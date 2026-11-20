<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Central reports reuse existing report states and tables; mutations use authenticated transactional RPCs so the database enforces permissions and evidence.
- New report files use validated server staging in a private dedicated bucket, metadata-linked transactionally; failed staging is retained with a failed status for reconciliation instead of silently deleting evidence.
- Individual participation responses are append-only and visible only to their author and managers; participation never creates an adjudicated responsibility automatically.
- Investigation evidence, conclusion and adjudicated persons have no authenticated column SELECT grants; manager-scoped RPCs return them, while report views use explicit non-private legacy columns.
- Report validation requires a manager different from the correction author to separate correction from approval.
