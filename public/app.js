// MOVEiTcrm — 4PL Control Tower (EFM & AFS) single-page frontend.
import { api } from './api.js';
import {
  el, fmtMoney, fmtDate, fmtDateTime, timeAgo, badge, brandChip,
  priorityBadge, statusBadge, slaBadge, healthBadge, shipmentStatusBadge,
  eventIcon, titleCase, toast, escAttr, escHtml, docTypeBadge, docMeta, actionStatusBadge,
  carrierStatusBadge, responsibilityBadge, quoteStatusBadge, opStatusBadge, severityBadge,
  npsBadge, csatBadge,
} from './ui.js';

const state = {
  brand: '',
  meta: null,
  view: 'dashboard',
};

// ---- Drawer / modal helpers ------------------------------------------------
const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalHost = document.getElementById('modal');

function openDrawer(html) {
  drawer.innerHTML = html;
  drawer.hidden = false;
  drawerBackdrop.hidden = false;
}
function closeDrawer() {
  drawer.hidden = true;
  drawerBackdrop.hidden = true;
  drawer.innerHTML = '';
  state.openAccountId = null;
}

// After creating/updating an account-ops record: refresh the open account
// drawer if there is one, otherwise re-render the current view.
function afterOpChange() {
  if (state.openAccountId && !drawer.hidden) openAccountDrawer(state.openAccountId);
  else router();
}
drawerBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDrawer(); closeModal(); }
});

function openModal(html) {
  modalHost.innerHTML = html;
  modalBackdrop.hidden = false;
}
function closeModal() {
  modalBackdrop.hidden = true;
  modalHost.innerHTML = '';
}
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

// ---- Router ----------------------------------------------------------------
const routes = {
  dashboard: renderDashboard,
  cases: renderCases,
  sales: renderSales,
  pipeline: renderSales, // alias
  marketing: renderMarketing,
  carriers: renderCarriers,
  accounts: renderAccounts,
  ops: renderAccountOps,
  shipments: renderShipments,
  events: renderEvents,
  admin: renderAdmin,
};

// Which permission gates each top-level view.
const VIEW_PERM = {
  dashboard: 'dashboard.view', cases: 'cases.view', sales: 'sales.view', pipeline: 'sales.view',
  marketing: 'marketing.view', carriers: 'carriers.view', accounts: 'accounts.view',
  ops: 'accountops.view', shipments: 'shipments.view', events: 'events.view', admin: 'admin.users',
};

// Effective-permission check for the acting user (honours "*" and "module.*").
function can(perm) {
  const s = state.perms;
  if (!s) return true; // before load, don't block
  if (s.has('*') || s.has(perm)) return true;
  return s.has(perm.split('.')[0] + '.*');
}
const TITLES = {
  dashboard: 'Dashboard',
  cases: 'Case Management',
  sales: 'Sales',
  marketing: 'Marketing & CX',
  carriers: 'Carriers',
  accounts: 'Account Management',
  ops: 'Account Operations',
  shipments: 'Shipments',
  events: 'efmAPP Status Feed',
  admin: 'Administration',
};

async function router() {
  const hash = location.hash.replace(/^#\//, '') || 'dashboard';
  const parts = hash.split('/');
  const view = parts[0];
  state.view = routes[view] ? view : 'dashboard';
  state.tab = parts[1] || null;
  document.getElementById('viewTitle').textContent = TITLES[state.view];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === state.view));
  document.getElementById('topbarActions').innerHTML = '';
  const host = document.getElementById('view');
  const perm = VIEW_PERM[state.view];
  if (perm && !can(perm)) {
    host.innerHTML = `<div class="empty"><div class="empty__ico">🔒</div>You don't have permission to view <b>${TITLES[state.view]}</b>.<div class="cell-sub" style="margin-top:8px">Ask an administrator to grant <code class="perm-key">${perm}</code>.</div></div>`;
    refreshBadges();
    return;
  }
  host.innerHTML = '<div class="loading">Loading…</div>';
  try {
    await routes[state.view](host);
    gateManageButtons();
  } catch (err) {
    host.innerHTML = `<div class="empty"><div class="empty__ico">⚠️</div>${err.message}</div>`;
    console.error(err);
  }
  refreshBadges();
}
window.addEventListener('hashchange', router);

// ---- Brand switch ----------------------------------------------------------
document.getElementById('brandSwitch').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.brand = btn.dataset.brand;
  document.querySelectorAll('#brandSwitch button').forEach((b) => b.classList.toggle('active', b === btn));
  router();
});

function bq(extra = {}) {
  const q = { ...extra };
  if (state.brand) q.brand = state.brand;
  return q;
}

// ---- Badges in nav ---------------------------------------------------------
async function refreshBadges() {
  try {
    const dash = await api.dashboard(bq());
    const cb = document.getElementById('badgeCases');
    cb.textContent = dash.kpis.openCases || '';
    const eb = document.getElementById('badgeEvents');
    eb.textContent = dash.kpis.exceptionsToday ? `${dash.kpis.exceptionsToday}!` : '';
    const carb = document.getElementById('badgeCarriers');
    if (carb) carb.textContent = dash.kpis.casesWithCarrier || '';
    const ob = document.getElementById('badgeOps');
    if (ob) ob.textContent = (dash.kpis.openRisks || 0) + (dash.kpis.openClaims || 0) || '';
  } catch { /* ignore */ }
}

// A simple hash-driven tab bar.
function tabBar(base, tabs, active) {
  return `<div class="tabs">${tabs.map((t) =>
    `<a href="#/${base}${t.key ? '/' + t.key : ''}" class="tab ${(active || '') === t.key ? 'active' : ''}">${t.label}</a>`).join('')}</div>`;
}

// ============================================================================
// DASHBOARD
// ============================================================================
async function renderDashboard(host) {
  const d = await api.dashboard(bq());
  const k = d.kpis;

  const kpiCards = [
    { label: 'Open cases', value: k.openCases, sub: `${k.slaBreached} breaching SLA`, cls: k.slaBreached ? 'kpi--alert' : '' },
    { label: 'Exceptions today', value: k.exceptionsToday, sub: 'from efmAPP feed', cls: k.exceptionsToday ? 'kpi--alert' : '' },
    { label: 'Active shipments', value: k.activeShipments, sub: `${k.exceptionShipments} with open exceptions` },
    { label: 'Open pipeline', value: fmtMoney(k.openPipelineValue), sub: `${fmtMoney(k.weightedPipelineValue)} weighted` },
    { label: 'Won (closed)', value: fmtMoney(k.wonValue), sub: 'this dataset', cls: 'kpi--good' },
    { label: 'Accounts', value: k.accounts, sub: `${k.atRiskAccounts} at-risk`, cls: k.atRiskAccounts ? 'kpi--alert' : '' },
    { label: 'With carrier', value: k.casesWithCarrier ?? 0, sub: 'cases to resolve', cls: k.casesWithCarrier ? 'kpi--alert' : '' },
    { label: 'NPS', value: k.nps == null ? '—' : k.nps, sub: 'net promoter score', cls: k.nps != null && k.nps < 0 ? 'kpi--alert' : k.nps >= 50 ? 'kpi--good' : '' },
    { label: 'CSAT', value: k.csat == null ? '—' : `${k.csat}/5`, sub: 'avg satisfaction', cls: k.csat != null && k.csat < 3 ? 'kpi--alert' : '' },
    { label: 'Active campaigns', value: k.activeCampaigns ?? 0, sub: 'marketing' },
    { label: 'Revenue at risk', value: fmtMoney(k.revenueAtRisk ?? 0), sub: `${k.openRisks ?? 0} open risks`, cls: k.openRisks ? 'kpi--alert' : '' },
    { label: 'Credit claims', value: k.openClaims ?? 0, sub: `${fmtMoney(k.openClaimsValue ?? 0)} open`, cls: k.openClaims ? 'kpi--alert' : '' },
    { label: 'Implementations', value: k.activeImplementations ?? 0, sub: 'in progress' },
    { label: 'Price reviews due', value: k.priceReviewsDue ?? 0, sub: 'within 60 days' },
    { label: 'Account actions', value: k.openActions ?? 0, sub: `${k.overdueActions ?? 0} overdue`, cls: k.overdueActions ? 'kpi--alert' : '' },
    { label: 'Agreements expiring', value: k.expiringAgreements ?? 0, sub: 'within 60 days', cls: k.expiringAgreements ? 'kpi--alert' : '' },
  ];

  const maxPri = Math.max(1, ...Object.values(d.byPriority));
  const priColors = { urgent: 'var(--red)', high: 'var(--amber)', medium: 'var(--blue)', low: 'var(--slate)' };
  const priMeter = ['urgent', 'high', 'medium', 'low'].map((p) => `
    <div class="meter__row">
      <span class="meter__label">${p}</span>
      <span class="meter__track"><span class="meter__fill" style="width:${(d.byPriority[p] / maxPri) * 100}%;background:${priColors[p]}"></span></span>
      <span class="meter__num">${d.byPriority[p] || 0}</span>
    </div>`).join('');

  const maxStage = Math.max(1, ...d.pipelineByStage.map((s) => s.value));
  const stageMeter = d.pipelineByStage.filter((s) => s.key !== 'lost').map((s) => `
    <div class="meter__row">
      <span class="meter__label">${s.label}</span>
      <span class="meter__track"><span class="meter__fill" style="width:${(s.value / maxStage) * 100}%;background:var(--primary)"></span></span>
      <span class="meter__num" style="width:auto">${fmtMoney(s.value)}</span>
    </div>`).join('');

  const feed = d.recentEvents.length
    ? d.recentEvents.map(eventRow).join('')
    : '<div class="empty">No efmAPP events yet.</div>';

  const slaWatch = d.slaWatch.length ? d.slaWatch.map((c) => `
    <div class="inline-item clickable" data-case="${c.id}">
      <div>
        <div class="cell-strong">${c.subject}</div>
        <div class="cell-sub">${c.accountName || 'Unlinked'} · ${brandChip(c.brand)}</div>
      </div>
      ${slaBadge(c)}
    </div>`).join('') : '<div class="empty">Nothing near SLA breach 🎉</div>';

  host.innerHTML = `
    <div class="grid kpis">${kpiCards.map(kpiCard).join('')}</div>

    <div class="two-col" style="margin-top:20px">
      <div class="card card--pad">
        <div class="section-head" style="margin-top:0"><h2>⚡ Live efmAPP status feed</h2><a class="muted" href="#/events">View all →</a></div>
        <div class="feed">${feed}</div>
      </div>
      <div>
        <div class="card card--pad">
          <div class="section-head" style="margin-top:0"><h2>SLA watch</h2><span class="muted">soonest due</span></div>
          <div class="inline-list">${slaWatch}</div>
        </div>
        <div class="card card--pad" style="margin-top:16px">
          <div class="section-head" style="margin-top:0"><h2>Open cases by priority</h2></div>
          <div class="meter">${priMeter}</div>
        </div>
      </div>
    </div>

    <div class="card card--pad" style="margin-top:16px">
      <div class="section-head" style="margin-top:0"><h2>Pipeline value by stage</h2><a class="muted" href="#/sales/pipeline">Open board →</a></div>
      <div class="meter">${stageMeter}</div>
    </div>`;

  host.querySelectorAll('[data-case]').forEach((n) =>
    n.addEventListener('click', () => openCaseDrawer(n.dataset.case)));
  host.querySelectorAll('[data-event-shipment]').forEach((n) =>
    n.addEventListener('click', () => { const id = n.dataset.eventShipment; if (id) openShipmentDrawer(id); }));
}

function kpiCard(c) {
  return `<div class="card kpi ${c.cls || ''}">
    <div class="kpi__label">${c.label}</div>
    <div class="kpi__value">${c.value}</div>
    <div class="kpi__sub">${c.sub}</div>
  </div>`;
}

function eventRow(e) {
  const ico = eventIcon(e.status);
  return `<div class="feed__item ${e._new ? 'pulse' : ''}" ${e.shipmentId ? `data-event-shipment="${e.shipmentId}"` : ''} style="${e.shipmentId ? 'cursor:pointer' : ''}">
    <div class="feed__ico" style="background:${ico.bg};color:${ico.fg}">${ico.icon}</div>
    <div class="feed__body">
      <div class="feed__top">
        <span class="feed__title">${titleCase(e.status)}</span>
        ${e.isException ? badge('exception', 'b-red') : ''}
        ${brandChip(e.brand)}
        <span class="mono">${e.shipmentRef}</span>
      </div>
      <div class="feed__meta">${e.location || 'Location n/a'}${e.carrier ? ' · ' + e.carrier : ''}${e.note ? ' · ' + e.note : ''}</div>
    </div>
    <div class="feed__time">${timeAgo(e.receivedAt)}</div>
  </div>`;
}

