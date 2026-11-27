# 1-H-4-2 phase 1: sponsor CSS split

The original style.css and app.js are unchanged. Pages builds extract only the contiguous sponsor-specific block, including media rules and the sponsor animation. Mixed selectors, other features and shared rules remain in the initial stylesheet. Build fails on unexpected source boundaries, invalid reconstruction or non-improving raw/gzip/Brotli sizes.

The existing optional-asset loader requests the hashed club-sponsors.css only when rendering the sponsor tab. The cards wait for both JS and CSS; errors use the existing retry control. Postponed matches must not load the sponsor stylesheet. The downloaded stylesheet is reused.

The optional stylesheet is appended after the critical stylesheet, so its cascade position differs from the original. The Chromium regression compares computed sponsor styles with the original stylesheet across four profiles; it also checks no requests on home/overview, re-entry reuse, direct link and retry. This is a bounded regression check, not proof of identical styling in every browser/state. No CSS is deleted. Do not merge until CI passes and review any differences.

The existing CSS coverage audit measures the deployed style.css only, not club-sponsors.css; its reported size now represents the initial stylesheet. Build logs provide before/after/deferred sizes. Further coverage instrumentation for optional stylesheets is a separate task.

The first computed-style comparison identified a later shared .ti-card margin override (4px 0 14px). Retain the base .ti-sponsor-card rule at its original cascade position; all remaining eligible sponsor rules are deferred. Recheck computed parity and measure the revised savings before merge.
