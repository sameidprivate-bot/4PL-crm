// Shared domain vocabulary for the EFM & AFS 4PL CRM.

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

export function stageMeta(key) {
  return DEAL_STAGES.find((s) => s.key === key);
}

export function slaDueDate(priority, from = new Date()) {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.medium;
  return new Date(from.getTime() + hours * 3600 * 1000).toISOString();
}
