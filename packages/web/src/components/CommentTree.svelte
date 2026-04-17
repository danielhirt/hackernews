<script lang="ts">
  import type { CommentItem } from '@omnifeed/core'
  import CommentNode from './CommentNode.svelte'

  let {
    comments,
    depth = 0,
    focusPath = [],
    onfocus,
    onloadchildren,
    defaultCollapsed = false,
  }: {
    comments: CommentItem[]
    depth?: number
    focusPath?: string[]
    onfocus?: (id: string) => void
    onloadchildren?: (id: string) => Promise<void>
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
      {onloadchildren}
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
