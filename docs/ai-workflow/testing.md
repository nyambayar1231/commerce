# Browser QA with the tester agent

A local copy of the whole shop (the **QA environment**) and an OpenCode **tester** agent that walks
it in the owner's Chrome and writes a report; the lead (Claude Code) reviews the report and
re-checks every failure itself. Asked for by the owner on 2026-11-27 to catch what unit and e2e
tests miss (e.g. production had no delivery methods, so checkout stopped after the address).

## The QA environment

```sh
scripts/test-env/start.sh   # recreate commerce_qa_e2e, seed, start everything (~20 s, longer on a cold build)
scripts/test-env/stop.sh    # stop it (only the processes it started)
```

| Service | Address |
|---|---|
| Storefront (production build) | http://localhost:3113 |
| Dashboard | http://localhost:5283 — staff `e2e-staff@example.com` / `e2e-staff-password-0123` (test values) |
| API | http://localhost:4110/graphql |
| Fake Wire (QPay) payment page | http://localhost:4199 — "Pay with QPay" / "Cancel", both notify the API like Wire |
| Mailpit | http://localhost:8026 |

Its own database and ports, so it runs next to the dev servers and `pnpm e2e`. Seeded: the demo
categories and delivery methods, three QA products, the staff account. Logs: `.ai/test-env/logs/`.

## A run

1. `scripts/test-env/start.sh`.
2. Brief: copy `prompts/test.md` to `.ai/briefs/<name>.md`, pick the journeys from
   [test-plan.md](test-plan.md) (all, or the ones a change touches), add anything specific.
3. `scripts/ai/spawn.sh <name> .ai/briefs/<name>.md --role tester --cwd .` — the tester runs on
   `OC_MODEL_IMPLEMENT` (DeepSeek V4.1 Flash) unless `--model` says otherwise.
4. The tester writes `.ai/test-reports/<date>.md`. The lead reads it, reproduces each FAIL (in the
   QA environment or with a test), sorts real bugs from test mistakes, and reports to the owner.
5. `scripts/test-env/stop.sh`.

## The tester's limits (`.opencode/agents/tester.md`)

Only the QA addresses above; test values only (the QA staff password is the only one it may type,
on the dashboard); writes only `.ai/test-reports/`; shell limited to `curl` on the QA health and
Mailpit API; no code, git, Docker or other sites. It changes nothing but what a journey creates.
