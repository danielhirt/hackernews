import type { RequestHandler } from './$types'

const LOBSTERS_BASE = 'https://lobste.rs'

export const GET: RequestHandler = async ({ url, fetch: skFetch }) => {
  const path = url.searchParams.get('path')
  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }

  try {
    const res = await skFetch(`${LOBSTERS_BASE}${path}`, {
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) {
      return new Response(`Lobsters API error: ${res.status}`, { status: res.status })
    }

    const data = await res.text()
    return new Response(data, {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response('Failed to fetch from Lobsters', { status: 502 })
  }
}
