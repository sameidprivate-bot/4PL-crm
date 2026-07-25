// Shared domain vocabulary for MOVEiTcrm (EFM & AFS 4PL).

export const BRANDS = ['EFM', 'AFS'];

// Sales pipeline stages, in order. Probabilities drive weighted forecast.
export const DEAL_STAGES = [
  { key: 'lead', label: 'Lead', probability: 10 },
  { key: 'qualified', label: 'Qualified', probability: 25 },
  { key: 'proposal', label: 'Proposal', probability: 50 },
  { key: 'negotiation', label: 'Negotiation', probability: 75 },
  { key: 'won', label: 'Closed Won', probability: 100 },
  { key: 'lost', label: 'Closed Lost', probability: 0 },
];

export const CASE_STATUSES = ['new', 'open', 'pending', 'escalated', 'resolved', 'closed'];
export const CASE_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Case categories for a 4PL freight-management desk.
export const CASE_CATEGORIES = [
  'delivery-exception',
  'delay',
  'customs',
  'damage',
  'lost-freight',
  'pod-request',
  'tracking-query',
  'billing',
  'booking',
  'claim',
  'general',
];

// SLA response targets (in hours) by priority — used to compute due dates
// and flag breaches on the customer-service desk.
export const SLA_HOURS = {
  urgent: 2,
  high: 4,
  medium: 12,
  low: 24,
};

// Account health / tiering for account management.
export const ACCOUNT_TIERS = ['strategic', 'enterprise', 'mid-market', 'small-business'];
export const ACCOUNT_HEALTH = ['healthy', 'watch', 'at-risk'];

// --- Carriers (the transport providers a 4PL manages) -----------------------
export const CARRIER_MODES = ['Road', 'Rail', 'Air', 'Sea', 'Courier'];
export const CARRIER_STATUSES = ['preferred', 'active', 'onboarding', 'suspended'];

// Service regions across Australia and New Zealand.
export const REGIONS = [
  'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', // Australia
  'NZ-NI', 'NZ-SI', // New Zealand (North / South Island)
  'National AU', 'National NZ', 'Trans-Tasman',
];

// Who currently owns resolving a case. "carrier" = it's with the carrier to fix.
export const CASE_RESPONSIBILITY = ['internal', 'carrier', 'customer'];

// Default responsibility per case category — drives the "still with carrier"
// view. Freight/delivery failures sit with the carrier; commercial/admin
// issues sit internally.
export const CATEGORY_RESPONSIBILITY = {
  'delivery-exception': 'carrier',
  delay: 'carrier',
  damage: 'carrier',
  'lost-freight': 'carrier',
  'failed-delivery': 'carrier',
  'pod-request': 'carrier',
  'tracking-query': 'carrier',
  customs: 'internal',
  billing: 'internal',
  booking: 'internal',
  claim: 'carrier',
  general: 'internal',
};

export function responsibilityForCategory(category) {
  return CATEGORY_RESPONSIBILITY[category] || 'internal';
}

// --- efmAPP status-event vocabulary -----------------------------------------
// The efmAPP mobile/ops app emits milestone events for every consignment.
// These flow into the CRM so customer-service agents have live shipment
// context — and so that exceptions automatically raise cases.

export const SHIPMENT_STATUSES = [
  'booked',
  'picked-up',
  'in-transit',
  'at-hub',
  'out-for-delivery',
  'delivered',
  'pod-captured',
  'delayed',
  'exception',
  'customs-hold',
  'damaged',
  'failed-delivery',
  'lost',
  'returned',
];

// Which incoming statuses are "exceptions" that warrant a CS case, and how
// they map onto case category + priority.
export const EXCEPTION_RULES = {
  delayed: { category: 'delay', priority: 'medium' },
  exception: { category: 'delivery-exception', priority: 'high' },
  'customs-hold': { category: 'customs', priority: 'high' },
  damaged: { category: 'damage', priority: 'urgent' },
  'failed-delivery': { category: 'delivery-exception', priority: 'high' },
  lost: { category: 'lost-freight', priority: 'urgent' },
};

export const EXCEPTION_STATUSES = Object.keys(EXCEPTION_RULES);

export function isExceptionStatus(status) {
  return Object.prototype.hasOwnProperty.call(EXCEPTION_RULES, status);
}

// --- Miller Heiman "Blue Sheet" (Strategic Selling) vocabulary --------------
// Fields that structure a strategic-selling analysis for a complex 4PL deal.

