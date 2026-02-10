<!-- devin-review-comment {"id": "ANALYSIS_pr-review-job-636bc5598ade4f209493a0c65d7dfe1f_0005", "file_path": ".agent/skills/gh-pr-conversation-resolver/scripts/resolve.py", "start_line": 97, "end_line": 100, "side": "RIGHT"} -->

🚩 **`resolve_thread` always prints success even if GraphQL mutation fails**

The `resolve_thread` function at `resolve.py:97-100` calls `run_graphql_query(query)` but does not check the return value. It unconditionally prints `Resolved thread {thread_id}` regardless of whether the mutation succeeded or `run_graphql_query` returned `None` (which happens on `CalledProcessError`). The new `--resolve-all` feature at lines 157-165 calls `resolve_thread` in a loop, so a batch resolve could silently report success for threads that failed to resolve. Compare with `reply_thread` at line 107 which correctly checks `if output:` before printing success.

*(Refers to lines 97-100)*

<!-- devin-review-badge-begin -->
<a href="https://app.devin.ai/review/lofi-monk/lofipulse/pull/16" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/assets/gh-open-in-devin-review-dark.svg?v=1">
    <img src="https://static.devin.ai/assets/gh-open-in-devin-review-light.svg?v=1" alt="Open in Devin Review">
  </picture>
</a>
<!-- devin-review-badge-end -->

---
*Was this helpful? React with 👍 or 👎 to provide feedback.*
