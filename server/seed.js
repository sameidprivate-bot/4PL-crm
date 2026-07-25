// Seed the CRM with realistic EFM & AFS 4PL data.
// Run with:  npm run seed   (adds --reset to wipe first)

import { db } from './db.js';
import { slaDueDate } from './domain.js';
import { ingestEvent } from './events.js';

function daysAgo(n) {
  return new Date(Date.now() - n * 86400 * 1000).toISOString();
}
function daysFromNow(n) {
  return new Date(Date.now() + n * 86400 * 1000).toISOString();
}
function hoursAgo(n) {
  return new Date(Date.now() - n * 3600 * 1000).toISOString();
}

export function seed() {
  db.reset();

  // --- Customer-service & sales agents --------------------------------------
  const agents = [
    { id: 'AGT-1', name: 'Priya Nair', role: 'CS Agent', team: 'Customer Service', brands: ['EFM', 'AFS'], active: true },
    { id: 'AGT-2', name: 'Marcus Webb', role: 'CS Agent', team: 'Customer Service', brands: ['EFM'], active: true },
    { id: 'AGT-3', name: 'Sofia Almeida', role: 'CS Team Lead', team: 'Customer Service', brands: ['AFS'], active: true },
    { id: 'AGT-4', name: 'Daniel Cho', role: 'Account Manager', team: 'Accounts', brands: ['EFM', 'AFS'], active: true },
    { id: 'AGT-5', name: 'Hannah Reyes', role: 'Sales Executive', team: 'Sales', brands: ['EFM', 'AFS'], active: true },
  ];
  agents.forEach((a) => db.insert('agents', a));

  // --- Accounts (shippers served by the 4PL desk) ---------------------------
  const accounts = [
    {
      id: 'ACC-1', name: 'Brightline Retail Group', brand: 'EFM', industry: 'Retail',
      tier: 'strategic', health: 'healthy', region: 'ANZ',
      ownerId: 'AGT-4', annualRevenue: 1850000, activeSince: '2019-03-01',
      website: 'brightline-retail.example', phone: '+61 3 9000 1000',
      notes: 'Peak season Oct–Dec. Multi-carrier managed freight across 42 stores.',
    },
    {
      id: 'ACC-2', name: 'Corevolt Industrial', brand: 'EFM', industry: 'Manufacturing',
      tier: 'enterprise', health: 'watch', region: 'ANZ',
      ownerId: 'AGT-4', annualRevenue: 940000, activeSince: '2021-07-15',
      website: 'corevolt.example', phone: '+61 2 8000 2000',
      notes: 'Sensitive to transit-time variance on inbound components.',
    },
    {
      id: 'ACC-3', name: 'Meridian Health Supplies', brand: 'AFS', industry: 'Healthcare',
      tier: 'enterprise', health: 'at-risk', region: 'North America',
      ownerId: 'AGT-4', annualRevenue: 1220000, activeSince: '2020-01-20',
      website: 'meridianhealth.example', phone: '+1 312 555 0100',
      notes: 'Cold-chain compliance critical. Two recent customs holds — watch closely.',
    },
    {
      id: 'ACC-4', name: 'NovaFresh Foods', brand: 'AFS', industry: 'Food & Beverage',
      tier: 'mid-market', health: 'healthy', region: 'North America',
      ownerId: 'AGT-4', annualRevenue: 610000, activeSince: '2022-05-10',
      website: 'novafresh.example', phone: '+1 469 555 0142',
      notes: 'Perishables — tight delivery windows to distribution centres.',
    },
    {
      id: 'ACC-5', name: 'Apex Components', brand: 'EFM', industry: 'Automotive',
      tier: 'mid-market', health: 'healthy', region: 'ANZ',
      ownerId: 'AGT-4', annualRevenue: 480000, activeSince: '2023-02-01',
      website: 'apexcomponents.example', phone: '+61 7 3000 3000',
      notes: 'Just-in-time inbound to assembly line.',
    },
    {
      id: 'ACC-6', name: 'Lumen Electronics', brand: 'AFS', industry: 'Electronics',
      tier: 'small-business', health: 'healthy', region: 'North America',
      ownerId: 'AGT-4', annualRevenue: 230000, activeSince: '2024-06-01',
      website: 'lumen-electronics.example', phone: '+1 408 555 0177',
      notes: 'High-value, low-volume consignments. Requires signature on delivery.',
    },
  ];
  accounts.forEach((a) => db.insert('accounts', { ...a, createdAt: a.activeSince, updatedAt: daysAgo(3) }));

  // --- Contacts -------------------------------------------------------------
  const contacts = [
    { id: 'CON-1', accountId: 'ACC-1', name: 'Elena Fischer', title: 'Head of Supply Chain', email: 'elena.fischer@brightline-retail.example', phone: '+61 3 9000 1010', primary: true },
    { id: 'CON-2', accountId: 'ACC-1', name: 'Tom Baker', title: 'Logistics Coordinator', email: 'tom.baker@brightline-retail.example', phone: '+61 3 9000 1011', primary: false },
    { id: 'CON-3', accountId: 'ACC-2', name: 'Raj Patel', title: 'Procurement Manager', email: 'raj.patel@corevolt.example', phone: '+61 2 8000 2010', primary: true },
    { id: 'CON-4', accountId: 'ACC-3', name: 'Dr. Amelia Stone', title: 'VP Operations', email: 'amelia.stone@meridianhealth.example', phone: '+1 312 555 0101', primary: true },
    { id: 'CON-5', accountId: 'ACC-4', name: 'Carlos Mendez', title: 'Distribution Lead', email: 'carlos.mendez@novafresh.example', phone: '+1 469 555 0143', primary: true },
    { id: 'CON-6', accountId: 'ACC-5', name: 'Grace Liu', title: 'Plant Manager', email: 'grace.liu@apexcomponents.example', phone: '+61 7 3000 3010', primary: true },
    { id: 'CON-7', accountId: 'ACC-6', name: 'Owen Clarke', title: 'Founder', email: 'owen@lumen-electronics.example', phone: '+1 408 555 0178', primary: true },
  ];
  contacts.forEach((c) => db.insert('contacts', { ...c, createdAt: daysAgo(120), updatedAt: daysAgo(30) }));

  // --- Sales pipeline -------------------------------------------------------
  const deals = [
    { id: 'DEAL-1', name: 'Brightline — national LTL consolidation', accountId: 'ACC-1', brand: 'EFM', stage: 'negotiation', value: 420000, ownerId: 'AGT-5', serviceType: 'Managed LTL', expectedCloseAt: daysFromNow(18), source: 'Existing account' },
    { id: 'DEAL-2', name: 'Corevolt — inbound control tower', accountId: 'ACC-2', brand: 'EFM', stage: 'proposal', value: 260000, ownerId: 'AGT-5', serviceType: 'Control Tower', expectedCloseAt: daysFromNow(32), source: 'Existing account' },
    { id: 'DEAL-3', name: 'Meridian — cold-chain lane redesign', accountId: 'ACC-3', brand: 'AFS', stage: 'qualified', value: 330000, ownerId: 'AGT-5', serviceType: 'Cold Chain', expectedCloseAt: daysFromNow(45), source: 'Referral' },
    { id: 'DEAL-4', name: 'NovaFresh — DC network optimisation', accountId: 'ACC-4', brand: 'AFS', stage: 'proposal', value: 155000, ownerId: 'AGT-5', serviceType: 'Network Design', expectedCloseAt: daysFromNow(21), source: 'Inbound' },
    { id: 'DEAL-5', name: 'Apex — JIT parcel program', accountId: 'ACC-5', brand: 'EFM', stage: 'won', value: 98000, ownerId: 'AGT-5', serviceType: 'Managed Parcel', expectedCloseAt: daysAgo(6), source: 'Existing account' },
    { id: 'DEAL-6', name: 'Lumen — signature-required express', accountId: 'ACC-6', brand: 'AFS', stage: 'lead', value: 46000, ownerId: 'AGT-5', serviceType: 'Express', expectedCloseAt: daysFromNow(60), source: 'Website' },
    { id: 'DEAL-7', name: 'Northwind Apparel — 4PL tender', accountId: null, brand: 'EFM', stage: 'qualified', value: 510000, ownerId: 'AGT-5', serviceType: 'Full 4PL', expectedCloseAt: daysFromNow(75), source: 'Tender', prospectName: 'Northwind Apparel' },
    { id: 'DEAL-8', name: 'Cedar Home — returns management', accountId: null, brand: 'AFS', stage: 'lost', value: 72000, ownerId: 'AGT-5', serviceType: 'Reverse Logistics', expectedCloseAt: daysAgo(12), source: 'Inbound', prospectName: 'Cedar Home', lostReason: 'Chose incumbent 3PL' },
  ];
  deals.forEach((d) => db.insert('deals', { ...d, createdAt: daysAgo(50), updatedAt: daysAgo(2) }));

  // --- Shipments (baseline; efmAPP events will update these) ----------------
  const shipments = [
    { id: 'SHP-1', reference: 'EFM-CON-88213', accountId: 'ACC-1', brand: 'EFM', origin: 'Melbourne, VIC', destination: 'Sydney, NSW', carrier: 'TollExpress', service: 'Road LTL', mode: 'Road', status: 'in-transit', eta: daysFromNow(1), pieces: 12, weightKg: 640 },
    { id: 'SHP-2', reference: 'EFM-CON-88245', accountId: 'ACC-2', brand: 'EFM', origin: 'Shenzhen, CN', destination: 'Brisbane, QLD', carrier: 'PacificOcean', service: 'Sea FCL', mode: 'Sea', status: 'at-hub', eta: daysFromNow(3), pieces: 1, weightKg: 18500 },
    { id: 'SHP-3', reference: 'AFS-CON-40118', accountId: 'ACC-3', brand: 'AFS', origin: 'Frankfurt, DE', destination: 'Chicago, IL', carrier: 'AirBridge', service: 'Air Cold Chain', mode: 'Air', status: 'in-transit', eta: daysFromNow(1), pieces: 6, weightKg: 210 },
    { id: 'SHP-4', reference: 'AFS-CON-40155', accountId: 'ACC-4', brand: 'AFS', origin: 'Dallas, TX', destination: 'Denver, CO', carrier: 'RoadRunner', service: 'Reefer LTL', mode: 'Road', status: 'out-for-delivery', eta: daysFromNow(0), pieces: 8, weightKg: 430 },
    { id: 'SHP-5', reference: 'EFM-CON-88301', accountId: 'ACC-5', brand: 'EFM', origin: 'Auckland, NZ', destination: 'Gold Coast, QLD', carrier: 'PacificOcean', service: 'Sea LCL', mode: 'Sea', status: 'picked-up', eta: daysFromNow(6), pieces: 4, weightKg: 1200 },
    { id: 'SHP-6', reference: 'AFS-CON-40201', accountId: 'ACC-6', brand: 'AFS', origin: 'San Jose, CA', destination: 'Austin, TX', carrier: 'SkyParcel', service: 'Express Air', mode: 'Air', status: 'in-transit', eta: daysFromNow(0), pieces: 2, weightKg: 34 },
    { id: 'SHP-7', reference: 'EFM-CON-88330', accountId: 'ACC-1', brand: 'EFM', origin: 'Perth, WA', destination: 'Adelaide, SA', carrier: 'TollExpress', service: 'Road FTL', mode: 'Road', status: 'delivered', eta: daysAgo(1), pieces: 20, weightKg: 3100 },
  ];
  shipments.forEach((s) =>
    db.insert('shipments', {
      ...s,
      lastLocation: s.origin,
      lastEventAt: daysAgo(1),
      hasOpenException: false,
      timeline: [{ status: 'booked', location: s.origin, note: 'Consignment booked', at: daysAgo(4) }],
      createdAt: daysAgo(4),
      updatedAt: daysAgo(1),
    }),
  );

  // --- A couple of manually-logged cases (not from efmAPP) ------------------
  const manualCases = [
    {
      id: 'CASE-1', subject: 'POD copy requested for EFM-CON-88330', brand: 'EFM',
      accountId: 'ACC-1', accountName: 'Brightline Retail Group', contactId: 'CON-1',
      shipmentId: 'SHP-7', shipmentRef: 'EFM-CON-88330',
      category: 'pod-request', priority: 'low', status: 'open', origin: 'phone',
      assigneeId: 'AGT-2', assigneeName: 'Marcus Webb',
      slaDueAt: slaDueDate('low', new Date(hoursAgo(3))),
      description: 'Customer requested signed proof of delivery for their records.',
      timeline: [{ type: 'note', message: 'Requested POD from carrier portal', at: hoursAgo(2) }],
      createdAt: hoursAgo(3), updatedAt: hoursAgo(2), lastActivityAt: hoursAgo(2),
    },
    {
      id: 'CASE-2', subject: 'Invoice query — duplicate fuel levy', brand: 'AFS',
      accountId: 'ACC-4', accountName: 'NovaFresh Foods', contactId: 'CON-5',
      shipmentId: null, shipmentRef: null,
      category: 'billing', priority: 'medium', status: 'pending', origin: 'email',
      assigneeId: 'AGT-3', assigneeName: 'Sofia Almeida',
      slaDueAt: slaDueDate('medium', new Date(hoursAgo(20))),
      description: 'Customer flagged what appears to be a duplicated fuel levy on invoice #INV-77120.',
      timeline: [{ type: 'note', message: 'Escalated to billing team for review', at: hoursAgo(18) }],
      createdAt: hoursAgo(26), updatedAt: hoursAgo(18), lastActivityAt: hoursAgo(18),
    },
  ];
  manualCases.forEach((c) => db.insert('cases', c));

  // --- Activities (account-management interaction log) ----------------------
  const activities = [
    { id: 'ACT-1', accountId: 'ACC-3', type: 'call', subject: 'QBR follow-up on customs delays', agentId: 'AGT-4', at: daysAgo(2) },
    { id: 'ACT-2', accountId: 'ACC-1', type: 'meeting', subject: 'Peak-season capacity planning', agentId: 'AGT-4', at: daysAgo(5) },
    { id: 'ACT-3', accountId: 'ACC-2', type: 'email', subject: 'Shared transit-time variance report', agentId: 'AGT-4', at: daysAgo(1) },
    { id: 'ACT-4', accountId: 'ACC-3', type: 'note', subject: 'Health downgraded to at-risk after 2nd customs hold', agentId: 'AGT-4', at: daysAgo(1) },
  ];
  activities.forEach((a) => db.insert('activities', { ...a, createdAt: a.at }));

  // Keep id counters ahead of seeded records.
  db.syncCounters({
    accounts: { prefix: 'ACC', start: 1 },
    contacts: { prefix: 'CON', start: 1 },
    cases: { prefix: 'CASE', start: 1 },
    deals: { prefix: 'DEAL', start: 1 },
    shipments: { prefix: 'SHP', start: 1 },
    events: { prefix: 'EVT', start: 1 },
    activities: { prefix: 'ACT', start: 1 },
    agents: { prefix: 'AGT', start: 1 },
  });

  // --- Replay a burst of efmAPP events to demonstrate live ingestion --------
  // These exercise the exception -> auto-case path the desk relies on.
  const replay = [
    { shipmentRef: 'EFM-CON-88213', status: 'in-transit', brand: 'EFM', location: 'Albury, NSW', carrier: 'TollExpress', occurredAt: hoursAgo(6) },
    { shipmentRef: 'AFS-CON-40118', status: 'customs-hold', brand: 'AFS', location: 'Chicago O\'Hare, IL', carrier: 'AirBridge', note: 'Documentation review — temperature log requested', occurredAt: hoursAgo(4) },
    { shipmentRef: 'EFM-CON-88245', status: 'delayed', brand: 'EFM', location: 'Port of Brisbane, QLD', carrier: 'PacificOcean', note: 'Vessel berthing delay 36h', occurredAt: hoursAgo(3) },
    { shipmentRef: 'AFS-CON-40201', status: 'failed-delivery', brand: 'AFS', location: 'Austin, TX', carrier: 'SkyParcel', note: 'No one available to sign', occurredAt: hoursAgo(2) },
    { shipmentRef: 'AFS-CON-40155', status: 'delivered', brand: 'AFS', location: 'Denver, CO', carrier: 'RoadRunner', occurredAt: hoursAgo(1) },
  ];
  for (const ev of replay) ingestEvent(ev);

  db.save();
  return {
    agents: db.collection('agents').length,
    accounts: db.collection('accounts').length,
    contacts: db.collection('contacts').length,
    deals: db.collection('deals').length,
    shipments: db.collection('shipments').length,
    cases: db.collection('cases').length,
    events: db.collection('events').length,
    activities: db.collection('activities').length,
  };
}

// Allow `node server/seed.js` / `npm run seed`.
if (import.meta.url === `file://${process.argv[1]}`) {
  db.load();
  const summary = seed();
  console.log('[seed] database seeded:', summary);
}
