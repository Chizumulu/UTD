# Lighthouse comparison

Use Actions → UTD Lighthouse comparison → Run workflow. Select a full baseline commit SHA, optionally a candidate SHA (defaults to the selected revision), and 1, 3 or 5 runs per device and revision. The default baseline is the revision immediately before the 1-H-2 JavaScript split. Pull requests modifying the benchmark itself run the same comparison automatically.

The workflow builds both revisions using their own Pages build scripts in detached worktrees on the same runner. It serves both under /UTD/ with local static HTTP servers, uses Lighthouse's mobile and desktop presets with simulated throttling, alternates baseline/candidate order, and starts a fresh browser for each audit. Default: 12 audits, 3 samples per device and revision. External analytics/push URL patterns are blocked. Other external resources may vary. Local server transfer is not production CDN transfer; gzip/Brotli numbers are independently computed asset sizes, not evidence of live CDN encoding.

Results appear in the Actions job summary and the lighthouse-comparison artifact (30 days): individual Lighthouse JSON/HTML, comparison.json, comparison.md and server logs. Compare medians, not the fastest single run. Lower timing/transfer values and higher score are usually desirable. A percentage is unavailable for a zero baseline. The asset inventory includes optional JS/CSS and is not the initial page's total download size.

The workflow is read-only and does not publish or alter Pages. Missing metrics, build failures or failed audits fail the comparison. Performance differences are informational rather than a merge threshold. Lab results do not measure real-user INP or field Core Web Vitals. The default run count is deliberately small; use five for noisier comparisons.
