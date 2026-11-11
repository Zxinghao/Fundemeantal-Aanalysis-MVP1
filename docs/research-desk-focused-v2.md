# Research Desk v2 — focused daily research and owner-nominated graph candidates

## What changes

The default Research Desk is intentionally limited to **two vertical sections**:

1. **Dual Agents (top):** last actual execution date, registered industries and companies, verified coverage status, candidate count. Expand only when inspecting Claude/Codex company-by-company reports, disagreements or evidence.
2. **Industry & company messages (below):** monitored source changes and research candidates. Each card includes a collapsed **Add annotation / Nominate for Dual Agents** form. Existing approval tools are folded under an advanced disclosure; scanner health and manual evidence submission are folded under **More tools**.

The graph is never changed by these steps. Candidate means **requires independent verification**.

## Daily scan coverage — no 4-company cap

\`Source Scan\` runs daily; it now checks **all configured daily and weekly official source URLs every day**. Four previously unmonitored companies have been added: Toray, Toyota, Ballard and InnoLight. Together with existing sources this covers all 17 company records across the current two industries.

\`build-daily-research.mjs\` includes every industry and every registered company in the daily brief. Both agents must return a structured \`industryChecks\` record for every industry and \`companyChecks\` for every company. The reconcile step fails closed if even one record is missing or if a stale/unmonitored source is marked as current.

**Coverage does not imply independent web discovery.** The deterministic collector visits configured official pages; Claude Code and Codex independently evaluate those snapshots. This does not guarantee discovery of every market news item, and their conclusions can share collection errors. Rate limits, stale pages and broken links remain explicit coverage gaps.

The previous 4-company rotation and 6-recent-event hard limits are removed. For unusual event spikes, further batch-size/cost controls may be needed before live activation.

## Human message annotation to AI review

1. Open Research Desk and select an industry.
2. Under a message, expand **添加批注 / 加入 Dual Agents 分析**.
3. Enter an evidence-based note (at least 10 characters), set its proposed graph-change type:
   - Update company information
   - Update existing node
   - Propose a new node
   - Propose or remove a relationship
   - Revise a relationship
4. Choose existing target company or nodes and provide the original source URL.
5. **保存批注** stores a draft only in the current browser. **加入 Dual Agents 分析** opens a prefilled GitHub issue.
6. Log in to the repository-owner GitHub account and click **Submit new issue**. Only then is the nomination sent to the backend. GitHub issue text is public in this public repository: do not include private notes.
7. \`Research Nomination Intake\` accepts only the exact owner, validates fields, canonical IDs, and any referenced scanner event/source URL, then commits an **unverified** record to \`data/manual-research-requests.json\`.
8. After a successful intake, \`Daily Dual-Agent Research\` is eligible to run (only when \`DUAL_RESEARCH_ENABLED=true\` and provider secrets are configured). It evaluates the nomination as a candidate. If the nomination is linked to a comparable official scanner event, those original excerpts are preserved; otherwise the nomination has no verified excerpts and cannot pass material-consensus validation.

This GitHub Issue confirmation is an interim secure handoff, **not yet a seamless one-click backend**. GitHub Pages alone cannot securely hold the tokens required to write repository data.

## Human approval and graph mutation remain separately protected

No AI job can write to \`data/industries.json\`. Existing \`Approve And Promote\` must still be run after reviewing a schema-validated patch.

The current patch engine supports changes to existing companies, scores, and node descriptions. **Adding/removing nodes or relationships is not yet implemented in the canonical patch executor**. Such proposals are research candidates only, not currently executable modifications. Finish an authenticated approval service and extend canonical graph operation validation and rollback before promising one-click updates of lines.

## Activation and credentials

Existing secrets: \`OPENAI_API_KEY\`, \`ANTHROPIC_API_KEY\` or \`CLAUDE_CODE_OAUTH_TOKEN\`, \`TELEGRAM_BOT_TOKEN\`, \`TELEGRAM_CHAT_ID\`. Existing repo variable \`DUAL_RESEARCH_ENABLED=true\` opts into model costs.

Do not enable without verifying both model actions, Telegram delivery, rate limits, and total daily costs. Rotate any bot token previously shared in chat.

## Regression checks

- Every registered company has an official monitor.
- Both independent model outputs cover every registered company and industry.
- Unverified nominations remain unverified; model agreement alone does not commit graph data.
- Owner-only intake rejects source spoofing, invalid targets, unsupported operations, and untrusted issue authors.
- Telegram sends only for a fresh, source-supported dual-consensus candidate and records sent IDs to suppress duplicates.
