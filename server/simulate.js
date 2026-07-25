// efmAPP status-event simulator.
//
// Streams synthetic milestone events at the running CRM's ingest endpoint so
// you can watch cases auto-raise on the customer-service desk in real time.
//
//   node server/simulate.js                 # a few events against localhost:3000
//   node server/simulate.js --count 20 --interval 1500
//   BASE=http://localhost:3000 node server/simulate.js

import { SHIPMENT_STATUSES, EXCEPTION_STATUSES, BRANDS } from './domain.js';

const args = process.argv.slice(2);
function argVal(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = process.env.BASE || argVal('base', 'http://localhost:3000');
const COUNT = Number(argVal('count', 8));
const INTERVAL = Number(argVal('interval', 1200));

// A pool of known shipment references from the seed set, plus a couple of new
// ones so the simulator also exercises the "unknown consignment" path.
const REFS = [
  { ref: 'EFM-CON-88213', brand: 'EFM' },
  { ref: 'EFM-CON-88245', brand: 'EFM' },
  { ref: 'EFM-CON-88301', brand: 'EFM' },
  { ref: 'AFS-CON-40118', brand: 'AFS' },
  { ref: 'AFS-CON-40155', brand: 'AFS' },
  { ref: 'AFS-CON-40201', brand: 'AFS' },
];

const LOCATIONS = ['Sydney, NSW', 'Melbourne, VIC', 'Brisbane, QLD', 'Chicago, IL', 'Dallas, TX', 'Denver, CO', 'Austin, TX'];
const CARRIERS = ['TollExpress', 'PacificOcean', 'AirBridge', 'RoadRunner', 'SkyParcel'];
const NOTES = {
  delayed: 'Traffic incident on route',
  exception: 'Address could not be located',
  'customs-hold': 'Awaiting import documentation',
  damaged: 'Carton crushed in handling',
  'failed-delivery': 'Recipient unavailable',
  lost: 'Consignment not scanned at destination hub',
};

// Bias toward exception statuses so demos are eventful, but keep normal
// milestones in the mix too.
const STATUS_POOL = [
  ...SHIPMENT_STATUSES.filter((s) => !EXCEPTION_STATUSES.includes(s)),
  ...EXCEPTION_STATUSES,
  ...EXCEPTION_STATUSES,
];

function pick(arr, i) {
  return arr[i % arr.length];
}

async function send(event, i) {
  try {
    const res = await fetch(`${BASE}/api/events/efmapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    });
    const data = await res.json();
    const tag = data.caseCreated
      ? `➜ auto-raised ${data.caseCreated.id} [${data.caseCreated.priority}]`
      : data.caseUpdated
        ? `➜ appended to ${data.caseUpdated.id}`
        : '';
    console.log(`[${i + 1}/${COUNT}] ${event.brand} ${event.shipmentRef} → ${event.status.padEnd(16)} ${tag}`);
  } catch (err) {
    console.error(`[${i + 1}] send failed:`, err.message, '\n  Is the server running?  npm start');
  }
}

async function main() {
  console.log(`Streaming ${COUNT} efmAPP events to ${BASE} every ${INTERVAL}ms...\n`);
  for (let i = 0; i < COUNT; i++) {
    const target = pick(REFS, i * 3 + 1);
    const status = pick(STATUS_POOL, i * 5 + 2);
    const event = {
      shipmentRef: target.ref,
      brand: target.brand,
      status,
      location: pick(LOCATIONS, i * 2),
      carrier: pick(CARRIERS, i),
      note: NOTES[status] || null,
      occurredAt: new Date().toISOString(),
    };
    await send(event, i);
    if (i < COUNT - 1) await new Promise((r) => setTimeout(r, INTERVAL));
  }
  console.log('\nDone. Open the CRM dashboard to see the new cases and events.');
}

main();
