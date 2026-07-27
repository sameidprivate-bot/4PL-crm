// Unit tests for the efmAPP event-ingestion engine and domain rules.
// Run with:  npm test    (uses the built-in node:test runner)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { db } from '../server/db.js';
import { ingestEvent } from '../server/events.js';
import { isExceptionStatus, slaDueDate, SLA_HOURS, emptyBlueSheet, responsibilityForCategory, quoteTotals, implementationChecklist, surveySummary, npsCategory, SERVICE_LINES, effectivePermissionSet, setGrants } from '../server/domain.js';

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
        carrierId: 'CARR-1', carrier: 'StarTrack',
        status: 'in-transit', hasOpenException: false, timeline: [],
      },
    ],
    events: [],
    activities: [],
    agents: [{ id: 'AGT-1', name: 'Agent A', active: true, brands: ['EFM'] }],
    carriers: [{ id: 'CARR-1', name: 'StarTrack', code: 'STK' }],
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

test('auto-raised freight case is linked to the carrier and owned by the carrier', () => {
  bootstrap();
  const { caseCreated } = ingestEvent({ shipmentRef: 'EFM-TEST-1', status: 'failed-delivery' });
  assert.ok(caseCreated);
  assert.equal(caseCreated.carrierId, 'CARR-1');
  assert.equal(caseCreated.carrierName, 'StarTrack');
  assert.equal(caseCreated.responsibility, 'carrier'); // delivery-exception → carrier
});

test('customs exceptions stay internal, not with the carrier', () => {
  bootstrap();
  const { caseCreated } = ingestEvent({ shipmentRef: 'EFM-TEST-1', status: 'customs-hold' });
  assert.equal(caseCreated.category, 'customs');
  assert.equal(caseCreated.responsibility, 'internal');
});

test('responsibilityForCategory maps freight failures to the carrier', () => {
  assert.equal(responsibilityForCategory('damage'), 'carrier');
  assert.equal(responsibilityForCategory('delay'), 'carrier');
  assert.equal(responsibilityForCategory('billing'), 'internal');
  assert.equal(responsibilityForCategory('unknown-x'), 'internal');
});

test('quoteTotals computes sell, buy, margin and margin %', () => {
  const t = quoteTotals([
    { units: 10, buyRate: 100, sellRate: 150 },
    { units: 2, buyRate: 500, sellRate: 600 },
  ]);
  assert.equal(t.sell, 2700);
  assert.equal(t.buy, 2000);
  assert.equal(t.margin, 700);
  assert.equal(t.marginPct, 26); // 700/2700
});

test('implementation checklists differ by type and are actionable', () => {
  const nc = implementationChecklist('new-customer');
  const cc = implementationChecklist('carrier-change');
  assert.ok(nc.length >= 4 && cc.length >= 4);
  assert.ok(nc.every((c) => c.id && c.task && c.done === false));
  assert.ok(cc.some((c) => /carrier/i.test(c.task)));
  assert.notDeepEqual(nc.map((c) => c.task), cc.map((c) => c.task));
});

test('system segments by service line, not EFM/AFS', () => {
  assert.deepEqual(SERVICE_LINES, ['4PL', '3PL', 'Global']);
});

test('npsCategory bands 0-10 into promoter/passive/detractor', () => {
  assert.equal(npsCategory(10), 'promoter');
  assert.equal(npsCategory(9), 'promoter');
  assert.equal(npsCategory(8), 'passive');
  assert.equal(npsCategory(7), 'passive');
  assert.equal(npsCategory(6), 'detractor');
  assert.equal(npsCategory(0), 'detractor');
});

test('surveySummary computes NPS score and CSAT average', () => {
  const s = surveySummary([
    { type: 'nps', score: 10 }, { type: 'nps', score: 9 }, // 2 promoters
    { type: 'nps', score: 8 },                              // 1 passive
    { type: 'nps', score: 3 },                              // 1 detractor
    { type: 'csat', score: 5 }, { type: 'csat', score: 4 }, { type: 'csat', score: 2 },
  ]);
  // NPS: promoters 50% - detractors 25% = 25
  assert.equal(s.nps.score, 25);
  assert.equal(s.nps.promoters, 2);
  assert.equal(s.nps.detractors, 1);
  // CSAT avg (5+4+2)/3 = 3.67 -> 3.7; satisfied = 2/3 = 67%
  assert.equal(s.csat.avg, 3.7);
  assert.equal(s.csat.satisfiedPct, 67);
});

test('empty Blue Sheet has the full Strategic Selling shape', () => {
  const bs = emptyBlueSheet();
  assert.equal(bs.funnelPosition, 'in-funnel');
  for (const k of ['buyingInfluences', 'redFlags', 'strengths', 'competition', 'winResults', 'actionPlan']) {
    assert.ok(Array.isArray(bs[k]), `${k} is an array`);
  }
  assert.equal(bs.sso, '');
});

// ---- RBAC: effective-permission computation ---------------------------------
test('effectivePermissionSet unions group permissions', () => {
  const groups = [{ permissions: ['cases.view', 'cases.manage'] }, { permissions: ['sales.view'] }];
  const set = effectivePermissionSet(groups, {});
  assert.ok(set.has('cases.view') && set.has('cases.manage') && set.has('sales.view'));
});

test('user-level allow adds a permission beyond the groups', () => {
  const groups = [{ permissions: ['cases.view'] }];
  const set = effectivePermissionSet(groups, { allow: ['accountops.view'], deny: [] });
  assert.ok(set.has('accountops.view'));
});

test('user-level deny removes a group-granted permission', () => {
  const groups = [{ permissions: ['carriers.view', 'cases.view'] }];
  const set = effectivePermissionSet(groups, { allow: [], deny: ['carriers.view'] });
  assert.ok(!set.has('carriers.view'));
  assert.ok(set.has('cases.view'));
});

test('deny wins over an allow for the same key', () => {
  const set = effectivePermissionSet([], { allow: ['cases.manage'], deny: ['cases.manage'] });
  assert.ok(!set.has('cases.manage'));
});

test('setGrants honours the global and module wildcards', () => {
  assert.ok(setGrants(new Set(['*']), 'admin.users'));
  assert.ok(setGrants(new Set(['cases.*']), 'cases.manage'));
  assert.ok(!setGrants(new Set(['cases.*']), 'sales.view'));
  assert.ok(setGrants(new Set(['sales.view']), 'sales.view'));
});
