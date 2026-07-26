// Seed MOVEiTcrm with realistic EFM & AFS 4PL data (Australia & New Zealand).
// Run with:  npm run seed   (adds --reset to wipe first)

import { db } from './db.js';
import { slaDueDate, emptyBlueSheet, responsibilityForCategory } from './domain.js';
import { ingestEvent } from './events.js';

function dateOnly(n) {
  return new Date(Date.now() + n * 86400 * 1000).toISOString().slice(0, 10);
}
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

  // --- Team: CS, account management & sales ---------------------------------
  const agents = [
    { id: 'AGT-1', name: 'Priya Nair', role: 'CS Agent', team: 'Customer Service', brands: ['4PL', '3PL', 'Global'], active: true },
    { id: 'AGT-2', name: 'Marcus Webb', role: 'CS Agent', team: 'Customer Service', brands: ['4PL', '3PL', 'Global'], active: true },
    { id: 'AGT-3', name: 'Sofia Almeida', role: 'CS Team Lead', team: 'Customer Service', brands: ['4PL', '3PL', 'Global'], active: true },
    { id: 'AGT-4', name: 'Daniel Cho', role: 'Account Manager', team: 'Accounts', brands: ['4PL', '3PL', 'Global'], active: true },
    { id: 'AGT-5', name: 'Hannah Reyes', role: 'Sales Executive', team: 'Sales', brands: ['4PL', '3PL', 'Global'], active: true, salesTarget: 900000 },
    { id: 'AGT-6', name: 'Jack Thompson', role: 'Business Development', team: 'Sales', brands: ['4PL', '3PL', 'Global'], active: true, salesTarget: 650000 },
  ];
  agents.forEach((a) => db.insert('agents', a));

  // --- Carriers (Australian & New Zealand transport providers) --------------
  const carriers = [
    { id: 'CARR-1', name: 'StarTrack', code: 'STK', modes: ['Road', 'Air'], regions: ['National AU'], status: 'preferred', country: 'AU', accountManager: 'Leanne Foster', phone: '+61 13 23 45', email: 'service@startrack.example', website: 'startrack.com.au', trackingUrl: 'https://startrack.com.au/track', abn: '64 000 000 001', accountCode: 'AFS-STK-01', onTimeTarget: 96, notes: 'Australia Post B2B express. Primary road+air lane carrier for east-coast metro.' },
    { id: 'CARR-2', name: 'Team Global Express', code: 'TGE', modes: ['Road', 'Rail', 'Air'], regions: ['National AU', 'Trans-Tasman'], status: 'preferred', country: 'AU', accountManager: 'Rob Mancini', phone: '+61 13 15 31', email: 'care@teamglobalexp.example', website: 'teamglobalexp.com', trackingUrl: 'https://teamglobalexp.com/track', abn: '64 000 000 002', accountCode: 'AFS-TGE-01', onTimeTarget: 95, notes: 'Formerly Toll. National rail linehaul + trans-Tasman.' },
    { id: 'CARR-3', name: 'Followmont Transport', code: 'FMT', modes: ['Road'], regions: ['QLD', 'NSW'], status: 'active', country: 'AU', accountManager: 'Kate Sullivan', phone: '+61 7 3489 8000', email: 'custserv@followmont.example', website: 'followmont.com.au', trackingUrl: 'https://followmont.com.au/track', abn: '64 000 000 003', accountCode: 'AFS-FMT-01', onTimeTarget: 97, notes: 'QLD specialist, strong regional Queensland coverage.' },
    { id: 'CARR-4', name: 'Toll Group', code: 'TOL', modes: ['Road', 'Sea', 'Air'], regions: ['National AU', 'National NZ', 'Trans-Tasman'], status: 'active', country: 'AU', accountManager: 'Steven Ng', phone: '+61 3 9694 2888', email: 'enquiries@toll.example', website: 'tollgroup.com', trackingUrl: 'https://tollgroup.com/track', abn: '64 000 000 004', accountCode: 'AFS-TOL-01', onTimeTarget: 94, notes: 'Trans-Tasman sea + air freight forwarding.' },
    { id: 'CARR-5', name: 'Aramex Australia', code: 'ARX', modes: ['Courier', 'Road'], regions: ['National AU'], status: 'active', country: 'AU', accountManager: 'Nadia Haddad', phone: '+61 2 8788 3000', email: 'support@aramex.example', website: 'aramex.com.au', trackingUrl: 'https://aramex.com.au/track', abn: '64 000 000 005', accountCode: 'AFS-ARX-01', onTimeTarget: 92, notes: 'Formerly Fastway. Franchise courier for parcels.' },
    { id: 'CARR-6', name: 'Border Express', code: 'BEX', modes: ['Road'], regions: ['National AU'], status: 'active', country: 'AU', accountManager: 'Greg Patterson', phone: '+61 3 9330 0777', email: 'info@borderexpress.example', website: 'borderexpress.com.au', trackingUrl: 'https://borderexpress.com.au/track', abn: '64 000 000 006', accountCode: 'AFS-BEX-01', onTimeTarget: 95, notes: 'National road linehaul, good interstate coverage.' },
    { id: 'CARR-7', name: 'Mainfreight', code: 'MFT', modes: ['Road', 'Sea'], regions: ['National NZ', 'Trans-Tasman', 'National AU'], status: 'preferred', country: 'NZ', accountManager: 'Aroha Ngata', phone: '+64 9 259 5500', email: 'service@mainfreight.example', website: 'mainfreight.com', trackingUrl: 'https://mainfreight.com/track', abn: 'NZBN 9429000000007', accountCode: 'AFS-MFT-01', onTimeTarget: 96, notes: 'NZ-origin. Domestic NZ + trans-Tasman sea freight.' },
    { id: 'CARR-8', name: 'NZ Couriers', code: 'NZC', modes: ['Courier', 'Road'], regions: ['National NZ'], status: 'active', country: 'NZ', accountManager: 'Liam O\'Connor', phone: '+64 9 356 3600', email: 'help@nzcouriers.example', website: 'nzcouriers.co.nz', trackingUrl: 'https://nzcouriers.co.nz/track', abn: 'NZBN 9429000000008', accountCode: 'AFS-NZC-01', onTimeTarget: 94, notes: 'Freightways brand. Domestic NZ courier.' },
    { id: 'CARR-9', name: 'CouriersPlease', code: 'CPL', modes: ['Courier'], regions: ['National AU'], status: 'active', country: 'AU', accountManager: 'Michelle Tran', phone: '+61 2 9695 7300', email: 'support@couriersplease.example', website: 'couriersplease.com.au', trackingUrl: 'https://couriersplease.com.au/track', abn: '64 000 000 009', accountCode: 'AFS-CPL-01', onTimeTarget: 91, notes: 'Metro parcel courier, e-commerce focus.' },
    { id: 'CARR-10', name: 'Northline', code: 'NLN', modes: ['Road', 'Sea'], regions: ['National AU', 'NT'], status: 'onboarding', country: 'AU', accountManager: 'Dave Kelleher', phone: '+61 8 8360 0888', email: 'service@northline.example', website: 'northline.com.au', trackingUrl: 'https://northline.com.au/track', abn: '64 000 000 010', accountCode: 'AFS-NLN-01', onTimeTarget: 93, notes: 'Regional + remote AU, strong NT/WA. Onboarding in progress.' },
  ];
  carriers.forEach((c) => db.insert('carriers', { ...c, createdAt: daysAgo(200), updatedAt: daysAgo(5) }));

  // --- Accounts (AU/NZ shippers served by the 4PL desk) --------------------
  const accounts = [
    { id: 'ACC-1', name: 'Kingfisher Hardware', brand: 'EFM', industry: 'Retail', tier: 'strategic', health: 'healthy', region: 'VIC', ownerId: 'AGT-4', annualRevenue: 1850000, activeSince: '2019-03-01', website: 'kingfisherhardware.com.au', phone: '+61 3 9600 1000', address: '120 Salmon St, Port Melbourne VIC 3207', notes: 'Peak season Oct–Dec. Multi-carrier managed freight across 42 stores.' },
    { id: 'ACC-2', name: 'Corella Foods', brand: 'AFS', industry: 'Food & Beverage', tier: 'enterprise', health: 'healthy', region: 'NSW', ownerId: 'AGT-4', annualRevenue: 940000, activeSince: '2021-07-15', website: 'corellafoods.com.au', phone: '+61 2 9700 2000', address: '8 Homebush Bay Dr, Rhodes NSW 2138', notes: 'Perishables — tight DC delivery windows across NSW/VIC.' },
    { id: 'ACC-3', name: 'Southern Cross Health', brand: 'AFS', industry: 'Healthcare', tier: 'enterprise', health: 'at-risk', region: 'SA', ownerId: 'AGT-4', annualRevenue: 1220000, activeSince: '2020-01-20', website: 'sxhealth.com.au', phone: '+61 8 8200 0100', address: '45 Grote St, Adelaide SA 5000', notes: 'Cold-chain compliance critical. Two recent temperature excursions — watch closely.' },
    { id: 'ACC-4', name: 'Redgum Building Supplies', brand: 'EFM', industry: 'Building Materials', tier: 'mid-market', health: 'healthy', region: 'QLD', ownerId: 'AGT-4', annualRevenue: 610000, activeSince: '2022-05-10', website: 'redgumsupplies.com.au', phone: '+61 7 3200 3000', address: '15 Kremzow Rd, Brendale QLD 4500', notes: 'Heavy freight to regional QLD sites; Followmont key lane.' },
    { id: 'ACC-5', name: 'Tasman Beverages', brand: 'AFS', industry: 'Beverages', tier: 'enterprise', health: 'watch', region: 'NZ-NI', ownerId: 'AGT-4', annualRevenue: 1050000, activeSince: '2020-09-01', website: 'tasmanbeverages.co.nz', phone: '+64 9 300 4000', address: '210 Great South Rd, Penrose, Auckland 1061', notes: 'NZ domestic + trans-Tasman export. Sensitive to sailing schedules.' },
    { id: 'ACC-6', name: 'Kauri Electronics', brand: 'AFS', industry: 'Electronics', tier: 'small-business', health: 'healthy', region: 'NZ-NI', ownerId: 'AGT-4', annualRevenue: 230000, activeSince: '2024-06-01', website: 'kaurielectronics.co.nz', phone: '+64 4 900 5000', address: '33 Victoria St, Wellington 6011', notes: 'High-value, low-volume. Signature-on-delivery required.' },
    { id: 'ACC-7', name: 'Pilbara Mining Services', brand: 'EFM', industry: 'Mining & Industrial', tier: 'enterprise', health: 'healthy', region: 'WA', ownerId: 'AGT-4', annualRevenue: 1480000, activeSince: '2018-11-01', website: 'pilbaramining.com.au', phone: '+61 8 9200 6000', address: '5 Mill St, Perth WA 6000', notes: 'Remote-site freight to the Pilbara; Northline/Toll for NT/WA remote.' },
  ];
  accounts.forEach((a) => db.insert('accounts', { ...a, createdAt: a.activeSince, updatedAt: daysAgo(3) }));

  // Segment the book of business by MAJOR SERVICE LINE (not EFM/AFS brand).
  const SERVICE_BY_ACCOUNT = {
    'ACC-1': '4PL', 'ACC-2': '3PL', 'ACC-3': '3PL', 'ACC-4': '3PL',
    'ACC-5': 'Global', 'ACC-6': 'Global', 'ACC-7': '4PL',
  };
  for (const a of db.collection('accounts')) a.brand = SERVICE_BY_ACCOUNT[a.id] || '4PL';

  // --- Contacts -------------------------------------------------------------
  const contacts = [
    { id: 'CON-1', accountId: 'ACC-1', name: 'Elena Fischer', title: 'Head of Supply Chain', email: 'elena.fischer@kingfisherhardware.com.au', phone: '+61 3 9600 1010', primary: true },
    { id: 'CON-2', accountId: 'ACC-1', name: 'Tom Baker', title: 'Logistics Coordinator', email: 'tom.baker@kingfisherhardware.com.au', phone: '+61 3 9600 1011', primary: false },
    { id: 'CON-3', accountId: 'ACC-2', name: 'Raj Patel', title: 'Procurement Manager', email: 'raj.patel@corellafoods.com.au', phone: '+61 2 9700 2010', primary: true },
    { id: 'CON-4', accountId: 'ACC-3', name: 'Dr. Amelia Stone', title: 'National Operations Manager', email: 'amelia.stone@sxhealth.com.au', phone: '+61 8 8200 0101', primary: true },
    { id: 'CON-5', accountId: 'ACC-4', name: 'Carlos Mendez', title: 'Distribution Lead', email: 'carlos.mendez@redgumsupplies.com.au', phone: '+61 7 3200 3010', primary: true },
    { id: 'CON-6', accountId: 'ACC-5', name: 'Ngaire Wilson', title: 'Supply Chain Manager', email: 'ngaire.wilson@tasmanbeverages.co.nz', phone: '+64 9 300 4010', primary: true },
    { id: 'CON-7', accountId: 'ACC-6', name: 'Owen Clarke', title: 'Founder', email: 'owen@kaurielectronics.co.nz', phone: '+64 4 900 5010', primary: true },
    { id: 'CON-8', accountId: 'ACC-7', name: 'Grace Liu', title: 'Logistics Superintendent', email: 'grace.liu@pilbaramining.com.au', phone: '+61 8 9200 6010', primary: true },
  ];
  contacts.forEach((c) => db.insert('contacts', { ...c, createdAt: daysAgo(120), updatedAt: daysAgo(30) }));

  // --- Sales pipeline -------------------------------------------------------
  const deals = [
    { id: 'DEAL-1', name: 'Kingfisher — national LTL consolidation', accountId: 'ACC-1', brand: 'EFM', stage: 'negotiation', value: 420000, ownerId: 'AGT-5', serviceType: 'Managed LTL', expectedCloseAt: daysFromNow(18), source: 'Existing account' },
    { id: 'DEAL-2', name: 'Corella — inbound control tower', accountId: 'ACC-2', brand: 'AFS', stage: 'proposal', value: 260000, ownerId: 'AGT-5', serviceType: 'Control Tower', expectedCloseAt: daysFromNow(32), source: 'Existing account' },
    { id: 'DEAL-3', name: 'Southern Cross — cold-chain lane redesign', accountId: 'ACC-3', brand: 'AFS', stage: 'qualified', value: 330000, ownerId: 'AGT-6', serviceType: 'Cold Chain', expectedCloseAt: daysFromNow(45), source: 'Referral' },
    { id: 'DEAL-4', name: 'Tasman — trans-Tasman export program', accountId: 'ACC-5', brand: 'AFS', stage: 'proposal', value: 285000, ownerId: 'AGT-6', serviceType: 'Trans-Tasman', expectedCloseAt: daysFromNow(21), source: 'Inbound' },
    { id: 'DEAL-5', name: 'Redgum — regional QLD parcel program', accountId: 'ACC-4', brand: 'EFM', stage: 'won', value: 98000, ownerId: 'AGT-5', serviceType: 'Managed Parcel', expectedCloseAt: daysAgo(6), source: 'Existing account' },
    { id: 'DEAL-6', name: 'Kauri — signature-required express', accountId: 'ACC-6', brand: 'AFS', stage: 'lead', value: 46000, ownerId: 'AGT-6', serviceType: 'Express', expectedCloseAt: daysFromNow(60), source: 'Website' },
    { id: 'DEAL-7', name: 'Wattle Apparel — 4PL tender', accountId: null, brand: 'EFM', stage: 'qualified', value: 510000, ownerId: 'AGT-5', serviceType: 'Full 4PL', expectedCloseAt: daysFromNow(75), source: 'Tender', prospectName: 'Wattle Apparel (Sydney NSW)' },
    { id: 'DEAL-8', name: 'Pilbara — remote-site freight review', accountId: 'ACC-7', brand: 'EFM', stage: 'negotiation', value: 375000, ownerId: 'AGT-6', serviceType: 'Managed FTL', expectedCloseAt: daysFromNow(28), source: 'Existing account' },
    { id: 'DEAL-9', name: 'Cedar Homewares — returns management', accountId: null, brand: 'AFS', stage: 'lost', value: 72000, ownerId: 'AGT-5', serviceType: 'Reverse Logistics', expectedCloseAt: daysAgo(12), source: 'Inbound', prospectName: 'Cedar Homewares (Christchurch NZ)', lostReason: 'Chose incumbent 3PL' },
  ];
  const blueSheets = {
    'DEAL-1': {
      sso: 'Secure a 24-month national managed-LTL agreement consolidating 42 stores by end of Q3, target $420k ARR.',
      funnelPosition: 'best-few', icpFit: 'strong',
      buyingInfluences: [
        { id: 'BI-1', name: 'Elena Fischer', title: 'Head of Supply Chain', role: 'economic', rating: 'supporter', mode: 'growth', influence: 'high', notes: 'Owns the budget; wants peak-season resilience.' },
        { id: 'BI-2', name: 'Tom Baker', title: 'Logistics Coordinator', role: 'user', rating: 'enthusiastic', mode: 'trouble', influence: 'medium', notes: 'Feels the pain of current carrier chaos — our coach.' },
        { id: 'BI-3', name: 'CFO (unknown)', title: 'Chief Financial Officer', role: 'technical', rating: 'neutral', mode: 'even-keel', influence: 'high', notes: 'Not yet engaged — RED FLAG.' },
      ],
      redFlags: ['CFO not yet met — final sign-off unclear', 'No written confirmation of Q3 budget'],
      strengths: ['Single control-tower view across StarTrack, TGE & Border Express', 'Proven peak-season surge capacity', 'Incumbent already trusts our exception handling'],
      competition: [{ type: 'status-quo', name: 'Current in-house multi-carrier setup', notes: 'Fragmented; no single throat to choke.' }, { type: 'direct', name: 'Regional 3PL', notes: 'Cheaper but no 4PL control tower.' }],
      winResults: [
        { influence: 'Elena Fischer', win: 'Recognised for de-risking peak season', result: 'On-time delivery >98% across stores' },
        { influence: 'Tom Baker', win: 'Stops firefighting carrier issues daily', result: 'Automated exception handling' },
      ],
      actionPlan: [
        { id: 'AP-1', action: 'Arrange intro meeting with CFO', owner: 'Hannah Reyes', dueDate: dateOnly(5), status: 'open' },
        { id: 'AP-2', action: 'Send peak-season capacity commitment letter', owner: 'Daniel Cho', dueDate: dateOnly(2), status: 'in-progress' },
      ],
      bestActionCommitment: 'Get Elena to introduce us to the CFO before the proposal review.',
    },
    'DEAL-3': {
      sso: 'Redesign Southern Cross cold-chain lanes under a new $330k program; qualify budget and timeline this quarter.',
      funnelPosition: 'in-funnel', icpFit: 'moderate',
      buyingInfluences: [
        { id: 'BI-6', name: 'Dr. Amelia Stone', title: 'National Operations Manager', role: 'economic', rating: 'neutral', mode: 'trouble', influence: 'high', notes: 'Two recent excursions — credibility at stake.' },
      ],
      redFlags: ['Account health at-risk after temperature excursions', 'Technical/compliance buyer not mapped'],
      strengths: ['Cold-chain compliance track record', 'Toll trans-Tasman + Mainfreight reefer network'],
      competition: [{ type: 'direct', name: 'Incumbent cold-chain 3PL', notes: 'Responsible for recent excursions.' }],
      winResults: [{ influence: 'Dr. Amelia Stone', win: 'Restores board confidence in logistics', result: 'Zero temperature excursions' }],
      actionPlan: [{ id: 'AP-4', action: 'Present excursion root-cause & remediation plan', owner: 'Jack Thompson', dueDate: dateOnly(4), status: 'in-progress' }],
      bestActionCommitment: 'Convert the at-risk relationship by owning the cold-chain remediation.',
    },
    'DEAL-8': {
      sso: 'Win a 24-month managed-FTL agreement for Pilbara remote-site freight, $375k, decision within 4 weeks.',
      funnelPosition: 'best-few', icpFit: 'strong',
      buyingInfluences: [
        { id: 'BI-7', name: 'Grace Liu', title: 'Logistics Superintendent', role: 'economic', rating: 'supporter', mode: 'growth', influence: 'high', notes: 'Wants reliable remote-site delivery.' },
        { id: 'BI-8', name: 'Site HSE Lead', title: 'HSE', role: 'technical', rating: 'neutral', mode: 'even-keel', influence: 'medium', notes: 'Compliance for remote-site access.' },
      ],
      redFlags: ['Remote NT/WA lanes depend on Northline onboarding completing'],
      strengths: ['Northline + Toll remote-site coverage', 'Real-time efmAPP tracking to site'],
      competition: [{ type: 'direct', name: 'Specialist mining logistics provider' }],
      winResults: [{ influence: 'Grace Liu', win: 'Fewer site stock-outs', result: 'Guaranteed remote-site SLAs' }],
      actionPlan: [{ id: 'AP-5', action: 'Confirm Northline onboarding timeline', owner: 'Jack Thompson', dueDate: dateOnly(6), status: 'open' }],
      bestActionCommitment: 'Lock the Northline lane so the remote-site SLA is credible.',
    },
  };
  deals.forEach((d) =>
    db.insert('deals', {
      ...d,
      blueSheet: { ...emptyBlueSheet(), ...(blueSheets[d.id] || {}) },
      closedAt: ['won', 'lost'].includes(d.stage) ? d.expectedCloseAt : null,
      createdAt: daysAgo(50),
      updatedAt: daysAgo(2),
    }),
  );

  // --- Quotes (with carrier buy/sell rate lines) ----------------------------
  const quotes = [
    {
      id: 'QTE-1', title: 'Kingfisher — national LTL rate proposal', accountId: 'ACC-1', dealId: 'DEAL-1', brand: 'EFM',
      status: 'sent', ownerId: 'AGT-5', validUntil: dateOnly(21), currency: 'AUD',
      lines: [
        { id: 'QL-1', lane: 'Melbourne VIC → Sydney NSW', mode: 'Road', carrierId: 'CARR-1', service: 'LTL', units: 120, buyRate: 180, sellRate: 235 },
        { id: 'QL-2', lane: 'Melbourne VIC → Brisbane QLD', mode: 'Road', carrierId: 'CARR-6', service: 'LTL', units: 80, buyRate: 210, sellRate: 275 },
        { id: 'QL-3', lane: 'Perth WA → Adelaide SA', mode: 'Rail', carrierId: 'CARR-2', service: 'Rail LTL', units: 40, buyRate: 320, sellRate: 410 },
      ],
      notes: 'Volume-based tiering applies above 300 consignments/month.',
    },
    {
      id: 'QTE-2', title: 'Tasman — trans-Tasman export rates', accountId: 'ACC-5', dealId: 'DEAL-4', brand: 'AFS',
      status: 'draft', ownerId: 'AGT-6', validUntil: dateOnly(30), currency: 'AUD',
      lines: [
        { id: 'QL-1', lane: 'Auckland NZ → Sydney NSW', mode: 'Sea', carrierId: 'CARR-7', service: 'LCL', units: 24, buyRate: 620, sellRate: 780 },
        { id: 'QL-2', lane: 'Auckland NZ → Melbourne VIC', mode: 'Air', carrierId: 'CARR-4', service: 'Air express', units: 12, buyRate: 950, sellRate: 1180 },
      ],
      notes: 'Trans-Tasman sailing schedule dependent.',
    },
    {
      id: 'QTE-3', title: 'Redgum — regional QLD parcel rates', accountId: 'ACC-4', dealId: 'DEAL-5', brand: 'EFM',
      status: 'accepted', ownerId: 'AGT-5', validUntil: dateOnly(-3), currency: 'AUD',
      lines: [
        { id: 'QL-1', lane: 'Brisbane QLD → Cairns QLD', mode: 'Road', carrierId: 'CARR-3', service: 'Parcel', units: 200, buyRate: 22, sellRate: 31 },
        { id: 'QL-2', lane: 'Brisbane QLD → Townsville QLD', mode: 'Road', carrierId: 'CARR-3', service: 'Parcel', units: 150, buyRate: 24, sellRate: 33 },
      ],
      notes: 'Accepted — feeds the won Redgum parcel program.',
    },
  ];
  quotes.forEach((q) => db.insert('quotes', { ...q, createdAt: daysAgo(14), updatedAt: daysAgo(3) }));

  // --- Sales activities -----------------------------------------------------
  const salesActivities = [
    { id: 'SACT-1', dealId: 'DEAL-1', accountId: 'ACC-1', type: 'meeting', subject: 'Proposal walkthrough with Elena', agentId: 'AGT-5', at: daysAgo(3) },
    { id: 'SACT-2', dealId: 'DEAL-1', accountId: 'ACC-1', type: 'quote', subject: 'Sent national LTL rate proposal (QTE-1)', agentId: 'AGT-5', at: daysAgo(2) },
    { id: 'SACT-3', dealId: 'DEAL-3', accountId: 'ACC-3', type: 'call', subject: 'Discussed cold-chain remediation scope', agentId: 'AGT-6', at: daysAgo(1) },
    { id: 'SACT-4', dealId: 'DEAL-8', accountId: 'ACC-7', type: 'site-visit', subject: 'Site visit to Perth DC', agentId: 'AGT-6', at: daysAgo(4) },
    { id: 'SACT-5', dealId: 'DEAL-4', accountId: 'ACC-5', type: 'email', subject: 'Shared trans-Tasman sailing options', agentId: 'AGT-6', at: daysAgo(2) },
  ];
  salesActivities.forEach((a) => db.insert('salesActivities', { ...a, createdAt: a.at }));

  // --- Shipments (AU/NZ lanes; efmAPP events will update these) -------------
  const shipments = [
    { id: 'SHP-1', reference: 'EFM-CON-88213', accountId: 'ACC-1', carrierId: 'CARR-1', brand: 'EFM', origin: 'Melbourne, VIC', destination: 'Sydney, NSW', carrier: 'StarTrack', service: 'Road LTL', mode: 'Road', status: 'in-transit', eta: daysFromNow(1), pieces: 12, weightKg: 640 },
    { id: 'SHP-2', reference: 'EFM-CON-88245', accountId: 'ACC-7', carrierId: 'CARR-2', brand: 'EFM', origin: 'Perth, WA', destination: 'Adelaide, SA', carrier: 'Team Global Express', service: 'Rail LTL', mode: 'Rail', status: 'at-hub', eta: daysFromNow(3), pieces: 1, weightKg: 18500 },
    { id: 'SHP-3', reference: 'AFS-CON-40118', accountId: 'ACC-3', carrierId: 'CARR-4', brand: 'AFS', origin: 'Auckland, NZ', destination: 'Adelaide, SA', carrier: 'Toll Group', service: 'Air Cold Chain', mode: 'Air', status: 'in-transit', eta: daysFromNow(1), pieces: 6, weightKg: 210 },
    { id: 'SHP-4', reference: 'AFS-CON-40155', accountId: 'ACC-2', carrierId: 'CARR-6', brand: 'AFS', origin: 'Sydney, NSW', destination: 'Melbourne, VIC', carrier: 'Border Express', service: 'Reefer LTL', mode: 'Road', status: 'out-for-delivery', eta: daysFromNow(0), pieces: 8, weightKg: 430 },
    { id: 'SHP-5', reference: 'AFS-CON-40201', accountId: 'ACC-6', carrierId: 'CARR-8', brand: 'AFS', origin: 'Auckland, NZ', destination: 'Wellington, NZ', carrier: 'NZ Couriers', service: 'Express', mode: 'Courier', status: 'in-transit', eta: daysFromNow(0), pieces: 2, weightKg: 34 },
    { id: 'SHP-6', reference: 'EFM-CON-88301', accountId: 'ACC-4', carrierId: 'CARR-3', brand: 'EFM', origin: 'Brisbane, QLD', destination: 'Cairns, QLD', carrier: 'Followmont Transport', service: 'Road LTL', mode: 'Road', status: 'picked-up', eta: daysFromNow(2), pieces: 4, weightKg: 1200 },
    { id: 'SHP-7', reference: 'EFM-CON-88330', accountId: 'ACC-1', carrierId: 'CARR-1', brand: 'EFM', origin: 'Melbourne, VIC', destination: 'Geelong, VIC', carrier: 'StarTrack', service: 'Road FTL', mode: 'Road', status: 'delivered', eta: daysAgo(1), pieces: 20, weightKg: 3100 },
    { id: 'SHP-8', reference: 'AFS-CON-40233', accountId: 'ACC-5', carrierId: 'CARR-7', brand: 'AFS', origin: 'Auckland, NZ', destination: 'Christchurch, NZ', carrier: 'Mainfreight', service: 'Sea LCL', mode: 'Sea', status: 'in-transit', eta: daysFromNow(4), pieces: 10, weightKg: 5400 },
    { id: 'SHP-9', reference: 'EFM-CON-88355', accountId: 'ACC-7', carrierId: 'CARR-10', brand: 'EFM', origin: 'Adelaide, SA', destination: 'Darwin, NT', carrier: 'Northline', service: 'Road FTL', mode: 'Road', status: 'in-transit', eta: daysFromNow(5), pieces: 6, weightKg: 8200 },
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

  // --- Manually-logged cases (not from efmAPP) ------------------------------
  const manualCases = [
    {
      id: 'CASE-1', subject: 'POD copy requested for EFM-CON-88330', brand: 'EFM',
      accountId: 'ACC-1', accountName: 'Kingfisher Hardware', contactId: 'CON-1',
      shipmentId: 'SHP-7', shipmentRef: 'EFM-CON-88330', carrierId: 'CARR-1', carrierName: 'StarTrack',
      responsibility: 'carrier', category: 'pod-request', priority: 'low', status: 'open', origin: 'phone',
      assigneeId: 'AGT-2', assigneeName: 'Marcus Webb',
      slaDueAt: slaDueDate('low', new Date(hoursAgo(3))),
      description: 'Customer requested signed proof of delivery. Awaiting POD from StarTrack portal.',
      timeline: [{ type: 'note', message: 'Requested POD from StarTrack portal', at: hoursAgo(2) }],
      createdAt: hoursAgo(3), updatedAt: hoursAgo(2), lastActivityAt: hoursAgo(2),
    },
    {
      id: 'CASE-2', subject: 'Invoice query — duplicate fuel levy', brand: 'AFS',
      accountId: 'ACC-2', accountName: 'Corella Foods', contactId: 'CON-3',
      shipmentId: null, shipmentRef: null, carrierId: null, carrierName: null,
      responsibility: 'internal', category: 'billing', priority: 'medium', status: 'pending', origin: 'email',
      assigneeId: 'AGT-3', assigneeName: 'Sofia Almeida',
      slaDueAt: slaDueDate('medium', new Date(hoursAgo(20))),
      description: 'Customer flagged what appears to be a duplicated fuel levy on invoice #INV-77120.',
      timeline: [{ type: 'note', message: 'Escalated to billing team for review', at: hoursAgo(18) }],
      createdAt: hoursAgo(26), updatedAt: hoursAgo(18), lastActivityAt: hoursAgo(18),
    },
    {
      id: 'CASE-3', subject: 'Damaged pallet claim — resolved by Followmont', brand: 'EFM',
      accountId: 'ACC-4', accountName: 'Redgum Building Supplies', contactId: 'CON-5',
      shipmentId: 'SHP-6', shipmentRef: 'EFM-CON-88301', carrierId: 'CARR-3', carrierName: 'Followmont Transport',
      responsibility: 'carrier', category: 'claim', priority: 'high', status: 'resolved', origin: 'phone',
      assigneeId: 'AGT-1', assigneeName: 'Priya Nair',
      slaDueAt: slaDueDate('high', new Date(daysAgo(4))),
      description: 'One pallet of tiles damaged in transit. Claim lodged with Followmont; credit issued.',
      timeline: [
        { type: 'system', message: 'Case created', at: daysAgo(4) },
        { type: 'note', message: 'Claim lodged with Followmont', at: daysAgo(3) },
        { type: 'system', message: 'Status changed to resolved', at: daysAgo(1) },
      ],
      createdAt: daysAgo(4), updatedAt: daysAgo(1), lastActivityAt: daysAgo(1), resolvedAt: daysAgo(1),
    },
  ];
  manualCases.forEach((c) => db.insert('cases', c));

  // --- Account activities ---------------------------------------------------
  const activities = [
    { id: 'ACT-1', accountId: 'ACC-3', type: 'call', subject: 'QBR follow-up on cold-chain excursions', agentId: 'AGT-4', at: daysAgo(2) },
    { id: 'ACT-2', accountId: 'ACC-1', type: 'meeting', subject: 'Peak-season capacity planning', agentId: 'AGT-4', at: daysAgo(5) },
    { id: 'ACT-3', accountId: 'ACC-2', type: 'email', subject: 'Shared transit-time variance report', agentId: 'AGT-4', at: daysAgo(1) },
    { id: 'ACT-4', accountId: 'ACC-3', type: 'note', subject: 'Health downgraded to at-risk after 2nd excursion', agentId: 'AGT-4', at: daysAgo(1) },
  ];
  activities.forEach((a) => db.insert('activities', { ...a, createdAt: a.at }));

  // --- Account document library ---------------------------------------------
  const documents = [
    { id: 'DOC-1', accountId: 'ACC-1', type: 'agreement', title: 'Managed Freight Services Agreement', period: '2024–2026', date: dateOnly(-540), expiryDate: dateOnly(45), owner: 'AGT-4', status: 'signed', value: 1850000, url: 'https://vault.example/kingfisher/msa-2024.pdf', version: 'v2', notes: 'Auto-renews unless 60-day notice. Renewal window opening soon.' },
    { id: 'DOC-2', accountId: 'ACC-1', type: 'rate-card', title: 'FY26 Road LTL/FTL Rate Card', period: 'FY2026', date: dateOnly(-120), expiryDate: dateOnly(245), owner: 'AGT-4', status: 'active', url: 'https://vault.example/kingfisher/rates-fy26.xlsx', version: 'v3' },
    { id: 'DOC-3', accountId: 'ACC-1', type: 'qbr', title: 'Q2 FY26 Business Review', period: 'Q2 FY26', date: dateOnly(-30), owner: 'AGT-4', status: 'shared', url: 'https://vault.example/kingfisher/qbr-q2fy26.pptx', notes: 'Peak-season capacity plan endorsed.' },
    { id: 'DOC-4', accountId: 'ACC-1', type: 'monthly-deck', title: 'June performance deck', period: 'Jun 2026', date: dateOnly(-25), owner: 'AGT-4', status: 'shared', url: 'https://vault.example/kingfisher/monthly-jun26.pdf' },
    { id: 'DOC-5', accountId: 'ACC-2', type: 'agreement', title: 'Inbound Freight Management Agreement', period: '2023–2025', date: dateOnly(-380), expiryDate: dateOnly(150), owner: 'AGT-4', status: 'signed', value: 940000, url: 'https://vault.example/corella/agreement.pdf', version: 'v1' },
    { id: 'DOC-6', accountId: 'ACC-2', type: 'rate-card', title: 'Reefer + Road Inbound Rate Card', period: '2026', date: dateOnly(-60), owner: 'AGT-4', status: 'active', url: 'https://vault.example/corella/rates-2026.xlsx', version: 'v2' },
    { id: 'DOC-7', accountId: 'ACC-2', type: 'qbr', title: 'H1 2026 Business Review', period: 'H1 2026', date: dateOnly(-14), owner: 'AGT-4', status: 'shared', url: 'https://vault.example/corella/qbr-h1.pptx', notes: 'Transit-time variance a key theme.' },
    { id: 'DOC-8', accountId: 'ACC-3', type: 'agreement', title: 'Cold-Chain Logistics Agreement', period: '2024–2027', date: dateOnly(-560), expiryDate: dateOnly(400), owner: 'AGT-4', status: 'signed', value: 1220000, url: 'https://vault.example/sxhealth/agreement.pdf', version: 'v1' },
    { id: 'DOC-9', accountId: 'ACC-3', type: 'rate-card', title: 'Air Cold-Chain Rate Card', period: '2026', date: dateOnly(-90), owner: 'AGT-4', status: 'active', url: 'https://vault.example/sxhealth/rates.xlsx', version: 'v1' },
    { id: 'DOC-10', accountId: 'ACC-3', type: 'qbr', title: 'Q2 2026 Business Review (cold-chain incidents)', period: 'Q2 2026', date: dateOnly(-7), owner: 'AGT-4', status: 'shared', url: 'https://vault.example/sxhealth/qbr-q2.pptx', notes: 'Remediation plan for excursions agreed.' },
    { id: 'DOC-11', accountId: 'ACC-3', type: 'monthly-deck', title: 'July performance deck', period: 'Jul 2026', date: dateOnly(-2), owner: 'AGT-4', status: 'draft', notes: 'Draft — awaiting cold-chain KPIs.' },
    { id: 'DOC-12', accountId: 'ACC-4', type: 'rate-card', title: 'Regional QLD Parcel Rate Card', period: '2026', date: dateOnly(-45), owner: 'AGT-4', status: 'active', url: 'https://vault.example/redgum/rates.xlsx', version: 'v1' },
    { id: 'DOC-13', accountId: 'ACC-5', type: 'agreement', title: 'Trans-Tasman Freight Agreement', period: '2025–2027', date: dateOnly(-200), expiryDate: dateOnly(500), owner: 'AGT-4', status: 'signed', value: 1050000, url: 'https://vault.example/tasman/agreement.pdf', version: 'v1' },
    { id: 'DOC-14', accountId: 'ACC-7', type: 'agreement', title: 'Remote-Site Freight Agreement', period: '2026', date: dateOnly(-30), expiryDate: dateOnly(335), owner: 'AGT-4', status: 'active', value: 1480000, url: 'https://vault.example/pilbara/agreement.pdf', version: 'v1' },
  ];
  documents.forEach((d) => db.insert('documents', { ...d, createdAt: d.date, updatedAt: d.date }));

  // --- Action register ------------------------------------------------------
  const actions = [
    { id: 'ACTN-1', accountId: 'ACC-1', title: 'Confirm peak-season carrier capacity commitments', owner: 'AGT-4', dueDate: dateOnly(7), status: 'in-progress', priority: 'high', source: 'qbr', documentId: 'DOC-3' },
    { id: 'ACTN-2', accountId: 'ACC-1', title: 'Issue 60-day renewal notice decision to Kingfisher', owner: 'AGT-4', dueDate: dateOnly(10), status: 'open', priority: 'high', source: 'rate-review', documentId: 'DOC-1' },
    { id: 'ACTN-3', accountId: 'ACC-2', title: 'Share transit-time variance improvement plan', owner: 'AGT-4', dueDate: dateOnly(-2), status: 'open', priority: 'high', source: 'qbr', documentId: 'DOC-7', notes: 'Overdue — chase.' },
    { id: 'ACTN-4', accountId: 'ACC-3', title: 'Deliver cold-chain excursion root-cause analysis', owner: 'AGT-4', dueDate: dateOnly(3), status: 'in-progress', priority: 'high', source: 'qbr', documentId: 'DOC-10' },
    { id: 'ACTN-5', accountId: 'ACC-3', title: 'Finalise July performance deck with cold-chain KPIs', owner: 'AGT-4', dueDate: dateOnly(5), status: 'open', priority: 'medium', source: 'monthly-deck', documentId: 'DOC-11' },
    { id: 'ACTN-6', accountId: 'ACC-4', title: 'Review parcel rate card ahead of contract renewal', owner: 'AGT-4', dueDate: dateOnly(21), status: 'open', priority: 'medium', source: 'rate-review', documentId: 'DOC-12' },
    { id: 'ACTN-7', accountId: 'ACC-1', title: 'Circulate June deck highlights to store ops', owner: 'AGT-4', dueDate: dateOnly(-8), status: 'done', priority: 'low', source: 'monthly-deck', documentId: 'DOC-4' },
  ];
  actions.forEach((a) => db.insert('actions', { ...a, createdAt: daysAgo(10), updatedAt: daysAgo(1), completedAt: a.status === 'done' ? daysAgo(1) : null }));

  // --- Annual price reviews (carrier/customer combinations, staggered dates) -
  const priceReviews = [
    { id: 'PRV-1', title: 'Kingfisher × StarTrack — FY27 CPI increase', scope: 'carrier-customer', accountId: 'ACC-1', carrierId: 'CARR-1', brand: 'EFM', method: 'cpi', cpiRate: 3.8, increasePercent: 3.8, effectiveDate: dateOnly(40), reviewDate: dateOnly(10), baselineValue: 620000, status: 'in-review', ownerId: 'AGT-4', notes: 'CPI-linked per MSA. Notify 30 days before effective date.' },
    { id: 'PRV-2', title: 'Kingfisher × Border Express — FY27 negotiated', scope: 'carrier-customer', accountId: 'ACC-1', carrierId: 'CARR-6', brand: 'EFM', method: 'negotiated', increasePercent: 5.2, effectiveDate: dateOnly(55), reviewDate: dateOnly(20), baselineValue: 310000, status: 'planned', ownerId: 'AGT-4', notes: 'Different increase date to StarTrack lane.' },
    { id: 'PRV-3', title: 'Corella Foods — whole-of-customer review', scope: 'customer', accountId: 'ACC-2', carrierId: null, brand: 'AFS', method: 'fixed-percent', increasePercent: 4.5, effectiveDate: dateOnly(25), reviewDate: dateOnly(-3), baselineValue: 940000, status: 'notified', ownerId: 'AGT-4', notes: 'Customer notified; awaiting acceptance.' },
    { id: 'PRV-4', title: 'Southern Cross × Toll — fuel adjustment', scope: 'carrier-customer', accountId: 'ACC-3', carrierId: 'CARR-4', brand: 'AFS', method: 'fuel-adjustment', increasePercent: 2.1, effectiveDate: dateOnly(15), reviewDate: dateOnly(-10), baselineValue: 480000, status: 'disputed', ownerId: 'AGT-4', notes: 'Customer disputing fuel levy basis.' },
    { id: 'PRV-5', title: 'Tasman Beverages × Mainfreight — trans-Tasman', scope: 'carrier-customer', accountId: 'ACC-5', carrierId: 'CARR-7', brand: 'AFS', method: 'market', increasePercent: 6.0, effectiveDate: dateOnly(70), reviewDate: dateOnly(30), baselineValue: 540000, status: 'planned', ownerId: 'AGT-4', notes: 'Sea freight market rates firming.' },
    { id: 'PRV-6', title: 'Network-wide fuel levy refresh', scope: 'network', accountId: null, carrierId: null, brand: 'EFM', method: 'fuel-adjustment', increasePercent: 1.5, effectiveDate: dateOnly(5), reviewDate: dateOnly(-1), baselineValue: null, status: 'approved', ownerId: 'AGT-4', notes: 'Applies across all EFM lanes.' },
  ];
  priceReviews.forEach((p) => db.insert('priceReviews', { ...p, lane: null, createdAt: daysAgo(20), updatedAt: daysAgo(2) }));

  // --- Solution / engineering / analytics requests --------------------------
  const requests = [
    { id: 'REQ-1', title: 'Design consolidated east-coast LTL network', type: 'solution-design', accountId: 'ACC-1', brand: 'EFM', priority: 'high', status: 'in-progress', requestedBy: 'Elena Fischer', ownerId: 'AGT-4', dueDate: dateOnly(12), description: 'Model consolidation of 42 stores onto StarTrack + Border Express.' },
    { id: 'REQ-2', title: 'efmAPP EDI integration for inbound milestones', type: 'integration', accountId: 'ACC-2', brand: 'AFS', priority: 'medium', status: 'scoping', requestedBy: 'Raj Patel', ownerId: 'AGT-5', dueDate: dateOnly(25), description: 'Push inbound milestone events into Corella WMS.' },
    { id: 'REQ-3', title: 'Cold-chain excursion analytics dashboard', type: 'analytics', accountId: 'ACC-3', brand: 'AFS', priority: 'high', status: 'new', requestedBy: 'Dr. Amelia Stone', ownerId: 'AGT-6', dueDate: dateOnly(8), description: 'Temperature excursion trends by lane and carrier.' },
    { id: 'REQ-4', title: 'Monthly freight-spend data extract', type: 'data-extract', accountId: 'ACC-7', brand: 'EFM', priority: 'low', status: 'delivered', requestedBy: 'Grace Liu', ownerId: 'AGT-4', dueDate: dateOnly(-5), description: 'CSV of freight spend by cost centre.' },
    { id: 'REQ-5', title: 'Remote-site lane optimisation study', type: 'optimisation', accountId: 'ACC-7', brand: 'EFM', priority: 'medium', status: 'in-progress', requestedBy: 'Grace Liu', ownerId: 'AGT-6', dueDate: dateOnly(18), description: 'Optimise Adelaide→Darwin remote-site routing.' },
  ];
  requests.forEach((r) => db.insert('requests', { ...r, createdAt: daysAgo(15), updatedAt: daysAgo(1) }));

  // --- At-risk register -----------------------------------------------------
  const risks = [
    { id: 'RISK-1', accountId: 'ACC-3', brand: 'AFS', title: 'Cold-chain excursions eroding confidence', category: 'service', severity: 'critical', likelihood: 'likely', revenueAtRisk: 1220000, status: 'mitigating', mitigationPlan: 'Root-cause analysis + Toll remediation plan + weekly exec check-ins.', ownerId: 'AGT-4', reviewDate: dateOnly(7) },
    { id: 'RISK-2', accountId: 'ACC-5', brand: 'AFS', title: 'Competitor pitching trans-Tasman lanes', category: 'competitor', severity: 'high', likelihood: 'possible', revenueAtRisk: 420000, status: 'open', mitigationPlan: 'Accelerate trans-Tasman program (DEAL-4); lock Mainfreight rates.', ownerId: 'AGT-6', reviewDate: dateOnly(14) },
    { id: 'RISK-3', accountId: 'ACC-2', brand: 'AFS', title: 'Transit-time variance complaints', category: 'service', severity: 'medium', likelihood: 'possible', revenueAtRisk: 180000, status: 'monitoring', mitigationPlan: 'Deliver variance improvement plan; control-tower rollout.', ownerId: 'AGT-4', reviewDate: dateOnly(21) },
  ];
  risks.forEach((r) => db.insert('risks', { ...r, createdAt: daysAgo(12), updatedAt: daysAgo(2) }));

  // --- Implementations (new customer + carrier change) ----------------------
  const cl = (arr, done) => arr.map((task, i) => ({ id: `CL-${i + 1}`, task, done: i < done }));
  const implementations = [
    { id: 'IMP-1', title: 'Redgum — regional QLD parcel go-live', type: 'new-customer', accountId: 'ACC-4', brand: 'EFM', status: 'go-live', goLiveDate: dateOnly(6), fromCarrierId: null, toCarrierId: 'CARR-3', ownerId: 'AGT-4', notes: 'Followmont onboarded for QLD regional.', checklist: cl(['Kick-off & scope', 'Carrier setup & rates loaded', 'efmAPP integration / EDI', 'Test consignments', 'Go-live sign-off', 'Post go-live review'], 4) },
    { id: 'IMP-2', title: 'Pilbara — change carrier Toll → Northline (remote NT/WA)', type: 'carrier-change', accountId: 'ACC-7', brand: 'EFM', status: 'in-progress', goLiveDate: dateOnly(20), fromCarrierId: 'CARR-4', toCarrierId: 'CARR-10', ownerId: 'AGT-4', notes: 'Moving remote-site lanes to Northline; parallel-run underway.', checklist: cl(['Confirm new carrier & rates', 'Notify outgoing carrier', 'Update lanes & routing rules', 'Parallel-run test', 'Cutover', 'Verify tracking events flowing'], 3) },
    { id: 'IMP-3', title: 'Kauri Electronics — new customer onboarding', type: 'new-customer', accountId: 'ACC-6', brand: 'AFS', status: 'planning', goLiveDate: dateOnly(35), fromCarrierId: null, toCarrierId: 'CARR-8', ownerId: 'AGT-6', notes: 'Signature-required express via NZ Couriers.', checklist: cl(['Kick-off & scope', 'Carrier setup & rates loaded', 'efmAPP integration / EDI', 'Test consignments', 'Go-live sign-off', 'Post go-live review'], 1) },
  ];
  implementations.forEach((i) => db.insert('implementations', { ...i, createdAt: daysAgo(18), updatedAt: daysAgo(1) }));

  // --- Credit claims (mostly against carriers) ------------------------------
  const creditClaims = [
    { id: 'CLM-1', accountId: 'ACC-4', brand: 'EFM', carrierId: 'CARR-3', shipmentId: 'SHP-6', shipmentRef: 'EFM-CON-88301', reference: 'CLM-2026-1001', amount: 2400, currency: 'AUD', reason: 'damage', against: 'carrier', status: 'under-review', lodgedDate: dateOnly(-3), ownerId: 'AGT-1', notes: 'Pallet of tiles damaged in transit; lodged with Followmont.' },
    { id: 'CLM-2', accountId: 'ACC-3', brand: 'AFS', carrierId: 'CARR-4', shipmentId: 'SHP-3', shipmentRef: 'AFS-CON-40118', reference: 'CLM-2026-1002', amount: 5600, currency: 'AUD', reason: 'service-failure', against: 'carrier', status: 'submitted', lodgedDate: dateOnly(-1), ownerId: 'AGT-3', notes: 'Cold-chain excursion — product loss claim against Toll.' },
    { id: 'CLM-3', accountId: 'ACC-2', brand: 'AFS', carrierId: null, shipmentId: null, shipmentRef: null, reference: 'CLM-2026-1003', amount: 890, currency: 'AUD', reason: 'overcharge', against: 'internal', status: 'approved', lodgedDate: dateOnly(-9), resolvedDate: dateOnly(-2), ownerId: 'AGT-3', notes: 'Duplicate fuel levy on INV-77120; credit approved.' },
    { id: 'CLM-4', accountId: 'ACC-6', brand: 'AFS', carrierId: 'CARR-8', shipmentId: 'SHP-5', shipmentRef: 'AFS-CON-40201', reference: 'CLM-2026-1004', amount: 320, currency: 'AUD', reason: 'delay', against: 'carrier', status: 'draft', lodgedDate: dateOnly(0), ownerId: 'AGT-1', notes: 'Failed delivery — re-delivery cost recovery from NZ Couriers.' },
  ];
  creditClaims.forEach((c) => db.insert('creditClaims', { ...c, resolvedDate: c.resolvedDate || null, createdAt: daysAgo(6), updatedAt: daysAgo(1) }));

  // --- Live chat sessions (some with waiting customer messages) -------------
  const chatSessions = [
    { id: 'CHAT-1', customerName: 'Tom Baker (Kingfisher)', accountId: 'ACC-1', agentId: 'AGT-2', subject: 'ETA for EFM-CON-88213', channel: 'web', status: 'waiting', createdAt: hoursAgo(1), lastMessageAt: hoursAgo(0.2) },
    { id: 'CHAT-2', customerName: 'Website visitor', accountId: null, agentId: null, subject: 'Trans-Tasman quote enquiry', channel: 'web', status: 'waiting', createdAt: hoursAgo(0.5), lastMessageAt: hoursAgo(0.1) },
  ];
  chatSessions.forEach((s) => db.insert('chatSessions', s));
  const chatMessages = [
    { id: 'MSG-1', sessionId: 'CHAT-1', sender: 'customer', text: 'Hi, any update on consignment EFM-CON-88213 to Sydney?', at: hoursAgo(1), readByAgent: true },
    { id: 'MSG-2', sessionId: 'CHAT-1', sender: 'agent', text: 'Hi Tom — it\'s in transit via StarTrack, currently in Albury. ETA tomorrow.', at: hoursAgo(0.9), readByAgent: true },
    { id: 'MSG-3', sessionId: 'CHAT-1', sender: 'customer', text: 'Great — can you send the POD once delivered?', at: hoursAgo(0.2), readByAgent: false },
    { id: 'MSG-4', sessionId: 'CHAT-2', sender: 'customer', text: 'Hello, we need rates for Auckland to Sydney sea freight. Can someone help?', at: hoursAgo(0.1), readByAgent: false },
  ];
  chatMessages.forEach((m) => db.insert('chatMessages', m));

  // --- Marketing campaigns (segmented by service line) ----------------------
  const campaigns = [
    { id: 'CMP-1', name: '4PL Control Tower — ANZ demand-gen', type: 'account-based', brand: '4PL', status: 'active', audience: 'Enterprise shippers, ANZ', channel: 'ABM + LinkedIn', startDate: dateOnly(-40), endDate: dateOnly(20), budget: 60000, cost: 42000, leads: 68, mql: 31, sql: 12, opportunities: 5, revenue: 930000, ownerId: 'AGT-5', notes: 'Targets 42 named 4PL prospects.' },
    { id: 'CMP-2', name: '3PL warehousing webinar series', type: 'webinar', brand: '3PL', status: 'active', audience: 'Mid-market ops managers', channel: 'Webinar', startDate: dateOnly(-20), endDate: dateOnly(10), budget: 18000, cost: 12500, leads: 140, mql: 44, sql: 9, opportunities: 3, revenue: 210000, ownerId: 'AGT-6', notes: 'Monthly 3PL best-practice webinars.' },
    { id: 'CMP-3', name: 'Trans-Tasman & Global freight guide', type: 'content', brand: 'Global', status: 'active', audience: 'Importers/exporters AU↔NZ', channel: 'Gated content', startDate: dateOnly(-30), endDate: dateOnly(30), budget: 15000, cost: 9800, leads: 96, mql: 28, sql: 7, opportunities: 4, revenue: 285000, ownerId: 'AGT-6', notes: 'Downloadable trans-Tasman rate & compliance guide.' },
    { id: 'CMP-4', name: 'Peak-season readiness email nurture', type: 'email', brand: '4PL', status: 'completed', audience: 'Existing 4PL customers', channel: 'Email', startDate: dateOnly(-90), endDate: dateOnly(-20), budget: 8000, cost: 6200, leads: 52, mql: 18, sql: 6, opportunities: 3, revenue: 160000, ownerId: 'AGT-5', notes: 'Drove peak-season expansion conversations.' },
    { id: 'CMP-5', name: 'MEGATRANS trade show 2026', type: 'event', brand: '3PL', status: 'planned', audience: 'Logistics buyers, Melbourne', channel: 'Trade show', startDate: dateOnly(35), endDate: dateOnly(37), budget: 55000, cost: 0, leads: 0, mql: 0, sql: 0, opportunities: 0, revenue: 0, ownerId: 'AGT-6', notes: 'Booth + speaking slot at MEGATRANS.' },
    { id: 'CMP-6', name: 'Cold-chain compliance social campaign', type: 'social', brand: 'Global', status: 'paused', audience: 'Healthcare & pharma shippers', channel: 'LinkedIn + X', startDate: dateOnly(-15), endDate: dateOnly(45), budget: 12000, cost: 4300, leads: 22, mql: 6, sql: 1, opportunities: 0, revenue: 0, ownerId: 'AGT-6', notes: 'Paused pending Southern Cross remediation story.' },
  ];
  campaigns.forEach((c) => db.insert('campaigns', { ...c, createdAt: daysAgo(45), updatedAt: daysAgo(2) }));

  // --- NPS & CSAT survey responses ------------------------------------------
  const svy = (id, type, score, accountId, days, comment, channel, respondent) =>
    ({ id, type, score, accountId, respondent: respondent || '', channel: channel || (type === 'csat' ? 'post-case' : 'email'), comment: comment || '', ownerId: 'AGT-4', respondedAt: daysAgo(days), createdAt: daysAgo(days) });
  const surveys = [
    // NPS
    svy('SVY-1', 'nps', 9, 'ACC-1', 12, 'Control tower visibility has been a game-changer for peak season.', 'qbr', 'Elena Fischer'),
    svy('SVY-2', 'nps', 10, 'ACC-7', 20, 'Remote-site delivery reliability is excellent.', 'qbr', 'Grace Liu'),
    svy('SVY-3', 'nps', 7, 'ACC-2', 8, 'Good service; transit-time variance still a niggle.', 'email', 'Raj Patel'),
    svy('SVY-4', 'nps', 4, 'ACC-3', 5, 'Two cold-chain excursions have shaken our confidence.', 'email', 'Dr. Amelia Stone'),
    svy('SVY-5', 'nps', 8, 'ACC-5', 15, 'Trans-Tasman sailings mostly on time.', 'email', 'Ngaire Wilson'),
    svy('SVY-6', 'nps', 9, 'ACC-4', 25, 'Followmont regional QLD coverage is great.', 'qbr', 'Carlos Mendez'),
    svy('SVY-7', 'nps', 6, 'ACC-6', 3, 'Signature-required express occasionally missed.', 'email', 'Owen Clarke'),
    // CSAT (post-case)
    svy('SVY-8', 'csat', 5, 'ACC-1', 1, 'POD sent within minutes — thanks!', 'post-case', 'Tom Baker'),
    svy('SVY-9', 'csat', 4, 'ACC-4', 2, 'Damage claim handled well.', 'post-case', 'Carlos Mendez'),
    svy('SVY-10', 'csat', 2, 'ACC-3', 1, 'Customs hold took too long to resolve.', 'post-case', 'Dr. Amelia Stone'),
    svy('SVY-11', 'csat', 5, 'ACC-2', 6, 'Billing query resolved quickly.', 'post-case', 'Raj Patel'),
    svy('SVY-12', 'csat', 3, 'ACC-6', 2, 'Re-delivery arranged but slow to update.', 'post-case', 'Owen Clarke'),
    // Older data point for trend
    svy('SVY-13', 'nps', 8, 'ACC-1', 45, 'Consistent service quarter on quarter.', 'qbr', 'Elena Fischer'),
    svy('SVY-14', 'csat', 4, 'ACC-7', 40, 'Query handled promptly.', 'post-case', 'Grace Liu'),
  ];
  surveys.forEach((s) => db.insert('surveys', s));

  // Normalise every account-linked record to its account's service line.
  const svcOf = (id) => db.getById('accounts', id)?.brand;
  for (const coll of ['deals', 'shipments', 'cases', 'quotes', 'priceReviews', 'requests', 'risks', 'implementations', 'creditClaims', 'surveys']) {
    for (const r of db.collection(coll)) {
      if (r.accountId && svcOf(r.accountId)) r.brand = svcOf(r.accountId);
      else if (r.brand === 'EFM') r.brand = '4PL';
      else if (r.brand === 'AFS') r.brand = '3PL';
    }
  }

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
    documents: { prefix: 'DOC', start: 1 },
    actions: { prefix: 'ACTN', start: 1 },
    carriers: { prefix: 'CARR', start: 1 },
    quotes: { prefix: 'QTE', start: 1 },
    salesActivities: { prefix: 'SACT', start: 1 },
    priceReviews: { prefix: 'PRV', start: 1 },
    requests: { prefix: 'REQ', start: 1 },
    risks: { prefix: 'RISK', start: 1 },
    implementations: { prefix: 'IMP', start: 1 },
    creditClaims: { prefix: 'CLM', start: 1 },
    chatSessions: { prefix: 'CHAT', start: 1 },
    chatMessages: { prefix: 'MSG', start: 1 },
    campaigns: { prefix: 'CMP', start: 1 },
    surveys: { prefix: 'SVY', start: 1 },
  });

  // --- Replay a burst of efmAPP events (exercise carrier-linked auto-cases) --
  const replay = [
    { shipmentRef: 'EFM-CON-88213', status: 'in-transit', brand: '4PL', location: 'Albury, NSW', carrier: 'StarTrack', occurredAt: hoursAgo(6) },
    { shipmentRef: 'AFS-CON-40118', status: 'customs-hold', brand: '3PL', location: 'Adelaide Airport, SA', carrier: 'Toll Group', note: 'Import documentation review — temperature log requested', occurredAt: hoursAgo(4) },
    { shipmentRef: 'EFM-CON-88245', status: 'delayed', brand: '4PL', location: 'Kalgoorlie, WA', carrier: 'Team Global Express', note: 'Rail linehaul delay 24h', occurredAt: hoursAgo(3) },
    { shipmentRef: 'AFS-CON-40201', status: 'failed-delivery', brand: 'Global', location: 'Wellington, NZ', carrier: 'NZ Couriers', note: 'No one available to sign', occurredAt: hoursAgo(2) },
    { shipmentRef: 'EFM-CON-88355', status: 'delayed', brand: '4PL', location: 'Tennant Creek, NT', carrier: 'Northline', note: 'Road closure — flooding on Stuart Hwy', occurredAt: hoursAgo(2) },
    { shipmentRef: 'AFS-CON-40155', status: 'delivered', brand: '3PL', location: 'Melbourne, VIC', carrier: 'Border Express', occurredAt: hoursAgo(1) },
  ];
  for (const ev of replay) ingestEvent(ev);

  db.save();
  return {
    agents: db.collection('agents').length,
    carriers: db.collection('carriers').length,
    accounts: db.collection('accounts').length,
    contacts: db.collection('contacts').length,
    deals: db.collection('deals').length,
    quotes: db.collection('quotes').length,
    shipments: db.collection('shipments').length,
    cases: db.collection('cases').length,
    events: db.collection('events').length,
    documents: db.collection('documents').length,
    actions: db.collection('actions').length,
    priceReviews: db.collection('priceReviews').length,
    requests: db.collection('requests').length,
    risks: db.collection('risks').length,
    implementations: db.collection('implementations').length,
    creditClaims: db.collection('creditClaims').length,
    chatSessions: db.collection('chatSessions').length,
    campaigns: db.collection('campaigns').length,
    surveys: db.collection('surveys').length,
  };
}

// Allow `node server/seed.js` / `npm run seed`.
if (import.meta.url === `file://${process.argv[1]}`) {
  db.load();
  const summary = seed();
  console.log('[seed] database seeded:', summary);
}
