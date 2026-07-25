// EFM & AFS 4PL CRM — API server.
// Serves a REST API plus the single-page frontend.

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// MOVEiTcrm — 4PL Control Tower (EFM & AFS)
import { db } from './db.js';
import { ingestEvent, ValidationError } from './events.js';
import { seed } from './seed.js';
import {
  DEAL_STAGES,
  CASE_STATUSES,
  CASE_PRIORITIES,
  CASE_CATEGORIES,
  SHIPMENT_STATUSES,
  ACCOUNT_TIERS,
  ACCOUNT_HEALTH,
  BRANDS,
  BUYING_INFLUENCE_ROLES,
  BUYING_MODES,
  BUYING_RATINGS,
  INFLUENCE_LEVELS,
  FUNNEL_POSITIONS,
  ICP_FIT,
  COMPETITION_TYPES,
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  ACTION_STATUSES,
  ACTION_SOURCES,
  CARRIER_MODES,
  CARRIER_STATUSES,
  REGIONS,
  CASE_RESPONSIBILITY,
  QUOTE_STATUSES,
  SALES_ACTIVITY_TYPES,
  LEAD_SOURCES,
  SERVICE_TYPES,
  responsibilityForCategory,
  quoteTotals,
  emptyBlueSheet,
  stageMeta,
  slaDueDate,
} from './domain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

// --- Bootstrap ---------------------------------------------------------------
db.load();
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
});
if (db.collection('accounts').length === 0) {
  console.log('[boot] empty database — seeding demo data');
  seed();
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// Small request logger.
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

const api = express.Router();

function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// --- Reference data ----------------------------------------------------------
api.get('/meta', (_req, res) => {
  res.json({
    brands: BRANDS,
    dealStages: DEAL_STAGES,
    caseStatuses: CASE_STATUSES,
    casePriorities: CASE_PRIORITIES,
    caseCategories: CASE_CATEGORIES,
    shipmentStatuses: SHIPMENT_STATUSES,
    accountTiers: ACCOUNT_TIERS,
    accountHealth: ACCOUNT_HEALTH,
    buyingInfluenceRoles: BUYING_INFLUENCE_ROLES,
    buyingModes: BUYING_MODES,
    buyingRatings: BUYING_RATINGS,
    influenceLevels: INFLUENCE_LEVELS,
    funnelPositions: FUNNEL_POSITIONS,
    icpFit: ICP_FIT,
    competitionTypes: COMPETITION_TYPES,
    documentTypes: DOCUMENT_TYPES,
    documentStatuses: DOCUMENT_STATUSES,
    actionStatuses: ACTION_STATUSES,
    actionSources: ACTION_SOURCES,
    carrierModes: CARRIER_MODES,
    carrierStatuses: CARRIER_STATUSES,
    regions: REGIONS,
    caseResponsibility: CASE_RESPONSIBILITY,
    quoteStatuses: QUOTE_STATUSES,
    salesActivityTypes: SALES_ACTIVITY_TYPES,
    leadSources: LEAD_SOURCES,
    serviceTypes: SERVICE_TYPES,
    agents: db.collection('agents'),
    carriers: db.collection('carriers').map((c) => ({ id: c.id, name: c.name, code: c.code })),
  });
});

// --- Dashboard ---------------------------------------------------------------
api.get('/dashboard', (req, res) => {
  const brand = req.query.brand;
  const bf = (r) => !brand || r.brand === brand;

  const cases = db.collection('cases').filter(bf);
  const deals = db.collection('deals').filter(bf);
  const shipments = db.collection('shipments').filter(bf);
  const events = db.collection('events').filter(bf);

  const openCaseStatuses = new Set(['new', 'open', 'pending', 'escalated']);
  const openCases = cases.filter((c) => openCaseStatuses.has(c.status));
  const now = Date.now();
  const slaBreached = openCases.filter((c) => c.slaDueAt && new Date(c.slaDueAt).getTime() < now);
  const casesWithCarrier = openCases.filter((c) => c.responsibility === 'carrier').length;

  const openPipeline = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const weightedPipeline = openPipeline.reduce(
    (sum, d) => sum + d.value * ((stageMeta(d.stage)?.probability ?? 0) / 100),
    0,
  );
  const wonThisView = deals.filter((d) => d.stage === 'won');

  const activeShipments = shipments.filter(
    (s) => !['delivered', 'pod-captured', 'returned'].includes(s.status),
  );
  const exceptionShipments = shipments.filter((s) => s.hasOpenException);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const eventsToday = events.filter((e) => new Date(e.receivedAt).getTime() >= startOfDay.getTime());
  const exceptionsToday = eventsToday.filter((e) => e.isException);

  // Account-management signals from the document library + action register.
  const accountIds = new Set(db.collection('accounts').filter(bf).map((a) => a.id));
  const openActions = db.collection('actions').filter((a) => accountIds.has(a.accountId) && a.status !== 'done');
  const overdueActions = openActions.filter((a) => a.dueDate && new Date(a.dueDate).getTime() < now);
  const in60 = now + 60 * 86400 * 1000;
  const expiringAgreements = db.collection('documents').filter(
    (dc) => accountIds.has(dc.accountId) && dc.type === 'agreement' && dc.expiryDate &&
      new Date(dc.expiryDate).getTime() < in60 && new Date(dc.expiryDate).getTime() > now,
  );

  // Case distribution by priority and by category.
  const byPriority = {};
  for (const p of CASE_PRIORITIES) byPriority[p] = openCases.filter((c) => c.priority === p).length;
  const byCategory = {};
  for (const c of openCases) byCategory[c.category] = (byCategory[c.category] || 0) + 1;

  // Pipeline value by stage.
  const pipelineByStage = DEAL_STAGES.map((s) => ({
    stage: s.key,
    label: s.label,
    count: deals.filter((d) => d.stage === s.key).length,
    value: deals.filter((d) => d.stage === s.key).reduce((sum, d) => sum + d.value, 0),
  }));

  res.json({
    kpis: {
      openCases: openCases.length,
      slaBreached: slaBreached.length,
      exceptionsToday: exceptionsToday.length,
      activeShipments: activeShipments.length,
      exceptionShipments: exceptionShipments.length,
      openPipelineValue: Math.round(openPipeline.reduce((s, d) => s + d.value, 0)),
      weightedPipelineValue: Math.round(weightedPipeline),
      wonValue: Math.round(wonThisView.reduce((s, d) => s + d.value, 0)),
      accounts: db.collection('accounts').filter(bf).length,
      atRiskAccounts: db.collection('accounts').filter(bf).filter((a) => a.health === 'at-risk').length,
      openActions: openActions.length,
      overdueActions: overdueActions.length,
      expiringAgreements: expiringAgreements.length,
      casesWithCarrier,
      carriers: db.collection('carriers').length,
    },
    byPriority,
    byCategory,
    pipelineByStage,
    recentEvents: [...events]
      .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
      .slice(0, 12),
    slaWatch: openCases
      .filter((c) => c.slaDueAt)
      .sort((a, b) => new Date(a.slaDueAt) - new Date(b.slaDueAt))
      .slice(0, 6)
      .map((c) => withSla(c)),
  });
});

// --- Accounts ----------------------------------------------------------------
api.get('/accounts', (req, res) => {
  const { brand, health, tier, q } = req.query;
  let rows = db.collection('accounts');
  if (brand) rows = rows.filter((r) => r.brand === brand);
  if (health) rows = rows.filter((r) => r.health === health);
  if (tier) rows = rows.filter((r) => r.tier === tier);
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(s) || (r.industry || '').toLowerCase().includes(s));
  }
  const openCaseStatuses = new Set(['new', 'open', 'pending', 'escalated']);
  res.json(
    rows.map((a) => ({
      ...a,
      openCases: db.filter('cases', (c) => c.accountId === a.id && openCaseStatuses.has(c.status)).length,
      openDeals: db.filter('deals', (d) => d.accountId === a.id && !['won', 'lost'].includes(d.stage)).length,
      activeShipments: db.filter('shipments', (s) => s.accountId === a.id && !['delivered', 'pod-captured', 'returned'].includes(s.status)).length,
      openActions: db.filter('actions', (x) => x.accountId === a.id && x.status !== 'done').length,
      documents: db.filter('documents', (x) => x.accountId === a.id).length,
    })),
  );
});

