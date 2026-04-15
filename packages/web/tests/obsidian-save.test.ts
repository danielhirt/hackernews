import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// The server module spawns Claude CLI which can't run in tests.
// Following the project convention (see summaries.test.ts, settings.test.ts),
// we reimplement the testable logic — validation and prompt construction —
// to verify the POST handler's behavior without needing child_process.
// ---------------------------------------------------------------------------

interface SaveRequest {
  title: string
  url?: string
  bodyText?: string
  summary: string
  source: string
  author: string
  tags?: string[]
}

// Reimplementation of the validation logic from +server.ts POST handler
function validateRequest(body: Record<string, unknown>):
  | { ok: true; data: SaveRequest }
  | { ok: false; status: number; message: string } {
  const { title, summary } = body as { title?: string; summary?: string }
  if (!title || !summary) {
    return { ok: false, status: 400, message: 'Missing title or summary' }
  }
  return { ok: true, data: body as unknown as SaveRequest }
}

// Reimplementation of buildPrompt from +server.ts
function buildPrompt(data: SaveRequest): string {
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

// Reimplementation of stream-json parsing from runClaude
function parseStreamJson(stdout: string): string | null {
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
  return lastText || null
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('obsidian-save request validation', () => {
  it('rejects when title is missing', () => {
    const result = validateRequest({ summary: 'A summary', source: 'hn', author: 'test' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.message).toBe('Missing title or summary')
    }
  })

  it('rejects when summary is missing', () => {
    const result = validateRequest({ title: 'A title', source: 'hn', author: 'test' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.message).toBe('Missing title or summary')
    }
  })

  it('rejects empty object', () => {
    const result = validateRequest({})
    expect(result.ok).toBe(false)
  })

  it('rejects empty string title', () => {
    const result = validateRequest({ title: '', summary: 'S' })
    expect(result.ok).toBe(false)
  })

  it('rejects empty string summary', () => {
    const result = validateRequest({ title: 'T', summary: '' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid request with title and summary', () => {
    const result = validateRequest({
      title: 'Test',
      summary: 'Summary',
      source: 'hn',
      author: 'user',
    })
    expect(result.ok).toBe(true)
  })

  it('accepts valid request with all optional fields', () => {
    const result = validateRequest({
      title: 'Test',
      summary: 'Summary',
      source: 'hn',
      author: 'user',
      url: 'https://example.com',
      bodyText: 'Full text',
      tags: ['a', 'b'],
    })
    expect(result.ok).toBe(true)
  })
})

describe('obsidian-save prompt construction', () => {
  it('includes title in prompt and note content', () => {
    const prompt = buildPrompt({
      title: 'My Article',
      summary: 'A great article.',
      source: 'hackernews',
      author: 'testuser',
    })
    expect(prompt).toContain('"My Article"')
    expect(prompt).toContain('# My Article')
  })

  it('includes url as link when provided', () => {
    const prompt = buildPrompt({
      title: 'Link Post',
      url: 'https://example.com/post',
      summary: 'Summary here.',
      source: 'hn',
      author: 'user',
    })
    expect(prompt).toContain('[Original post](https://example.com/post)')
  })

  it('includes bodyText when url is absent', () => {
    const prompt = buildPrompt({
      title: 'Text Post',
      bodyText: 'This is the full body text.',
      summary: 'Summary here.',
      source: 'hn',
      author: 'user',
    })
    expect(prompt).toContain('This is the full body text.')
    expect(prompt).not.toContain('[Original post]')
  })

  it('prefers url over bodyText when both present', () => {
    const prompt = buildPrompt({
      title: 'Both Post',
      url: 'https://example.com',
      bodyText: 'Should not appear',
      summary: 'Summary',
      source: 'hn',
      author: 'user',
    })
    expect(prompt).toContain('[Original post](https://example.com)')
    expect(prompt).not.toContain('Should not appear')
  })

  it('omits link and body when neither url nor bodyText provided', () => {
    const prompt = buildPrompt({
      title: 'Minimal Post',
      summary: 'Just a summary.',
      source: 'hn',
      author: 'user',
    })
    expect(prompt).not.toContain('[Original post]')
    expect(prompt).toContain('# Minimal Post')
    expect(prompt).toContain('## AI Summary')
    expect(prompt).toContain('Just a summary.')
  })

  it('includes summary in AI Summary section', () => {
    const prompt = buildPrompt({
      title: 'Test',
      summary: 'This is the AI-generated summary.',
      source: 'hn',
      author: 'user',
    })
    expect(prompt).toContain('## AI Summary\n\nThis is the AI-generated summary.')
  })

  it('includes source in tag list', () => {
    const prompt = buildPrompt({
      title: 'Test',
      summary: 'Summary',
      source: 'hackernews',
      author: 'user',
    })
    expect(prompt).toContain('tags including: hackernews')
  })

  it('includes additional tags in tag list', () => {
    const prompt = buildPrompt({
      title: 'Test',
      summary: 'Summary',
      source: 'lobsters',
      author: 'user',
      tags: ['rust', 'performance'],
    })
    expect(prompt).toContain('tags including: lobsters, rust, performance')
  })

  it('handles empty tags array', () => {
    const prompt = buildPrompt({
      title: 'Test',
      summary: 'Summary',
      source: 'hn',
      author: 'user',
      tags: [],
    })
    expect(prompt).toContain('tags including: hn')
  })

  it('includes author', () => {
    const prompt = buildPrompt({
      title: 'Test',
      summary: 'Summary',
      source: 'hn',
      author: 'jsmith',
    })
    expect(prompt).toContain('Author: jsmith')
  })

  it('includes default Obsidian vault location', () => {
    const prompt = buildPrompt({
      title: 'Test',
      summary: 'Summary',
      source: 'hn',
      author: 'user',
    })
    expect(prompt).toContain('008 Resources/Omnifeed/')
  })

  it('instructs to use notetaker skill', () => {
    const prompt = buildPrompt({
      title: 'Test',
      summary: 'Summary',
      source: 'hn',
      author: 'user',
    })
    expect(prompt).toContain('/notetaker')
  })
})

describe('obsidian-save stream-json parsing', () => {
  function assistantLine(text: string): string {
    return JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text }] },
    })
  }

  it('extracts text from single assistant message', () => {
    const result = parseStreamJson(assistantLine('Note saved successfully'))
    expect(result).toBe('Note saved successfully')
  })

  it('extracts last assistant text from multiple messages', () => {
    const stdout = [
      assistantLine('First response'),
      assistantLine('Second response'),
      assistantLine('Final response'),
    ].join('\n')
    expect(parseStreamJson(stdout)).toBe('Final response')
  })

  it('ignores non-assistant message types', () => {
    const stdout = [
      JSON.stringify({ type: 'system', message: 'init' }),
      assistantLine('Real response'),
      JSON.stringify({ type: 'tool_use', name: 'Write' }),
    ].join('\n')
    expect(parseStreamJson(stdout)).toBe('Real response')
  })

  it('returns null for empty stdout', () => {
    expect(parseStreamJson('')).toBeNull()
  })

  it('returns null when no assistant messages found', () => {
    const stdout = JSON.stringify({ type: 'system', message: 'no assistants here' })
    expect(parseStreamJson(stdout)).toBeNull()
  })

  it('skips malformed JSON lines', () => {
    const stdout = [
      'not json at all',
      assistantLine('Valid response'),
      '{broken json',
    ].join('\n')
    expect(parseStreamJson(stdout)).toBe('Valid response')
  })

  it('trims whitespace from extracted text', () => {
    const result = parseStreamJson(assistantLine('  padded text  '))
    expect(result).toBe('padded text')
  })

  it('handles assistant message with no text blocks', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Write' }] },
    })
    expect(parseStreamJson(line)).toBeNull()
  })

  it('handles assistant message with empty content array', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [] },
    })
    expect(parseStreamJson(line)).toBeNull()
  })

  it('handles blank lines in output', () => {
    const stdout = '\n\n' + assistantLine('Response') + '\n\n'
    expect(parseStreamJson(stdout)).toBe('Response')
  })
})
