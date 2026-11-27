# Approval publication tracking (phase 1)

Four repository_dispatch approval workflows (league scorers, FA Cup scorers, forfeits, Instagram lineups) upload a small run receipt after a successful data-writing job. Receipts contain run ID/attempt, branch, commit, and public data.js checksum; no approval payload or credentials.

Pages build emits publication.json with the deployed source commit and data.js SHA-256. A separate scheduled monitor checks recent approval runs, receipts, exact PR branch/head, merged commit ancestry, deployed commit ancestry, and downloaded public data.js checksum. A later deployment containing an earlier commit proves historical inclusion, not that every field still equals the old approval after subsequent edits. A direct publication of the exact receipt commit also requires matching receipt checksum. This does not verify browser rendering.

Enabled using existing UTD_HEALTH_MONITOR_ENABLED=true; no new secrets. Scan starts when this script first appears on main, and covers up to seven days, maximum 100 runs per workflow. Run delays >=2 hours, failures/missing receipts >=30 minutes, unmerged PRs >=24 hours, and unverified deployment >=1 hour create one GitHub Issue per run. Open PR review remains required; no automatic merge or retry is added. A verified run closes its incident. Older unresolved incidents remain open for manual inspection.

Limitations: does not see approvals that never produced a GitHub run, skipped dispatches, or individual field changes overwritten by later commits. API/cache or artifact errors fail the monitoring workflow; inspect its logs. No Worker changes. Scheduled GitHub execution can be delayed. Manual run after Pages deployment recommended.
