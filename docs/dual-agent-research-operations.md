# Daily dual-agent research: operation and approval boundary

## Status

This is an **opt-in, not-yet-activated** pipeline. It does not send Telegram messages until all credentials exist and the repository variable DUAL_RESEARCH_ENABLED is set to true. A dry review of code or a passing CI test does not imply that two real agents have already investigated the market.

Architecture:

1. Existing `Source Scan` runs daily (currently 06:15 UTC) and captures comparable official-source changes. It is a candidate generator, not a proof engine.
2. After a successful Source Scan, `Daily Dual-Agent Research` builds one immutable research snapshot for both agents. It rotates up to four companies per industry per day, while tracking available official-source freshness. Source coverage is limited to `data/source-watchlist.json`, not the entire industry internet.
3. Independent Claude Code and Codex jobs see the same snapshot in separate GitHub runners. Neither is given the other model's assessment.
4. The deterministic reconciliation step rejects wrong event IDs, wrong targets, changed source URLs, fabricated excerpts, low-confidence material verdicts, or different change types/evidence passages. Agreeing outputs are classified **consensus_candidate**, never "verified".
5. Telegram notification sends at most once per consensus event and links to the Research Desk for inspection. Notification state is stored separately for deduplication.
6. Research Desk shows both opinions, the source excerpt, provenance, missing coverage, and a link to the original evidence.
7. **Only a human-approved, schema-validated patch may change `data/industries.json`.** Existing export -> Apply Review / Approve And Promote -> GitHub Pages deployment is retained.

## Prerequisites (GitHub repository Settings → Secrets and variables → Actions)

Repository secrets:
- `OPENAI_API_KEY`: required by the Codex GitHub Action. A ChatGPT subscription alone is not an API key.
- `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`: required by Claude Code GitHub Action. Confirm your Claude plan and provider terms.
- `TELEGRAM_BOT_TOKEN`: secret belonging to the Telegram bot; **rotate any token ever pasted into chat or checked into source**.
- `TELEGRAM_CHAT_ID`: Telegram recipient ID. Start a conversation with the bot first.

Repository variable:
- `DUAL_RESEARCH_ENABLED` = `true` to opt in to daily analysis costs and alerts.

Trigger manually from Actions → Daily Dual-Agent Research → Run workflow after configuration, or wait for the next successful Source Scan. This workflow is not scheduled independently: it is chained to the existing daily scan to avoid analyzing pre-scan data. GitHub scheduling may be delayed and externally hosted APIs can fail; inspect Actions failures.

## Safety and validity limits

- The models independently interpret **the same monitored evidence**, which can have shared collection errors. Their agreement is not independent corroboration by two different primary sources.
- The current source monitor does not cover all upstream tiers or all companies. A missing alert does not mean nothing important happened.
- Most candidate events are webpage-content differences. Marketing changes, non-comparable snapshots, stale captures, and unsupported interpretations must not trigger a graph update.
- The action **does not write industry graph data**, does not trade, and cannot approve or publish evidence on the user's behalf.
- No alerts on disagreement or failed agent execution. The source scanner and current review functionality are retained.
- The notification ledger only records successful Telegram sends. It must not contain tokens.

## The remaining requirement: one-click approval *inside* the website

GitHub Pages is a static frontend. Today its Approve button stores a local decision; it **does not** authenticate the user or write to GitHub. The Research Desk includes a link to the existing protected GitHub approval workflow, where the user currently exports the reviewed JSON and explicitly executes `Approve And Promote`.

To implement the requested one-click web approval, deploy a separate authenticated service (for example a Cloudflare Worker or a small server). Required security architecture:

1. OAuth-login as the explicitly allowlisted GitHub owner; enforce CSRF / state, secure short-lived sessions and rate limits. Never distribute a GitHub write token to the browser.
2. Frontend sends the review **event ID**, intended decision, and human-verification worksheet to the service.
3. Server re-fetches immutable candidate source data from the repository, confirms the recorded consensus evidence, checks an exact repository revision / compare-and-swap and the current event status, and validates the worksheet and patch paths. Never trust a client-supplied full database patch.
4. Server triggers `Approve And Promote` using a server-side GitHub App installation token (or protected equivalent), only after explicit owner confirmation. Reject replayed/expired events.
5. The existing validation and promotion workflow updates `data/industries.json`, and GitHub Pages deploys that commit. The website must display a pending deployment status, not claim instant success.
6. Log approval actor, timestamp, event ID, source references, previous/new graph versions and workflow run URL. Provide rollback via `data/industries.previous.json`.

**This authenticated service is not deployed in the present change.** Do not represent local browser approval as publication. Do not remove the manual GitHub approval guard until backend authentication and audit tests are complete.

## Files

- `scripts/build-daily-research.mjs`: daily focus and evidence snapshot (source freshness + recent comparable events)
- `scripts/dual-agent-output.schema.json`: shared machine-readable model contract
- `scripts/reconcile-dual-research.mjs`: deterministic fail-closed consensus classifier
- `scripts/telegram-dual-alerts.mjs`: deduplicated notifications with browser deep links
- `dual-review-ui.js` and `dual-review-ui.css`: Research Desk provenance UI
- `.github/workflows/dual-agent-research.yml`: after-scan independent agent jobs
- `tests/dual-agent-research.test.mjs`: regression tests
- `data/dual-agent-reviews.json`: public audit summary, initially empty

## Monitoring and rollback

Watch the `Source Scan`, `Daily Dual-Agent Research`, `Validate Research Data`, `Approve And Promote`, and Pages workflows. For any excessive alert frequency or unexpected candidate, set `DUAL_RESEARCH_ENABLED` to `false` before editing source monitors. Keep secrets rotated and review the cost and token budgets regularly.