api.get('/accounts/:id', (req, res) => {
  const account = db.getById('accounts', req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json({
    ...account,
    owner: db.getById('agents', account.ownerId) || null,
    contacts: db.filter('contacts', (c) => c.accountId === account.id),
    cases: db.filter('cases', (c) => c.accountId === account.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    deals: db.filter('deals', (d) => d.accountId === account.id).map(decorateDeal),
    shipments: db.filter('shipments', (s) => s.accountId === account.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    activities: db.filter('activities', (x) => x.accountId === account.id).sort((a, b) => new Date(b.at) - new Date(a.at)),
    documents: db.filter('documents', (x) => x.accountId === account.id).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)),
    actions: db.filter('actions', (x) => x.accountId === account.id).sort(actionSort),
  });
});

// Sort actions: open/blocked/in-progress first (by due date), done last.
function actionSort(a, b) {
  const openA = a.status !== 'done';
  const openB = b.status !== 'done';
  if (openA !== openB) return openA ? -1 : 1;
  const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const dbb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  return da - dbb;
}

api.post('/accounts', asyncH((req, res) => {
  const b = req.body || {};
  if (!b.name) throw new ValidationError('name is required');
  const account = {
    id: db.nextId('ACC'),
    name: b.name,
    brand: b.brand || 'EFM',
    industry: b.industry || 'Other',
    tier: b.tier || 'mid-market',
    health: b.health || 'healthy',
    region: b.region || '',
    ownerId: b.ownerId || null,
    annualRevenue: Number(b.annualRevenue) || 0,
    website: b.website || '',
    phone: b.phone || '',
    notes: b.notes || '',
    activeSince: b.activeSince || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.insert('accounts', account);
  res.status(201).json(account);
}));

api.patch('/accounts/:id', asyncH((req, res) => {
  const updated = db.update('accounts', req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Account not found' });
  res.json(updated);
}));

api.post('/accounts/:id/activities', asyncH((req, res) => {
  const account = db.getById('accounts', req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const b = req.body || {};
  const activity = {
    id: db.nextId('ACT'),
    accountId: account.id,
    type: b.type || 'note',
    subject: b.subject || '',
    agentId: b.agentId || null,
    at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.insert('activities', activity);
  res.status(201).json(activity);
}));

// --- Account documents: rate cards, agreements, QBRs, monthly decks ---------
api.get('/accounts/:id/documents', (req, res) => {
  const rows = db.filter('documents', (d) => d.accountId === req.params.id);
  if (req.query.type) return res.json(rows.filter((d) => d.type === req.query.type));
  res.json(rows);
});

api.post('/accounts/:id/documents', asyncH((req, res) => {
  const account = db.getById('accounts', req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const b = req.body || {};
  if (!b.title) throw new ValidationError('title is required');
  const now = new Date().toISOString();
  const doc = {
    id: db.nextId('DOC'),
    accountId: account.id,
    type: b.type || 'other',
    title: b.title,
    period: b.period || '',
    date: b.date || now.slice(0, 10),
    expiryDate: b.expiryDate || null,
    owner: b.owner || null,
    status: b.status || 'active',
    url: b.url || '',
    value: b.value != null ? Number(b.value) : null,
    notes: b.notes || '',
    version: b.version || 'v1',
    createdAt: now,
    updatedAt: now,
  };
  db.insert('documents', doc);
  res.status(201).json(doc);
}));

api.patch('/documents/:id', asyncH((req, res) => {
  const updated = db.update('documents', req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Document not found' });
  res.json(updated);
}));

api.delete('/documents/:id', asyncH((req, res) => {
  const ok = db.remove('documents', req.params.id);
  if (!ok) return res.status(404).json({ error: 'Document not found' });
  res.json({ ok: true });
}));

// --- Account actions: QBR / monthly review action register ------------------
api.get('/accounts/:id/actions', (req, res) => {
  res.json(db.filter('actions', (a) => a.accountId === req.params.id).sort(actionSort));
});

api.post('/accounts/:id/actions', asyncH((req, res) => {
  const account = db.getById('accounts', req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const b = req.body || {};
  if (!b.title) throw new ValidationError('title is required');
  const now = new Date().toISOString();
  const action = {
    id: db.nextId('ACTN'),
    accountId: account.id,
    title: b.title,
    owner: b.owner || null,
    dueDate: b.dueDate || null,
    status: b.status || 'open',
    priority: b.priority || 'medium',
    source: b.source || 'manual',
    documentId: b.documentId || null,
    notes: b.notes || '',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  db.insert('actions', action);
  res.status(201).json(action);
}));

api.patch('/actions/:id', asyncH((req, res) => {
  const existing = db.getById('actions', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Action not found' });
  const patch = { ...req.body };
  if (patch.status === 'done' && existing.status !== 'done') patch.completedAt = new Date().toISOString();
  if (patch.status && patch.status !== 'done') patch.completedAt = null;
  res.json(db.update('actions', req.params.id, patch));
}));

// --- Contacts ----------------------------------------------------------------
api.post('/contacts', asyncH((req, res) => {
  const b = req.body || {};
  if (!b.accountId || !b.name) throw new ValidationError('accountId and name are required');
  const contact = {
    id: db.nextId('CON'),
    accountId: b.accountId,
    name: b.name,
    title: b.title || '',
    email: b.email || '',
    phone: b.phone || '',
    primary: !!b.primary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.insert('contacts', contact);
  res.status(201).json(contact);
}));

// --- Cases (customer service) ------------------------------------------------
api.get('/cases', (req, res) => {
  const { brand, status, priority, category, assigneeId, accountId, carrierId, responsibility, withCarrier, origin, q, sla } = req.query;
  let rows = [...db.collection('cases')];
  if (brand) rows = rows.filter((r) => r.brand === brand);
  if (status) rows = rows.filter((r) => r.status === status);
  if (priority) rows = rows.filter((r) => r.priority === priority);
  if (category) rows = rows.filter((r) => r.category === category);
  if (assigneeId) rows = rows.filter((r) => r.assigneeId === assigneeId);
  if (accountId) rows = rows.filter((r) => r.accountId === accountId);
  if (carrierId) rows = rows.filter((r) => r.carrierId === carrierId);
  if (responsibility) rows = rows.filter((r) => r.responsibility === responsibility);
  // withCarrier=true → cases the carrier still has to resolve.
  if (withCarrier === 'true') rows = rows.filter((r) => r.responsibility === 'carrier' && !['resolved', 'closed'].includes(r.status));
  if (origin) rows = rows.filter((r) => r.origin === origin);
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.subject || '').toLowerCase().includes(s) ||
        (r.shipmentRef || '').toLowerCase().includes(s) ||
        (r.accountName || '').toLowerCase().includes(s) ||
        (r.carrierName || '').toLowerCase().includes(s) ||
        r.id.toLowerCase().includes(s),
    );
  }
  const now = Date.now();
  if (sla === 'breached') rows = rows.filter((r) => r.slaDueAt && new Date(r.slaDueAt).getTime() < now && !['resolved', 'closed'].includes(r.status));
  rows.sort((a, b) => new Date(b.lastActivityAt || b.updatedAt) - new Date(a.lastActivityAt || a.updatedAt));
  res.json(rows.map((c) => withSla(c)));
});

api.get('/cases/:id', (req, res) => {
  const c = db.getById('cases', req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });
  res.json({
    ...withSla(c),
    account: c.accountId ? db.getById('accounts', c.accountId) : null,
    contact: c.contactId ? db.getById('contacts', c.contactId) : null,
    shipment: c.shipmentId ? db.getById('shipments', c.shipmentId) : null,
    carrier: c.carrierId ? db.getById('carriers', c.carrierId) : null,
    assignee: c.assigneeId ? db.getById('agents', c.assigneeId) : null,
  });
});

api.post('/cases', asyncH((req, res) => {
  const b = req.body || {};
  if (!b.subject) throw new ValidationError('subject is required');
  const account = b.accountId ? db.getById('accounts', b.accountId) : null;
  const priority = b.priority || 'medium';
  const now = new Date().toISOString();
  const shipment = b.shipmentId ? db.getById('shipments', b.shipmentId) : null;
  const category = b.category || 'general';
  const carrierId = b.carrierId || shipment?.carrierId || null;
  const carrier = carrierId ? db.getById('carriers', carrierId) : null;
  const newCase = {
    id: db.nextId('CASE'),
    subject: b.subject,
    brand: b.brand || account?.brand || 'EFM',
    accountId: account?.id ?? null,
    accountName: account?.name ?? null,
    contactId: b.contactId || null,
    shipmentId: b.shipmentId || null,
    shipmentRef: b.shipmentRef || shipment?.reference || null,
    carrierId,
    carrierName: carrier?.name ?? shipment?.carrier ?? null,
    responsibility: b.responsibility || responsibilityForCategory(category),
    category,
    priority,
    status: b.status || 'new',
    origin: b.origin || 'manual',
    assigneeId: b.assigneeId || null,
    assigneeName: b.assigneeId ? db.getById('agents', b.assigneeId)?.name : null,
    slaDueAt: b.slaDueAt || slaDueDate(priority),
    description: b.description || '',
    timeline: [{ type: 'system', message: 'Case created', at: now }],
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  };
  db.insert('cases', newCase);
  res.status(201).json(withSla(newCase));
}));

api.patch('/cases/:id', asyncH((req, res) => {
  const existing = db.getById('cases', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Case not found' });
  const b = req.body || {};
  const patch = { ...b, lastActivityAt: new Date().toISOString() };

  // Keep denormalised fields in sync.
  if (b.assigneeId !== undefined) patch.assigneeName = b.assigneeId ? db.getById('agents', b.assigneeId)?.name : null;
  if (b.carrierId !== undefined) patch.carrierName = b.carrierId ? db.getById('carriers', b.carrierId)?.name : null;
  if (b.priority && b.priority !== existing.priority && !b.slaDueAt) {
    patch.slaDueAt = slaDueDate(b.priority, new Date(existing.createdAt));
  }
  if (b.status && ['resolved', 'closed'].includes(b.status) && !existing.resolvedAt) {
    patch.resolvedAt = new Date().toISOString();
  }

  const timeline = existing.timeline || [];
  const at = new Date().toISOString();
  if (b.status && b.status !== existing.status) {
    timeline.push({ type: 'system', message: `Status changed to ${b.status}`, at });
  }
  if (b.responsibility && b.responsibility !== existing.responsibility) {
    timeline.push({ type: 'system', message: `Responsibility set to ${b.responsibility}${b.responsibility === 'carrier' ? ' — awaiting carrier' : ''}`, at });
  }
  patch.timeline = timeline;
  const updated = db.update('cases', req.params.id, patch);
  res.json(withSla(updated));
}));

api.post('/cases/:id/notes', asyncH((req, res) => {
  const existing = db.getById('cases', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Case not found' });
  const b = req.body || {};
  if (!b.message) throw new ValidationError('message is required');
  const timeline = existing.timeline || [];
  timeline.push({ type: 'note', message: b.message, agentId: b.agentId || null, at: new Date().toISOString() });
  const updated = db.update('cases', req.params.id, { timeline, lastActivityAt: new Date().toISOString() });
  res.status(201).json(withSla(updated));
}));

function withSla(c) {
  const now = Date.now();
  const open = !['resolved', 'closed'].includes(c.status);
  let slaState = 'none';
  let slaHoursRemaining = null;
  if (c.slaDueAt) {
    const diffMs = new Date(c.slaDueAt).getTime() - now;
    slaHoursRemaining = Math.round((diffMs / 3600000) * 10) / 10;
    if (!open) slaState = 'met';
    else if (diffMs < 0) slaState = 'breached';
    else if (diffMs < 3600000) slaState = 'due-soon';
    else slaState = 'on-track';
  }
  return { ...c, slaState, slaHoursRemaining };
}

// --- Deals (sales pipeline) --------------------------------------------------
api.get('/deals', (req, res) => {
  const { brand, stage, ownerId, accountId, q } = req.query;
  let rows = [...db.collection('deals')];
  if (brand) rows = rows.filter((r) => r.brand === brand);
  if (stage) rows = rows.filter((r) => r.stage === stage);
  if (ownerId) rows = rows.filter((r) => r.ownerId === ownerId);
  if (accountId) rows = rows.filter((r) => r.accountId === accountId);
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter((r) => (r.name || '').toLowerCase().includes(s) || (r.prospectName || '').toLowerCase().includes(s));
  }
  res.json(rows.map(decorateDeal));
});

api.get('/deals/board', (req, res) => {
  const brand = req.query.brand;
  const rows = db.collection('deals').filter((d) => !brand || d.brand === brand);
  const board = DEAL_STAGES.map((s) => {
    const deals = rows.filter((d) => d.stage === s.key).map(decorateDeal);
    return {
      stage: s.key,
      label: s.label,
      probability: s.probability,
      count: deals.length,
      value: deals.reduce((sum, d) => sum + d.value, 0),
      deals: deals.sort((a, b) => b.value - a.value),
    };
  });
  res.json(board);
});

api.post('/deals', asyncH((req, res) => {
  const b = req.body || {};
  if (!b.name) throw new ValidationError('name is required');
  const account = b.accountId ? db.getById('accounts', b.accountId) : null;
  const now = new Date().toISOString();
  const deal = {
    id: db.nextId('DEAL'),
    name: b.name,
    accountId: account?.id ?? null,
    prospectName: b.prospectName || null,
    brand: b.brand || account?.brand || 'EFM',
    stage: b.stage || 'lead',
    value: Number(b.value) || 0,
    ownerId: b.ownerId || null,
    serviceType: b.serviceType || 'Managed Freight',
    expectedCloseAt: b.expectedCloseAt || null,
    source: b.source || 'Direct',
    blueSheet: { ...emptyBlueSheet(), ...(b.blueSheet || {}) },
    createdAt: now,
    updatedAt: now,
  };
  db.insert('deals', deal);
  res.status(201).json(decorateDeal(deal));
}));

api.get('/deals/:id', (req, res) => {
  const d = db.getById('deals', req.params.id);
  if (!d) return res.status(404).json({ error: 'Deal not found' });
  if (!d.blueSheet) d.blueSheet = emptyBlueSheet();
  res.json({
    ...decorateDeal(d),
    account: d.accountId ? db.getById('accounts', d.accountId) : null,
    owner: d.ownerId ? db.getById('agents', d.ownerId) : null,
    quotes: db.filter('quotes', (q) => q.dealId === d.id).map(decorateQuote),
    activities: db.filter('salesActivities', (x) => x.dealId === d.id)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .map((x) => ({ ...x, agentName: x.agentId ? db.getById('agents', x.agentId)?.name : null })),
  });
});

// Update just the Blue Sheet (Strategic Selling analysis).
api.put('/deals/:id/bluesheet', asyncH((req, res) => {
  const existing = db.getById('deals', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });
  const blueSheet = { ...emptyBlueSheet(), ...(existing.blueSheet || {}), ...(req.body || {}) };
  const updated = db.update('deals', req.params.id, { blueSheet });
  res.json(decorateDeal(updated));
}));

api.patch('/deals/:id', asyncH((req, res) => {
  const existing = db.getById('deals', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });
  const b = req.body || {};
  const patch = { ...b };
  // Stamp a close date and log win/loss when a deal reaches a terminal stage.
  if (b.stage && ['won', 'lost'].includes(b.stage) && !['won', 'lost'].includes(existing.stage)) {
    patch.closedAt = new Date().toISOString();
  }
  if (b.ownerId !== undefined) patch.ownerName = b.ownerId ? db.getById('agents', b.ownerId)?.name : null;
  const updated = db.update('deals', req.params.id, patch);
  res.json(decorateDeal(updated));
}));

// --- Sales: quotes (with carrier buy/sell rate lines) -----------------------
api.get('/quotes', (req, res) => {
  const { brand, status, accountId, dealId } = req.query;
  let rows = [...db.collection('quotes')];
  if (brand) rows = rows.filter((r) => r.brand === brand);
  if (status) rows = rows.filter((r) => r.status === status);
  if (accountId) rows = rows.filter((r) => r.accountId === accountId);
  if (dealId) rows = rows.filter((r) => r.dealId === dealId);
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(rows.map(decorateQuote));
});

api.post('/quotes', asyncH((req, res) => {
  const b = req.body || {};
  if (!b.title && !b.accountId) throw new ValidationError('title or accountId is required');
  const account = b.accountId ? db.getById('accounts', b.accountId) : null;
  const now = new Date().toISOString();
  const quote = {
    id: db.nextId('QTE'),
    title: b.title || `Quote for ${account?.name || 'prospect'}`,
    accountId: account?.id ?? null,
    dealId: b.dealId || null,
    brand: b.brand || account?.brand || 'EFM',
    status: b.status || 'draft',
    ownerId: b.ownerId || null,
    validUntil: b.validUntil || null,
    currency: b.currency || 'AUD',
    lines: (b.lines || []).map((l, i) => ({ id: `QL-${i + 1}`, ...l })),
    notes: b.notes || '',
    createdAt: now,
    updatedAt: now,
  };
  db.insert('quotes', quote);
  res.status(201).json(decorateQuote(quote));
}));

api.patch('/quotes/:id', asyncH((req, res) => {
  const existing = db.getById('quotes', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Quote not found' });
  const updated = db.update('quotes', req.params.id, req.body || {});
  res.json(decorateQuote(updated));
}));

function decorateQuote(q) {
  const totals = quoteTotals(q.lines);
  return {
    ...q,
    accountName: q.accountId ? db.getById('accounts', q.accountId)?.name : null,
    ownerName: q.ownerId ? db.getById('agents', q.ownerId)?.name : null,
    lines: (q.lines || []).map((l) => ({ ...l, carrierName: l.carrierId ? db.getById('carriers', l.carrierId)?.name : l.carrierName || null })),
    totals,
  };
}

// --- Sales: activity log per deal -------------------------------------------
api.post('/deals/:id/activities', asyncH((req, res) => {
  const deal = db.getById('deals', req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  const b = req.body || {};
  const activity = {
    id: db.nextId('SACT'),
    dealId: deal.id,
    accountId: deal.accountId || null,
    type: b.type || 'note',
    subject: b.subject || '',
    agentId: b.agentId || deal.ownerId || null,
    at: new Date().toISOString(),
  };
  db.insert('salesActivities', activity);
  res.status(201).json(activity);
}));

// --- Sales overview / reporting ---------------------------------------------
api.get('/sales/overview', (req, res) => {
  const brand = req.query.brand;
  const deals = db.collection('deals').filter((d) => !brand || d.brand === brand);
  const open = deals.filter((d) => !['won', 'lost'].includes(d.stage));
  const won = deals.filter((d) => d.stage === 'won');
  const lost = deals.filter((d) => d.stage === 'lost');
  const closed = won.length + lost.length;

  const sum = (arr, f = (d) => d.value) => Math.round(arr.reduce((s, d) => s + (f(d) || 0), 0));
  const weighted = Math.round(open.reduce((s, d) => s + d.value * ((stageMeta(d.stage)?.probability ?? 0) / 100), 0));

  const groupBy = (arr, key) => {
    const m = {};
    for (const d of arr) {
      const k = typeof key === 'function' ? key(d) : d[key];
      const g = (m[k] = m[k] || { key: k, count: 0, value: 0 });
      g.count += 1; g.value += d.value || 0;
    }
    return Object.values(m).map((g) => ({ ...g, value: Math.round(g.value) })).sort((a, b) => b.value - a.value);
  };

  // Forecast by expected-close month for open deals (weighted).
  const forecast = {};
  for (const d of open) {
    if (!d.expectedCloseAt) continue;
    const key = new Date(d.expectedCloseAt).toISOString().slice(0, 7);
    const g = (forecast[key] = forecast[key] || { month: key, value: 0, weighted: 0, count: 0 });
    g.count += 1; g.value += d.value; g.weighted += d.value * ((stageMeta(d.stage)?.probability ?? 0) / 100);
  }

  const agents = db.collection('agents').filter((a) => a.team === 'Sales' || deals.some((d) => d.ownerId === a.id));
  const byOwner = agents.map((a) => {
    const mine = deals.filter((d) => d.ownerId === a.id);
    const myOpen = mine.filter((d) => !['won', 'lost'].includes(d.stage));
    const myWon = mine.filter((d) => d.stage === 'won');
    return {
      id: a.id, name: a.name, target: a.salesTarget || 0,
      openValue: sum(myOpen), wonValue: sum(myWon),
      weighted: Math.round(myOpen.reduce((s, d) => s + d.value * ((stageMeta(d.stage)?.probability ?? 0) / 100), 0)),
      openCount: myOpen.length, wonCount: myWon.length,
    };
  }).filter((o) => o.openCount || o.wonCount || o.target);

  const quotes = db.collection('quotes').filter((qt) => !brand || qt.brand === brand);
  const outstandingQuotes = quotes.filter((qt) => ['draft', 'sent'].includes(qt.status));

  res.json({
    kpis: {
      openValue: sum(open),
      weightedValue: weighted,
      wonValue: sum(won),
      lostValue: sum(lost),
      openCount: open.length,
      wonCount: won.length,
      winRate: closed ? Math.round((won.length / closed) * 100) : null,
      avgDealSize: open.length ? Math.round(sum(open) / open.length) : 0,
      quotesOutstanding: outstandingQuotes.length,
      quotesOutstandingValue: Math.round(outstandingQuotes.reduce((s, qt) => s + quoteTotals(qt.lines).sell, 0)),
    },
    byService: groupBy(open, 'serviceType'),
    bySource: groupBy(open, (d) => d.source || 'Direct'),
    byOwner,
    forecast: Object.values(forecast).map((f) => ({ ...f, value: Math.round(f.value), weighted: Math.round(f.weighted) })).sort((a, b) => a.month.localeCompare(b.month)),
    topDeals: [...open].sort((a, b) => b.value - a.value).slice(0, 6).map(decorateDeal),
    recentActivities: [...db.collection('salesActivities')].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10)
      .map((x) => ({ ...x, dealName: db.getById('deals', x.dealId)?.name, agentName: x.agentId ? db.getById('agents', x.agentId)?.name : null })),
  });
});

function decorateDeal(d) {
  const meta = stageMeta(d.stage);
  const bs = d.blueSheet;
  return {
    ...d,
    accountName: d.accountId ? db.getById('accounts', d.accountId)?.name : d.prospectName,
    ownerName: d.ownerId ? db.getById('agents', d.ownerId)?.name : null,
    probability: meta?.probability ?? 0,
    weightedValue: Math.round(d.value * ((meta?.probability ?? 0) / 100)),
    blueSheetScore: blueSheetScore(bs),
    redFlagCount: bs?.redFlags?.length || 0,
  };
}

// A rough "how complete/healthy is this Blue Sheet" score (0–100) so the
// board can surface deals that still need strategic-selling work.
function blueSheetScore(bs) {
  if (!bs) return 0;
  let score = 0;
  if (bs.sso) score += 20;
  if (bs.buyingInfluences?.length) score += Math.min(30, bs.buyingInfluences.length * 10);
  if (bs.buyingInfluences?.some((b) => b.role === 'coach')) score += 10;
  if (bs.buyingInfluences?.some((b) => b.role === 'economic')) score += 10;
  if (bs.strengths?.length) score += 10;
  if (bs.winResults?.length) score += 10;
  if (bs.actionPlan?.some((a) => a.status !== 'done')) score += 10;
  return Math.min(100, score);
}

// --- Shipments ---------------------------------------------------------------
api.get('/shipments', (req, res) => {
  const { brand, status, accountId, carrierId, exceptions, q } = req.query;
  let rows = [...db.collection('shipments')];
  if (brand) rows = rows.filter((r) => r.brand === brand);
  if (status) rows = rows.filter((r) => r.status === status);
  if (accountId) rows = rows.filter((r) => r.accountId === accountId);
  if (carrierId) rows = rows.filter((r) => r.carrierId === carrierId);
  if (exceptions === 'true') rows = rows.filter((r) => r.hasOpenException);
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter((r) => r.reference.toLowerCase().includes(s) || (r.destination || '').toLowerCase().includes(s) || (r.carrier || '').toLowerCase().includes(s));
  }
  rows.sort((a, b) => new Date(b.lastEventAt || b.updatedAt) - new Date(a.lastEventAt || a.updatedAt));
  res.json(rows.map((s) => ({ ...s, accountName: s.accountId ? db.getById('accounts', s.accountId)?.name : null })));
});

api.get('/shipments/:id', (req, res) => {
  const s = db.getById('shipments', req.params.id);
  if (!s) return res.status(404).json({ error: 'Shipment not found' });
  res.json({
    ...s,
    account: s.accountId ? db.getById('accounts', s.accountId) : null,
    carrier: s.carrierId ? db.getById('carriers', s.carrierId) : null,
    events: db.filter('events', (e) => e.shipmentId === s.id).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)),
    cases: db.filter('cases', (c) => c.shipmentId === s.id),
  });
});

// --- Carriers (transport-provider setup) ------------------------------------
const OPEN_CASE = new Set(['new', 'open', 'pending', 'escalated']);

function carrierStats(carrierId) {
  const cases = db.filter('cases', (c) => c.carrierId === carrierId);
  const shipments = db.filter('shipments', (s) => s.carrierId === carrierId);
  const openCases = cases.filter((c) => OPEN_CASE.has(c.status));
  const withCarrier = openCases.filter((c) => c.responsibility === 'carrier');
  const resolved = cases.filter((c) => ['resolved', 'closed'].includes(c.status));
  const delivered = shipments.filter((s) => ['delivered', 'pod-captured'].includes(s.status));
  const exceptions = shipments.filter((s) => s.hasOpenException).length;
  // Average resolution time (hours) for resolved cases that have timestamps.
  const resolvedTimed = resolved.filter((c) => c.resolvedAt && c.createdAt);
  const avgResolutionH = resolvedTimed.length
    ? Math.round(
        resolvedTimed.reduce((sum, c) => sum + (new Date(c.resolvedAt) - new Date(c.createdAt)) / 3600000, 0) /
          resolvedTimed.length,
      )
    : null;
  const onTimePct = shipments.length ? Math.round((delivered.length / shipments.length) * 100) : null;
  return {
    caseCount: cases.length,
    openCases: openCases.length,
    withCarrier: withCarrier.length,
    resolved: resolved.length,
    shipments: shipments.length,
    exceptions,
    exceptionRate: shipments.length ? Math.round((exceptions / shipments.length) * 100) : 0,
    avgResolutionH,
    onTimePct,
  };
}

api.get('/carriers', (req, res) => {
  const { mode, status, region, q } = req.query;
  let rows = [...db.collection('carriers')];
  if (mode) rows = rows.filter((r) => (r.modes || []).includes(mode));
  if (status) rows = rows.filter((r) => r.status === status);
  if (region) rows = rows.filter((r) => (r.regions || []).includes(region));
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(s) || (r.code || '').toLowerCase().includes(s));
  }
  res.json(rows.map((c) => ({ ...c, stats: carrierStats(c.id) })).sort((a, b) => b.stats.withCarrier - a.stats.withCarrier));
});

api.get('/carriers/:id', (req, res) => {
  const c = db.getById('carriers', req.params.id);
  if (!c) return res.status(404).json({ error: 'Carrier not found' });
  const cases = db.filter('cases', (x) => x.carrierId === c.id)
    .sort((a, b) => new Date(b.lastActivityAt || b.createdAt) - new Date(a.lastActivityAt || a.createdAt))
    .map(withSla);
  res.json({
    ...c,
    stats: carrierStats(c.id),
    cases,
    shipments: db.filter('shipments', (s) => s.carrierId === c.id).sort((a, b) => new Date(b.lastEventAt || b.updatedAt) - new Date(a.lastEventAt || a.updatedAt)),
  });
});

api.post('/carriers', asyncH((req, res) => {
  const b = req.body || {};
  if (!b.name) throw new ValidationError('name is required');
  const now = new Date().toISOString();
  const carrier = {
    id: db.nextId('CARR'),
    name: b.name,
    code: b.code || b.name.slice(0, 4).toUpperCase(),
    modes: b.modes || ['Road'],
    regions: b.regions || [],
    status: b.status || 'active',
    country: b.country || 'AU',
    accountManager: b.accountManager || '',
    phone: b.phone || '',
    email: b.email || '',
    website: b.website || '',
    trackingUrl: b.trackingUrl || '',
    abn: b.abn || '',
    accountCode: b.accountCode || '',
    onTimeTarget: b.onTimeTarget != null ? Number(b.onTimeTarget) : 95,
    notes: b.notes || '',
    createdAt: now,
    updatedAt: now,
  };
  db.insert('carriers', carrier);
  res.status(201).json(carrier);
}));

api.patch('/carriers/:id', asyncH((req, res) => {
  const updated = db.update('carriers', req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Carrier not found' });
  res.json(updated);
}));

// Carrier performance report — cases by carrier, still-with-carrier, on-time.
api.get('/reports/carriers', (req, res) => {
  const brand = req.query.brand;
  const carriers = db.collection('carriers');
  const rows = carriers.map((c) => {
    const stats = carrierStats(c.id);
    return { id: c.id, name: c.name, code: c.code, status: c.status, modes: c.modes, onTimeTarget: c.onTimeTarget, ...stats };
  });
  // Unassigned / no-carrier cases too.
  const orphanCases = db.filter('cases', (c) => !c.carrierId && (!brand || c.brand === brand));
  res.json({
    carriers: rows.sort((a, b) => b.withCarrier - a.withCarrier || b.caseCount - a.caseCount),
    totals: {
      carriers: carriers.length,
      preferred: carriers.filter((c) => c.status === 'preferred').length,
      casesWithCarrier: rows.reduce((s, r) => s + r.withCarrier, 0),
      openCases: rows.reduce((s, r) => s + r.openCases, 0),
      unassignedCases: orphanCases.length,
    },
  });
});

// --- efmAPP status-event ingestion ------------------------------------------
// The efmAPP posts status milestones here. Exceptions auto-raise CS cases.
api.post('/events/efmapp', asyncH((req, res) => {
  const payload = req.body || {};
  const result = ingestEvent(payload);
  res.status(201).json({
    ok: true,
    event: result.event,
    shipment: result.shipment,
    caseCreated: result.caseCreated,
    caseUpdated: result.caseUpdated,
  });
}));

// Accept a batch of events in one call (useful for efmAPP sync jobs).
api.post('/events/efmapp/batch', asyncH((req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const results = events.map((e) => {
    try {
      return { ok: true, ...pickResult(ingestEvent(e)) };
    } catch (err) {
      return { ok: false, error: err.message, event: e };
    }
  });
  res.status(201).json({ processed: results.length, results });
}));

function pickResult(r) {
  return {
    eventId: r.event.id,
    status: r.event.status,
    caseCreated: r.caseCreated?.id ?? null,
    caseUpdated: r.caseUpdated?.id ?? null,
  };
}

api.get('/events', (req, res) => {
  const { brand, exceptions, shipmentId, limit } = req.query;
  let rows = [...db.collection('events')];
  if (brand) rows = rows.filter((r) => r.brand === brand);
  if (exceptions === 'true') rows = rows.filter((r) => r.isException);
  if (shipmentId) rows = rows.filter((r) => r.shipmentId === shipmentId);
  rows.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
  res.json(rows.slice(0, Number(limit) || 50));
});

// --- Admin: reseed (handy for demos) ----------------------------------------
api.post('/admin/reseed', asyncH((_req, res) => {
  const summary = seed();
  res.json({ ok: true, summary });
}));

app.use('/api', api);

// --- Error handling ----------------------------------------------------------
app.use('/api', (err, _req, res, _next) => {
  const status = err.statusCode || (err instanceof ValidationError ? 400 : 500);
  if (status >= 500) console.error('[api error]', err);
  res.status(status).json({ error: err.message || 'Internal error' });
});

// --- Static frontend ---------------------------------------------------------
app.use(express.static(PUBLIC_DIR));
app.get('*', (_req, res) => {
  const indexFile = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`\n  MOVEiTcrm — 4PL Control Tower running at http://localhost:${PORT}`);
  console.log(`  API base:  http://localhost:${PORT}/api`);
  console.log(`  efmAPP ingest:  POST http://localhost:${PORT}/api/events/efmapp\n`);
});

export { app };
