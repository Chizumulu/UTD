#!/usr/bin/env bash
# Keep dependency installation and browser download independently retryable.
set -euo pipefail
log_dir="${1:?installation log directory required}"
mkdir -p "$log_dir"
retry() {
  local label="$1" attempt status
  shift
  for attempt in 1 2 3; do
    echo "Installing $label: attempt $attempt/3"
    if "$@" 2>&1 | tee "$log_dir/$label-$attempt.log"; then
      echo "$label installed on attempt $attempt"
      return 0
    else
      status=$?
      echo "::warning::$label installation attempt $attempt failed (exit $status)"
      if (( attempt < 3 )); then sleep "$((attempt * 10))"; fi
    fi
  done
  echo "::error::$label installation exhausted all three attempts"
  return "$status"
}
retry dependencies timeout 120s npx --no-install playwright install-deps chromium
retry chromium timeout 120s npx --no-install playwright install chromium
node --input-type=module -e 'import {chromium} from "playwright"; const browser=await chromium.launch({headless:true}); try { console.log("Chromium launch verified:", browser.version()); } finally { await browser.close(); }' 2>&1 | tee "$log_dir/chromium-launch.log"
