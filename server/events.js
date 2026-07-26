// efmAPP status-event ingestion engine.
//
// This is the integration that lets EFM/AFS customer-service agents work
// proactively: as the efmAPP emits consignment milestones, each event is
//   1. recorded on the CRM event feed,
//   2. folded into the matching shipment's live status + timeline, and
//   3. (for exception milestones) auto-converted into a customer-service
//      case, routed to an agent, with an SLA clock started.

import { db } from './db.js';
import {
  EXCEPTION_RULES,
  isExceptionStatus,
  slaDueDate,
  responsibilityForCategory,
} from './domain.js';

const OPEN_CASE_STATUSES = new Set(['new', 'open', 'pending', 'escalated']);

function nowIso() {
  return new Date().toISOString();
}

// Pick the least-loaded active agent for a brand so exception cases spread
// across the desk instead of piling on one person (very light round-robin).
function pickAgent(brand) {
  const agents = db.filter('agents', (a) => a.active && (!a.brands || a.brands.includes(brand)));
  const pool = agents.length ? agents : db.filter('agents', (a) => a.active);
  if (!pool.length) return null;
  const load = new Map(pool.map((a) => [a.id, 0]));
  for (const c of db.collection('cases')) {
    if (OPEN_CASE_STATUSES.has(c.status) && load.has(c.assigneeId)) {
      load.set(c.assigneeId, load.get(c.assigneeId) + 1);
    }
  }
  return pool.sort((a, b) => load.get(a.id) - load.get(b.id))[0];
}

function findOpenCaseForShipment(shipmentId) {
  return db.find(
    'cases',
    (c) => c.shipmentId === shipmentId && OPEN_CASE_STATUSES.has(c.status),
  );
}

const EXCEPTION_MESSAGES = {
  delayed: 'Shipment delayed in transit',
  exception: 'Delivery exception reported',
  'customs-hold': 'Consignment held at customs',
  damaged: 'Damage reported on consignment',
  'failed-delivery': 'Delivery attempt failed',
  lost: 'Consignment reported lost',
};

/**
 * Process one inbound efmAPP status event.
 * @returns {{event, shipment, caseCreated, caseUpdated}}
 */
export function ingestEvent(payload) {
  const {
    shipmentRef,
    status,
    brand,
    location = null,
    carrier = null,
    eta = null,
    note = null,
    occurredAt,
    source = 'efmAPP',
  } = payload;

  if (!shipmentRef) throw new ValidationError('shipmentRef is required');
  if (!status) throw new ValidationError('status is required');

  const timestamp = occurredAt || nowIso();

  // Locate (or lazily create) the shipment this event belongs to.
  let shipment = db.find('shipments', (s) => s.reference === shipmentRef);
  const account = shipment ? db.getById('accounts', shipment.accountId) : null;
  const resolvedBrand = brand || shipment?.brand || '4PL';

  const event = {
    id: db.nextId('EVT'),
    source,
    shipmentRef,
    shipmentId: shipment?.id ?? null,
    accountId: shipment?.accountId ?? null,
    brand: resolvedBrand,
    status,
    isException: isExceptionStatus(status),
    location,
    carrier,
    eta,
    note,
    occurredAt: timestamp,
    receivedAt: nowIso(),
  };
  db.insert('events', event);

  if (shipment) {
    const timeline = shipment.timeline || [];
    timeline.push({ status, location, note, at: timestamp });
    db.update('shipments', shipment.id, {
      status,
      lastEventAt: timestamp,
      lastLocation: location || shipment.lastLocation,
      carrier: carrier || shipment.carrier,
      eta: eta || shipment.eta,
      hasOpenException: isExceptionStatus(status) || shipment.hasOpenException,
      timeline,
    });
    shipment = db.getById('shipments', shipment.id);
  }

  let caseCreated = null;
  let caseUpdated = null;

  if (isExceptionStatus(status)) {
    const existing = shipment ? findOpenCaseForShipment(shipment.id) : null;
    if (existing) {
      // Append the new milestone to the existing case rather than duplicating.
      const timeline = existing.timeline || [];
      timeline.push({
        type: 'event',
        message: `efmAPP: ${EXCEPTION_MESSAGES[status] || status}${location ? ` (${location})` : ''}`,
        at: timestamp,
      });
      caseUpdated = db.update('cases', existing.id, {
        timeline,
        lastActivityAt: timestamp,
      });
    } else {
      const rule = EXCEPTION_RULES[status];
      const agent = shipment ? pickAgent(resolvedBrand) : null;
      const contact = account
        ? db.find('contacts', (ct) => ct.accountId === account.id && ct.primary)
        : null;
      const carrier = shipment?.carrierId ? db.getById('carriers', shipment.carrierId) : null;
      const responsibility = responsibilityForCategory(rule.category);
      const newCase = {
        id: db.nextId('CASE'),
        subject: `${EXCEPTION_MESSAGES[status] || status} — ${shipmentRef}`,
        brand: resolvedBrand,
        accountId: account?.id ?? null,
        accountName: account?.name ?? null,
        contactId: contact?.id ?? null,
        shipmentId: shipment?.id ?? null,
        shipmentRef,
        carrierId: shipment?.carrierId ?? null,
        carrierName: carrier?.name ?? shipment?.carrier ?? null,
        responsibility,
        category: rule.category,
        priority: rule.priority,
        status: 'new',
        origin: 'efmapp-auto',
        assigneeId: agent?.id ?? null,
        assigneeName: agent?.name ?? null,
        slaDueAt: slaDueDate(rule.priority, new Date(timestamp)),
        description:
          `Auto-raised from an efmAPP status event.\n` +
          `Consignment ${shipmentRef}${location ? ` at ${location}` : ''} reported "${status}".` +
          (note ? `\nCarrier note: ${note}` : ''),
        timeline: [
          {
            type: 'system',
            message: `Case auto-created from efmAPP "${status}" event`,
            at: timestamp,
          },
        ],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastActivityAt: timestamp,
      };
      caseCreated = db.insert('cases', newCase);
    }
  }

  // A clean delivery closes any lingering open exception flag on the shipment.
  if ((status === 'delivered' || status === 'pod-captured') && shipment) {
    db.update('shipments', shipment.id, { hasOpenException: false });
  }

  return { event, shipment, caseCreated, caseUpdated };
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}
