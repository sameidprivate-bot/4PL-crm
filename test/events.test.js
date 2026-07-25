// Unit tests for the efmAPP event-ingestion engine and domain rules.
// Run with:  npm test    (uses the built-in node:test runner)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { db } from '../server/db.js';
import { ingestEvent } from '../server/events.js';
import { isExceptionStatus, slaDueDate, SLA_HOURS, emptyBlueSheet } from '../server/domain.js';

// Build an isolated in-memory dataset for each test run.
function bootstrap() {
  db.state = {
    accounts: [{ id: 'ACC-1', name: 'Test Co', brand: 'EFM' }],
    contacts: [{ id: 'CON-1', accountId: 'ACC-1', name: 'Jane', primary: true }],
    cases: [],
    deals: [],
    shipments: [
      {
        id: 'SHP-1', reference: 'EFM-TEST-1', accountId: 'ACC-1', brand: 'EFM',
        status: 'in-transit', hasOpenException: false, timeline: [],
      },
    ],
    events: [],
    activities: [],
    agents: [{ id: 'AGT-1', name: 'Agent A', active: true, brands: ['EFM'] }],
  };
  db._counters = {};
  db.save = () => {}; // no-op: keep tests off disk
}

test('domain helpers', () => {
  assert.equal(isExceptionStatus('customs-hold'), true);
  assert.equal(isExceptionStatus('delivered'), false);
  const due = new Date(slaDueDate('urgent', new Date('2026-01-01T00:00:00Z')));
  assert.equal(due.toISOString(), new Date(`2026-01-01T0${SLA_HOURS.urgent}:00:00Z`).toISOString());
});

test('non-exception event updates shipment but raises no case', () => {
  bootstrap();
  const { event, shipment, caseCreated } = ingestEvent({
    shipmentRef: 'EFM-TEST-1', status: 'at-hub', location: 'Sydney',
  });
  assert.equal(event.isException, false);
  assert.equal(shipment.status, 'at-hub');
  assert.equal(caseCreated, null);
  assert.equal(db.collection('cases').length, 0);
});

test('exception event auto-raises a linked, prioritised case', () => {
  bootstrap();
  const { caseCreated } = ingestEvent({
    shipmentRef: 'EFM-TEST-1', status: 'damaged', location: 'Melbourne', note: 'Crushed',
  });
  assert.ok(caseCreated, 'a case should be created');
  assert.equal(caseCreated.priority, 'urgent'); // damage -> urgent
  assert.equal(caseCreated.category, 'damage');
  assert.equal(caseCreated.accountId, 'ACC-1');
  assert.equal(caseCreated.shipmentId, 'SHP-1');
  assert.equal(caseCreated.origin, 'efmapp-auto');
  assert.equal(caseCreated.assigneeId, 'AGT-1');
  assert.ok(caseCreated.slaDueAt, 'SLA due date is set');
});

test('a second exception on the same shipment appends instead of duplicating', () => {
  bootstrap();
  const first = ingestEvent({ shipmentRef: 'EFM-TEST-1', status: 'delayed' });
  assert.ok(first.caseCreated);
  const second = ingestEvent({ shipmentRef: 'EFM-TEST-1', status: 'exception' });
  assert.equal(second.caseCreated, null, 'no duplicate case');
  assert.ok(second.caseUpdated, 'existing case updated');
  assert.equal(db.collection('cases').length, 1);
  assert.ok(second.caseUpdated.timeline.length >= 2);
});

test('delivery clears the shipment exception flag', () => {
  bootstrap();
  ingestEvent({ shipmentRef: 'EFM-TEST-1', status: 'delayed' });
  assert.equal(db.getById('shipments', 'SHP-1').hasOpenException, true);
  ingestEvent({ shipmentRef: 'EFM-TEST-1', status: 'delivered' });
  assert.equal(db.getById('shipments', 'SHP-1').hasOpenException, false);
});

test('exception on an unknown shipment is recorded and raises an unlinked case', () => {
  bootstrap();
  const { event, shipment, caseCreated } = ingestEvent({
    shipmentRef: 'UNKNOWN-999', status: 'delayed', brand: 'AFS',
  });
  assert.equal(event.shipmentId, null);
  assert.equal(shipment, undefined);
  // No exception should be dropped: a case is still raised so the CS desk
  // is alerted, just without a linked shipment/account.
  assert.ok(caseCreated, 'a case is raised even for an unknown consignment');
  assert.equal(caseCreated.shipmentId, null);
  assert.equal(caseCreated.accountId, null);
  assert.equal(caseCreated.shipmentRef, 'UNKNOWN-999');
  assert.equal(db.collection('events').length, 1);
});

test('missing required fields are rejected', () => {
  bootstrap();
  assert.throws(() => ingestEvent({ status: 'delayed' }), /shipmentRef/);
  assert.throws(() => ingestEvent({ shipmentRef: 'X' }), /status/);
});

test('empty Blue Sheet has the full Strategic Selling shape', () => {
  const bs = emptyBlueSheet();
  assert.equal(bs.funnelPosition, 'in-funnel');
  for (const k of ['buyingInfluences', 'redFlags', 'strengths', 'competition', 'winResults', 'actionPlan']) {
    assert.ok(Array.isArray(bs[k]), `${k} is an array`);
  }
  assert.equal(bs.sso, '');
});