// The four buying-influence roles every complex sale has.
export const BUYING_INFLUENCE_ROLES = [
  { key: 'economic', label: 'Economic Buyer', hint: 'Final approval; controls budget; can say yes when others say no.' },
  { key: 'user', label: 'User Buyer', hint: 'Judges impact on their own job; will use / supervise use of the service.' },
  { key: 'technical', label: 'Technical Buyer', hint: 'Screens out on specs/compliance; gatekeeper; can say no, not yes.' },
  { key: 'coach', label: 'Coach', hint: 'Guides you to the win; wants your solution; gives/validates information.' },
];

// How receptive each buying influence is to change right now.
export const BUYING_MODES = [
  { key: 'growth', label: 'Growth', hint: 'Wants more/better; open to change.' },
  { key: 'trouble', label: 'Trouble', hint: 'Facing a problem; urgent to fix the gap.' },
  { key: 'even-keel', label: 'Even Keel', hint: 'No perceived gap; hard to move.' },
  { key: 'overconfident', label: 'Overconfident', hint: 'Believes reality is better than it is.' },
];

// Rating: how each buyer feels about you / your solution (-5 … +5 collapsed to bands).
export const BUYING_RATINGS = [
  { key: 'enthusiastic', label: 'Enthusiastic Advocate', score: 5 },
  { key: 'supporter', label: 'Supporter', score: 3 },
  { key: 'neutral', label: 'Neutral', score: 0 },
  { key: 'non-supporter', label: 'Non-supporter', score: -3 },
  { key: 'anti', label: 'Anti', score: -5 },
];

export const INFLUENCE_LEVELS = ['high', 'medium', 'low'];

// Where the opportunity sits in the strategic-selling funnel.
export const FUNNEL_POSITIONS = [
  { key: 'universe', label: 'Universe' },
  { key: 'above-funnel', label: 'Above the Funnel' },
  { key: 'in-funnel', label: 'In the Funnel' },
  { key: 'best-few', label: 'Best Few' },
];

export const ICP_FIT = ['strong', 'moderate', 'weak'];

// Competitive posture on the deal.
export const COMPETITION_TYPES = ['direct', 'indirect', 'status-quo', 'no-decision', 'internal'];

// An empty Blue Sheet, used when creating deals so the shape is always present.
export function emptyBlueSheet() {
  return {
    sso: '',                    // Single Sales Objective
    funnelPosition: 'in-funnel',
    icpFit: 'moderate',
    buyingInfluences: [],       // [{ id, name, title, role, rating, mode, influence, notes }]
    redFlags: [],               // [string]
    strengths: [],              // strengths to leverage — [string]
    competition: [],            // [{ type, name, notes }]
    winResults: [],             // [{ influence, win, result }]
    actionPlan: [],             // [{ id, action, owner, dueDate, status }]
    bestActionCommitment: '',
  };
}

// --- Account document library & action register -----------------------------
export const DOCUMENT_TYPES = [
  { key: 'rate-card', label: 'Rate Card' },
  { key: 'agreement', label: 'Agreement' },
  { key: 'qbr', label: 'QBR Deck' },
  { key: 'monthly-deck', label: 'Monthly Deck' },
  { key: 'other', label: 'Other' },
];

export const DOCUMENT_STATUSES = ['draft', 'active', 'signed', 'shared', 'scheduled', 'expired', 'superseded'];

export const ACTION_STATUSES = ['open', 'in-progress', 'blocked', 'done'];
export const ACTION_SOURCES = ['qbr', 'monthly-deck', 'rate-review', 'manual'];

// --- Sales: quotes & activities ---------------------------------------------
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'];
export const SALES_ACTIVITY_TYPES = ['call', 'email', 'meeting', 'site-visit', 'proposal', 'quote', 'note'];
export const LEAD_SOURCES = ['Existing account', 'Referral', 'Inbound', 'Tender', 'Website', 'Outbound', 'Event'];
export const SERVICE_TYPES = [
  'Managed LTL', 'Managed FTL', 'Managed Parcel', 'Control Tower', 'Cold Chain',
  'Network Design', 'Reverse Logistics', 'Trans-Tasman', 'Full 4PL', 'Warehousing', 'Express',
];

// Sum a quote's lines into totals + margin.
export function quoteTotals(lines = []) {
  const sell = lines.reduce((s, l) => s + (Number(l.sellRate) || 0) * (Number(l.units) || 1), 0);
  const buy = lines.reduce((s, l) => s + (Number(l.buyRate) || 0) * (Number(l.units) || 1), 0);
  const margin = sell - buy;
  const marginPct = sell > 0 ? Math.round((margin / sell) * 100) : 0;
  return { sell: Math.round(sell), buy: Math.round(buy), margin: Math.round(margin), marginPct };
}

export function stageMeta(key) {
  return DEAL_STAGES.find((s) => s.key === key);
}

export function slaDueDate(priority, from = new Date()) {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.medium;
  return new Date(from.getTime() + hours * 3600 * 1000).toISOString();
}
