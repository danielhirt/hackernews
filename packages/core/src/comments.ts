import type { Comment, CommentItem } from './models.js'
import type { HnClient } from './client.js'

export function hnCommentToItem(comment: Comment, depth: number): CommentItem {
  return {
    id: `hn:${comment.id}`,
    source: 'hackernews',
    text: comment.text,
    author: comment.by,
    timestamp: comment.time,
    deleted: comment.deleted,
    dead: comment.dead,
    children: [],
    depth,
  }
}

export async function fetchHnCommentTree(
  client: HnClient,
  ids: number[],
  depth = 0,
  maxDepth = 10,
): Promise<CommentItem[]> {
  if (!ids.length || depth > maxDepth) return []

  const results = await Promise.all(ids.map((id) => client.fetchItem(id)))
  const items: CommentItem[] = []

  for (const result of results) {
    if (!result || !('parent' in result)) continue
    const comment = result as Comment
    if (comment.deleted || comment.dead) continue

    const item = hnCommentToItem(comment, depth)
    if (comment.kids?.length) {
      item.children = await fetchHnCommentTree(client, comment.kids, depth + 1, maxDepth)
    }
    items.push(item)
  }

  return items
}
