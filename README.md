## MAX TrustLine Bot

Node.js implementation of the MAX TrustLine whistleblowing bot described in `prdmax.md`. The service exposes a secure HTTPS webhook for MAX, persists all entities in SQLite, and drives both the reporter and reviewer flows through inline keyboards only.

### Capabilities
- Reporter wizard for selecting organization, category, entering a description, attachments, contact preference, and confirmation.
- Short ticket IDs with status lookup + follow-up replies that stay anonymous for reviewers.
- Reviewer verification via whitelist or access codes, reviewer inbox / in-progress / closed views, case actions, and bridged messaging back to reporters.
- Attachment metadata retention, audit log entries for every state transition, and RU user-facing copy per PRD.

### Requirements
- Node.js 20+ (Node 24.11.0 tested)
- MAX Bot token + HTTPS endpoint reachable by MAX

### Configuration
1. Copy `.env.example` to `.env` and fill in:
   - `BOT_TOKEN`, `WEBHOOK_URL`, `WEBHOOK_SECRET`
   - `MAX_API_BASE_URL` (sandbox/production)
   - `DB_URL` (e.g. `sqlite://data/trustline.db`)
2. Adjust JSON configs under `config/`:
   - `orgs.json`: organizations, optional category overrides
   - `reviewers-whitelist.json`: org_id → array of MAX user IDs
   - `access-codes.json`: fallback reviewer codes

On startup the service syncs these files into SQLite.

### Run
```bash
npm install
npm run dev
```
The server exposes:
- `POST /webhook/max` – MAX webhook endpoint (signed with `WEBHOOK_SECRET`)
- `GET /healthz` – basic health probe

When `WEBHOOK_URL` is set the service registers it with MAX automatically. Long polling can be added later by calling `MaxClient.fetchUpdates`.

### Project structure
- `src/config/` – env parsing + constants
- `src/db/` – SQLite connection, migrations, config sync
- `src/services/` – persistence helpers (cases, reviewers, sessions, audit)
- `src/bot/` – inline keyboards, localization, update handler
- `src/max/client.js` – MAX HTTP client wrapper

### Next steps / testing
- Point MAX dev bot webhook at `/webhook/max` and walk through the scenarios listed in `prdmax.md`.
- Use `npm run dev` locally with an ngrok/Cloudflared tunnel for manual verification.
