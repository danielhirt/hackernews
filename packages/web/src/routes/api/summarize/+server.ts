import { spawn } from 'node:child_process'
import { HnClient, type Story, type Comment } from '@omnifeed/core'
import type { RequestHandler } from './$types'

const MAX_COMMENTS = 30
const MAX_ARTICLE_CHARS = 8000

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchArticleText(url: string, fetchFn: typeof fetch): Promise<string> {
  try {
    const res = await fetchFn(url, {
      headers: { 'User-Agent': 'HN-Reader-Summarizer/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ''
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return ''
    const html = await res.text()
    const text = stripHtml(html)
    return text.slice(0, MAX_ARTICLE_CHARS)
  } catch {
    return ''
  }
}

async function fetchCommentTree(client: HnClient, ids: number[], depth = 0): Promise<Comment[]> {
  if (!ids.length || depth > 1) return []
  const items = await Promise.all(ids.map((id) => client.fetchItem(id)))
  const comments: Comment[] = []
  for (const item of items) {
    if (!item || !('parent' in item) || item.deleted || item.dead) continue
    const comment = item as Comment
    comments.push(comment)
    if (comment.kids?.length && comments.length < MAX_COMMENTS) {
      const children = await fetchCommentTree(client, comment.kids.slice(0, 5), depth + 1)
      comments.push(...children)
    }
    if (comments.length >= MAX_COMMENTS) break
  }
  return comments.slice(0, MAX_COMMENTS)
}

function buildGenericPrompt(
  title: string,
  text: string | undefined,
  articleText: string,
  comments: { author: string; text: string }[],
): string {
  let context = `Summarize this post. Follow the format rules from your system prompt exactly.\n\nTitle: ${title}\n`

  if (text) {
    context += `\nPost text:\n${text}\n`
  }

  if (articleText) {
    context += `\nLinked article content:\n${articleText}\n`
  }

  if (comments.length > 0) {
    context += `\nTop comments:\n`
    for (const c of comments) {
      context += `- ${c.author}: ${c.text}\n`
    }
  }

  return context
}

function buildPrompt(story: Story, articleText: string, comments: Comment[]): string {
  let context = `Summarize this post. Follow the format rules from your system prompt exactly.\n\nTitle: ${story.title}\nBy ${story.by} | ${story.score} points | ${story.descendants ?? 0} comments\n`

  if (story.text) {
    context += `\nPost text:\n${stripHtml(story.text)}\n`
  }

  if (articleText) {
    context += `\nLinked article content:\n${articleText}\n`
  }

  if (comments.length > 0) {
    context += `\nTop comments:\n`
    for (const c of comments) {
      context += `- ${c.by}: ${stripHtml(c.text)}\n`
    }
  }

  return context
}

const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
}

const CLAUDE_TIMEOUT_MS = 90_000
const SUMMARIZER_SYSTEM_PROMPT = `You summarize technical posts and discussions. Output only the summary, nothing else. No preamble, no sign-off.

FORMAT RULES (follow exactly):
- Never use headings (#, ##, ###). Use **Bold Label** on its own line to start each section.
- Never use horizontal rules (---).
- Never repeat the post title.
- Use exactly these sections in order:
  1. **Overview** — 2-3 sentence summary of what the post/article covers.
  2. **Key Points** — 3-6 bullet points. One line each, no sub-bullets.
  3. **Discussion** — 2-4 bullet points summarizing notable comment perspectives. Only include this section if comments were provided.
- Use plain bullet points (- ), no bold prefixes on individual bullets.
- Keep the total summary under 200 words.`

function runClaude(prompt: string, model = 'sonnet'): Promise<string> {
  const modelId = MODEL_MAP[model] ?? MODEL_MAP.sonnet
  return new Promise((resolve, reject) => {
    let settled = false
    const proc = spawn('claude', [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', modelId,
      '--tools', '',
      '--system-prompt', SUMMARIZER_SYSTEM_PROMPT,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/tmp',
      env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:' + (process.env.HOME ?? '') + '/.local/bin' },
    })

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        proc.kill()
        reject(new Error('Summary generation timed out'))
      }
    }, CLAUDE_TIMEOUT_MS)

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

    proc.on('close', () => {
      clearTimeout(timer)
      if (settled) return
      settled = true

      // Parse stream-json lines to extract the first assistant text response,
      // ignoring any subsequent turns injected by hooks.
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.type !== 'assistant') continue
          const blocks = event.message?.content
          if (!Array.isArray(blocks)) continue
          for (const block of blocks) {
            if (block.type === 'text' && block.text) {
              resolve(block.text.trim())
              return
            }
          }
        } catch {
          // skip malformed lines
        }
      }

      reject(new Error(stderr.trim() || 'No summary text in response'))
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(err)
      }
    })

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}

async function runClaudeWithRetry(prompt: string, model = 'sonnet', retries = 1): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await runClaude(prompt, model)
    } catch (err) {
      if (attempt === retries) throw err
      // Brief pause before retry
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error('Unreachable')
}

export const POST: RequestHandler = async ({ request, fetch: skFetch }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const { storyId, model } = body as { storyId?: number; model?: string }

  // Generic mode: caller passes data directly (for non-HN sources)
  const itemTitle = body.title as string | undefined
  if (itemTitle && !storyId) {
    const itemUrl = body.url as string | undefined
    const itemText = body.text as string | undefined
    const itemComments = (body.comments ?? []) as { author: string; text: string }[]

    const articleText = itemUrl ? await fetchArticleText(itemUrl, skFetch) : ''
    const prompt = buildGenericPrompt(itemTitle, itemText, articleText, itemComments)

    try {
      const result = await runClaudeWithRetry(prompt, model)
      return new Response(result, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return new Response(message, { status: 502 })
    }
  }

  if (!storyId) {
    return new Response('Missing storyId or title', { status: 400 })
  }

  const client = new HnClient(skFetch)

  let story: Story
  try {
    const item = await client.fetchItem(storyId)
    if (!item || !('title' in item)) {
      return new Response('Story not found', { status: 404 })
    }
    story = item as Story
  } catch {
    return new Response('Failed to fetch story from HN', { status: 502 })
  }

  const [articleText, comments] = await Promise.all([
    story.url ? fetchArticleText(story.url, skFetch) : Promise.resolve(''),
    story.kids?.length ? fetchCommentTree(client, story.kids.slice(0, 15)) : Promise.resolve([]),
  ])

  const prompt = buildPrompt(story, articleText, comments)

  try {
    const result = await runClaudeWithRetry(prompt, model)
    return new Response(result, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(message, { status: 502 })
  }
}
