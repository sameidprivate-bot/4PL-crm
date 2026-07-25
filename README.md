# MOVEiTcrm — 4PL Control Tower

**MOVEiTcrm** is a control-tower CRM for the **EFM** and **AFS** fourth-party-logistics (4PL) brands.
Styled in the MOVEiTcx / AFS Logistics brand palette (midnight blue + logistics red).
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
| **Case management** | Full CS desk: priority, category, status, assignee, SLA tracking (with breach detection), notes and an activity timeline. Cases carry a **carrier** and a **responsibility** (carrier / internal / customer). |
| **Carriers** | Carrier setup for the AU/NZ transport panel (StarTrack, Team Global Express, Followmont, Toll, Mainfreight, …). See **cases by carrier**, what's **still with the carrier to resolve**, and a **performance report** (open/with-carrier/resolved, avg resolution time, exception rate, on-time %). |
| **Sales** | Tabbed **Overview / Pipeline / Quotes**: weighted forecast by month, win rate, rep-vs-target, pipeline by service & source; drag-and-drop Kanban with a **Miller Heiman Blue Sheet** per deal; **quotes** with carrier buy/sell rate lines and margin; win/loss close workflow. |
| **Account management** | 360° account view — health/tier, contacts, cases, deals, shipments, a **document library** (rate cards, agreements, QBRs, monthly decks) and an **action register**. |
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

## Sales pipeline — Miller Heiman Blue Sheet

Every deal carries a **Strategic Selling Blue Sheet**, editable in the deal drawer:

- **Single Sales Objective (SSO)** — what, how much, by when
- **Funnel position** (Universe → Above the Funnel → In the Funnel → Best Few) and **ideal-customer fit**
- **Buying influences** — Economic / User / Technical / Coach, each with a **rating**
  (Enthusiastic → Anti), a **response mode** (Growth / Trouble / Even Keel / Overconfident)
  and **degree of influence**
- **Red flags**, **strengths to leverage**, **competition** (direct / indirect / status-quo / no-decision)
- **Win-results** (personal win + business result per buyer)
- **Action plan** (action / owner / due / status) and a **best-action commitment**

A **plan-strength score** (0–100) is derived from Blue Sheet completeness and shown on
each pipeline card so reps can see which deals still need strategic work.

`GET /api/deals/:id` returns the full deal + Blue Sheet; `PUT /api/deals/:id/bluesheet`
saves it.

## Account management — documents & actions

Each account keeps a **document library** and an **action register**:

- **Documents** — `rate-card`, `agreement`, `qbr`, `monthly-deck` (and `other`), each with
  period, effective/expiry dates, owner, status, version, optional value and a link.
  Agreements expiring within 60 days surface on the dashboard.
- **Actions** — items captured from QBRs / monthly reviews / rate reviews, with owner,
  due date (overdue flagged), status and source. Toggle done inline.

```
GET/POST   /api/accounts/:id/documents      PATCH/DELETE /api/documents/:id
GET/POST   /api/accounts/:id/actions        PATCH        /api/actions/:id
```

---

## Carriers & carrier-linked cases

The transport panel is real Australian & New Zealand carriers — **StarTrack, Team Global
Express, Followmont Transport, Toll Group, Aramex Australia, Border Express, Mainfreight,
NZ Couriers, CouriersPlease, Northline** — each with modes, regions, account manager, ABN/NZBN,
account code and an on-time target.

Every case carries a **carrierId** and a **responsibility** (`carrier` / `internal` / `customer`).
Freight failures (delivery exceptions, delays, damage, lost freight, POD, claims) default to
**carrier**; customs/billing/booking stay **internal**. That powers:

- **Cases by carrier** — filter the case desk by carrier, and a `↳ Still with carrier` toggle
  showing exactly what the carrier still has to resolve.
- **Carrier drawer** — with-carrier / on-time / avg-resolution KPIs, plus the case list split into
  *still with carrier*, *other open*, and *resolved*.
- **Carrier performance report** (`GET /api/reports/carriers`) — cases, open, with-carrier,
  resolved, avg resolution time, exception rate and on-time % per carrier.

```
GET/POST /api/carriers          GET /api/carriers/:id        PATCH /api/carriers/:id
GET /api/reports/carriers
GET /api/cases?carrierId=…&responsibility=carrier&withCarrier=true
```

## Sales

`GET /api/sales/overview` returns pipeline value, weighted forecast, win rate, avg deal size,
quotes outstanding, forecast by close month, pipeline by service/source, and rep-vs-target.

**Quotes** carry carrier buy/sell rate lines and compute sell / buy / margin / margin %:

```
GET/POST /api/quotes            PATCH /api/quotes/:id
POST /api/deals/:id/activities  # log a sales call/meeting/quote
PATCH /api/deals/:id            # stage moves; won/lost stamp a close date
```

All monetary values are AUD; addresses and lanes are Australian & New Zealand.

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
