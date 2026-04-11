<script lang="ts">
  import type { CommentItem } from '@hackernews/core'
  import CommentNode from './CommentNode.svelte'

  let {
    comments,
    depth = 0,
    focusPath = [],
    onfocus,
    defaultCollapsed = false,
  }: {
    comments: CommentItem[]
    depth?: number
    focusPath?: string[]
    onfocus?: (id: string) => void
    defaultCollapsed?: boolean
  } = $props()
</script>

<div class="comment-tree">
  {#each comments as comment (comment.id)}
    <CommentNode
      {comment}
      {depth}
      {focusPath}
      {onfocus}
      {defaultCollapsed}
    />
  {/each}
</div>

<style>
  .comment-tree {
    display: flex;
    flex-direction: column;
  }
</style>