// ============================================================================
// CASES
// ============================================================================
async function renderCases(host) {
  document.getElementById('topbarActions').innerHTML =
    `<button class="btn btn--primary" id="newCaseBtn">+ New case</button>`;
  document.getElementById('newCaseBtn').onclick = openNewCaseModal;

  const filters = window.__caseFilters || {};
  const cases = await api.cases(bq(filters));
  const m = state.meta;

  const sel = (name, opts, val, label) => `
    <select data-filter="${name}">
      <option value="">${label}</option>
      ${opts.map((o) => `<option value="${o}" ${val === o ? 'selected' : ''}>${titleCase(o)}</option>`).join('')}
    </select>`;

  const carrierSel = `<select data-filter="carrierId"><option value="">All carriers</option>${(m.carriers || []).map((c) => `<option value="${c.id}" ${filters.carrierId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>`;

  host.innerHTML = `
    <div class="toolbar">
      <input class="search" placeholder="Search cases, refs, accounts, carriers…" data-filter="q" value="${filters.q || ''}" />
      ${sel('status', m.caseStatuses, filters.status, 'All statuses')}
      ${sel('priority', m.casePriorities, filters.priority, 'All priorities')}
      ${sel('category', m.caseCategories, filters.category, 'All categories')}
      ${carrierSel}
      ${sel('responsibility', m.caseResponsibility, filters.responsibility, 'Any owner of fix')}
      <button class="btn btn--sm ${filters.withCarrier === 'true' ? 'btn--primary' : ''}" id="withCarrierToggle">↳ Still with carrier</button>
      <button class="btn btn--sm ${filters.sla === 'breached' ? 'btn--primary' : ''}" id="slaToggle">SLA breached</button>
      <div class="spacer"></div>
      <span class="muted">${cases.length} case(s)</span>
    </div>
    <div class="card table-wrap">
      <table class="data">
        <thead><tr>
          <th>Case</th><th>Account</th><th>Carrier</th><th>Category</th><th>Priority</th><th>Status</th><th>SLA</th><th>Assignee</th>
        </tr></thead>
        <tbody>
          ${cases.length ? cases.map(caseRow).join('') : `<tr><td colspan="8"><div class="empty">No cases match.</div></td></tr>`}
        </tbody>
      </table>
    </div>`;

  const apply = () => { window.__caseFilters = collectFilters(host); renderCases(host); };
  host.querySelectorAll('[data-filter]').forEach((n) => {
    const ev = n.tagName === 'SELECT' ? 'change' : 'input';
    let t;
    n.addEventListener(ev, () => { clearTimeout(t); t = setTimeout(apply, ev === 'input' ? 300 : 0); });
  });
  host.querySelector('#slaToggle').onclick = () => {
    window.__caseFilters = { ...collectFilters(host), sla: filters.sla === 'breached' ? '' : 'breached' };
    renderCases(host);
  };
  host.querySelector('#withCarrierToggle').onclick = () => {
    window.__caseFilters = { ...collectFilters(host), withCarrier: filters.withCarrier === 'true' ? '' : 'true' };
    renderCases(host);
  };
  host.querySelectorAll('tr[data-case]').forEach((tr) =>
    tr.addEventListener('click', () => openCaseDrawer(tr.dataset.case)));
}

function collectFilters(host) {
  const f = {};
  host.querySelectorAll('[data-filter]').forEach((n) => { if (n.value) f[n.dataset.filter] = n.value; });
  if (host.querySelector('#slaToggle')?.classList.contains('btn--primary')) f.sla = 'breached';
  if (host.querySelector('#withCarrierToggle')?.classList.contains('btn--primary')) f.withCarrier = 'true';
  return f;
}

function caseRow(c) {
  return `<tr class="clickable" data-case="${c.id}">
    <td>
      <div class="cell-strong">${escHtml(c.subject)}</div>
      <div class="cell-sub"><span class="mono">${c.id}</span>${c.origin === 'efmapp-auto' ? ' · <span class="badge b-violet" style="padding:1px 6px">⚡ efmAPP</span>' : ''}${c.shipmentRef ? ' · ' + c.shipmentRef : ''}</div>
    </td>
    <td>${c.accountName ? `${escHtml(c.accountName)}<br><span class="cell-sub">${brandChip(c.brand)}</span>` : `<span class="cell-sub">Unlinked ${brandChip(c.brand)}</span>`}</td>
    <td>${c.carrierName ? `${escHtml(c.carrierName)}<br>${c.responsibility === 'carrier' && !['resolved', 'closed'].includes(c.status) ? responsibilityBadge('carrier') : ''}` : '<span class="cell-sub">—</span>'}</td>
    <td>${badge(titleCase(c.category), 'b-slate')}</td>
    <td>${priorityBadge(c.priority)}</td>
    <td>${statusBadge(c.status)}</td>
    <td>${slaBadge(c)}</td>
    <td>${c.assigneeName || '<span class="cell-sub">Unassigned</span>'}</td>
  </tr>`;
}

async function openCaseDrawer(id) {
  const c = await api.case(id);
  const m = state.meta;
  const agentOpts = (sel) => m.agents.map((a) => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${a.name}</option>`).join('');
  const opt = (arr, sel) => arr.map((v) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${titleCase(v)}</option>`).join('');

  const timeline = (c.timeline || []).slice().reverse().map((t) => `
    <div class="timeline__item">
      <div class="timeline__msg">${t.message}</div>
      <div class="timeline__time">${fmtDateTime(t.at)}${t.type ? ' · ' + t.type : ''}</div>
    </div>`).join('') || '<div class="cell-sub">No activity yet.</div>';

  openDrawer(`
    <div class="drawer__head">
      <button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${c.id} · ${brandChip(c.brand)} ${c.origin === 'efmapp-auto' ? '· ⚡ auto-raised' : ''}</div>
      <div class="drawer__title">${escHtml(c.subject)}</div>
      <div class="chips" style="margin-top:10px">${priorityBadge(c.priority)} ${statusBadge(c.status)} ${slaBadge(c)} ${c.responsibility ? responsibilityBadge(c.responsibility) : ''}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section">
        <div class="form-row">
          <label class="field"><span>Status</span><select data-edit="status">${opt(m.caseStatuses, c.status)}</select></label>
          <label class="field"><span>Priority</span><select data-edit="priority">${opt(m.casePriorities, c.priority)}</select></label>
          <label class="field"><span>Category</span><select data-edit="category">${opt(m.caseCategories, c.category)}</select></label>
          <label class="field"><span>Assignee</span><select data-edit="assigneeId"><option value="">Unassigned</option>${agentOpts(c.assigneeId)}</select></label>
          <label class="field"><span>Carrier</span><select data-edit="carrierId"><option value="">— none —</option>${(m.carriers || []).map((cr) => `<option value="${cr.id}" ${c.carrierId === cr.id ? 'selected' : ''}>${cr.name}</option>`).join('')}</select></label>
          <label class="field"><span>Owner of fix</span><select data-edit="responsibility">${opt(m.caseResponsibility, c.responsibility || 'internal')}</select></label>
        </div>
        <button class="btn btn--primary btn--sm" id="saveCase">Save changes</button>
      </div>

      <div class="drawer__section">
        <h4>Details</h4>
        <dl class="dl">
          <dt>Account</dt><dd>${c.account ? `<a href="#" data-acc="${c.account.id}">${escHtml(c.account.name)}</a>` : 'Unlinked'}</dd>
          ${c.contact ? `<dt>Contact</dt><dd>${escHtml(c.contact.name)} · ${escHtml(c.contact.email)}</dd>` : ''}
          ${c.carrier ? `<dt>Carrier</dt><dd><a href="#" data-carr="${c.carrier.id}">${escHtml(c.carrier.name)}</a> ${c.responsibility === 'carrier' && !['resolved', 'closed'].includes(c.status) ? responsibilityBadge('carrier') : ''}</dd>` : ''}
          ${c.shipment ? `<dt>Shipment</dt><dd><a href="#" data-shp="${c.shipment.id}"><span class="mono">${c.shipment.reference}</span></a> — ${shipmentStatusBadge(c.shipment.status)}</dd>` : ''}
          <dt>Origin</dt><dd>${c.origin === 'efmapp-auto' ? '⚡ efmAPP status event' : titleCase(c.origin)}</dd>
          <dt>SLA due</dt><dd>${fmtDateTime(c.slaDueAt)} (${slaBadge(c)})</dd>
          <dt>Created</dt><dd>${fmtDateTime(c.createdAt)}</dd>
        </dl>
        ${c.description ? `<p style="margin-top:12px;white-space:pre-wrap;color:var(--text-muted);font-size:13px">${escHtml(c.description)}</p>` : ''}
      </div>

      <div class="drawer__section">
        <h4>Add note</h4>
        <textarea id="noteInput" rows="2" placeholder="Log a customer interaction or internal note…"></textarea>
        <div class="chips" style="margin-top:8px">
          <button class="btn btn--sm" id="addNote">Add note</button>
          <button class="btn btn--sm" id="logCsat">😊 Log CSAT</button>
        </div>
      </div>

      <div class="drawer__section">
        <h4>Activity timeline</h4>
        <div class="timeline">${timeline}</div>
      </div>
    </div>`);

  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveCase').onclick = async () => {
    const patch = {};
    drawer.querySelectorAll('[data-edit]').forEach((n) => { patch[n.dataset.edit] = n.value || null; });
    await api.updateCase(id, patch);
    toast('Case updated', `${id} saved`, 'success');
    closeDrawer(); router();
  };
  drawer.querySelector('#addNote').onclick = async () => {
    const msg = drawer.querySelector('#noteInput').value.trim();
    if (!msg) return;
    await api.addCaseNote(id, { message: msg });
    toast('Note added', '', 'success');
    openCaseDrawer(id);
  };
  drawer.querySelector('#logCsat').onclick = () => openSurveyModal(c.accountId, { type: 'csat', caseId: id });
  const accLink = drawer.querySelector('[data-acc]');
  if (accLink) accLink.onclick = (e) => { e.preventDefault(); closeDrawer(); openAccountDrawer(accLink.dataset.acc); };
  const shpLink = drawer.querySelector('[data-shp]');
  if (shpLink) shpLink.onclick = (e) => { e.preventDefault(); closeDrawer(); openShipmentDrawer(shpLink.dataset.shp); };
  const carrLink = drawer.querySelector('[data-carr]');
  if (carrLink) carrLink.onclick = (e) => { e.preventDefault(); closeDrawer(); openCarrierDrawer(carrLink.dataset.carr); };
}

function openNewCaseModal() {
  const m = state.meta;
  api.accounts(bq()).then((accounts) => {
    openModal(`
      <div class="modal__head">New case</div>
      <div class="modal__body">
        <label class="field"><span>Subject *</span><input id="f-subject" placeholder="Short summary of the issue" /></label>
        <div class="form-row">
          <label class="field"><span>Account</span><select id="f-account"><option value="">— none —</option>${accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label>
          <label class="field"><span>Brand</span><select id="f-brand">${state.meta.brands.map((b) => `<option>${b}</option>`).join('')}</select></label>
          <label class="field"><span>Category</span><select id="f-category">${m.caseCategories.map((c) => `<option value="${c}">${titleCase(c)}</option>`).join('')}</select></label>
          <label class="field"><span>Priority</span><select id="f-priority">${m.casePriorities.map((p) => `<option value="${p}" ${p === 'medium' ? 'selected' : ''}>${titleCase(p)}</option>`).join('')}</select></label>
          <label class="field"><span>Assignee</span><select id="f-assignee"><option value="">Unassigned</option>${m.agents.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label>
          <label class="field"><span>Origin</span><select id="f-origin"><option value="phone">Phone</option><option value="email">Email</option><option value="portal">Portal</option><option value="manual">Manual</option></select></label>
        </div>
        <label class="field"><span>Description</span><textarea id="f-desc" rows="3"></textarea></label>
      </div>
      <div class="modal__foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn--primary" id="createCase">Create case</button>
      </div>`);
    modalHost.querySelector('[data-close]').onclick = closeModal;
    modalHost.querySelector('#createCase').onclick = async () => {
      const body = {
        subject: val('f-subject'), accountId: val('f-account') || null, brand: val('f-brand'),
        category: val('f-category'), priority: val('f-priority'), assigneeId: val('f-assignee') || null,
        origin: val('f-origin'), description: val('f-desc'),
      };
      if (!body.subject) return toast('Subject required', '', 'warn');
      await api.createCase(body);
      closeModal(); toast('Case created', '', 'success'); router();
    };
  });
}

// ============================================================================
// SALES (tabbed: Overview · Pipeline · Quotes)
// ============================================================================
async function renderSales(host) {
  const tab = state.tab || '';
  host.innerHTML = tabBar('sales', [
    { key: '', label: 'Overview' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'quotes', label: 'Quotes' },
  ], tab) + `<div id="salesContent"></div>`;
  const content = host.querySelector('#salesContent');
  if (tab === 'pipeline') return renderPipeline(content);
  if (tab === 'quotes') return renderQuotes(content);
  return renderSalesOverview(content);
}

async function renderSalesOverview(host) {
  const s = await api.salesOverview(bq());
  const k = s.kpis;
  const kpiCards = [
    { label: 'Open pipeline', value: fmtMoney(k.openValue), sub: `${k.openCount} deals` },
    { label: 'Weighted forecast', value: fmtMoney(k.weightedValue), sub: 'probability-adjusted' },
    { label: 'Won', value: fmtMoney(k.wonValue), sub: `${k.wonCount} deals`, cls: 'kpi--good' },
    { label: 'Win rate', value: k.winRate == null ? '—' : `${k.winRate}%`, sub: 'won / closed' },
    { label: 'Avg deal size', value: fmtMoney(k.avgDealSize), sub: 'open deals' },
    { label: 'Quotes outstanding', value: k.quotesOutstanding, sub: fmtMoney(k.quotesOutstandingValue) },
  ];

  const meter = (rows, max, colorFn) => rows.map((r) => `
    <div class="meter__row">
      <span class="meter__label" title="${escAttr(r.label)}">${escHtml(r.label)}</span>
      <span class="meter__track"><span class="meter__fill" style="width:${max ? (r.value / max) * 100 : 0}%;background:${colorFn ? colorFn(r) : 'var(--primary)'}"></span></span>
      <span class="meter__num" style="width:auto">${fmtMoney(r.value)}</span>
    </div>`).join('');

  const svc = s.byService.map((x) => ({ label: titleCase(x.key || 'Other'), value: x.value }));
  const src = s.bySource.map((x) => ({ label: x.key || 'Direct', value: x.value }));
  const maxSvc = Math.max(1, ...svc.map((x) => x.value));
  const maxSrc = Math.max(1, ...src.map((x) => x.value));

  const forecastMax = Math.max(1, ...s.forecast.map((f) => f.value));
  const forecast = s.forecast.length ? s.forecast.map((f) => `
    <div class="meter__row">
      <span class="meter__label">${f.month}</span>
      <span class="meter__track">
        <span class="meter__fill" style="width:${(f.value / forecastMax) * 100}%;background:var(--slate)"></span>
        <span class="meter__fill" style="width:${(f.weighted / forecastMax) * 100}%;background:var(--primary);margin-top:-8px"></span>
      </span>
      <span class="meter__num" style="width:auto">${fmtMoney(f.weighted)}</span>
    </div>`).join('') : '<div class="cell-sub">No dated open deals.</div>';

  const owners = s.byOwner.map((o) => {
    const pct = o.target ? Math.min(100, Math.round((o.wonValue / o.target) * 100)) : 0;
    return `<div class="inline-item">
      <div style="flex:1">
        <div class="cell-strong">${escHtml(o.name)}</div>
        <div class="cell-sub">Won ${fmtMoney(o.wonValue)}${o.target ? ` of ${fmtMoney(o.target)} target` : ''} · ${o.openCount} open · weighted ${fmtMoney(o.weighted)}</div>
        ${o.target ? `<div class="probbar" style="margin-top:6px"><i style="width:${pct}%;background:${pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--primary)'}"></i></div>` : ''}
      </div>
      <span class="badge b-slate">${o.target ? pct + '%' : '—'}</span>
    </div>`;
  }).join('') || '<div class="cell-sub">No sales reps.</div>';

  const topDeals = s.topDeals.map((d) => `
    <div class="inline-item clickable" data-deal="${d.id}">
      <div><div class="cell-strong">${escHtml(d.name)}</div><div class="cell-sub">${escHtml(d.accountName || 'Prospect')} · ${badge(titleCase(d.stage), 'b-slate')}</div></div>
      <b>${fmtMoney(d.value)}</b>
    </div>`).join('') || '<div class="cell-sub">No open deals.</div>';

  const activities = s.recentActivities.map((a) => `
    <div class="feed__item">
      <div class="feed__ico" style="background:var(--blue-bg);color:var(--blue)">${{ call: '📞', email: '✉️', meeting: '🤝', 'site-visit': '📍', proposal: '📑', quote: '💲', note: '📝' }[a.type] || '•'}</div>
      <div class="feed__body"><div class="feed__title">${escHtml(a.subject)}</div><div class="feed__meta">${escHtml(a.dealName || '')}${a.agentName ? ' · ' + escHtml(a.agentName) : ''}</div></div>
      <div class="feed__time">${timeAgo(a.at)}</div>
    </div>`).join('') || '<div class="cell-sub">No recent activity.</div>';

  host.innerHTML = `
    <div class="grid kpis">${kpiCards.map(kpiCard).join('')}</div>
    <div class="two-col" style="margin-top:20px">
      <div>
        <div class="card card--pad">
          <div class="section-head" style="margin-top:0"><h2>Weighted forecast by close month</h2><span class="muted">bar = total · red = weighted</span></div>
          <div class="meter">${forecast}</div>
        </div>
        <div class="card card--pad" style="margin-top:16px">
          <div class="section-head" style="margin-top:0"><h2>Rep performance vs target</h2></div>
          <div class="inline-list">${owners}</div>
        </div>
        <div class="card card--pad" style="margin-top:16px">
          <div class="section-head" style="margin-top:0"><h2>Recent sales activity</h2></div>
          <div class="feed">${activities}</div>
        </div>
      </div>
      <div>
        <div class="card card--pad">
          <div class="section-head" style="margin-top:0"><h2>Pipeline by service</h2></div>
          <div class="meter">${meter(svc, maxSvc)}</div>
        </div>
        <div class="card card--pad" style="margin-top:16px">
          <div class="section-head" style="margin-top:0"><h2>Pipeline by source</h2></div>
          <div class="meter">${meter(src, maxSrc, () => 'var(--accent)')}</div>
        </div>
        <div class="card card--pad" style="margin-top:16px">
          <div class="section-head" style="margin-top:0"><h2>Top open deals</h2><a class="muted" href="#/sales/pipeline">Board →</a></div>
          <div class="inline-list">${topDeals}</div>
        </div>
      </div>
    </div>`;
  host.querySelectorAll('[data-deal]').forEach((n) => n.onclick = () => openDealDrawer(n.dataset.deal));
}

async function renderQuotes(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newQuoteBtn">+ New quote</button>`;
  document.getElementById('newQuoteBtn').onclick = () => openQuoteModal();
  const quotes = await api.quotes(bq());
  host.innerHTML = `
    <div class="card table-wrap">
      <table class="data">
        <thead><tr><th>Quote</th><th>Account</th><th>Lines</th><th>Sell</th><th>Margin</th><th>Status</th><th>Valid until</th></tr></thead>
        <tbody>${quotes.length ? quotes.map((q) => `
          <tr class="clickable" data-quote="${q.id}">
            <td><div class="cell-strong">${escHtml(q.title)}</div><div class="cell-sub mono">${q.id}${q.dealId ? ' · ' + q.dealId : ''}</div></td>
            <td>${escHtml(q.accountName || '—')} ${brandChip(q.brand)}</td>
            <td>${q.lines.length}</td>
            <td class="cell-strong">${fmtMoney(q.totals.sell)}</td>
            <td>${fmtMoney(q.totals.margin)} <span class="cell-sub">(${q.totals.marginPct}%)</span></td>
            <td>${quoteStatusBadge(q.status)}</td>
            <td class="cell-sub">${q.validUntil ? fmtDate(q.validUntil) : '—'}</td>
          </tr>`).join('') : `<tr><td colspan="7"><div class="empty">No quotes yet.</div></td></tr>`}
        </tbody>
      </table>
    </div>`;
  host.querySelectorAll('[data-quote]').forEach((tr) => tr.onclick = () => openQuoteDrawer(quotes.find((q) => q.id === tr.dataset.quote)));
}

function openQuoteDrawer(q) {
  if (!q) return;
  const m = state.meta;
  const lines = q.lines.map((l) => `
    <tr>
      <td><div class="cell-strong">${escHtml(l.lane || l.service || '—')}</div><div class="cell-sub">${l.mode || ''}${l.carrierName ? ' · ' + escHtml(l.carrierName) : ''}</div></td>
      <td class="cell-sub">${l.units || 1}×</td>
      <td class="cell-sub">${fmtMoney(l.buyRate)}</td>
      <td class="cell-strong">${fmtMoney(l.sellRate)}</td>
    </tr>`).join('');
  openDrawer(`
    <div class="drawer__head">
      <button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${q.id} · ${brandChip(q.brand)}</div>
      <div class="drawer__title">${escHtml(q.title)}</div>
      <div class="chips" style="margin-top:10px">${quoteStatusBadge(q.status)} <span class="badge b-slate">Sell ${fmtMoney(q.totals.sell)}</span> <span class="badge b-green">Margin ${q.totals.marginPct}%</span></div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section">
        <dl class="dl">
          <dt>Account</dt><dd>${escHtml(q.accountName || '—')}</dd>
          <dt>Owner</dt><dd>${q.ownerName || '—'}</dd>
          <dt>Currency</dt><dd>${q.currency}</dd>
          <dt>Valid until</dt><dd>${q.validUntil ? fmtDate(q.validUntil) : '—'}</dd>
          <dt>Buy / Sell</dt><dd>${fmtMoney(q.totals.buy)} / <b>${fmtMoney(q.totals.sell)}</b></dd>
          <dt>Margin</dt><dd>${fmtMoney(q.totals.margin)} (${q.totals.marginPct}%)</dd>
        </dl>
      </div>
      <div class="drawer__section">
        <h4>Rate lines</h4>
        <div class="table-wrap"><table class="data mini"><thead><tr><th>Lane / service</th><th>Qty</th><th>Buy</th><th>Sell</th></tr></thead><tbody>${lines || '<tr><td colspan=4 class="cell-sub">No lines.</td></tr>'}</tbody></table></div>
      </div>
      <div class="drawer__section">
        <h4>Status</h4>
        <label class="field"><select id="qStatus">${m.quoteStatuses.map((st) => `<option value="${st}" ${st === q.status ? 'selected' : ''}>${titleCase(st)}</option>`).join('')}</select></label>
        <button class="btn btn--primary btn--sm" id="saveQuote">Update status</button>
      </div>
      ${q.notes ? `<div class="drawer__section"><h4>Notes</h4><p class="cell-sub">${escHtml(q.notes)}</p></div>` : ''}
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveQuote').onclick = async () => {
    await api.updateQuote(q.id, { status: val('qStatus') });
    toast('Quote updated', q.id, 'success'); closeDrawer(); router();
  };
}

function openQuoteModal(dealId, accountId) {
  const m = state.meta;
  Promise.all([api.accounts(bq()), api.carriers()]).then(([accounts, carriers]) => {
    const carrierOpts = (sel) => `<option value="">— carrier —</option>` + carriers.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.name}</option>`).join('');
    const lineRow = () => `<tr data-qline>
      <td><input data-f="lane" placeholder="Lane e.g. Melbourne VIC → Sydney NSW" /></td>
      <td><select data-f="mode"><option value="">Mode</option>${m.carrierModes.map((x) => `<option>${x}</option>`).join('')}</select></td>
      <td><select data-f="carrierId">${carrierOpts()}</select></td>
      <td><input data-f="units" type="number" value="1" style="width:60px" /></td>
      <td><input data-f="buyRate" type="number" placeholder="Buy" style="width:80px" /></td>
      <td><input data-f="sellRate" type="number" placeholder="Sell" style="width:80px" /></td>
      <td><button class="btn btn--sm btn--danger" data-rm-row>✕</button></td>
    </tr>`;
    openModal(`
      <div class="modal__head">New quote</div>
      <div class="modal__body">
        <label class="field"><span>Title</span><input id="q-title" placeholder="e.g. National LTL rate proposal" /></label>
        <div class="form-row">
          <label class="field"><span>Account</span><select id="q-account"><option value="">— prospect —</option>${accounts.map((a) => `<option value="${a.id}" ${a.id === accountId ? 'selected' : ''}>${a.name}</option>`).join('')}</select></label>
          <label class="field"><span>Owner</span><select id="q-owner"><option value="">—</option>${m.agents.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label>
          <label class="field"><span>Valid until</span><input id="q-valid" type="date" /></label>
          <label class="field"><span>Status</span><select id="q-status">${m.quoteStatuses.map((s) => `<option>${s}</option>`).join('')}</select></label>
        </div>
        <h4 style="margin:6px 0">Rate lines</h4>
        <div class="table-wrap"><table class="data mini" id="q-lines"><thead><tr><th>Lane</th><th>Mode</th><th>Carrier</th><th>Qty</th><th>Buy</th><th>Sell</th><th></th></tr></thead><tbody>${lineRow()}</tbody></table></div>
        <button class="btn btn--sm" id="q-addline" style="margin-top:6px">+ Add line</button>
      </div>
      <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createQuote">Create quote</button></div>`);
    modalHost.querySelector('[data-close]').onclick = closeModal;
    modalHost.querySelector('#q-addline').onclick = () => modalHost.querySelector('#q-lines tbody').insertAdjacentHTML('beforeend', lineRow());
    modalHost.addEventListener('click', (e) => { const rm = e.target.closest('[data-rm-row]'); if (rm) rm.closest('tr').remove(); });
    modalHost.querySelector('#createQuote').onclick = async () => {
      const lines = [...modalHost.querySelectorAll('#q-lines tbody tr')].map((tr) => {
        const o = {}; tr.querySelectorAll('[data-f]').forEach((n) => o[n.dataset.f] = n.value.trim());
        o.units = Number(o.units) || 1; o.buyRate = Number(o.buyRate) || 0; o.sellRate = Number(o.sellRate) || 0;
        return o;
      }).filter((l) => l.lane || l.sellRate);
      const body = {
        title: val('q-title'), accountId: val('q-account') || null, dealId: dealId || null,
        ownerId: val('q-owner') || null, validUntil: val('q-valid') || null, status: val('q-status'), lines,
      };
      await api.createQuote(body);
      closeModal(); toast('Quote created', '', 'success'); router();
    };
  });
}

// ============================================================================
// PIPELINE
// ============================================================================
async function renderPipeline(host) {
  document.getElementById('topbarActions').innerHTML =
    `<button class="btn btn--primary" id="newDealBtn">+ New deal</button>`;
  document.getElementById('newDealBtn').onclick = openNewDealModal;

  const board = await api.dealBoard(bq());
  const openStages = board.filter((s) => s.key !== 'lost' || s.count);
  const totalOpen = board.filter((s) => !['won', 'lost'].includes(s.stage)).reduce((a, s) => a + s.value, 0);
  const totalWeighted = board.filter((s) => !['won', 'lost'].includes(s.stage))
    .reduce((a, s) => a + s.deals.reduce((x, d) => x + d.weightedValue, 0), 0);

  host.innerHTML = `
    <div class="toolbar">
      <span class="badge b-blue">Open: ${fmtMoney(totalOpen)}</span>
      <span class="badge b-violet">Weighted forecast: ${fmtMoney(totalWeighted)}</span>
      <div class="spacer"></div>
      <span class="muted">Drag cards between stages to update</span>
    </div>
    <div class="board">
      ${openStages.map((s) => `
        <div class="board__col" data-stage="${s.stage}">
          <div class="board__head">
            <div>
              <div class="board__title">${s.label}</div>
              <div class="board__meta">${s.count} deal(s) · ${s.probability}%</div>
            </div>
            <div class="board__val">${fmtMoney(s.value)}</div>
          </div>
          ${s.deals.map(dealCard).join('') || '<div class="cell-sub" style="padding:8px 4px">—</div>'}
        </div>`).join('')}
    </div>`;

  host.querySelectorAll('.deal-card').forEach((card) => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', card.dataset.deal));
    card.addEventListener('click', () => openDealDrawer(card.dataset.deal));
  });
  host.querySelectorAll('.board__col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('dragover'); });
    col.addEventListener('dragleave', () => col.classList.remove('dragover'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault(); col.classList.remove('dragover');
      const id = e.dataTransfer.getData('text/plain');
      const stage = col.dataset.stage;
      await api.updateDeal(id, { stage });
      toast('Deal moved', `${id} → ${stage}`, 'success');
      renderPipeline(host);
    });
  });
}

