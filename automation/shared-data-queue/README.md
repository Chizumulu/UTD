# Shared data publication queue

The following production writers use the same Actions concurrency group, `approved-scorer-proposals-main`, with `queue: max`:

- league scorer approval
- FA Cup scorer approval
- FA Cup result and schedule sync
- league fixture date sync
- forfeit approval
- Instagram lineup approval
- YouTube highlight publish job

The YouTube PR validation job does not take the write lock. Checkout of main in these writers occurs after acquiring the group. Existing approval rules, retries, direct push or recovery PR behavior are unchanged. No force push, automatic conflict resolution, or automatic approval of recovery PRs is introduced.

The queue serializes these runs, not manual edits or subsequent merge of previously opened PRs. GitHub's queue is bounded; a canceled or failed run still requires inspection. Existing open PR conflicts are not automatically resolved. The next phase will address end-to-end tracking of publication and failures.

Run the concurrency policy test with `node --test scripts/data-write-queue.test.mjs`.
