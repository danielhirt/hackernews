import { spawn } from 'node:child_process'
import type { RequestHandler } from './$types'

const CLAUDE_TIMEOUT_MS = 120_000

function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const proc = spawn('claude', [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/tmp',
      env: {
        ...process.env,
        PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:' + (process.env.HOME ?? '') + '/.local/bin',
      },
    })

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        proc.kill()
        reject(new Error('Obsidian save timed out'))
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

      // Parse stream-json to extract the last assistant text response.
      // The notetaker skill may produce multiple turns, so we want the final one.
      let lastText = ''
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.type !== 'assistant') continue
          const blocks = event.message?.content
          if (!Array.isArray(blocks)) continue
          for (const block of blocks) {
            if (block.type === 'text' && block.text) {
              lastText = block.text.trim()
            }
          }
        } catch {
          // skip malformed lines
        }
      }

      if (lastText) {
        resolve(lastText)
      } else {
        reject(new Error(stderr.trim() || 'No response from Claude'))
      }
    })

    proc.on('error', (err: Error) => {
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

function buildPrompt(data: {
  title: string
  url?: string
  bodyText?: string
  summary: string
  source: string
  author: string
  tags?: string[]
}): string {
  let noteContent = `# ${data.title}\n\n`

  if (data.url) {
    noteContent += `[Original post](${data.url})\n\n`
  } else if (data.bodyText) {
    noteContent += `${data.bodyText}\n\n`
  }

  noteContent += `## AI Summary\n\n${data.summary}\n`

  const tagList = [data.source, ...(data.tags ?? [])].join(', ')

  return `Use the /notetaker skill to write the following note to my Obsidian vault. The note title should be "${data.title}". Add relevant tags including: ${tagList}. Author: ${data.author}.

Default location: 008 Resources/Omnifeed/ (use this unless a better spot in the vault is found).

Here is the note content to save:

${noteContent}

After writing the note, briefly confirm where it was saved.`
}

export const POST: RequestHandler = async ({ request }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const { title, url, bodyText, summary, source, author, tags } = body as {
    title: string
    url?: string
    bodyText?: string
    summary: string
    source: string
    author: string
    tags?: string[]
  }

  if (!title || !summary) {
    return new Response('Missing title or summary', { status: 400 })
  }

  const prompt = buildPrompt({ title, url, bodyText, summary, source, author, tags })

  try {
    const result = await runClaude(prompt)
    return new Response(JSON.stringify({ success: true, message: result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