function dealCard(d) {
  const scoreColor = d.blueSheetScore >= 70 ? 'var(--green)' : d.blueSheetScore >= 40 ? 'var(--amber)' : 'var(--red)';
  const showBs = !['won', 'lost'].includes(d.stage);
  return `<div class="deal-card" data-deal="${d.id}">
    <div class="deal-card__name">${escHtml(d.name)}</div>
    <div class="deal-card__meta">
      <span>${escHtml(d.accountName || 'Prospect')} ${brandChip(d.brand)}</span>
      <span class="deal-card__val">${fmtMoney(d.value)}</span>
    </div>
    <div class="probbar"><i style="width:${d.probability}%"></i></div>
    ${showBs ? `<div class="deal-card__bs" title="Blue Sheet strength">
      <span class="bs-dot" style="background:${scoreColor}"></span> Blue Sheet ${d.blueSheetScore}%
      ${d.redFlagCount ? `<span class="bs-flags">⚑ ${d.redFlagCount}</span>` : ''}
    </div>` : ''}
  </div>`;
}

async function openDealDrawer(id) {
  const d = await api.deal(id);
  if (!d) return;
  const m = state.meta;
  const bs = d.blueSheet || {};
  const scoreColor = d.blueSheetScore >= 70 ? 'var(--green)' : d.blueSheetScore >= 40 ? 'var(--amber)' : 'var(--red)';

  const enumOpts = (list, sel) => list.map((v) => {
    const key = typeof v === 'string' ? v : v.key;
    const label = typeof v === 'string' ? titleCase(v) : v.label;
    return `<option value="${key}" ${key === sel ? 'selected' : ''}>${label}</option>`;
  }).join('');

  openDrawer(`
    <div class="drawer__head">
      <button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${d.id} · ${brandChip(d.brand)} · ${d.serviceType}</div>
      <div class="drawer__title">${escHtml(d.name)}</div>
      <div class="chips" style="margin-top:10px">
        ${badge(m.dealStages.find((s) => s.key === d.stage)?.label || d.stage, 'b-blue')}
        <span class="badge b-slate">${fmtMoney(d.value)}</span>
        <span class="badge b-violet">Weighted ${fmtMoney(d.weightedValue)}</span>
        ${d.redFlagCount ? badge(`${d.redFlagCount} red flag${d.redFlagCount > 1 ? 's' : ''}`, 'b-red') : ''}
      </div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section">
        <div class="form-row">
          <label class="field"><span>Stage</span><select id="stageSel">${m.dealStages.map((s) => `<option value="${s.key}" ${s.key === d.stage ? 'selected' : ''}>${s.label} (${s.probability}%)</option>`).join('')}</select></label>
          <label class="field"><span>Value (AUD)</span><input id="valInput" type="number" value="${d.value}" /></label>
        </div>
        <dl class="dl">
          <dt>Account</dt><dd>${escHtml(d.accountName || d.prospectName || '—')}</dd>
          <dt>Owner</dt><dd>${d.ownerName || '—'}</dd>
          <dt>Source</dt><dd>${d.source || '—'}</dd>
          <dt>Expected close</dt><dd>${d.expectedCloseAt ? fmtDate(d.expectedCloseAt) : '—'}</dd>
          ${d.closedAt ? `<dt>Closed</dt><dd>${fmtDate(d.closedAt)}</dd>` : ''}
          ${d.lostReason ? `<dt>Lost reason</dt><dd>${escHtml(d.lostReason)}</dd>` : ''}
        </dl>
        <div class="chips" style="margin-top:8px">
          <button class="btn btn--primary btn--sm" id="saveDeal">Save stage &amp; value</button>
          ${!['won', 'lost'].includes(d.stage) ? `<button class="btn btn--sm" id="winBtn" style="color:var(--green)">✓ Mark won</button><button class="btn btn--sm btn--danger" id="lossBtn">✕ Mark lost</button>` : ''}
        </div>
      </div>

      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 8px"><h4 style="margin:0">Quotes</h4><button class="btn btn--sm" id="addQuoteBtn">+ New quote</button></div>
        <div class="inline-list">${(d.quotes || []).length ? d.quotes.map((q) => `
          <div class="inline-item clickable" data-quote="${q.id}">
            <div><div class="cell-strong">${escHtml(q.title)}</div><div class="cell-sub">${q.lines.length} lines · margin ${q.totals.marginPct}%</div></div>
            <div class="chips">${quoteStatusBadge(q.status)} <b>${fmtMoney(q.totals.sell)}</b></div>
          </div>`).join('') : '<div class="cell-sub">No quotes yet.</div>'}</div>
      </div>

      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 8px"><h4 style="margin:0">Sales activity</h4></div>
        <div class="form-row">
          <select id="sactType">${m.salesActivityTypes.map((t) => `<option value="${t}">${titleCase(t)}</option>`).join('')}</select>
          <input id="sactSubject" placeholder="Log a call, meeting, email…" />
        </div>
        <button class="btn btn--sm" id="addSact" style="margin-top:8px">Add activity</button>
        <div class="timeline" style="margin-top:14px">${(d.activities || []).length ? d.activities.map((a) => `
          <div class="timeline__item"><div class="timeline__msg">${titleCase(a.type)}: ${escHtml(a.subject)}</div><div class="timeline__time">${fmtDateTime(a.at)}${a.agentName ? ' · ' + escHtml(a.agentName) : ''}</div></div>`).join('') : '<div class="cell-sub">No activity logged.</div>'}</div>
      </div>

      <div class="drawer__section" style="border-top:1px solid var(--border);padding-top:18px">
        <div class="section-head" style="margin:0 0 6px">
          <h4 style="margin:0">🔵 Miller Heiman Blue Sheet</h4>
          <span class="muted">Strategic Selling</span>
        </div>
        <div class="meter__row" style="margin-bottom:14px">
          <span class="meter__label" style="width:auto">Plan strength</span>
          <span class="meter__track"><span class="meter__fill" style="width:${d.blueSheetScore}%;background:${scoreColor}"></span></span>
          <span class="meter__num">${d.blueSheetScore}</span>
        </div>

        <label class="field"><span>Single Sales Objective (SSO)</span><textarea id="bs-sso" rows="2" placeholder="What, how much, by when — the specific objective for this sale">${escHtml(bs.sso || '')}</textarea></label>
        <div class="form-row">
          <label class="field"><span>Funnel position</span><select id="bs-funnel">${enumOpts(m.funnelPositions, bs.funnelPosition)}</select></label>
          <label class="field"><span>Ideal-customer fit</span><select id="bs-icp">${enumOpts(m.icpFit, bs.icpFit)}</select></label>
        </div>

        <h4 style="margin-top:8px">Buying influences</h4>
        <div class="table-wrap"><table class="data mini" id="bs-influences">
          <thead><tr><th>Name / title</th><th>Role</th><th>Rating</th><th>Mode</th><th>Infl.</th><th></th></tr></thead>
          <tbody>${(bs.buyingInfluences || []).map((b) => influenceRow(b, m)).join('')}</tbody>
        </table></div>
        <button class="btn btn--sm" id="add-influence">+ Add buying influence</button>

        <h4 style="margin-top:18px">Red flags <span class="muted">(one per line)</span></h4>
        <textarea id="bs-redflags" rows="3" placeholder="Missing information, uncontacted buyers, budget uncertainty…">${escHtml((bs.redFlags || []).join('\n'))}</textarea>

        <h4 style="margin-top:14px">Strengths to leverage <span class="muted">(one per line)</span></h4>
        <textarea id="bs-strengths" rows="3">${escHtml((bs.strengths || []).join('\n'))}</textarea>

        <h4 style="margin-top:14px">Competition</h4>
        <div class="table-wrap"><table class="data mini" id="bs-competition">
          <thead><tr><th>Type</th><th>Who</th><th>Notes</th><th></th></tr></thead>
          <tbody>${(bs.competition || []).map((c) => competitionRow(c, m)).join('')}</tbody>
        </table></div>
        <button class="btn btn--sm" id="add-competition">+ Add competitor</button>

        <h4 style="margin-top:18px">Win-results</h4>
        <div class="table-wrap"><table class="data mini" id="bs-winresults">
          <thead><tr><th>Buyer</th><th>Win (personal)</th><th>Result (business)</th><th></th></tr></thead>
          <tbody>${(bs.winResults || []).map(winResultRow).join('')}</tbody>
        </table></div>
        <button class="btn btn--sm" id="add-winresult">+ Add win-result</button>

        <h4 style="margin-top:18px">Action plan</h4>
        <div class="table-wrap"><table class="data mini" id="bs-actions">
          <thead><tr><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>${(bs.actionPlan || []).map((a) => bsActionRow(a, m)).join('')}</tbody>
        </table></div>
        <button class="btn btn--sm" id="add-bsaction">+ Add action</button>

        <label class="field" style="margin-top:16px"><span>Best action commitment</span><textarea id="bs-commitment" rows="2" placeholder="The single most important next step to advance the sale">${escHtml(bs.bestActionCommitment || '')}</textarea></label>

        <button class="btn btn--primary" id="saveBlueSheet" style="margin-top:6px">Save Blue Sheet</button>
      </div>
    </div>`);

  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveDeal').onclick = async () => {
    await api.updateDeal(id, { stage: val('stageSel'), value: Number(val('valInput')) });
    toast('Deal updated', '', 'success'); closeDrawer(); router();
  };
  const winBtn = drawer.querySelector('#winBtn');
  if (winBtn) winBtn.onclick = async () => {
    await api.updateDeal(id, { stage: 'won', value: Number(val('valInput')) });
    toast('Deal won 🎉', d.id, 'success'); closeDrawer(); router();
  };
  const lossBtn = drawer.querySelector('#lossBtn');
  if (lossBtn) lossBtn.onclick = async () => {
    const reason = prompt('Reason for loss?') || '';
    await api.updateDeal(id, { stage: 'lost', lostReason: reason });
    toast('Deal marked lost', d.id, 'warn'); closeDrawer(); router();
  };
  drawer.querySelector('#addQuoteBtn').onclick = () => openQuoteModal(id, d.accountId);
  drawer.querySelectorAll('[data-quote]').forEach((n) => n.onclick = async () => {
    const quotes = await api.quotes({ dealId: id });
    openQuoteDrawer(quotes.find((q) => q.id === n.dataset.quote));
  });
  drawer.querySelector('#addSact').onclick = async () => {
    const subject = val('sactSubject'); if (!subject) return;
    await api.addDealActivity(id, { type: val('sactType'), subject });
    toast('Activity logged', '', 'success'); openDealDrawer(id);
  };

  // Repeatable-row add buttons.
  drawer.querySelector('#add-influence').onclick = () =>
    drawer.querySelector('#bs-influences tbody').insertAdjacentHTML('beforeend', influenceRow({}, m));
  drawer.querySelector('#add-competition').onclick = () =>
    drawer.querySelector('#bs-competition tbody').insertAdjacentHTML('beforeend', competitionRow({}, m));
  drawer.querySelector('#add-winresult').onclick = () =>
    drawer.querySelector('#bs-winresults tbody').insertAdjacentHTML('beforeend', winResultRow({}));
  drawer.querySelector('#add-bsaction').onclick = () =>
    drawer.querySelector('#bs-actions tbody').insertAdjacentHTML('beforeend', bsActionRow({}, m));
  // Row removal (event delegation).
  drawer.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm-row]');
    if (rm) rm.closest('tr').remove();
  });

  drawer.querySelector('#saveBlueSheet').onclick = async () => {
    const blueSheet = collectBlueSheet();
    await api.saveBlueSheet(id, blueSheet);
    toast('Blue Sheet saved', d.id, 'success');
    openDealDrawer(id);
  };
}

// --- Blue Sheet row templates + collectors ----------------------------------
function influenceRow(b = {}, m) {
  const rid = b.id || `BI-${Math.random().toString(36).slice(2, 7)}`;
  const sel = (list, v) => list.map((o) => `<option value="${o.key}" ${o.key === v ? 'selected' : ''}>${o.label}</option>`).join('');
  const selPlain = (list, v) => list.map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${titleCase(o)}</option>`).join('');
  return `<tr data-bi-row data-id="${rid}">
    <td><input data-f="name" value="${escAttr(b.name)}" placeholder="Name" style="margin-bottom:4px" /><input data-f="title" value="${escAttr(b.title)}" placeholder="Title" /></td>
    <td><select data-f="role">${sel(m.buyingInfluenceRoles, b.role)}</select></td>
    <td><select data-f="rating">${sel(m.buyingRatings, b.rating || 'neutral')}</select></td>
    <td><select data-f="mode">${sel(m.buyingModes, b.mode || 'even-keel')}</select></td>
    <td><select data-f="influence">${selPlain(m.influenceLevels, b.influence || 'medium')}</select></td>
    <td><button class="btn btn--sm btn--danger" data-rm-row title="Remove">✕</button></td>
  </tr>`;
}
function competitionRow(c = {}, m) {
  const selPlain = (list, v) => list.map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${titleCase(o)}</option>`).join('');
  return `<tr data-comp-row>
    <td><select data-f="type">${selPlain(m.competitionTypes, c.type || 'direct')}</select></td>
    <td><input data-f="name" value="${escAttr(c.name)}" placeholder="Competitor" /></td>
    <td><input data-f="notes" value="${escAttr(c.notes)}" placeholder="Notes" /></td>
    <td><button class="btn btn--sm btn--danger" data-rm-row>✕</button></td>
  </tr>`;
}
function winResultRow(w = {}) {
  return `<tr data-wr-row>
    <td><input data-f="influence" value="${escAttr(w.influence)}" placeholder="Buyer" /></td>
    <td><input data-f="win" value="${escAttr(w.win)}" placeholder="Personal win" /></td>
    <td><input data-f="result" value="${escAttr(w.result)}" placeholder="Business result" /></td>
    <td><button class="btn btn--sm btn--danger" data-rm-row>✕</button></td>
  </tr>`;
}
function bsActionRow(a = {}, m) {
  const selPlain = (list, v) => list.map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${titleCase(o)}</option>`).join('');
  const due = a.dueDate ? a.dueDate.slice(0, 10) : '';
  return `<tr data-ap-row>
    <td><input data-f="action" value="${escAttr(a.action)}" placeholder="Action" /></td>
    <td><input data-f="owner" value="${escAttr(a.owner)}" placeholder="Owner" /></td>
    <td><input data-f="dueDate" type="date" value="${due}" /></td>
    <td><select data-f="status">${selPlain(m.actionStatuses, a.status || 'open')}</select></td>
    <td><button class="btn btn--sm btn--danger" data-rm-row>✕</button></td>
  </tr>`;
}

function readRow(tr) {
  const o = {};
  tr.querySelectorAll('[data-f]').forEach((n) => { o[n.dataset.f] = n.value.trim(); });
  return o;
}
function collectBlueSheet() {
  const lines = (id) => val(id).split('\n').map((s) => s.trim()).filter(Boolean);
  const rows = (sel) => [...drawer.querySelectorAll(sel)];
  return {
    sso: val('bs-sso'),
    funnelPosition: val('bs-funnel'),
    icpFit: val('bs-icp'),
    buyingInfluences: rows('#bs-influences tbody tr').map((tr) => ({ id: tr.dataset.id, ...readRow(tr) })).filter((b) => b.name),
    redFlags: lines('bs-redflags'),
    strengths: lines('bs-strengths'),
    competition: rows('#bs-competition tbody tr').map(readRow).filter((c) => c.name),
    winResults: rows('#bs-winresults tbody tr').map(readRow).filter((w) => w.win || w.result),
    actionPlan: rows('#bs-actions tbody tr').map(readRow).filter((a) => a.action),
    bestActionCommitment: val('bs-commitment'),
  };
}

function openNewDealModal() {
  const m = state.meta;
  api.accounts(bq()).then((accounts) => {
    openModal(`
      <div class="modal__head">New deal</div>
      <div class="modal__body">
        <label class="field"><span>Deal name *</span><input id="f-name" placeholder="e.g. Managed LTL program" /></label>
        <div class="form-row">
          <label class="field"><span>Account</span><select id="f-account"><option value="">— prospect —</option>${accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label>
          <label class="field"><span>Brand</span><select id="f-brand">${m.brands.map((b) => `<option>${b}</option>`).join('')}</select></label>
          <label class="field"><span>Stage</span><select id="f-stage">${m.dealStages.map((s) => `<option value="${s.key}">${s.label}</option>`).join('')}</select></label>
          <label class="field"><span>Value (USD)</span><input id="f-value" type="number" value="50000" /></label>
          <label class="field"><span>Service type</span><input id="f-service" value="Managed Freight" /></label>
          <label class="field"><span>Owner</span><select id="f-owner"><option value="">—</option>${m.agents.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label>
        </div>
      </div>
      <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createDeal">Create deal</button></div>`);
    modalHost.querySelector('[data-close]').onclick = closeModal;
    modalHost.querySelector('#createDeal').onclick = async () => {
      const body = { name: val('f-name'), accountId: val('f-account') || null, brand: val('f-brand'), stage: val('f-stage'), value: Number(val('f-value')), serviceType: val('f-service'), ownerId: val('f-owner') || null };
      if (!body.name) return toast('Name required', '', 'warn');
      await api.createDeal(body); closeModal(); toast('Deal created', '', 'success'); router();
    };
  });
}

// ============================================================================
// ACCOUNTS
// ============================================================================
async function renderAccounts(host) {
  document.getElementById('topbarActions').innerHTML =
    `<button class="btn btn--primary" id="newAccBtn">+ New account</button>`;
  document.getElementById('newAccBtn').onclick = openNewAccountModal;

  const accounts = await api.accounts(bq());
  host.innerHTML = `
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
      ${accounts.map(accountCard).join('') || '<div class="empty">No accounts.</div>'}
    </div>`;
  host.querySelectorAll('[data-acc]').forEach((n) =>
    n.addEventListener('click', () => openAccountDrawer(n.dataset.acc)));
}

function accountCard(a) {
  const healthColor = { healthy: 'var(--green)', watch: 'var(--amber)', 'at-risk': 'var(--red)' }[a.health];
  return `<div class="card card--pad clickable" data-acc="${a.id}" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
      <div>
        <div class="cell-strong" style="font-size:15px">${a.name}</div>
        <div class="cell-sub">${a.industry} · ${a.region || '—'}</div>
      </div>
      ${brandChip(a.brand)}
    </div>
    <div class="chips" style="margin:12px 0 10px">${healthBadge(a.health)} ${badge(titleCase(a.tier), 'b-slate')}</div>
    <div class="health-strip"><i style="display:block;height:100%;width:100%;background:${healthColor}"></i></div>
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:var(--text-muted);flex-wrap:wrap;gap:4px">
      <span><b style="color:var(--text)">${a.openCases}</b> cases</span>
      <span><b style="color:var(--text)">${a.openDeals}</b> deals</span>
      <span><b style="color:var(--text)">${a.openActions ?? 0}</b> actions</span>
      <span><b style="color:var(--text)">${a.documents ?? 0}</b> docs</span>
      <span>${fmtMoney(a.annualRevenue)}/yr</span>
    </div>
  </div>`;
}

