# EFM &amp; AFS — 4PL CRM

A control-tower CRM for the **EFM** and **AFS** fourth-party-logistics (4PL) brands.
It unifies the three things a 4PL customer-service and commercial team need in one
place — **case management**, a **sales pipeline**, and **account management** — and wires
them to live shipment telemetry so the desk works *proactively*.

The centrepiece is the **efmAPP status-event feed**: as the efmAPP emits consignment
milestones (picked-up, in-transit, customs-hold, delivered …), each event flows into the
CRM and any **exception automatically raises a customer-service case**, routed to an agent
with an SLA clock already running. Agents stop chasing spreadsheets and start the day with
the exceptions already triaged.

---

## Highlights

| Capability | What it does |
|---|---|
| **efmAPP ingestion** | `POST /api/events/efmapp` accepts status milestones; exceptions auto-create linked, prioritised cases and update the shipment timeline. |
| **Case management** | Full CS desk: priority, category, status, assignee, SLA tracking (with breach detection), notes and an activity timeline. |
| **Sales pipeline** | Drag-and-drop Kanban across stages with weighted forecast (stage × probability). |
| **Account management** | 360° account view — health/tier, contacts, open cases, deals, shipments and a logged interaction history. |
| **Shipments** | Consignment register with live status, ETA and full efmAPP event timeline per shipment. |
| **Dashboard** | KPIs (open cases, SLA breaches, exceptions today, pipeline value…), SLA watch-list and a live event feed. |
| **Dual-brand** | Everything filters by EFM / AFS from the sidebar. |

---

## Quick start

```bash
npm install
npm run seed      # load realistic EFM & AFS demo data
npm start         # http://localhost:3000
```

Then, in a second terminal, watch cases auto-raise as efmAPP events stream in:

```bash
npm run simulate                       # a burst of synthetic status events
node server/simulate.js --count 20 --interval 800
```

You can also fire a single event from the UI (**⚡ Simulate efmAPP event**) or via curl:

```bash
curl -X POST http://localhost:3000/api/events/efmapp \
  -H 'content-type: application/json' \
  -d '{"shipmentRef":"AFS-CON-40118","brand":"AFS","status":"customs-hold","location":"Chicago, IL","note":"Docs review"}'
```

A `customs-hold` / `damaged` / `delayed` / `failed-delivery` / `lost` / `exception` status
raises a case; anything else just updates the shipment.

---

## efmAPP event contract

```jsonc
POST /api/events/efmapp
{
  "shipmentRef": "AFS-CON-40118",   // required — matches a shipment reference
  "status":      "customs-hold",    // required — see statuses below
  "brand":       "AFS",             // EFM | AFS (defaults from the shipment)
  "location":    "Chicago, IL",
  "carrier":     "AirBridge",
  "eta":         "2026-07-27T00:00:00Z",
  "note":        "Documentation review",
  "occurredAt":  "2026-07-25T03:00:00Z"
}
```

`POST /api/events/efmapp/batch` accepts `{ "events": [ … ] }` for sync jobs.

**Statuses** — `booked · picked-up · in-transit · at-hub · out-for-delivery · delivered ·
pod-captured` and the exception set `delayed · exception · customs-hold · damaged ·
failed-delivery · lost · returned`.

**Exception → case mapping**

| Status | Category | Priority |
|---|---|---|
| `damaged`, `lost` | damage / lost-freight | **urgent** |
| `exception`, `customs-hold`, `failed-delivery` | delivery-exception / customs | **high** |
| `delayed` | delay | **medium** |

SLA response targets: urgent 2h · high 4h · medium 12h · low 24h.

---

## Architecture

```
server/
  index.js      Express app + REST API + static hosting
  domain.js     Shared vocabulary (stages, statuses, SLA rules, exception mapping)
  events.js     efmAPP ingestion engine (exception → auto-case, assignment, SLA)
  db.js         Zero-dependency JSON datastore (in-memory + file flush)
  seed.js       Realistic EFM & AFS demo dataset
  simulate.js   efmAPP event streamer for demos
public/
  index.html    App shell
  app.js        SPA (router, views, drawers, modals)
  api.js        REST client
  ui.js         Formatting + badge helpers
  styles.css    Light/dark themed design system
test/
  events.test.js  Unit tests for the ingestion engine (node --test)
```

**Stack:** Node.js + Express on the back end; a dependency-free vanilla-JS single-page app
on the front end. Data persists to `data/crm.json` — no database engine to install. The
store is deliberately swappable: `server/db.js` is the only file that touches persistence,
so moving to Postgres/SQLite later means reimplementing one module.

---

## API reference (summary)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard?brand=` | KPIs, SLA watch, recent events |
| GET/POST | `/api/accounts` | List / create accounts |
| GET/PATCH | `/api/accounts/:id` | Account 360 / update |
| POST | `/api/accounts/:id/activities` | Log an interaction |
| GET/POST | `/api/cases` | List (filterable) / create cases |
| GET/PATCH | `/api/cases/:id` | Case detail / update |
| POST | `/api/cases/:id/notes` | Add a case note |
| GET | `/api/deals`, `/api/deals/board` | Pipeline list / Kanban board |
| POST/PATCH | `/api/deals`, `/api/deals/:id` | Create / move a deal |
| GET | `/api/shipments`, `/api/shipments/:id` | Shipments + event timeline |
| POST | `/api/events/efmapp` | **Ingest a status event** |
| GET | `/api/events` | Event feed (filter `?exceptions=true`) |

Case filters: `brand, status, priority, category, assigneeId, accountId, origin, q, sla=breached`.

---

## Testing

```bash
npm test          # node:test — covers the ingestion engine and domain rules
```

## Notes

- `data/crm.json` is git-ignored; the server auto-seeds on first boot if empty.
- Reset demo data anytime: `npm run seed` or `POST /api/admin/reseed`.
