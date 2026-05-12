# Telemetry worker

A Cloudflare Worker that aggregates anonymous telemetry beacons from the
reverse-colorblindness Pages site. Stores only counters in KV; no raw
request data, IPs, or per-session identifiers are persisted.

## Deploy

```bash
cd worker
pnpm install
pnpm wrangler login
pnpm wrangler kv namespace create COUNTERS
pnpm wrangler kv namespace create COUNTERS --preview
# paste the returned ids into wrangler.toml
pnpm run deploy
```

The deploy step prints a `*.workers.dev` URL. Set it as
`VITE_TELEMETRY_URL` in the GitHub Pages build environment (Settings ->
Secrets and variables -> Actions -> Variables) and the frontend will
start sending beacons. If the variable is unset, the frontend is a
no-op.

## What gets stored

KV keys are aggregate counters scoped by month:

- `event:<event_name>:YYYY-MM`
- `summary:score:<rg_bucket>:<by_bucket>:YYYY-MM`
- `summary:not_sure:<bucket>:YYYY-MM`
- `plate:<axis>:<deficiency>:<character>:<ratio_bucket>:<correct>:<choice>:YYYY-MM`

Per-axis score buckets are `0_2 | 3_5 | 6_8 | 9_12`. The `not_sure` count
can span 0-24 (one per plate in the battery) and uses
`0_2 | 3_5 | 6_8 | 9_12 | 13_18 | 19_24`. Ratio buckets are
`lt_1_5 | 1_5_2_0 | 2_0_2_5 | 2_5_plus`. Every value is whitelist-validated
inside the Worker; unknown or out-of-range inputs are silently dropped.

## Reading counters

```bash
pnpm wrangler kv key list --binding COUNTERS
pnpm wrangler kv key get --binding COUNTERS "event:test_completed:2026-05"
```

## What is intentionally not stored

- IP addresses, user agents, request ids, cf-* headers
- Per-session linkage between events or plate responses
- Timestamps finer than monthly bucket
- The Worker has `observability.enabled = false` so no per-request logs are emitted