async function openAccountDrawer(id) {
  const a = await api.account(id);
  state.openAccountId = id;
  const contacts = a.contacts.map((c) => `
    <div class="inline-item">
      <div><div class="cell-strong">${c.name}${c.primary ? ' <span class="badge b-blue" style="padding:1px 6px">primary</span>' : ''}</div><div class="cell-sub">${c.title || ''}</div></div>
      <div style="text-align:right"><div class="cell-sub">${c.email}</div><div class="cell-sub">${c.phone || ''}</div></div>
    </div>`).join('') || '<div class="cell-sub">No contacts.</div>';

  const cases = a.cases.slice(0, 6).map((c) => `
    <div class="inline-item clickable" data-case="${c.id}">
      <div><div class="cell-strong">${c.subject}</div><div class="cell-sub">${c.id} · ${titleCase(c.category)}</div></div>
      <div class="chips">${priorityBadge(c.priority)} ${statusBadge(c.status)}</div>
    </div>`).join('') || '<div class="cell-sub">No cases.</div>';

  const deals = a.deals.map((d) => `
    <div class="inline-item clickable" data-deal="${d.id}"><div class="cell-strong">${escHtml(d.name)}</div><div>${badge(titleCase(d.stage), 'b-slate')} <b>${fmtMoney(d.value)}</b></div></div>`).join('') || '<div class="cell-sub">No deals.</div>';

  const shipments = a.shipments.slice(0, 6).map((s) => `
    <div class="inline-item clickable" data-shp="${s.id}">
      <div><span class="mono">${s.reference}</span><div class="cell-sub">${s.origin} → ${s.destination}</div></div>
      ${shipmentStatusBadge(s.status)}
    </div>`).join('') || '<div class="cell-sub">No shipments.</div>';

  // Documents grouped by type (rate cards, agreements, QBRs, monthly decks).
  const docs = a.documents || [];
  const docSection = (label, type) => {
    const items = docs.filter((d) => d.type === type);
    if (!items.length) return '';
    return `<div style="margin-bottom:10px"><div class="doc-group-label">${docMeta(type).icon} ${label}</div>${items.map(documentItem).join('')}</div>`;
  };
  const documentsHtml = docs.length
    ? ['rate-card', 'agreement', 'qbr', 'monthly-deck', 'other']
        .map((t) => docSection(state.meta.documentTypes.find((x) => x.key === t)?.label + 's', t)).join('')
    : '<div class="cell-sub">No documents yet.</div>';

  // Action register (from QBRs / monthly reviews).
  const actions = a.actions || [];
  const openActionCount = actions.filter((x) => x.status !== 'done').length;
  const actionsHtml = actions.length
    ? actions.map(actionItem).join('')
    : '<div class="cell-sub">No actions logged.</div>';

  const activities = a.activities.slice(0, 8).map((x) => `
    <div class="timeline__item"><div class="timeline__msg">${titleCase(x.type)}: ${escHtml(x.subject)}</div><div class="timeline__time">${fmtDateTime(x.at)}</div></div>`).join('') || '<div class="cell-sub">No activity.</div>';

  // Account-ops registers (compact lists in the drawer).
  const listOr = (arr, fn, empty) => arr && arr.length ? arr.map(fn).join('') : `<div class="cell-sub">${empty}</div>`;
  const prvHtml = listOr(a.priceReviews, (r) => `
    <div class="inline-item clickable" data-prv="${r.id}"><div><div class="cell-strong">${escHtml(r.title)}</div><div class="cell-sub">${titleCase(r.scope)} · ${r.increasePercent != null ? r.increasePercent + '%' : '—'} · eff ${r.effectiveDate ? fmtDate(r.effectiveDate) : 'TBC'}</div></div>${opStatusBadge(r.status)}</div>`, 'No price reviews.');
  const reqHtml = listOr(a.requests, (r) => `
    <div class="inline-item clickable" data-req="${r.id}"><div><div class="cell-strong">${escHtml(r.title)}</div><div class="cell-sub">${titleCase(r.type)}</div></div><div class="chips">${priorityBadge(r.priority)} ${opStatusBadge(r.status)}</div></div>`, 'No requests.');
  const riskHtml = listOr(a.risks, (r) => `
    <div class="inline-item clickable" data-risk="${r.id}"><div><div class="cell-strong">${escHtml(r.title)}</div><div class="cell-sub">${titleCase(r.category)}${r.revenueAtRisk ? ' · ' + fmtMoney(r.revenueAtRisk) + ' at risk' : ''}</div></div><div class="chips">${severityBadge(r.severity)} ${opStatusBadge(r.status)}</div></div>`, 'No risks flagged.');
  const impHtml = listOr(a.implementations, (r) => `
    <div class="inline-item clickable" data-imp="${r.id}"><div><div class="cell-strong">${escHtml(r.title)}</div><div class="cell-sub">${titleCase(r.type)}${r.goLiveDate ? ' · go-live ' + fmtDate(r.goLiveDate) : ''} · ${r.progress}%</div></div>${opStatusBadge(r.status)}</div>`, 'No implementations.');
  const clmHtml = listOr(a.creditClaims, (r) => `
    <div class="inline-item clickable" data-clm="${r.id}"><div><div class="cell-strong">${r.reference} · ${fmtMoney(r.amount)}</div><div class="cell-sub">${titleCase(r.reason)} · ${r.against === 'carrier' ? 'vs ' + escHtml(r.carrierName || 'carrier') : 'internal'}</div></div>${opStatusBadge(r.status)}</div>`, 'No credit claims.');
  const xp = a.experience || { nps: {}, csat: {} };
  const svyHtml = listOr((a.surveys || []).slice(0, 5), (r) => `
    <div class="inline-item"><div><div class="cell-strong">${r.type.toUpperCase()} ${r.score}${r.type === 'csat' ? '/5' : ''}</div><div class="cell-sub">${escHtml(r.comment || r.respondent || '')}</div></div><span class="cell-sub">${timeAgo(r.respondedAt)}</span></div>`, 'No survey responses.');

  openDrawer(`
    <div class="drawer__head">
      <button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${a.id} · ${brandChip(a.brand)}</div>
      <div class="drawer__title">${a.name}</div>
      <div class="chips" style="margin-top:10px">${healthBadge(a.health)} ${badge(titleCase(a.tier), 'b-slate')}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section">
        <dl class="dl">
          <dt>Industry</dt><dd>${a.industry}</dd>
          <dt>Region</dt><dd>${a.region || '—'}</dd>
          <dt>Account owner</dt><dd>${a.owner ? a.owner.name : '—'}</dd>
          <dt>Annual revenue</dt><dd>${fmtMoney(a.annualRevenue)}</dd>
          <dt>Customer since</dt><dd>${fmtDate(a.activeSince)}</dd>
          <dt>Phone</dt><dd>${a.phone || '—'}</dd>
        </dl>
        ${a.notes ? `<p style="margin-top:10px;font-size:13px;color:var(--text-muted)">${a.notes}</p>` : ''}
        <div style="margin-top:12px"><label class="field"><span>Health</span><select id="healthSel">${state.meta.accountHealth.map((h) => `<option value="${h}" ${h === a.health ? 'selected' : ''}>${titleCase(h)}</option>`).join('')}</select></label><button class="btn btn--sm btn--primary" id="saveHealth">Update health</button></div>
      </div>
      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 10px"><h4 style="margin:0">📁 Documents &amp; agreements</h4><button class="btn btn--sm" id="addDoc">+ Add</button></div>
        ${documentsHtml}
      </div>
      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 10px"><h4 style="margin:0">✔ Actions <span class="muted">${openActionCount} open</span></h4><button class="btn btn--sm" id="addAction">+ Add</button></div>
        <div class="inline-list">${actionsHtml}</div>
      </div>
      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 10px"><h4 style="margin:0">💲 Price reviews</h4><button class="btn btn--sm" id="addPrv">+ Add</button></div>
        <div class="inline-list">${prvHtml}</div>
      </div>
      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 10px"><h4 style="margin:0">⚠ At-risk</h4><button class="btn btn--sm" id="addRisk">+ Flag</button></div>
        <div class="inline-list">${riskHtml}</div>
      </div>
      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 10px"><h4 style="margin:0">🧩 Requests</h4><button class="btn btn--sm" id="addReq">+ Add</button></div>
        <div class="inline-list">${reqHtml}</div>
      </div>
      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 10px"><h4 style="margin:0">🚀 Implementations</h4><button class="btn btn--sm" id="addImp">+ Add</button></div>
        <div class="inline-list">${impHtml}</div>
      </div>
      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 10px"><h4 style="margin:0">💳 Credit claims</h4><button class="btn btn--sm" id="addClm">+ Add</button></div>
        <div class="inline-list">${clmHtml}</div>
      </div>
      <div class="drawer__section">
        <div class="section-head" style="margin:0 0 10px"><h4 style="margin:0">😊 Experience (NPS / CSAT)</h4><button class="btn btn--sm" id="addSvy">+ Capture</button></div>
        <div class="chips" style="margin-bottom:10px">${npsBadge(xp.nps.score)} ${csatBadge(xp.csat.avg)}</div>
        <div class="inline-list">${svyHtml}</div>
      </div>
      <div class="drawer__section"><h4>Contacts</h4><div class="inline-list">${contacts}</div></div>
      <div class="drawer__section"><h4>Open cases</h4><div class="inline-list">${cases}</div></div>
      <div class="drawer__section"><h4>Deals</h4><div class="inline-list">${deals}</div></div>
      <div class="drawer__section"><h4>Shipments</h4><div class="inline-list">${shipments}</div></div>
      <div class="drawer__section">
        <h4>Log activity</h4>
        <div class="form-row">
          <select id="actType"><option value="call">Call</option><option value="meeting">Meeting</option><option value="email">Email</option><option value="note">Note</option></select>
          <input id="actSubject" placeholder="Subject" />
        </div>
        <button class="btn btn--sm" id="addActivity" style="margin-top:8px">Add</button>
        <div class="timeline" style="margin-top:14px">${activities}</div>
      </div>
    </div>`);

  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveHealth').onclick = async () => {
    await api.updateAccount(id, { health: val('healthSel') });
    toast('Account updated', '', 'success'); openAccountDrawer(id);
  };
  drawer.querySelector('#addActivity').onclick = async () => {
    const subject = val('actSubject'); if (!subject) return;
    await api.addActivity(id, { type: val('actType'), subject });
    toast('Activity logged', '', 'success'); openAccountDrawer(id);
  };
  drawer.querySelector('#addDoc').onclick = () => openAddDocumentModal(id);
  drawer.querySelector('#addAction').onclick = () => openAddActionModal(id);
  // Account-ops add buttons (pre-fill this account).
  drawer.querySelector('#addPrv').onclick = () => openPriceReviewModal(id);
  drawer.querySelector('#addRisk').onclick = () => openRiskModal(id);
  drawer.querySelector('#addReq').onclick = () => openRequestModal(id);
  drawer.querySelector('#addImp').onclick = () => openImplementationModal(id);
  drawer.querySelector('#addClm').onclick = () => openClaimModal(id);
  drawer.querySelector('#addSvy').onclick = () => openSurveyModal(id);
  // Account-ops item clicks open the respective register drawer.
  const byId = (arr) => Object.fromEntries((arr || []).map((r) => [r.id, r]));
  const prvMap = byId(a.priceReviews), riskMap = byId(a.risks), reqMap = byId(a.requests), impMap = byId(a.implementations), clmMap = byId(a.creditClaims);
  drawer.querySelectorAll('[data-prv]').forEach((n) => n.onclick = () => openPriceReviewDrawer(prvMap[n.dataset.prv]));
  drawer.querySelectorAll('[data-risk]').forEach((n) => n.onclick = () => openRiskDrawer(riskMap[n.dataset.risk]));
  drawer.querySelectorAll('[data-req]').forEach((n) => n.onclick = () => openRequestDrawer(reqMap[n.dataset.req]));
  drawer.querySelectorAll('[data-imp]').forEach((n) => n.onclick = () => openImplementationDrawer(impMap[n.dataset.imp]));
  drawer.querySelectorAll('[data-clm]').forEach((n) => n.onclick = () => openClaimDrawer(clmMap[n.dataset.clm]));
  // Toggle an action done / not-done.
  drawer.querySelectorAll('[data-action-toggle]').forEach((n) => n.onclick = async (e) => {
    e.stopPropagation();
    const actionId = n.dataset.actionToggle;
    await api.updateAction(actionId, { status: n.checked ? 'done' : 'open' });
    openAccountDrawer(id);
  });
  drawer.querySelectorAll('[data-del-doc]').forEach((n) => n.onclick = async (e) => {
    e.stopPropagation();
    await api.deleteDocument(n.dataset.delDoc);
    toast('Document removed', '', 'success'); openAccountDrawer(id);
  });
  drawer.querySelectorAll('[data-case]').forEach((n) => n.onclick = () => { closeDrawer(); openCaseDrawer(n.dataset.case); });
  drawer.querySelectorAll('[data-shp]').forEach((n) => n.onclick = () => { closeDrawer(); openShipmentDrawer(n.dataset.shp); });
  drawer.querySelectorAll('[data-deal]').forEach((n) => n.onclick = () => { closeDrawer(); openDealDrawer(n.dataset.deal); });
}

// --- Account document + action item templates -------------------------------
function documentItem(d) {
  const expiry = d.expiryDate ? new Date(d.expiryDate).getTime() : null;
  const soon = expiry && expiry - Date.now() < 60 * 86400 * 1000 && expiry > Date.now();
  const expired = expiry && expiry < Date.now();
  const meta = [d.period, d.version, d.value ? fmtMoney(d.value) : null].filter(Boolean).join(' · ');
  return `<div class="doc-item">
    <div style="flex:1;min-width:0">
      <div class="cell-strong">${d.url ? `<a href="${escAttr(d.url)}" target="_blank" rel="noopener">${escHtml(d.title)} ↗</a>` : escHtml(d.title)}</div>
      <div class="cell-sub">${meta || fmtDate(d.date)}${d.expiryDate ? ` · ${expired ? '<span style="color:var(--red)">expired</span>' : soon ? `<span style="color:var(--amber)">expires ${fmtDate(d.expiryDate)}</span>` : `expires ${fmtDate(d.expiryDate)}`}` : ''}</div>
    </div>
    <span class="badge ${d.status === 'signed' || d.status === 'active' ? 'b-green' : d.status === 'draft' ? 'b-amber' : 'b-slate'}">${titleCase(d.status)}</span>
    <button class="btn btn--sm btn--danger" data-del-doc="${d.id}" title="Remove">✕</button>
  </div>`;
}

function actionItem(x) {
  const done = x.status === 'done';
  const overdue = !done && x.dueDate && new Date(x.dueDate).getTime() < Date.now();
  return `<div class="inline-item" style="${done ? 'opacity:.6' : ''}">
    <div style="display:flex;gap:10px;align-items:start;flex:1;min-width:0">
      <input type="checkbox" style="width:auto;margin-top:2px" ${done ? 'checked' : ''} data-action-toggle="${x.id}" />
      <div style="min-width:0">
        <div class="cell-strong" style="${done ? 'text-decoration:line-through' : ''}">${escHtml(x.title)}</div>
        <div class="cell-sub">
          ${badge(titleCase(x.source), 'b-slate')}
          ${x.owner ? ' · ' + escHtml(x.owner) : ''}
          ${x.dueDate ? ` · <span style="${overdue ? 'color:var(--red);font-weight:700' : ''}">due ${fmtDate(x.dueDate)}${overdue ? ' (overdue)' : ''}</span>` : ''}
        </div>
      </div>
    </div>
    ${actionStatusBadge(x.status)}
  </div>`;
}

function openAddDocumentModal(accountId) {
  const m = state.meta;
  openModal(`
    <div class="modal__head">Add document</div>
    <div class="modal__body">
      <label class="field"><span>Title *</span><input id="d-title" placeholder="e.g. FY26 Rate Card" /></label>
      <div class="form-row">
        <label class="field"><span>Type</span><select id="d-type">${m.documentTypes.map((t) => `<option value="${t.key}">${t.label}</option>`).join('')}</select></label>
        <label class="field"><span>Status</span><select id="d-status">${m.documentStatuses.map((s) => `<option value="${s}" ${s === 'active' ? 'selected' : ''}>${titleCase(s)}</option>`).join('')}</select></label>
        <label class="field"><span>Period</span><input id="d-period" placeholder="e.g. Q3 FY26 / 2026" /></label>
        <label class="field"><span>Effective date</span><input id="d-date" type="date" /></label>
        <label class="field"><span>Expiry (optional)</span><input id="d-expiry" type="date" /></label>
        <label class="field"><span>Value (optional)</span><input id="d-value" type="number" /></label>
      </div>
      <label class="field"><span>Link (URL)</span><input id="d-url" placeholder="https://…" /></label>
      <label class="field"><span>Notes</span><textarea id="d-notes" rows="2"></textarea></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createDoc">Add document</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createDoc').onclick = async () => {
    const body = {
      title: val('d-title'), type: val('d-type'), status: val('d-status'), period: val('d-period'),
      date: val('d-date') || undefined, expiryDate: val('d-expiry') || null,
      value: val('d-value') || null, url: val('d-url'), notes: val('d-notes'),
    };
    if (!body.title) return toast('Title required', '', 'warn');
    await api.addDocument(accountId, body);
    closeModal(); toast('Document added', '', 'success'); openAccountDrawer(accountId);
  };
}

function openAddActionModal(accountId) {
  const m = state.meta;
  openModal(`
    <div class="modal__head">Add action</div>
    <div class="modal__body">
      <label class="field"><span>Action *</span><input id="ac-title" placeholder="e.g. Send renewal proposal" /></label>
      <div class="form-row">
        <label class="field"><span>Source</span><select id="ac-source">${m.actionSources.map((s) => `<option value="${s}">${titleCase(s)}</option>`).join('')}</select></label>
        <label class="field"><span>Status</span><select id="ac-status">${m.actionStatuses.map((s) => `<option value="${s}">${titleCase(s)}</option>`).join('')}</select></label>
        <label class="field"><span>Owner</span><input id="ac-owner" placeholder="Owner name" /></label>
        <label class="field"><span>Due date</span><input id="ac-due" type="date" /></label>
        <label class="field"><span>Priority</span><select id="ac-priority"><option>low</option><option selected>medium</option><option>high</option></select></label>
      </div>
      <label class="field"><span>Notes</span><textarea id="ac-notes" rows="2"></textarea></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createAction">Add action</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createAction').onclick = async () => {
    const body = {
      title: val('ac-title'), source: val('ac-source'), status: val('ac-status'),
      owner: val('ac-owner'), dueDate: val('ac-due') || null, priority: val('ac-priority'), notes: val('ac-notes'),
    };
    if (!body.title) return toast('Action required', '', 'warn');
    await api.addAction(accountId, body);
    closeModal(); toast('Action added', '', 'success'); openAccountDrawer(accountId);
  };
}

