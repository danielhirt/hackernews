<script lang="ts">
  import type { CommentItem } from '@hackernews/core'
  import CommentNode from './CommentNode.svelte'

  let {
    comments,
    depth = 0,
    focusPath = [],
    onfocus,
  }: {
    comments: CommentItem[]
    depth?: number
    focusPath?: string[]
    onfocus?: (id: string) => void
  } = $props()
</script>

<div class="comment-tree">
  {#each comments as comment (comment.id)}
    <CommentNode
      {comment}
      {depth}
      {focusPath}
      {onfocus}
    />
  {/each}
</div>

<style>
  .comment-tree {
    display: flex;
    flex-direction: column;
  }
</style>
