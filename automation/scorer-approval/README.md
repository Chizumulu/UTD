# WhatsApp scorer approval

This is an opt-in bridge between the existing Chizumulu structured API and the UTD repository. It does not change the live ticker in `app.js`.

## Flow

1. Every 10 minutes, the Cloudflare Worker checks `/v1/structured?limit=40`.
2. It creates a proposal only for a completed match whose goal events identify both teams and whose scorer counts exactly match the final score.
3. The Worker sends a WhatsApp template message with **Approve**, **Reject**, and **Hold** quick replies.
4. Reject records the decision. Hold keeps the same proposal available so its buttons can be used later. Each proposal expires after 14 days.
5. Approve dispatches a GitHub Actions event. The action checks the fixture and score in `data.js`, adds the home and away scorer summaries, then commits the approved change directly to `main`.
6. The push triggers the repository's normal publish flow. If GitHub blocks a direct push because of branch rules, the action opens a PR instead; it never bypasses repository rules.

If a scorer is ambiguous, events are incomplete, teams cannot be matched uniquely, or the API goal count disagrees with the final score, no WhatsApp proposal is sent. The GitHub action also refuses ambiguous or mismatched fixtures.

## 1. Create and deploy the Worker

Install Wrangler and authenticate with the Cloudflare account that will host this service. From this directory:

```sh
npx wrangler kv namespace create UTD_APPROVALS
```

Copy the returned namespace ID into `wrangler.toml`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`. Then set the Worker secrets:

```sh
npx wrangler secret put META_VERIFY_TOKEN
npx wrangler secret put META_APP_SECRET
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_ADMIN_WA_ID
npx wrangler secret put WHATSAPP_TEMPLATE_NAME
npx wrangler secret put WHATSAPP_TEMPLATE_LANGUAGE
npx wrangler secret put WHATSAPP_GRAPH_URL
npx wrangler secret put APPROVAL_SIGNING_SECRET
npx wrangler secret put GITHUB_REPOSITORY
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

Use a random `APPROVAL_SIGNING_SECRET` of at least 32 characters. `WHATSAPP_GRAPH_URL` must be the Graph API base for the Meta API version enabled in your account, for example `https://graph.facebook.com/vXX.X`. `GITHUB_REPOSITORY` is `Chizumulu/UTD`. `GITHUB_TOKEN` must be a fine-grained token limited to this repository with **Contents: read and write** and **Pull requests: read and write** permissions. Add the same token as the GitHub Actions repository secret `SCORER_GITHUB_TOKEN`; the workflow uses it to commit the approved update and to open a PR if direct pushes are blocked.

The deployment URL will look like `https://utd-scorer-approval.<your-subdomain>.workers.dev`. Use its `/webhook` route as the Meta webhook callback URL and enter the same value set for `META_VERIFY_TOKEN` in Meta's webhook verification form. Subscribe the WhatsApp webhook to the `messages` field. The Worker validates Meta's `x-hub-signature-256` header and accepts button actions only from `WHATSAPP_ADMIN_WA_ID`.

## 2. Create the WhatsApp template

Create and get approval for a WhatsApp message template with:

- Three body text variables: match and score, scorer summary, proposal ID.
- Three quick reply buttons, in this order: **Approve**, **Reject**, **Hold**.

Set the matching template name and language using the Worker secrets above. The Worker fills the quick reply payloads for each proposal. Meta requires approved templates for business initiated notifications. The recipient must be able to receive the business message.

## 3. Enable the GitHub workflow

Merge the workflow and scripts from this branch first. GitHub only runs `repository_dispatch` workflows once the workflow exists on the default branch.

Add the same fine-grained token as a repository Actions secret named `SCORER_GITHUB_TOKEN`. The workflow uses it to check out and push the approved change. Keep its access limited to this repository.

## Decisions and retries

- **Approve** commits the change to `main` immediately when repository rules allow it. If a direct push is blocked, the workflow opens a PR for the required GitHub review.
- **Reject** records the rejection.
- **Hold** preserves the proposal for up to 14 days. Click Approve or Reject on that original WhatsApp message when ready.
- A team pair/date is deduplicated for 14 days to avoid repeated alerts. For a corrected API post after a decision, remove the `match:<key>` and `proposal:<id>` keys from the Worker KV namespace after reviewing the change.
- A protected `main` branch can reject the direct push when it requires a pull request, review, or status check. In that case the workflow creates a PR and leaves it open; it never bypasses those rules.
- If Actions fails to commit the data or open the fallback PR, inspect the run log. The action fails closed when the API teams do not uniquely match a fixture or the approved score conflicts with `data.js`.

## References

- [Meta WhatsApp interactive message templates](https://developers.facebook.com/docs/whatsapp/api/messages/message-templates/interactive-message-templates)
- [GitHub Actions events, including repository_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