function openNewAccountModal() {
  const m = state.meta;
  openModal(`
    <div class="modal__head">New account</div>
    <div class="modal__body">
      <label class="field"><span>Company name *</span><input id="f-name" /></label>
      <div class="form-row">
        <label class="field"><span>Brand</span><select id="f-brand">${m.brands.map((b) => `<option>${b}</option>`).join('')}</select></label>
        <label class="field"><span>Industry</span><input id="f-industry" value="Logistics" /></label>
        <label class="field"><span>Tier</span><select id="f-tier">${m.accountTiers.map((t) => `<option value="${t}">${titleCase(t)}</option>`).join('')}</select></label>
        <label class="field"><span>Health</span><select id="f-health">${m.accountHealth.map((h) => `<option value="${h}">${titleCase(h)}</option>`).join('')}</select></label>
        <label class="field"><span>Region</span><input id="f-region" /></label>
        <label class="field"><span>Owner</span><select id="f-owner"><option value="">—</option>${m.agents.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createAcc">Create</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createAcc').onclick = async () => {
    const body = { name: val('f-name'), brand: val('f-brand'), industry: val('f-industry'), tier: val('f-tier'), health: val('f-health'), region: val('f-region'), ownerId: val('f-owner') || null };
    if (!body.name) return toast('Name required', '', 'warn');
    await api.createAccount(body); closeModal(); toast('Account created', '', 'success'); router();
  };
}

// ============================================================================
// SHIPMENTS
// ============================================================================
async function renderShipments(host) {
  const filters = window.__shipFilters || {};
  const shipments = await api.shipments(bq(filters));
  const m = state.meta;
  host.innerHTML = `
    <div class="toolbar">
      <input class="search" placeholder="Search reference or destination…" data-sfilter="q" value="${filters.q || ''}" />
      <select data-sfilter="status"><option value="">All statuses</option>${m.shipmentStatuses.map((s) => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${titleCase(s)}</option>`).join('')}</select>
      <button class="btn btn--sm ${filters.exceptions === 'true' ? 'btn--primary' : ''}" id="excToggle">⚠ Exceptions only</button>
      <div class="spacer"></div><span class="muted">${shipments.length} shipment(s)</span>
    </div>
    <div class="card table-wrap">
      <table class="data">
        <thead><tr><th>Reference</th><th>Account</th><th>Lane</th><th>Mode</th><th>Status</th><th>ETA</th><th>Last event</th></tr></thead>
        <tbody>${shipments.length ? shipments.map(shipmentRow).join('') : `<tr><td colspan="7"><div class="empty">No shipments.</div></td></tr>`}</tbody>
      </table>
    </div>`;
  const apply = () => {
    const f = {};
    host.querySelectorAll('[data-sfilter]').forEach((n) => { if (n.value) f[n.dataset.sfilter] = n.value; });
    if (host.querySelector('#excToggle').classList.contains('btn--primary')) f.exceptions = 'true';
    window.__shipFilters = f; renderShipments(host);
  };
  host.querySelectorAll('[data-sfilter]').forEach((n) => {
    const ev = n.tagName === 'SELECT' ? 'change' : 'input'; let t;
    n.addEventListener(ev, () => { clearTimeout(t); t = setTimeout(apply, ev === 'input' ? 300 : 0); });
  });
  host.querySelector('#excToggle').onclick = () => {
    window.__shipFilters = { ...(window.__shipFilters || {}), exceptions: filters.exceptions === 'true' ? '' : 'true' };
    renderShipments(host);
  };
  host.querySelectorAll('tr[data-shp]').forEach((tr) => tr.addEventListener('click', () => openShipmentDrawer(tr.dataset.shp)));
}

function shipmentRow(s) {
  return `<tr class="clickable" data-shp="${s.id}">
    <td><span class="mono cell-strong">${s.reference}</span> ${s.hasOpenException ? '<span class="badge b-red" style="padding:1px 6px">⚠</span>' : ''}<div class="cell-sub">${brandChip(s.brand)} ${s.carrier || ''}</div></td>
    <td>${s.accountName || '—'}</td>
    <td>${s.origin} → ${s.destination}</td>
    <td>${badge(s.mode, 'b-slate')}</td>
    <td>${shipmentStatusBadge(s.status)}</td>
    <td class="cell-sub">${s.eta ? fmtDate(s.eta) : '—'}</td>
    <td class="cell-sub">${timeAgo(s.lastEventAt)}</td>
  </tr>`;
}

async function openShipmentDrawer(id) {
  const s = await api.shipment(id);
  const events = s.events.map((e) => {
    const ico = eventIcon(e.status);
    return `<div class="timeline__item"><div class="timeline__msg">${titleCase(e.status)} ${e.isException ? badge('exception', 'b-red') : ''}</div><div class="timeline__time">${e.location || ''} · ${fmtDateTime(e.occurredAt)}${e.note ? ' · ' + e.note : ''}</div></div>`;
  }).join('') || '<div class="cell-sub">No efmAPP events recorded.</div>';
  const cases = s.cases.map((c) => `<div class="inline-item clickable" data-case="${c.id}"><div class="cell-strong">${c.subject}</div>${statusBadge(c.status)}</div>`).join('') || '<div class="cell-sub">No linked cases.</div>';

  openDrawer(`
    <div class="drawer__head">
      <button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${brandChip(s.brand)} · ${s.service}</div>
      <div class="drawer__title mono">${s.reference}</div>
      <div class="chips" style="margin-top:10px">${shipmentStatusBadge(s.status)} ${s.hasOpenException ? badge('open exception', 'b-red') : ''}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section">
        <dl class="dl">
          <dt>Account</dt><dd>${s.account ? s.account.name : '—'}</dd>
          <dt>Lane</dt><dd>${s.origin} → ${s.destination}</dd>
          <dt>Carrier</dt><dd>${s.carrier || '—'}</dd>
          <dt>Mode / service</dt><dd>${s.mode} · ${s.service}</dd>
          <dt>Pieces / weight</dt><dd>${s.pieces} pcs · ${s.weightKg} kg</dd>
          <dt>ETA</dt><dd>${s.eta ? fmtDate(s.eta) : '—'}</dd>
          <dt>Last location</dt><dd>${s.lastLocation || '—'}</dd>
        </dl>
      </div>
      <div class="drawer__section"><h4>Linked cases</h4><div class="inline-list">${cases}</div></div>
      <div class="drawer__section"><h4>efmAPP event timeline</h4><div class="timeline">${events}</div></div>
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelectorAll('[data-case]').forEach((n) => n.onclick = () => { closeDrawer(); openCaseDrawer(n.dataset.case); });
}

// ============================================================================
// MARKETING & CX (tabbed: Campaigns · NPS & CSAT)
// ============================================================================
async function renderMarketing(host) {
  const tab = state.tab || '';
  host.innerHTML = tabBar('marketing', [
    { key: '', label: 'Campaigns' },
    { key: 'experience', label: 'NPS & CSAT' },
  ], tab) + `<div id="mktContent"></div>`;
  const c = host.querySelector('#mktContent');
  if (tab === 'experience') return renderExperience(c);
  return renderCampaigns(c);
}

async function renderCampaigns(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newCmp">+ New campaign</button>`;
  document.getElementById('newCmp').onclick = () => openCampaignModal();
  const o = await api.marketingOverview(bq());
  const k = o.kpis;
  const kpiCards = [
    { label: 'Active campaigns', value: k.activeCampaigns, sub: `${k.campaigns} total` },
    { label: 'Leads', value: k.leads, sub: `${k.mql} MQL · ${k.sql} SQL` },
    { label: 'Pipeline influenced', value: fmtMoney(k.pipelineInfluenced), sub: `${k.opportunities} opportunities` },
    { label: 'Marketing spend', value: fmtMoney(k.spend), sub: k.cpl != null ? `${fmtMoney(k.cpl)} / lead` : '' },
    { label: 'ROI', value: k.roi == null ? '—' : `${k.roi}%`, sub: 'pipeline vs spend', cls: k.roi != null && k.roi > 0 ? 'kpi--good' : '' },
  ];
  const rows = o.campaigns;
  host.innerHTML = `
    <div class="grid kpis" style="margin-bottom:18px">${kpiCards.map(kpiCard).join('')}</div>
    <div class="card table-wrap"><table class="data">
      <thead><tr><th>Campaign</th><th>Service</th><th>Type</th><th>Status</th><th>Leads</th><th>MQL</th><th>Spend</th><th>Pipeline</th><th>ROI</th></tr></thead>
      <tbody>${rows.length ? rows.map((c) => `
        <tr class="clickable" data-cmp="${c.id}">
          <td class="cell-strong">${escHtml(c.name)}</td>
          <td>${brandChip(c.brand)}</td>
          <td>${badge(titleCase(c.type), 'b-violet')}</td>
          <td>${opStatusBadge(c.status)}</td>
          <td>${c.leads}</td>
          <td class="cell-sub">${c.mql}</td>
          <td class="cell-sub">${fmtMoney(c.cost)}</td>
          <td class="cell-strong">${fmtMoney(c.revenue)}</td>
          <td style="color:${c.roi > 0 ? 'var(--green)' : 'var(--text-muted)'};font-weight:700">${c.roi == null ? '—' : c.roi + '%'}</td>
        </tr>`).join('') : `<tr><td colspan="9"><div class="empty">No campaigns.</div></td></tr>`}
      </tbody></table></div>`;
  const map = Object.fromEntries(rows.map((c) => [c.id, c]));
  host.querySelectorAll('[data-cmp]').forEach((tr) => tr.onclick = () => openCampaignDrawer(map[tr.dataset.cmp]));
}

function openCampaignModal() {
  const s = opSelects(); const m = state.meta;
  openModal(`
    <div class="modal__head">New campaign</div>
    <div class="modal__body">
      <label class="field"><span>Campaign name *</span><input id="cm-name" placeholder="e.g. 4PL Control Tower — ANZ demand-gen" /></label>
      <div class="form-row">
        <label class="field"><span>Type</span><select id="cm-type">${s.en(m.campaignTypes, 'email')}</select></label>
        <label class="field"><span>Service line</span><select id="cm-brand">${s.en(m.serviceLines, '4PL')}</select></label>
        <label class="field"><span>Status</span><select id="cm-status">${s.en(m.campaignStatuses, 'planned')}</select></label>
        <label class="field"><span>Owner</span><select id="cm-owner">${s.agent()}</select></label>
        <label class="field"><span>Start date</span><input id="cm-start" type="date" /></label>
        <label class="field"><span>End date</span><input id="cm-end" type="date" /></label>
        <label class="field"><span>Budget (AUD)</span><input id="cm-budget" type="number" /></label>
        <label class="field"><span>Cost to date (AUD)</span><input id="cm-cost" type="number" /></label>
      </div>
      <label class="field"><span>Audience</span><input id="cm-aud" placeholder="Target segment" /></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createCmp">Create</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createCmp').onclick = async () => {
    if (!val('cm-name')) return toast('Name required', '', 'warn');
    await api.createCampaign({ name: val('cm-name'), type: val('cm-type'), brand: val('cm-brand'), status: val('cm-status'), ownerId: val('cm-owner') || null, startDate: val('cm-start') || null, endDate: val('cm-end') || null, budget: val('cm-budget') || 0, cost: val('cm-cost') || 0, audience: val('cm-aud') });
    closeModal(); toast('Campaign created', '', 'success'); router();
  };
}

function openCampaignDrawer(c) {
  if (!c) return; const s = opSelects(); const m = state.meta;
  const stat = (label, v) => `<div class="card kpi" style="padding:12px"><div class="kpi__label">${label}</div><div class="kpi__value" style="font-size:20px">${v}</div></div>`;
  openDrawer(`
    <div class="drawer__head"><button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${c.id} · ${brandChip(c.brand)} · ${titleCase(c.type)}</div>
      <div class="drawer__title">${escHtml(c.name)}</div>
      <div class="chips" style="margin-top:10px">${opStatusBadge(c.status)} ${c.roi != null ? badge('ROI ' + c.roi + '%', c.roi > 0 ? 'b-green' : 'b-slate') : ''}</div>
    </div>
    <div class="drawer__body">
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
        ${stat('Leads', c.leads)}${stat('MQL', c.mql)}${stat('SQL', c.sql)}
      </div>
      <div class="drawer__section"><dl class="dl">
        <dt>Audience</dt><dd>${escHtml(c.audience || '—')}</dd>
        <dt>Channel</dt><dd>${escHtml(c.channel || '—')}</dd>
        <dt>Owner</dt><dd>${c.ownerName || '—'}</dd>
        <dt>Runs</dt><dd>${c.startDate ? fmtDate(c.startDate) : '—'} → ${c.endDate ? fmtDate(c.endDate) : '—'}</dd>
        <dt>Budget / spend</dt><dd>${fmtMoney(c.budget)} / <b>${fmtMoney(c.cost)}</b></dd>
        <dt>Opportunities</dt><dd>${c.opportunities}</dd>
        <dt>Pipeline influenced</dt><dd class="cell-strong">${fmtMoney(c.revenue)}</dd>
        <dt>Cost / lead</dt><dd>${c.cpl == null ? '—' : fmtMoney(c.cpl)}</dd>
      </dl>${c.notes ? `<p class="cell-sub" style="margin-top:10px">${escHtml(c.notes)}</p>` : ''}</div>
      <div class="drawer__section"><h4>Update</h4>
        <div class="form-row">
          <label class="field"><span>Status</span><select id="e-status">${s.en(m.campaignStatuses, c.status)}</select></label>
          <label class="field"><span>Leads</span><input id="e-leads" type="number" value="${c.leads}" /></label>
          <label class="field"><span>Cost</span><input id="e-cost" type="number" value="${c.cost}" /></label>
          <label class="field"><span>Pipeline (AUD)</span><input id="e-rev" type="number" value="${c.revenue}" /></label>
        </div>
        <button class="btn btn--primary btn--sm" id="saveCmp">Save</button>
      </div>
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveCmp').onclick = async () => {
    await api.updateCampaign(c.id, { status: val('e-status'), leads: Number(val('e-leads')), cost: Number(val('e-cost')), revenue: Number(val('e-rev')) });
    toast('Campaign updated', c.id, 'success'); closeDrawer(); router();
  };
}

// ---- NPS & CSAT ----
async function renderExperience(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="capSvy">+ Capture response</button>`;
  document.getElementById('capSvy').onclick = () => openSurveyModal();
  const [rep, responses] = await Promise.all([api.experienceReport(bq()), api.surveys(bq())]);
  const nps = rep.nps, csat = rep.csat;
  const total = Math.max(1, nps.promoters + nps.passives + nps.detractors);
  const pct = (n) => (n / total) * 100;
  const npsColor = nps.score == null ? 'var(--text-muted)' : nps.score >= 50 ? 'var(--green)' : nps.score >= 0 ? 'var(--amber)' : 'var(--red)';

  const slRows = rep.byServiceLine.map((s) => `
    <div class="meter__row">
      <span class="meter__label">${s.serviceLine}</span>
      <span class="meter__track"><span class="meter__fill" style="width:${s.nps.score == null ? 0 : Math.max(0, (s.nps.score + 100) / 2)}%;background:var(--primary)"></span></span>
      <span class="meter__num" style="width:auto">NPS ${s.nps.score ?? '—'} · CSAT ${s.csat.avg ?? '—'}</span>
    </div>`).join('');

  const verbatims = rep.recent.map((r) => `
    <div class="inline-item">
      <div style="flex:1"><div class="cell-strong">"${escHtml(r.comment)}"</div><div class="cell-sub">${escHtml(r.respondent || r.accountName || 'Anon')} · ${escHtml(r.accountName || '')} ${brandChip(r.brand)}</div></div>
      ${r.type === 'nps' ? `<span class="badge ${r.category === 'promoter' ? 'b-green' : r.category === 'passive' ? 'b-amber' : 'b-red'}">NPS ${r.score}</span>` : `<span class="badge ${r.score >= 4 ? 'b-green' : r.score >= 3 ? 'b-amber' : 'b-red'}">CSAT ${r.score}</span>`}
    </div>`).join('') || '<div class="cell-sub">No comments yet.</div>';

  host.innerHTML = `
    <div class="two-col">
      <div>
        <div class="card card--pad">
          <div class="section-head" style="margin-top:0"><h2>Net Promoter Score</h2><span class="muted">${nps.responses} responses</span></div>
          <div class="gauge"><span class="gauge__num" style="color:${npsColor}">${nps.score ?? '—'}</span><span class="cell-sub">promoters − detractors</span></div>
          <div class="nps-bar">
            <span style="width:${pct(nps.detractors)}%;background:var(--red)"></span>
            <span style="width:${pct(nps.passives)}%;background:var(--amber)"></span>
            <span style="width:${pct(nps.promoters)}%;background:var(--green)"></span>
          </div>
          <div class="nps-legend"><span><b>${nps.promoters}</b> promoters</span><span><b>${nps.passives}</b> passives</span><span><b>${nps.detractors}</b> detractors</span></div>
        </div>
        <div class="card card--pad" style="margin-top:16px">
          <div class="section-head" style="margin-top:0"><h2>Customer Satisfaction (CSAT)</h2><span class="muted">${csat.responses} responses</span></div>
          <div class="gauge"><span class="gauge__num" style="color:${csat.avg == null ? 'var(--text-muted)' : csat.avg >= 4 ? 'var(--green)' : csat.avg >= 3 ? 'var(--amber)' : 'var(--red)'}">${csat.avg ?? '—'}</span><span class="cell-sub">/ 5 · ${csat.satisfiedPct ?? '—'}% satisfied</span></div>
        </div>
        <div class="card card--pad" style="margin-top:16px">
          <div class="section-head" style="margin-top:0"><h2>By service line</h2></div>
          <div class="meter">${slRows}</div>
        </div>
      </div>
      <div>
        <div class="card card--pad">
          <div class="section-head" style="margin-top:0"><h2>Recent verbatims</h2></div>
          <div class="inline-list">${verbatims}</div>
        </div>
        <div class="card card--pad" style="margin-top:16px">
          <div class="section-head" style="margin-top:0"><h2>All responses</h2><span class="muted">${responses.length}</span></div>
          <div class="table-wrap"><table class="data mini">
            <thead><tr><th>Type</th><th>Score</th><th>Account</th><th>Service</th><th>Channel</th><th>When</th></tr></thead>
            <tbody>${responses.slice(0, 20).map((r) => `<tr><td>${r.type.toUpperCase()}</td><td class="cell-strong">${r.score}${r.type === 'csat' ? '/5' : ''}</td><td>${escHtml(r.accountName || '—')}</td><td>${brandChip(r.brand)}</td><td class="cell-sub">${titleCase(r.channel)}</td><td class="cell-sub">${timeAgo(r.respondedAt)}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
      </div>
    </div>`;
}

function openSurveyModal(accountId, opts = {}) {
  const s = opSelects(); const m = state.meta;
  openModal(`
    <div class="modal__head">Capture ${opts.type ? opts.type.toUpperCase() : 'NPS / CSAT'} response</div>
    <div class="modal__body">
      <div class="form-row">
        <label class="field"><span>Type</span><select id="sv-type">${s.en(m.surveyTypes, opts.type || 'nps')}</select></label>
        <label class="field"><span>Score</span><input id="sv-score" type="number" min="0" max="10" placeholder="NPS 0–10 / CSAT 1–5" /></label>
        <label class="field"><span>Account</span><select id="sv-account">${s.acc(accountId)}</select></label>
        <label class="field"><span>Channel</span><select id="sv-channel">${s.en(m.surveyChannels, opts.caseId ? 'post-case' : 'email')}</select></label>
        <label class="field"><span>Respondent</span><input id="sv-resp" placeholder="Contact name" /></label>
      </div>
      <label class="field"><span>Comment</span><textarea id="sv-comment" rows="2"></textarea></label>
      <p class="cell-sub" id="sv-hint">NPS: 9–10 promoter · 7–8 passive · 0–6 detractor.</p>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createSvy">Save response</button></div>`);
  const typeSel = modalHost.querySelector('#sv-type');
  const scoreIn = modalHost.querySelector('#sv-score');
  const hint = modalHost.querySelector('#sv-hint');
  const sync = () => {
    const nps = typeSel.value === 'nps';
    scoreIn.max = nps ? 10 : 5; scoreIn.placeholder = nps ? 'NPS 0–10' : 'CSAT 1–5';
    hint.textContent = nps ? 'NPS: 9–10 promoter · 7–8 passive · 0–6 detractor.' : 'CSAT: 1 (very dissatisfied) – 5 (very satisfied).';
  };
  typeSel.onchange = sync; sync();
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createSvy').onclick = async () => {
    if (val('sv-score') === '') return toast('Score required', '', 'warn');
    try {
      await api.createSurvey({ type: val('sv-type'), score: Number(val('sv-score')), accountId: val('sv-account') || accountId || null, channel: val('sv-channel'), respondent: val('sv-resp'), comment: val('sv-comment'), caseId: opts.caseId || null });
    } catch (e) { return toast('Invalid', e.message, 'error'); }
    closeModal(); toast('Response captured', '', 'success'); afterOpChange();
  };
}

// ============================================================================
// CARRIERS (tabbed: Directory · Performance report)
// ============================================================================
async function renderCarriers(host) {
  const tab = state.tab || '';
  host.innerHTML = tabBar('carriers', [
    { key: '', label: 'Directory' },
    { key: 'performance', label: 'Performance report' },
  ], tab) + `<div id="carrierContent"></div>`;
  const content = host.querySelector('#carrierContent');
  if (tab === 'performance') return renderCarrierReport(content);
  return renderCarrierDirectory(content);
}

function modeChips(modes) {
  return (modes || []).map((m) => `<span class="mode-chip">${m}</span>`).join(' ');
}

async function renderCarrierDirectory(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newCarrierBtn">+ New carrier</button>`;
  document.getElementById('newCarrierBtn').onclick = () => openCarrierModal();
  const carriers = await api.carriers();
  host.innerHTML = `
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
      ${carriers.map(carrierCard).join('') || '<div class="empty">No carriers.</div>'}
    </div>`;
  host.querySelectorAll('[data-carrier]').forEach((n) => n.onclick = () => openCarrierDrawer(n.dataset.carrier));
}

function carrierCard(c) {
  const s = c.stats;
  const onTime = s.onTimePct;
  const otColor = onTime == null ? 'var(--slate)' : onTime >= (c.onTimeTarget || 95) ? 'var(--green)' : onTime >= 80 ? 'var(--amber)' : 'var(--red)';
  return `<div class="card card--pad clickable" data-carrier="${c.id}" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
      <div>
        <div class="cell-strong" style="font-size:15px">${escHtml(c.name)} <span class="cell-sub mono">${c.code}</span></div>
        <div class="cell-sub">${escHtml((c.regions || []).join(', ') || c.country)}</div>
      </div>
      ${carrierStatusBadge(c.status)}
    </div>
    <div class="chips" style="margin:10px 0">${modeChips(c.modes)}</div>
    <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:var(--text-muted);flex-wrap:wrap;gap:6px">
      <span><b style="color:var(--text)">${s.caseCount}</b> cases</span>
      <span><b style="color:${s.withCarrier ? 'var(--amber)' : 'var(--text)'}">${s.withCarrier}</b> with carrier</span>
      <span><b style="color:var(--text)">${s.shipments}</b> shipments</span>
      <span>on-time <b style="color:${otColor}">${onTime == null ? '—' : onTime + '%'}</b></span>
    </div>
  </div>`;
}

async function openCarrierDrawer(id) {
  const c = await api.carrier(id);
  const s = c.stats;
  const openCase = new Set(['new', 'open', 'pending', 'escalated']);
  const withCarrier = c.cases.filter((x) => x.responsibility === 'carrier' && openCase.has(x.status));
  const otherOpen = c.cases.filter((x) => openCase.has(x.status) && x.responsibility !== 'carrier');
  const resolved = c.cases.filter((x) => ['resolved', 'closed'].includes(x.status));

  const caseItem = (x) => `<div class="inline-item clickable" data-case="${x.id}">
    <div><div class="cell-strong">${escHtml(x.subject)}</div><div class="cell-sub">${x.id} · ${titleCase(x.category)}${x.shipmentRef ? ' · ' + x.shipmentRef : ''}</div></div>
    <div class="chips">${priorityBadge(x.priority)} ${statusBadge(x.status)}</div>
  </div>`;

  const section = (title, arr, empty) => `<div class="drawer__section"><h4>${title} <span class="muted">${arr.length}</span></h4><div class="inline-list">${arr.length ? arr.map(caseItem).join('') : `<div class="cell-sub">${empty}</div>`}</div></div>`;

  openDrawer(`
    <div class="drawer__head">
      <button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${c.id} · <span class="mono">${c.code}</span></div>
      <div class="drawer__title">${escHtml(c.name)}</div>
      <div class="chips" style="margin-top:10px">${carrierStatusBadge(c.status)} ${modeChips(c.modes)}</div>
    </div>
    <div class="drawer__body">
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">
        <div class="card kpi" style="padding:12px"><div class="kpi__label">With carrier</div><div class="kpi__value" style="font-size:22px;color:${s.withCarrier ? 'var(--amber)' : 'var(--text)'}">${s.withCarrier}</div><div class="kpi__sub">to resolve</div></div>
        <div class="card kpi" style="padding:12px"><div class="kpi__label">On-time</div><div class="kpi__value" style="font-size:22px">${s.onTimePct == null ? '—' : s.onTimePct + '%'}</div><div class="kpi__sub">target ${c.onTimeTarget}%</div></div>
        <div class="card kpi" style="padding:12px"><div class="kpi__label">Avg resolve</div><div class="kpi__value" style="font-size:22px">${s.avgResolutionH == null ? '—' : s.avgResolutionH + 'h'}</div><div class="kpi__sub">${s.resolved} resolved</div></div>
      </div>

      <div class="drawer__section">
        <h4>Details</h4>
        <dl class="dl">
          <dt>Coverage</dt><dd>${escHtml((c.regions || []).join(', ') || '—')}</dd>
          <dt>Modes</dt><dd>${(c.modes || []).join(', ')}</dd>
          <dt>Account mgr</dt><dd>${escHtml(c.accountManager || '—')}</dd>
          <dt>Phone</dt><dd>${escHtml(c.phone || '—')}</dd>
          <dt>Email</dt><dd>${escHtml(c.email || '—')}</dd>
          <dt>Account code</dt><dd class="mono">${escHtml(c.accountCode || '—')}</dd>
          <dt>ABN / NZBN</dt><dd class="mono">${escHtml(c.abn || '—')}</dd>
          <dt>Exception rate</dt><dd>${s.exceptionRate}% of ${s.shipments} shipments</dd>
        </dl>
        ${c.notes ? `<p class="cell-sub" style="margin-top:10px">${escHtml(c.notes)}</p>` : ''}
        <div style="margin-top:12px"><label class="field"><span>Status</span><select id="carrStatus">${state.meta.carrierStatuses.map((st) => `<option value="${st}" ${st === c.status ? 'selected' : ''}>${titleCase(st)}</option>`).join('')}</select></label><button class="btn btn--sm btn--primary" id="saveCarrier">Update status</button></div>
      </div>

      ${section('⚠ Still with carrier to resolve', withCarrier, 'Nothing outstanding with this carrier 🎉')}
      ${section('Other open cases', otherOpen, 'None.')}
      ${section('Resolved / closed', resolved.slice(0, 8), 'None yet.')}
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveCarrier').onclick = async () => {
    await api.updateCarrier(id, { status: val('carrStatus') });
    toast('Carrier updated', c.name, 'success'); openCarrierDrawer(id);
  };
  drawer.querySelectorAll('[data-case]').forEach((n) => n.onclick = () => { closeDrawer(); openCaseDrawer(n.dataset.case); });
}

async function renderCarrierReport(host) {
  const rep = await api.carrierReport(bq());
  const t = rep.totals;
  const maxCases = Math.max(1, ...rep.carriers.map((c) => c.caseCount));
  host.innerHTML = `
    <div class="grid kpis" style="margin-bottom:20px">
      ${kpiCard({ label: 'Carriers', value: t.carriers, sub: `${t.preferred} preferred` })}
      ${kpiCard({ label: 'Cases with carrier', value: t.casesWithCarrier, sub: 'awaiting carrier action', cls: t.casesWithCarrier ? 'kpi--alert' : '' })}
      ${kpiCard({ label: 'Open cases (carrier-linked)', value: t.openCases, sub: 'across all carriers' })}
      ${kpiCard({ label: 'Unassigned cases', value: t.unassignedCases, sub: 'no carrier set' })}
    </div>
    <div class="card table-wrap">
      <table class="data">
        <thead><tr><th>Carrier</th><th>Status</th><th>Cases</th><th>Open</th><th>With carrier</th><th>Resolved</th><th>Avg resolve</th><th>Exceptions</th><th>On-time</th></tr></thead>
        <tbody>${rep.carriers.map((c) => {
          const otColor = c.onTimePct == null ? 'var(--text-muted)' : c.onTimePct >= (c.onTimeTarget || 95) ? 'var(--green)' : c.onTimePct >= 80 ? 'var(--amber)' : 'var(--red)';
          return `<tr class="clickable" data-carrier="${c.id}">
            <td><div class="cell-strong">${escHtml(c.name)}</div><div class="cell-sub">${modeChips(c.modes)}</div></td>
            <td>${carrierStatusBadge(c.status)}</td>
            <td>${c.caseCount}</td>
            <td>${c.openCases}</td>
            <td>${c.withCarrier ? `<b style="color:var(--amber)">${c.withCarrier}</b>` : '0'}</td>
            <td>${c.resolved}</td>
            <td class="cell-sub">${c.avgResolutionH == null ? '—' : c.avgResolutionH + 'h'}</td>
            <td>${c.exceptions} <span class="cell-sub">(${c.exceptionRate}%)</span></td>
            <td style="color:${otColor};font-weight:700">${c.onTimePct == null ? '—' : c.onTimePct + '%'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  host.querySelectorAll('[data-carrier]').forEach((tr) => tr.onclick = () => openCarrierDrawer(tr.dataset.carrier));
}

function openCarrierModal() {
  const m = state.meta;
  openModal(`
    <div class="modal__head">New carrier</div>
    <div class="modal__body">
      <label class="field"><span>Carrier name *</span><input id="c-name" placeholder="e.g. StarTrack" /></label>
      <div class="form-row">
        <label class="field"><span>Code</span><input id="c-code" placeholder="STK" /></label>
        <label class="field"><span>Status</span><select id="c-status">${m.carrierStatuses.map((s) => `<option value="${s}" ${s === 'active' ? 'selected' : ''}>${titleCase(s)}</option>`).join('')}</select></label>
        <label class="field"><span>Account manager</span><input id="c-am" /></label>
        <label class="field"><span>Phone</span><input id="c-phone" /></label>
        <label class="field"><span>Email</span><input id="c-email" /></label>
        <label class="field"><span>On-time target %</span><input id="c-ot" type="number" value="95" /></label>
      </div>
      <label class="field"><span>Modes</span><div class="chips" id="c-modes">${m.carrierModes.map((x) => `<label class="badge b-slate" style="cursor:pointer"><input type="checkbox" value="${x}" style="width:auto;margin-right:4px" ${x === 'Road' ? 'checked' : ''}/>${x}</label>`).join('')}</div></label>
      <label class="field"><span>Regions</span><select id="c-regions" multiple size="4">${m.regions.map((r) => `<option value="${r}">${r}</option>`).join('')}</select></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createCarrier">Create carrier</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createCarrier').onclick = async () => {
    const modes = [...modalHost.querySelectorAll('#c-modes input:checked')].map((n) => n.value);
    const regions = [...modalHost.querySelectorAll('#c-regions option:checked')].map((n) => n.value);
    const body = { name: val('c-name'), code: val('c-code'), status: val('c-status'), accountManager: val('c-am'), phone: val('c-phone'), email: val('c-email'), onTimeTarget: Number(val('c-ot')) || 95, modes: modes.length ? modes : ['Road'], regions };
    if (!body.name) return toast('Name required', '', 'warn');
    await api.createCarrier(body); closeModal(); toast('Carrier created', '', 'success'); router();
  };
}

// ============================================================================
// ACCOUNT OPS (Price reviews · At-Risk · Requests · Implementations · Claims)
// ============================================================================
function opSelects() {
  const m = state.meta;
  return {
    acc: (sel, blank = '— account —') => `<option value="">${blank}</option>` + (m.accountsLite || []).map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${escHtml(a.name)}</option>`).join(''),
    carr: (sel, blank = '— carrier —') => `<option value="">${blank}</option>` + (m.carriers || []).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${escHtml(c.name)}</option>`).join(''),
    agent: (sel, blank = '— owner —') => `<option value="">${blank}</option>` + m.agents.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${a.name}</option>`).join(''),
    en: (list, sel) => list.map((v) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${titleCase(v)}</option>`).join(''),
  };
}

async function renderAccountOps(host) {
  const tabs = [
    { key: '', label: 'Price Reviews' },
    { key: 'risk', label: 'At-Risk' },
    { key: 'requests', label: 'Requests' },
    { key: 'implementations', label: 'Implementations' },
    { key: 'claims', label: 'Credit Claims' },
  ];
  const tab = state.tab || '';
  host.innerHTML = tabBar('ops', tabs, tab) + `<div id="opsContent"></div>`;
  const c = host.querySelector('#opsContent');
  if (tab === 'risk') return renderRisks(c);
  if (tab === 'requests') return renderRequests(c);
  if (tab === 'implementations') return renderImplementations(c);
  if (tab === 'claims') return renderCreditClaims(c);
  return renderPriceReviews(c);
}

// ---- Price reviews ----
async function renderPriceReviews(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newPrv">+ New price review</button>`;
  document.getElementById('newPrv').onclick = () => openPriceReviewModal();
  const rows = await api.priceReviews(bq());
  host.innerHTML = `
    <p class="cell-sub" style="margin:0 0 14px">Annual price reviews — per carrier/customer combination, customer, carrier, lane or network, each with its own increase date.</p>
    <div class="card table-wrap"><table class="data">
      <thead><tr><th>Review</th><th>Scope</th><th>Account</th><th>Carrier</th><th>Method</th><th>Increase</th><th>Effective</th><th>Status</th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `
        <tr class="clickable" data-prv="${r.id}">
          <td class="cell-strong">${escHtml(r.title)}</td>
          <td>${badge(titleCase(r.scope), 'b-slate')}</td>
          <td>${escHtml(r.accountName || '—')}</td>
          <td>${escHtml(r.carrierName || '—')}</td>
          <td class="cell-sub">${titleCase(r.method)}</td>
          <td class="cell-strong">${r.increasePercent != null ? r.increasePercent + '%' : '—'}</td>
          <td class="cell-sub">${r.effectiveDate ? fmtDate(r.effectiveDate) : '—'}</td>
          <td>${opStatusBadge(r.status)}</td>
        </tr>`).join('') : `<tr><td colspan="8"><div class="empty">No price reviews.</div></td></tr>`}
      </tbody></table></div>`;
  const map = Object.fromEntries(rows.map((r) => [r.id, r]));
  host.querySelectorAll('[data-prv]').forEach((tr) => tr.onclick = () => openPriceReviewDrawer(map[tr.dataset.prv]));
}

function openPriceReviewModal(accountId) {
  const s = opSelects(); const m = state.meta;
  openModal(`
    <div class="modal__head">New annual price review</div>
    <div class="modal__body">
      <label class="field"><span>Title</span><input id="p-title" placeholder="e.g. Customer × Carrier — FY27 CPI increase" /></label>
      <div class="form-row">
        <label class="field"><span>Scope</span><select id="p-scope">${s.en(m.priceReviewScopes, 'carrier-customer')}</select></label>
        <label class="field"><span>Method</span><select id="p-method">${s.en(m.priceReviewMethods, 'cpi')}</select></label>
        <label class="field"><span>Account</span><select id="p-account">${s.acc(accountId)}</select></label>
        <label class="field"><span>Carrier</span><select id="p-carrier">${s.carr()}</select></label>
        <label class="field"><span>Increase %</span><input id="p-pct" type="number" step="0.1" placeholder="e.g. 3.8" /></label>
        <label class="field"><span>Baseline value (AUD)</span><input id="p-base" type="number" /></label>
        <label class="field"><span>Review date</span><input id="p-review" type="date" /></label>
        <label class="field"><span>Effective (increase) date</span><input id="p-eff" type="date" /></label>
        <label class="field"><span>Status</span><select id="p-status">${s.en(m.priceReviewStatuses, 'planned')}</select></label>
        <label class="field"><span>Owner</span><select id="p-owner">${s.agent()}</select></label>
      </div>
      <label class="field"><span>Notes</span><textarea id="p-notes" rows="2"></textarea></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createPrv">Create</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createPrv').onclick = async () => {
    await api.createPriceReview({
      title: val('p-title'), scope: val('p-scope'), method: val('p-method'), accountId: val('p-account') || null, carrierId: val('p-carrier') || null,
      increasePercent: val('p-pct') || null, baselineValue: val('p-base') || null, reviewDate: val('p-review') || null, effectiveDate: val('p-eff') || null,
      status: val('p-status'), ownerId: val('p-owner') || null, notes: val('p-notes'),
    });
    closeModal(); toast('Price review created', '', 'success'); afterOpChange();
  };
}

function openPriceReviewDrawer(r) {
  if (!r) return; const s = opSelects(); const m = state.meta;
  openDrawer(`
    <div class="drawer__head"><button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${r.id} · ${brandChip(r.brand)}</div>
      <div class="drawer__title">${escHtml(r.title)}</div>
      <div class="chips" style="margin-top:10px">${badge(titleCase(r.scope), 'b-slate')} ${opStatusBadge(r.status)}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section"><dl class="dl">
        <dt>Account</dt><dd>${escHtml(r.accountName || '—')}</dd>
        <dt>Carrier</dt><dd>${escHtml(r.carrierName || '—')}</dd>
        <dt>Method</dt><dd>${titleCase(r.method)}</dd>
        <dt>Increase</dt><dd class="cell-strong">${r.increasePercent != null ? r.increasePercent + '%' : '—'}${r.cpiRate != null ? ` (CPI ${r.cpiRate}%)` : ''}</dd>
        <dt>Baseline</dt><dd>${r.baselineValue != null ? fmtMoney(r.baselineValue) : '—'}${r.baselineValue && r.increasePercent ? ` → +${fmtMoney(Math.round(r.baselineValue * r.increasePercent / 100))}/yr` : ''}</dd>
        <dt>Review date</dt><dd>${r.reviewDate ? fmtDate(r.reviewDate) : '—'}</dd>
        <dt>Effective date</dt><dd>${r.effectiveDate ? fmtDate(r.effectiveDate) : '—'}</dd>
        <dt>Owner</dt><dd>${r.ownerName || '—'}</dd>
      </dl>${r.notes ? `<p class="cell-sub" style="margin-top:10px">${escHtml(r.notes)}</p>` : ''}</div>
      <div class="drawer__section"><h4>Update</h4>
        <div class="form-row">
          <label class="field"><span>Status</span><select id="e-status">${s.en(m.priceReviewStatuses, r.status)}</select></label>
          <label class="field"><span>Increase %</span><input id="e-pct" type="number" step="0.1" value="${r.increasePercent ?? ''}" /></label>
          <label class="field"><span>Effective date</span><input id="e-eff" type="date" value="${r.effectiveDate ? r.effectiveDate.slice(0, 10) : ''}" /></label>
        </div>
        <button class="btn btn--primary btn--sm" id="savePrv">Save</button>
      </div>
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#savePrv').onclick = async () => {
    await api.updatePriceReview(r.id, { status: val('e-status'), increasePercent: val('e-pct') || null, effectiveDate: val('e-eff') || null });
    toast('Price review updated', r.id, 'success'); closeDrawer(); router();
  };
}

// ---- At-Risk ----
async function renderRisks(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newRisk">+ Flag risk</button>`;
  document.getElementById('newRisk').onclick = () => openRiskModal();
  const rows = await api.risks(bq());
  const totalRev = rows.filter((r) => !['mitigated', 'closed'].includes(r.status)).reduce((s, r) => s + (r.revenueAtRisk || 0), 0);
  host.innerHTML = `
    <div class="toolbar"><span class="badge b-red">Revenue at risk: ${fmtMoney(totalRev)}</span><div class="spacer"></div><span class="muted">${rows.length} risk(s)</span></div>
    <div class="card table-wrap"><table class="data">
      <thead><tr><th>Account</th><th>Risk</th><th>Category</th><th>Severity</th><th>Rev at risk</th><th>Owner</th><th>Review</th><th>Status</th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `
        <tr class="clickable" data-risk="${r.id}">
          <td class="cell-strong">${escHtml(r.accountName || '—')} ${brandChip(r.brand)}</td>
          <td>${escHtml(r.title)}</td>
          <td>${badge(titleCase(r.category), 'b-slate')}</td>
          <td>${severityBadge(r.severity)}</td>
          <td class="cell-strong">${r.revenueAtRisk != null ? fmtMoney(r.revenueAtRisk) : '—'}</td>
          <td class="cell-sub">${r.ownerName || '—'}</td>
          <td class="cell-sub">${r.reviewDate ? fmtDate(r.reviewDate) : '—'}</td>
          <td>${opStatusBadge(r.status)}</td>
        </tr>`).join('') : `<tr><td colspan="8"><div class="empty">No risks flagged 🎉</div></td></tr>`}
      </tbody></table></div>`;
  const map = Object.fromEntries(rows.map((r) => [r.id, r]));
  host.querySelectorAll('[data-risk]').forEach((tr) => tr.onclick = () => openRiskDrawer(map[tr.dataset.risk]));
}

function openRiskModal(accountId) {
  const s = opSelects(); const m = state.meta;
  openModal(`
    <div class="modal__head">Flag account risk</div>
    <div class="modal__body">
      <label class="field"><span>Account *</span><select id="r-account">${s.acc(accountId)}</select></label>
      <label class="field"><span>Risk title</span><input id="r-title" placeholder="e.g. Competitor pitching key lanes" /></label>
      <div class="form-row">
        <label class="field"><span>Category</span><select id="r-cat">${s.en(m.riskCategories, 'service')}</select></label>
        <label class="field"><span>Severity</span><select id="r-sev">${s.en(m.riskSeverities, 'medium')}</select></label>
        <label class="field"><span>Revenue at risk (AUD)</span><input id="r-rev" type="number" /></label>
        <label class="field"><span>Owner</span><select id="r-owner">${s.agent()}</select></label>
        <label class="field"><span>Review date</span><input id="r-review" type="date" /></label>
        <label class="field"><span>Status</span><select id="r-status">${s.en(m.riskStatuses, 'open')}</select></label>
      </div>
      <label class="field"><span>Mitigation plan</span><textarea id="r-plan" rows="3"></textarea></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createRisk">Flag risk</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createRisk').onclick = async () => {
    if (!val('r-account')) return toast('Account required', '', 'warn');
    await api.createRisk({ accountId: val('r-account'), title: val('r-title'), category: val('r-cat'), severity: val('r-sev'), revenueAtRisk: val('r-rev') || null, ownerId: val('r-owner') || null, reviewDate: val('r-review') || null, status: val('r-status'), mitigationPlan: val('r-plan') });
    closeModal(); toast('Risk flagged', '', 'warn'); afterOpChange();
  };
}

function openRiskDrawer(r) {
  if (!r) return; const s = opSelects(); const m = state.meta;
  openDrawer(`
    <div class="drawer__head"><button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${r.id} · ${brandChip(r.brand)} · ${escHtml(r.accountName || '')}</div>
      <div class="drawer__title">${escHtml(r.title)}</div>
      <div class="chips" style="margin-top:10px">${severityBadge(r.severity)} ${opStatusBadge(r.status)} ${badge(titleCase(r.category), 'b-slate')}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section"><dl class="dl">
        <dt>Revenue at risk</dt><dd class="cell-strong">${r.revenueAtRisk != null ? fmtMoney(r.revenueAtRisk) : '—'}</dd>
        <dt>Likelihood</dt><dd>${titleCase(r.likelihood || '—')}</dd>
        <dt>Owner</dt><dd>${r.ownerName || '—'}</dd>
        <dt>Review date</dt><dd>${r.reviewDate ? fmtDate(r.reviewDate) : '—'}</dd>
      </dl>${r.mitigationPlan ? `<h4 style="margin-top:14px">Mitigation plan</h4><p class="cell-sub">${escHtml(r.mitigationPlan)}</p>` : ''}</div>
      <div class="drawer__section"><h4>Update</h4>
        <div class="form-row">
          <label class="field"><span>Status</span><select id="e-status">${s.en(m.riskStatuses, r.status)}</select></label>
          <label class="field"><span>Severity</span><select id="e-sev">${s.en(m.riskSeverities, r.severity)}</select></label>
        </div>
        <label class="field"><span>Mitigation plan</span><textarea id="e-plan" rows="3">${escHtml(r.mitigationPlan || '')}</textarea></label>
        <button class="btn btn--primary btn--sm" id="saveRisk">Save</button>
      </div>
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveRisk').onclick = async () => {
    await api.updateRisk(r.id, { status: val('e-status'), severity: val('e-sev'), mitigationPlan: val('e-plan') });
    toast('Risk updated', r.id, 'success'); closeDrawer(); router();
  };
}

// ---- Requests ----
async function renderRequests(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newReq">+ New request</button>`;
  document.getElementById('newReq').onclick = () => openRequestModal();
  const rows = await api.requests(bq());
  host.innerHTML = `
    <p class="cell-sub" style="margin:0 0 14px">Solution design, engineering, analytics, data & integration requests.</p>
    <div class="card table-wrap"><table class="data">
      <thead><tr><th>Request</th><th>Type</th><th>Account</th><th>Priority</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `
        <tr class="clickable" data-req="${r.id}">
          <td class="cell-strong">${escHtml(r.title)}</td>
          <td>${badge(titleCase(r.type), 'b-violet')}</td>
          <td>${escHtml(r.accountName || '—')} ${brandChip(r.brand)}</td>
          <td>${priorityBadge(r.priority)}</td>
          <td class="cell-sub">${r.ownerName || '—'}</td>
          <td class="cell-sub">${r.dueDate ? fmtDate(r.dueDate) : '—'}</td>
          <td>${opStatusBadge(r.status)}</td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="empty">No requests.</div></td></tr>`}
      </tbody></table></div>`;
  const map = Object.fromEntries(rows.map((r) => [r.id, r]));
  host.querySelectorAll('[data-req]').forEach((tr) => tr.onclick = () => openRequestDrawer(map[tr.dataset.req]));
}

function openRequestModal(accountId) {
  const s = opSelects(); const m = state.meta;
  openModal(`
    <div class="modal__head">New request</div>
    <div class="modal__body">
      <label class="field"><span>Title *</span><input id="q-title" placeholder="e.g. Cold-chain analytics dashboard" /></label>
      <div class="form-row">
        <label class="field"><span>Type</span><select id="q-type">${s.en(m.requestTypes, 'solution-design')}</select></label>
        <label class="field"><span>Account</span><select id="q-account">${s.acc(accountId)}</select></label>
        <label class="field"><span>Priority</span><select id="q-priority">${s.en(m.casePriorities, 'medium')}</select></label>
        <label class="field"><span>Owner</span><select id="q-owner">${s.agent()}</select></label>
        <label class="field"><span>Requested by</span><input id="q-by" /></label>
        <label class="field"><span>Due date</span><input id="q-due" type="date" /></label>
      </div>
      <label class="field"><span>Description</span><textarea id="q-desc" rows="3"></textarea></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createReq">Create</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createReq').onclick = async () => {
    if (!val('q-title')) return toast('Title required', '', 'warn');
    await api.createRequest({ title: val('q-title'), type: val('q-type'), accountId: val('q-account') || null, priority: val('q-priority'), ownerId: val('q-owner') || null, requestedBy: val('q-by'), dueDate: val('q-due') || null, description: val('q-desc') });
    closeModal(); toast('Request created', '', 'success'); afterOpChange();
  };
}

function openRequestDrawer(r) {
  if (!r) return; const s = opSelects(); const m = state.meta;
  openDrawer(`
    <div class="drawer__head"><button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${r.id} · ${badge(titleCase(r.type), 'b-violet')}</div>
      <div class="drawer__title">${escHtml(r.title)}</div>
      <div class="chips" style="margin-top:10px">${priorityBadge(r.priority)} ${opStatusBadge(r.status)}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section"><dl class="dl">
        <dt>Account</dt><dd>${escHtml(r.accountName || '—')}</dd>
        <dt>Requested by</dt><dd>${escHtml(r.requestedBy || '—')}</dd>
        <dt>Owner</dt><dd>${r.ownerName || '—'}</dd>
        <dt>Due</dt><dd>${r.dueDate ? fmtDate(r.dueDate) : '—'}</dd>
      </dl>${r.description ? `<p class="cell-sub" style="margin-top:10px;white-space:pre-wrap">${escHtml(r.description)}</p>` : ''}</div>
      <div class="drawer__section"><h4>Update</h4>
        <div class="form-row">
          <label class="field"><span>Status</span><select id="e-status">${s.en(m.requestStatuses, r.status)}</select></label>
          <label class="field"><span>Owner</span><select id="e-owner">${s.agent(r.ownerId)}</select></label>
        </div>
        <button class="btn btn--primary btn--sm" id="saveReq">Save</button>
      </div>
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveReq').onclick = async () => {
    await api.updateRequest(r.id, { status: val('e-status'), ownerId: val('e-owner') || null });
    toast('Request updated', r.id, 'success'); closeDrawer(); router();
  };
}

// ---- Implementations ----
async function renderImplementations(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newImp">+ New implementation</button>`;
  document.getElementById('newImp').onclick = () => openImplementationModal();
  const rows = await api.implementations(bq());
  host.innerHTML = `
    <p class="cell-sub" style="margin:0 0 14px">Onboarding new customers and changes to existing customers (incl. carrier changes).</p>
    <div class="card table-wrap"><table class="data">
      <thead><tr><th>Implementation</th><th>Type</th><th>Account</th><th>Change</th><th>Go-live</th><th>Progress</th><th>Status</th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `
        <tr class="clickable" data-imp="${r.id}">
          <td class="cell-strong">${escHtml(r.title)}</td>
          <td>${badge(titleCase(r.type), 'b-blue')}</td>
          <td>${escHtml(r.accountName || '—')} ${brandChip(r.brand)}</td>
          <td class="cell-sub">${r.type === 'carrier-change' && (r.fromCarrierName || r.toCarrierName) ? `${escHtml(r.fromCarrierName || '?')} → ${escHtml(r.toCarrierName || '?')}` : '—'}</td>
          <td class="cell-sub">${r.goLiveDate ? fmtDate(r.goLiveDate) : '—'}</td>
          <td style="min-width:110px"><div class="probbar"><i style="width:${r.progress}%;background:${r.progress >= 100 ? 'var(--green)' : 'var(--primary)'}"></i></div><span class="cell-sub">${r.progress}%</span></td>
          <td>${opStatusBadge(r.status)}</td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="empty">No implementations.</div></td></tr>`}
      </tbody></table></div>`;
  const map = Object.fromEntries(rows.map((r) => [r.id, r]));
  host.querySelectorAll('[data-imp]').forEach((tr) => tr.onclick = () => openImplementationDrawer(map[tr.dataset.imp]));
}

function openImplementationModal(accountId) {
  const s = opSelects(); const m = state.meta;
  const carrierRow = `<div class="form-row" id="imp-carriers" hidden>
    <label class="field"><span>From carrier</span><select id="i-from">${s.carr()}</select></label>
    <label class="field"><span>To carrier</span><select id="i-to">${s.carr()}</select></label></div>`;
  openModal(`
    <div class="modal__head">New implementation</div>
    <div class="modal__body">
      <label class="field"><span>Title</span><input id="i-title" placeholder="e.g. New customer onboarding / Carrier change" /></label>
      <div class="form-row">
        <label class="field"><span>Type</span><select id="i-type">${s.en(m.implementationTypes, 'new-customer')}</select></label>
        <label class="field"><span>Account</span><select id="i-account">${s.acc(accountId)}</select></label>
        <label class="field"><span>Status</span><select id="i-status">${s.en(m.implementationStatuses, 'planning')}</select></label>
        <label class="field"><span>Go-live date</span><input id="i-golive" type="date" /></label>
        <label class="field"><span>Owner</span><select id="i-owner">${s.agent()}</select></label>
      </div>
      ${carrierRow}
      <label class="field"><span>Notes</span><textarea id="i-notes" rows="2"></textarea></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createImp">Create</button></div>`);
  const typeSel = modalHost.querySelector('#i-type');
  const toggleCarriers = () => { modalHost.querySelector('#imp-carriers').hidden = typeSel.value !== 'carrier-change'; };
  typeSel.onchange = toggleCarriers; toggleCarriers();
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createImp').onclick = async () => {
    await api.createImplementation({ title: val('i-title'), type: val('i-type'), accountId: val('i-account') || null, status: val('i-status'), goLiveDate: val('i-golive') || null, ownerId: val('i-owner') || null, fromCarrierId: val('i-from') || null, toCarrierId: val('i-to') || null, notes: val('i-notes') });
    closeModal(); toast('Implementation created', '', 'success'); afterOpChange();
  };
}

function openImplementationDrawer(r) {
  if (!r) return; const s = opSelects(); const m = state.meta;
  const checklist = (r.checklist || []).map((c) => `
    <label class="inline-item" style="cursor:pointer"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" style="width:auto" ${c.done ? 'checked' : ''} data-cl="${c.id}" /> <span style="${c.done ? 'text-decoration:line-through;opacity:.6' : ''}">${escHtml(c.task)}</span></span></label>`).join('');
  openDrawer(`
    <div class="drawer__head"><button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${r.id} · ${badge(titleCase(r.type), 'b-blue')} · ${escHtml(r.accountName || '')}</div>
      <div class="drawer__title">${escHtml(r.title)}</div>
      <div class="chips" style="margin-top:10px">${opStatusBadge(r.status)} <span class="badge b-slate">${r.progress}% complete</span></div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section"><dl class="dl">
        ${r.type === 'carrier-change' ? `<dt>Carrier change</dt><dd>${escHtml(r.fromCarrierName || '?')} → <b>${escHtml(r.toCarrierName || '?')}</b></dd>` : ''}
        <dt>Go-live</dt><dd>${r.goLiveDate ? fmtDate(r.goLiveDate) : '—'}</dd>
        <dt>Owner</dt><dd>${r.ownerName || '—'}</dd>
      </dl>${r.notes ? `<p class="cell-sub" style="margin-top:10px">${escHtml(r.notes)}</p>` : ''}</div>
      <div class="drawer__section"><h4>Checklist</h4><div class="inline-list">${checklist || '<div class="cell-sub">No tasks.</div>'}</div></div>
      <div class="drawer__section"><h4>Status</h4><label class="field"><select id="e-status">${s.en(m.implementationStatuses, r.status)}</select></label><button class="btn btn--primary btn--sm" id="saveImp">Save status</button></div>
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  // Checklist toggles persist immediately.
  drawer.querySelectorAll('[data-cl]').forEach((n) => n.onchange = async () => {
    const checklist = (r.checklist || []).map((c) => c.id === n.dataset.cl ? { ...c, done: n.checked } : c);
    r.checklist = checklist;
    const u = await api.updateImplementation(r.id, { checklist });
    r.progress = u.progress;
  });
  drawer.querySelector('#saveImp').onclick = async () => {
    await api.updateImplementation(r.id, { status: val('e-status') });
    toast('Implementation updated', r.id, 'success'); closeDrawer(); router();
  };
}

// ---- Credit claims ----
async function renderCreditClaims(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newClm">+ New claim</button>`;
  document.getElementById('newClm').onclick = () => openClaimModal();
  const rows = await api.creditClaims(bq());
  const open = rows.filter((r) => !['credited', 'rejected'].includes(r.status));
  host.innerHTML = `
    <div class="toolbar"><span class="badge b-amber">Open claims: ${fmtMoney(open.reduce((s, r) => s + (r.amount || 0), 0))}</span><div class="spacer"></div><span class="muted">${rows.length} claim(s)</span></div>
    <div class="card table-wrap"><table class="data">
      <thead><tr><th>Reference</th><th>Account</th><th>Carrier</th><th>Reason</th><th>Against</th><th>Amount</th><th>Lodged</th><th>Status</th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `
        <tr class="clickable" data-clm="${r.id}">
          <td><span class="mono cell-strong">${r.reference}</span>${r.shipmentRef ? `<div class="cell-sub">${r.shipmentRef}</div>` : ''}</td>
          <td>${escHtml(r.accountName || '—')} ${brandChip(r.brand)}</td>
          <td>${escHtml(r.carrierName || '—')}</td>
          <td>${badge(titleCase(r.reason), 'b-slate')}</td>
          <td>${r.against === 'carrier' ? badge('Carrier', 'b-amber') : badge('Internal', 'b-blue')}</td>
          <td class="cell-strong">${fmtMoney(r.amount)}</td>
          <td class="cell-sub">${r.lodgedDate ? fmtDate(r.lodgedDate) : '—'}</td>
          <td>${opStatusBadge(r.status)}</td>
        </tr>`).join('') : `<tr><td colspan="8"><div class="empty">No credit claims.</div></td></tr>`}
      </tbody></table></div>`;
  const map = Object.fromEntries(rows.map((r) => [r.id, r]));
  host.querySelectorAll('[data-clm]').forEach((tr) => tr.onclick = () => openClaimDrawer(map[tr.dataset.clm]));
}

function openClaimModal(accountId) {
  const s = opSelects(); const m = state.meta;
  openModal(`
    <div class="modal__head">New credit claim</div>
    <div class="modal__body">
      <div class="form-row">
        <label class="field"><span>Account</span><select id="c-account">${s.acc(accountId)}</select></label>
        <label class="field"><span>Carrier</span><select id="c-carrier">${s.carr()}</select></label>
        <label class="field"><span>Reason</span><select id="c-reason">${s.en(m.claimReasons, 'service-failure')}</select></label>
        <label class="field"><span>Against</span><select id="c-against">${s.en(m.claimAgainst, 'carrier')}</select></label>
        <label class="field"><span>Amount (AUD)</span><input id="c-amount" type="number" /></label>
        <label class="field"><span>Shipment ref</span><input id="c-ship" placeholder="e.g. EFM-CON-88301" /></label>
        <label class="field"><span>Status</span><select id="c-status">${s.en(m.claimStatuses, 'draft')}</select></label>
        <label class="field"><span>Owner</span><select id="c-owner">${s.agent()}</select></label>
      </div>
      <label class="field"><span>Notes</span><textarea id="c-notes" rows="2"></textarea></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createClm">Create claim</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createClm').onclick = async () => {
    await api.createCreditClaim({ accountId: val('c-account') || null, carrierId: val('c-carrier') || null, reason: val('c-reason'), against: val('c-against'), amount: val('c-amount') || 0, shipmentRef: val('c-ship') || null, status: val('c-status'), ownerId: val('c-owner') || null, notes: val('c-notes') });
    closeModal(); toast('Credit claim created', '', 'success'); afterOpChange();
  };
}

function openClaimDrawer(r) {
  if (!r) return; const s = opSelects(); const m = state.meta;
  openDrawer(`
    <div class="drawer__head"><button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${r.reference} · ${brandChip(r.brand)}</div>
      <div class="drawer__title">${fmtMoney(r.amount)} — ${titleCase(r.reason)}</div>
      <div class="chips" style="margin-top:10px">${opStatusBadge(r.status)} ${r.against === 'carrier' ? badge('vs Carrier', 'b-amber') : badge('Internal', 'b-blue')}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section"><dl class="dl">
        <dt>Account</dt><dd>${escHtml(r.accountName || '—')}</dd>
        <dt>Carrier</dt><dd>${escHtml(r.carrierName || '—')}</dd>
        <dt>Shipment</dt><dd class="mono">${r.shipmentRef || '—'}</dd>
        <dt>Lodged</dt><dd>${r.lodgedDate ? fmtDate(r.lodgedDate) : '—'}</dd>
        <dt>Resolved</dt><dd>${r.resolvedDate ? fmtDate(r.resolvedDate) : '—'}</dd>
        <dt>Owner</dt><dd>${r.ownerName || '—'}</dd>
      </dl>${r.notes ? `<p class="cell-sub" style="margin-top:10px">${escHtml(r.notes)}</p>` : ''}</div>
      <div class="drawer__section"><h4>Update</h4>
        <div class="form-row">
          <label class="field"><span>Status</span><select id="e-status">${s.en(m.claimStatuses, r.status)}</select></label>
          <label class="field"><span>Amount</span><input id="e-amount" type="number" value="${r.amount}" /></label>
        </div>
        <button class="btn btn--primary btn--sm" id="saveClm">Save</button>
      </div>
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveClm').onclick = async () => {
    await api.updateCreditClaim(r.id, { status: val('e-status'), amount: Number(val('e-amount')) });
    toast('Claim updated', r.reference, 'success'); closeDrawer(); router();
  };
}

// ============================================================================
// EVENTS (efmAPP feed)
// ============================================================================
async function renderEvents(host) {
  document.getElementById('topbarActions').innerHTML =
    `<button class="btn btn--primary" id="simEventTop">⚡ Simulate event</button>`;
  document.getElementById('simEventTop').onclick = openSimulateModal;

  const onlyExc = window.__eventsExc || false;
  const events = await api.events(bq({ exceptions: onlyExc ? 'true' : undefined, limit: 100 }));
  host.innerHTML = `
    <div class="toolbar">
      <button class="btn btn--sm ${onlyExc ? 'btn--primary' : ''}" id="excOnly">⚠ Exceptions only</button>
      <div class="spacer"></div>
      <span class="muted">Auto-refreshing every 5s · ${events.length} event(s)</span>
    </div>
    <div class="card card--pad"><div class="feed" id="eventFeed">${events.map(eventRow).join('') || '<div class="empty">No events.</div>'}</div></div>`;
  host.querySelector('#excOnly').onclick = () => { window.__eventsExc = !onlyExc; renderEvents(host); };
  host.querySelectorAll('[data-event-shipment]').forEach((n) =>
    n.addEventListener('click', () => { if (n.dataset.eventShipment) openShipmentDrawer(n.dataset.eventShipment); }));
}

function openSimulateModal() {
  const m = state.meta;
  api.shipments(bq()).then((shipments) => {
    openModal(`
      <div class="modal__head">⚡ Simulate efmAPP status event</div>
      <div class="modal__body">
        <p class="cell-sub" style="margin-top:0">Post a status milestone as if it came from the efmAPP. Exception statuses auto-raise a customer-service case.</p>
        <label class="field"><span>Shipment</span><select id="s-ref">${shipments.map((s) => `<option value="${s.reference}" data-brand="${s.brand}">${s.reference} — ${s.origin} → ${s.destination}</option>`).join('')}</select></label>
        <div class="form-row">
          <label class="field"><span>Status</span><select id="s-status">${m.shipmentStatuses.map((s) => `<option value="${s}" ${s === 'delayed' ? 'selected' : ''}>${titleCase(s)}</option>`).join('')}</select></label>
          <label class="field"><span>Location</span><input id="s-loc" value="In transit" /></label>
        </div>
        <label class="field"><span>Carrier note (optional)</span><input id="s-note" placeholder="e.g. Vessel berthing delay" /></label>
      </div>
      <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="sendEvent">Send event</button></div>`);
    modalHost.querySelector('[data-close]').onclick = closeModal;
    modalHost.querySelector('#sendEvent').onclick = async () => {
      const refSel = modalHost.querySelector('#s-ref');
      const brand = refSel.selectedOptions[0]?.dataset.brand;
      const res = await api.sendEvent({ shipmentRef: refSel.value, brand, status: val('s-status'), location: val('s-loc'), note: val('s-note') || null });
      closeModal();
      if (res.caseCreated) toast('⚡ Case auto-raised', `${res.caseCreated.id} · ${res.caseCreated.priority}`, 'warn');
      else if (res.caseUpdated) toast('Event appended to case', res.caseUpdated.id, 'success');
      else toast('Event recorded', titleCase(res.event.status), 'success');
      router();
    };
  });
}

// ---- Quick simulate from sidebar (random-ish event) ------------------------
async function quickSimulate() {
  const shipments = await api.shipments(bq());
  if (!shipments.length) return toast('No shipments to update', '', 'warn');
  const statuses = ['delayed', 'customs-hold', 'damaged', 'failed-delivery', 'in-transit', 'out-for-delivery', 'delivered'];
  const s = shipments[Math.floor(Date.now() / 1000) % shipments.length];
  const status = statuses[Math.floor(Date.now() / 3000) % statuses.length];
  const res = await api.sendEvent({ shipmentRef: s.reference, brand: s.brand, status, location: s.destination });
  if (res.caseCreated) toast('⚡ Case auto-raised', `${res.caseCreated.id} — ${titleCase(status)} on ${s.reference}`, 'warn');
  else toast('efmAPP event received', `${titleCase(status)} · ${s.reference}`, 'success');
  router();
}

// ============================================================================
// ADMINISTRATION — users, security groups & permissions
// ============================================================================
async function renderAdmin(host) {
  const tabs = [
    { key: '', label: 'Users' },
    { key: 'groups', label: 'Security Groups' },
  ];
  const tab = state.tab || '';
  host.innerHTML = tabBar('admin', tabs, tab) + `<div id="adminContent"></div>`;
  const c = host.querySelector('#adminContent');
  if (tab === 'groups') return renderSecurityGroups(c);
  return renderUsers(c);
}

// ---- Users ----
async function renderUsers(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newUsr">+ New user</button>`;
  document.getElementById('newUsr').onclick = () => openUserModal();
  const users = await api.users();
  host.innerHTML = `
    <p class="cell-sub" style="margin:0 0 14px">Assign permissions by <b>security group</b> (role) and refine at the <b>individual user</b> level with allow / deny overrides.</p>
    <div class="card table-wrap"><table class="data">
      <thead><tr><th>User</th><th>Role</th><th>Team</th><th>Security groups</th><th>Effective perms</th><th>Access</th><th>Status</th></tr></thead>
      <tbody>${users.length ? users.map((u) => `
        <tr class="clickable" data-usr="${u.id}">
          <td class="cell-strong">${escHtml(u.name)}<div class="cell-sub">${escHtml(u.email || '—')}</div></td>
          <td>${escHtml(u.role || '—')}</td>
          <td class="cell-sub">${escHtml(u.team || '—')}</td>
          <td>${(u.groups || []).map((g) => badge(escHtml(g.name), 'b-blue')).join(' ') || '<span class="cell-sub">none</span>'}</td>
          <td class="cell-sub">${u.effectivePermissions.includes('*') ? 'All (*)' : u.effectivePermissions.length}${(u.permissionOverrides.allow || []).length || (u.permissionOverrides.deny || []).length ? ` <span class="badge b-amber">override</span>` : ''}</td>
          <td>${u.isAdmin ? badge('Admin', 'b-red') : badge('Standard', 'b-slate')}</td>
          <td>${u.active ? badge('Active', 'b-green') : badge('Disabled', 'b-slate')}</td>
        </tr>`).join('') : `<tr><td colspan="7"><div class="empty">No users.</div></td></tr>`}
      </tbody></table></div>`;
  const map = Object.fromEntries(users.map((u) => [u.id, u]));
  host.querySelectorAll('[data-usr]').forEach((tr) => tr.onclick = () => openUserDrawer(map[tr.dataset.usr]));
}

function openUserModal() {
  const s = opSelects();
  openModal(`
    <div class="modal__head">New user</div>
    <div class="modal__body">
      <div class="form-row">
        <label class="field"><span>Name</span><input id="u-name" placeholder="e.g. Jordan Lee" /></label>
        <label class="field"><span>Role / title</span><input id="u-role" placeholder="e.g. CS Agent" /></label>
        <label class="field"><span>Team</span><input id="u-team" placeholder="e.g. Customer Service" /></label>
        <label class="field"><span>Email</span><input id="u-email" type="email" /></label>
      </div>
      <label class="field"><span>Security groups</span>
        <div class="checklist" id="u-groups"></div>
      </label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createUsr">Create</button></div>`);
  api.securityGroups().then((groups) => {
    modalHost.querySelector('#u-groups').innerHTML = groups.map((g) =>
      `<label class="chk"><input type="checkbox" value="${g.id}" /> ${escHtml(g.name)} <span class="cell-sub">— ${escHtml(g.description || '')}</span></label>`).join('');
  });
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createUsr').onclick = async () => {
    const groupIds = [...modalHost.querySelectorAll('#u-groups input:checked')].map((i) => i.value);
    await api.createUser({ name: val('u-name'), role: val('u-role'), team: val('u-team'), email: val('u-email'), groupIds });
    closeModal(); toast('User created', '', 'success'); router();
  };
}

async function openUserDrawer(u) {
  if (!u) return;
  const [perms, groups] = await Promise.all([api.permissions(), api.securityGroups()]);
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const overrides = u.permissionOverrides || { allow: [], deny: [] };

  // Compute what the user's *groups* grant (for the "inherited" hint).
  function groupGrantsFor(groupIds) {
    const set = new Set();
    for (const id of groupIds) for (const p of (groupById[id]?.permissions || [])) set.add(p);
    return set;
  }
  const grants = (set, perm) => set.has('*') || set.has(perm) || set.has(perm.split('.')[0] + '.*');

  const permRows = perms.modules.map((mod) => {
    const list = perms.permissions.filter((p) => p.module === mod.key);
    if (!list.length) return '';
    return `<div class="perm-mod"><div class="perm-mod__h">${escHtml(mod.label)}</div>
      ${list.map((p) => {
        const cur = overrides.allow?.includes(p.key) ? 'allow' : overrides.deny?.includes(p.key) ? 'deny' : 'inherit';
        return `<div class="perm-row" data-perm="${p.key}">
          <div class="perm-row__label">${escHtml(p.label)} <code class="perm-key">${p.key}</code>
            <span class="perm-inh" data-inh="${p.key}"></span></div>
          <div class="seg">
            <label class="seg__opt"><input type="radio" name="ov-${p.key}" value="inherit" ${cur === 'inherit' ? 'checked' : ''}/>Inherit</label>
            <label class="seg__opt seg__opt--allow"><input type="radio" name="ov-${p.key}" value="allow" ${cur === 'allow' ? 'checked' : ''}/>Allow</label>
            <label class="seg__opt seg__opt--deny"><input type="radio" name="ov-${p.key}" value="deny" ${cur === 'deny' ? 'checked' : ''}/>Deny</label>
          </div></div>`;
      }).join('')}</div>`;
  }).join('');

  openDrawer(`
    <div class="drawer__head"><button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${u.id} · ${u.isAdmin ? badge('Admin', 'b-red') : badge('Standard', 'b-slate')}</div>
      <div class="drawer__title">${escHtml(u.name)}</div>
      <div class="chips" style="margin-top:10px">${(u.groups || []).map((g) => badge(escHtml(g.name), 'b-blue')).join(' ')}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section"><h4>Details</h4>
        <div class="form-row">
          <label class="field"><span>Name</span><input id="d-name" value="${escAttr(u.name)}" /></label>
          <label class="field"><span>Role / title</span><input id="d-role" value="${escAttr(u.role || '')}" /></label>
          <label class="field"><span>Team</span><input id="d-team" value="${escAttr(u.team || '')}" /></label>
          <label class="field"><span>Email</span><input id="d-email" value="${escAttr(u.email || '')}" /></label>
          <label class="field"><span>Status</span><select id="d-active"><option value="true" ${u.active ? 'selected' : ''}>Active</option><option value="false" ${!u.active ? 'selected' : ''}>Disabled</option></select></label>
        </div>
      </div>
      <div class="drawer__section"><h4>Security groups <span class="cell-sub">— role-based permissions</span></h4>
        <div class="checklist" id="d-groups">
          ${groups.map((g) => `<label class="chk"><input type="checkbox" value="${g.id}" ${(u.groupIds || []).includes(g.id) ? 'checked' : ''}/> ${escHtml(g.name)} <span class="cell-sub">— ${(g.permissions || []).includes('*') ? 'all access' : (g.permissions || []).length + ' perms'}</span></label>`).join('')}
        </div>
      </div>
      <div class="drawer__section"><h4>User-level permission overrides</h4>
        <p class="cell-sub" style="margin:0 0 10px">Each permission inherits from the groups above. Override individually to explicitly <b>Allow</b> or <b>Deny</b> for this user.</p>
        <div class="perm-grid">${permRows}</div>
      </div>
      <div class="drawer__section"><h4>Effective permissions</h4>
        <div class="chips" id="d-effective"></div>
      </div>
      <div class="drawer__foot"><button class="btn btn--primary" id="saveUsr">Save changes</button></div>
    </div>`);

  drawer.querySelector('[data-close]').onclick = closeDrawer;

  // Recompute inherited hints + live effective set as groups/overrides change.
  function recompute() {
    const groupIds = [...drawer.querySelectorAll('#d-groups input:checked')].map((i) => i.value);
    const gset = groupGrantsFor(groupIds);
    const eff = new Set(gset);
    drawer.querySelectorAll('.perm-row').forEach((row) => {
      const key = row.dataset.perm;
      const inherited = grants(gset, key);
      row.querySelector(`[data-inh="${key}"]`).innerHTML = inherited ? '<span class="badge b-green">inherited</span>' : '';
      const ov = drawer.querySelector(`input[name="ov-${key}"]:checked`)?.value || 'inherit';
      if (ov === 'allow') eff.add(key);
      else if (ov === 'deny') eff.delete(key);
    });
    const effBox = drawer.querySelector('#d-effective');
    if (gset.has('*')) effBox.innerHTML = badge('All access (*)', 'b-red');
    else {
      const keys = [...eff].filter((k) => k !== '*').sort();
      effBox.innerHTML = keys.length ? keys.map((k) => `<code class="perm-key">${k}</code>`).join(' ') : '<span class="cell-sub">No permissions.</span>';
    }
  }
  drawer.querySelectorAll('#d-groups input, .perm-row input').forEach((i) => i.addEventListener('change', recompute));
  recompute();

  drawer.querySelector('#saveUsr').onclick = async () => {
    const groupIds = [...drawer.querySelectorAll('#d-groups input:checked')].map((i) => i.value);
    const allow = [], deny = [];
    drawer.querySelectorAll('.perm-row').forEach((row) => {
      const key = row.dataset.perm;
      const ov = drawer.querySelector(`input[name="ov-${key}"]:checked`)?.value;
      if (ov === 'allow') allow.push(key);
      else if (ov === 'deny') deny.push(key);
    });
    await api.updateUser(u.id, {
      name: val('d-name'), role: val('d-role'), team: val('d-team'), email: val('d-email'),
      active: val('d-active') === 'true', groupIds, permissionOverrides: { allow, deny },
    });
    toast('User updated', u.id, 'success');
    closeDrawer();
    await loadUsers();                 // refresh switcher / acting perms
    if (u.id === state.currentUser?.id) await setActingUser(u.id);
    router();
  };
}

// ---- Security groups ----
async function renderSecurityGroups(host) {
  document.getElementById('topbarActions').innerHTML = `<button class="btn btn--primary" id="newGrp">+ New security group</button>`;
  document.getElementById('newGrp').onclick = () => openGroupModal();
  const groups = await api.securityGroups();
  host.innerHTML = `
    <p class="cell-sub" style="margin:0 0 14px">Security groups bundle permissions into reusable roles. Assign them to users, then fine-tune per user.</p>
    <div class="card table-wrap"><table class="data">
      <thead><tr><th>Group</th><th>Description</th><th>Members</th><th>Permissions</th></tr></thead>
      <tbody>${groups.length ? groups.map((g) => `
        <tr class="clickable" data-grp="${g.id}">
          <td class="cell-strong">${escHtml(g.name)}</td>
          <td class="cell-sub">${escHtml(g.description || '—')}</td>
          <td>${badge(g.memberCount + ' member' + (g.memberCount === 1 ? '' : 's'), 'b-slate')}</td>
          <td>${(g.permissions || []).includes('*') ? badge('All access (*)', 'b-red') : badge(g.permissionCount + ' perms', 'b-blue')}</td>
        </tr>`).join('') : `<tr><td colspan="4"><div class="empty">No security groups.</div></td></tr>`}
      </tbody></table></div>`;
  const map = Object.fromEntries(groups.map((g) => [g.id, g]));
  host.querySelectorAll('[data-grp]').forEach((tr) => tr.onclick = () => openGroupDrawer(map[tr.dataset.grp]));
}

function openGroupModal() {
  openModal(`
    <div class="modal__head">New security group</div>
    <div class="modal__body">
      <label class="field"><span>Name</span><input id="g-name" placeholder="e.g. Customer Service" /></label>
      <label class="field"><span>Description</span><input id="g-desc" placeholder="What this role can do" /></label>
    </div>
    <div class="modal__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="createGrp">Create</button></div>`);
  modalHost.querySelector('[data-close]').onclick = closeModal;
  modalHost.querySelector('#createGrp').onclick = async () => {
    const g = await api.createSecurityGroup({ name: val('g-name'), description: val('g-desc'), permissions: [] });
    closeModal(); toast('Security group created', '', 'success');
    const full = await api.securityGroups();
    openGroupDrawer(full.find((x) => x.id === g.id) || g);
    router();
  };
}

async function openGroupDrawer(g) {
  if (!g) return;
  const perms = await api.permissions();
  const all = (g.permissions || []).includes('*');
  const has = new Set(g.permissions || []);

  const permRows = perms.modules.map((mod) => {
    const list = perms.permissions.filter((p) => p.module === mod.key);
    if (!list.length) return '';
    return `<div class="perm-mod"><div class="perm-mod__h">${escHtml(mod.label)}</div>
      ${list.map((p) => `<label class="chk"><input type="checkbox" class="g-perm" value="${p.key}" ${has.has(p.key) ? 'checked' : ''}/> ${escHtml(p.label)} <code class="perm-key">${p.key}</code></label>`).join('')}</div>`;
  }).join('');

  openDrawer(`
    <div class="drawer__head"><button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${g.id}</div>
      <div class="drawer__title">${escHtml(g.name)}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section">
        <div class="form-row">
          <label class="field"><span>Name</span><input id="g-name" value="${escAttr(g.name)}" /></label>
          <label class="field"><span>Description</span><input id="g-desc" value="${escAttr(g.description || '')}" /></label>
        </div>
        <label class="chk chk--master"><input type="checkbox" id="g-all" ${all ? 'checked' : ''}/> <b>Full access</b> — grant every permission (<code class="perm-key">*</code>)</label>
      </div>
      <div class="drawer__section"><h4>Permissions</h4>
        <div class="perm-grid" id="g-perms" ${all ? 'style="opacity:.4;pointer-events:none"' : ''}>${permRows}</div>
      </div>
      <div class="drawer__foot"><button class="btn btn--primary" id="saveGrp">Save changes</button></div>
    </div>`);

  drawer.querySelector('[data-close]').onclick = closeDrawer;
  const allBox = drawer.querySelector('#g-all');
  const permsBox = drawer.querySelector('#g-perms');
  allBox.addEventListener('change', () => {
    permsBox.style.opacity = allBox.checked ? '.4' : '';
    permsBox.style.pointerEvents = allBox.checked ? 'none' : '';
  });

  drawer.querySelector('#saveGrp').onclick = async () => {
    const permissions = allBox.checked ? ['*'] : [...drawer.querySelectorAll('.g-perm:checked')].map((i) => i.value);
    await api.updateSecurityGroup(g.id, { name: val('g-name'), description: val('g-desc'), permissions });
    toast('Security group updated', g.id, 'success');
    closeDrawer();
    await loadUsers();
    if (state.currentUser) await setActingUser(state.currentUser.id);
    router();
  };
}

// ============================================================================
// ACTING USER / PERMISSION GATING
// ============================================================================
async function loadUsers() {
  try {
    state.users = await api.users();
  } catch { state.users = []; }
  return state.users;
}

function populateUserSwitch() {
  const sel = document.getElementById('userSwitch');
  if (!sel) return;
  sel.innerHTML = (state.users || []).map((u) =>
    `<option value="${u.id}" ${u.id === state.currentUser?.id ? 'selected' : ''}>${escHtml(u.name)} — ${escHtml(u.role || '')}</option>`).join('');
  sel.onchange = () => setActingUser(sel.value).then(() => router());
}

async function setActingUser(id) {
  const u = (state.users || []).find((x) => x.id === id) || (state.users || [])[0];
  if (!u) { state.perms = null; return; }
  state.currentUser = u;
  state.perms = new Set(u.effectivePermissions || []);
  localStorage.setItem('actingUser', u.id);
  const sel = document.getElementById('userSwitch');
  if (sel && sel.value !== u.id) sel.value = u.id;
  applyNavGating();
}

// Show/hide sidebar nav items and controls based on the acting user's perms.
function applyNavGating() {
  document.querySelectorAll('#nav a').forEach((a) => {
    const perm = VIEW_PERM[a.dataset.view];
    a.style.display = !perm || can(perm) ? '' : 'none';
  });
  const sim = document.getElementById('simulateBtn');
  if (sim) sim.style.display = can('events.ingest') ? '' : 'none';
}

// Gate topbar create/manage buttons for the current view by button id.
const BTN_PERM = {
  newCaseBtn: 'cases.manage', newQuoteBtn: 'sales.manage', newDealBtn: 'sales.manage',
  newAccBtn: 'accounts.manage', newCmp: 'marketing.manage', capSvy: 'surveys.capture',
  newCarrierBtn: 'carriers.manage', newPrv: 'accountops.manage', newRisk: 'accountops.manage',
  newReq: 'accountops.manage', newImp: 'accountops.manage', newClm: 'accountops.manage',
  simEventTop: 'events.ingest', newUsr: 'admin.users', newGrp: 'admin.users',
};
function gateManageButtons() {
  const bar = document.getElementById('topbarActions');
  if (!bar) return;
  for (const [id, perm] of Object.entries(BTN_PERM)) {
    const btn = bar.querySelector('#' + id);
    if (btn && !can(perm)) btn.remove();
  }
}

// ============================================================================
// Boot
// ============================================================================
const val = (id) => document.getElementById(id)?.value?.trim() || '';

document.getElementById('simulateBtn').onclick = quickSimulate;
document.getElementById('themeBtn').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};
document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light');

// Auto-refresh the events view periodically.
setInterval(() => { if (state.view === 'events' && drawer.hidden && modalBackdrop.hidden) router(); }, 5000);

// ============================================================================
// LIVE CHAT widget
// ============================================================================
const chat = { open: false, sessionId: null, poll: null };
const chatFab = document.getElementById('chatFab');
const chatPanel = document.getElementById('chatPanel');
const chatFabBadge = document.getElementById('chatFabBadge');

async function refreshChatBadge() {
  try {
    const sessions = await api.chatSessions();
    const unread = sessions.reduce((s, c) => s + (c.unread || 0), 0);
    chatFabBadge.textContent = unread || '';
    chatFabBadge.hidden = !unread;
    return sessions;
  } catch { return []; }
}

async function openChat() {
  chat.open = true;
  chatPanel.hidden = false;
  await renderChatList();
  chat.poll = setInterval(async () => {
    if (chat.sessionId) await renderChatThread(chat.sessionId, true);
    else await renderChatList();
    refreshChatBadge();
  }, 4000);
}
function closeChat() {
  chat.open = false; chat.sessionId = null; chatPanel.hidden = true;
  if (chat.poll) clearInterval(chat.poll);
}
chatFab.onclick = () => (chat.open ? closeChat() : openChat());

async function renderChatList() {
  const sessions = await api.chatSessions();
  chatPanel.innerHTML = `
    <div class="chat-head">
      <div><b>Live chat</b><div class="chat-sub">${sessions.length} conversation(s)</div></div>
      <button class="chat-x" data-cx>×</button>
    </div>
    <div class="chat-list">
      ${sessions.map((s) => `
        <div class="chat-listitem" data-cs="${s.id}">
          <div class="chat-avatar">${(s.customerName || '?').slice(0, 1)}</div>
          <div style="flex:1;min-width:0">
            <div class="chat-name">${escHtml(s.customerName)} ${s.unread ? `<span class="chat-unread">${s.unread}</span>` : ''}</div>
            <div class="chat-preview">${escHtml(s.lastMessage ? s.lastMessage.text : s.subject)}</div>
          </div>
          <div class="chat-time">${s.lastMessageAt ? timeAgo(s.lastMessageAt) : ''}</div>
        </div>`).join('') || '<div class="cell-sub" style="padding:16px">No conversations.</div>'}
    </div>
    <div class="chat-foot"><button class="btn btn--sm btn--block" data-cnew>+ New chat</button></div>`;
  chatPanel.querySelector('[data-cx]').onclick = closeChat;
  chatPanel.querySelector('[data-cnew]').onclick = async () => {
    const s = await api.createChat({ customerName: 'New visitor', subject: 'New enquiry', message: 'Hi, I have a question about a shipment.' });
    chat.sessionId = s.id; renderChatThread(s.id);
  };
  chatPanel.querySelectorAll('[data-cs]').forEach((n) => n.onclick = () => { chat.sessionId = n.dataset.cs; renderChatThread(n.dataset.cs); });
}

async function renderChatThread(id, silent) {
  const s = await api.chatSession(id);
  if (!silent) api.chatRead(id).then(refreshChatBadge);
  const atBottom = (() => { const b = chatPanel.querySelector('.chat-msgs'); return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 60; })();
  chatPanel.innerHTML = `
    <div class="chat-head">
      <button class="chat-x" data-back>‹</button>
      <div style="flex:1"><b>${escHtml(s.customerName)}</b><div class="chat-sub">${escHtml(s.accountName || s.subject)}</div></div>
      <button class="chat-x" data-cx>×</button>
    </div>
    <div class="chat-msgs">
      ${(s.messages || []).map((m) => `
        <div class="chat-msg chat-msg--${m.sender}">
          <div class="chat-bubble">${escHtml(m.text)}</div>
          <div class="chat-msgtime">${m.sender === 'agent' ? 'You' : m.sender === 'system' ? 'System' : escHtml(s.customerName.split(' ')[0])} · ${timeAgo(m.at)}</div>
        </div>`).join('')}
    </div>
    <div class="chat-compose">
      <input id="chatInput" placeholder="Type a reply…" autocomplete="off" />
      <button class="btn btn--primary btn--sm" id="chatSend">Send</button>
    </div>
    <div class="chat-actions"><button class="btn btn--sm" data-raisecase ${s.caseId ? 'disabled' : ''}>${s.caseId ? '✓ Case ' + s.caseId : '➜ Raise case'}</button></div>`;
  chatPanel.querySelector('[data-cx]').onclick = closeChat;
  chatPanel.querySelector('[data-back]').onclick = () => { chat.sessionId = null; renderChatList(); };
  const input = chatPanel.querySelector('#chatInput');
  const send = async () => {
    const text = input.value.trim(); if (!text) return;
    input.value = '';
    await api.chatSend(id, { text, sender: 'agent' });
    await renderChatThread(id);
  };
  chatPanel.querySelector('#chatSend').onclick = send;
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  const raise = chatPanel.querySelector('[data-raisecase]');
  if (raise && !s.caseId) raise.onclick = async () => {
    const c = await api.chatToCase(id);
    toast('Case raised from chat', c.id, 'success');
    renderChatThread(id);
  };
  const box = chatPanel.querySelector('.chat-msgs');
  if (box && (atBottom || !silent)) box.scrollTop = box.scrollHeight;
  if (!silent) input.focus();
}

setInterval(() => { if (!chat.open) refreshChatBadge(); }, 8000);

(async function init() {
  state.meta = await api.meta();
  await loadUsers();
  const saved = localStorage.getItem('actingUser');
  const admin = (state.users || []).find((u) => u.id === saved) || (state.users || []).find((u) => u.isAdmin) || (state.users || [])[0];
  if (admin) await setActingUser(admin.id);
  populateUserSwitch();
  if (!location.hash) location.hash = '#/dashboard';
  await router();
  refreshChatBadge();
})();
