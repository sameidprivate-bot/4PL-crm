// EFM & AFS 4PL CRM — single-page frontend.
import { api } from './api.js';
import {
  el, fmtMoney, fmtDate, fmtDateTime, timeAgo, badge, brandChip,
  priorityBadge, statusBadge, slaBadge, healthBadge, shipmentStatusBadge,
  eventIcon, titleCase, toast,
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
  pipeline: renderPipeline,
  accounts: renderAccounts,
  shipments: renderShipments,
  events: renderEvents,
};
const TITLES = {
  dashboard: 'Dashboard',
  cases: 'Case Management',
  pipeline: 'Sales Pipeline',
  accounts: 'Account Management',
  shipments: 'Shipments',
  events: 'efmAPP Status Feed',
};

async function router() {
  const hash = location.hash.replace(/^#\//, '') || 'dashboard';
  const [view] = hash.split('/');
  state.view = routes[view] ? view : 'dashboard';
  document.getElementById('viewTitle').textContent = TITLES[state.view];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === state.view));
  document.getElementById('topbarActions').innerHTML = '';
  const host = document.getElementById('view');
  host.innerHTML = '<div class="loading">Loading…</div>';
  try {
    await routes[state.view](host);
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
  } catch { /* ignore */ }
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
      <div class="section-head" style="margin-top:0"><h2>Pipeline value by stage</h2><a class="muted" href="#/pipeline">Open board →</a></div>
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

  host.innerHTML = `
    <div class="toolbar">
      <input class="search" placeholder="Search cases, refs, accounts…" data-filter="q" value="${filters.q || ''}" />
      ${sel('status', m.caseStatuses, filters.status, 'All statuses')}
      ${sel('priority', m.casePriorities, filters.priority, 'All priorities')}
      ${sel('category', m.caseCategories, filters.category, 'All categories')}
      <select data-filter="origin">
        <option value="">Any origin</option>
        <option value="efmapp-auto" ${filters.origin === 'efmapp-auto' ? 'selected' : ''}>efmAPP auto</option>
        <option value="manual" ${filters.origin === 'manual' ? 'selected' : ''}>Manual</option>
      </select>
      <button class="btn btn--sm ${filters.sla === 'breached' ? 'btn--primary' : ''}" id="slaToggle">SLA breached</button>
      <div class="spacer"></div>
      <span class="muted">${cases.length} case(s)</span>
    </div>
    <div class="card table-wrap">
      <table class="data">
        <thead><tr>
          <th>Case</th><th>Account</th><th>Category</th><th>Priority</th><th>Status</th><th>SLA</th><th>Assignee</th><th>Updated</th>
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
  host.querySelectorAll('tr[data-case]').forEach((tr) =>
    tr.addEventListener('click', () => openCaseDrawer(tr.dataset.case)));
}

function collectFilters(host) {
  const f = {};
  host.querySelectorAll('[data-filter]').forEach((n) => { if (n.value) f[n.dataset.filter] = n.value; });
  const slaBtn = host.querySelector('#slaToggle');
  if (slaBtn && slaBtn.classList.contains('btn--primary')) f.sla = 'breached';
  return f;
}

function caseRow(c) {
  return `<tr class="clickable" data-case="${c.id}">
    <td>
      <div class="cell-strong">${c.subject}</div>
      <div class="cell-sub"><span class="mono">${c.id}</span>${c.origin === 'efmapp-auto' ? ' · <span class="badge b-violet" style="padding:1px 6px">⚡ efmAPP</span>' : ''}${c.shipmentRef ? ' · ' + c.shipmentRef : ''}</div>
    </td>
    <td>${c.accountName ? `${c.accountName}<br><span class="cell-sub">${brandChip(c.brand)}</span>` : `<span class="cell-sub">Unlinked ${brandChip(c.brand)}</span>`}</td>
    <td>${badge(titleCase(c.category), 'b-slate')}</td>
    <td>${priorityBadge(c.priority)}</td>
    <td>${statusBadge(c.status)}</td>
    <td>${slaBadge(c)}</td>
    <td>${c.assigneeName || '<span class="cell-sub">Unassigned</span>'}</td>
    <td class="cell-sub">${timeAgo(c.lastActivityAt || c.updatedAt)}</td>
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
      <div class="drawer__title">${c.subject}</div>
      <div class="chips" style="margin-top:10px">${priorityBadge(c.priority)} ${statusBadge(c.status)} ${slaBadge(c)}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section">
        <div class="form-row">
          <label class="field"><span>Status</span><select data-edit="status">${opt(m.caseStatuses, c.status)}</select></label>
          <label class="field"><span>Priority</span><select data-edit="priority">${opt(m.casePriorities, c.priority)}</select></label>
          <label class="field"><span>Category</span><select data-edit="category">${opt(m.caseCategories, c.category)}</select></label>
          <label class="field"><span>Assignee</span><select data-edit="assigneeId"><option value="">Unassigned</option>${agentOpts(c.assigneeId)}</select></label>
        </div>
        <button class="btn btn--primary btn--sm" id="saveCase">Save changes</button>
      </div>

      <div class="drawer__section">
        <h4>Details</h4>
        <dl class="dl">
          <dt>Account</dt><dd>${c.account ? `<a href="#" data-acc="${c.account.id}">${c.account.name}</a>` : 'Unlinked'}</dd>
          ${c.contact ? `<dt>Contact</dt><dd>${c.contact.name} · ${c.contact.email}</dd>` : ''}
          ${c.shipment ? `<dt>Shipment</dt><dd><a href="#" data-shp="${c.shipment.id}"><span class="mono">${c.shipment.reference}</span></a> — ${shipmentStatusBadge(c.shipment.status)}</dd>` : ''}
          <dt>Origin</dt><dd>${c.origin === 'efmapp-auto' ? '⚡ efmAPP status event' : titleCase(c.origin)}</dd>
          <dt>SLA due</dt><dd>${fmtDateTime(c.slaDueAt)} (${slaBadge(c)})</dd>
          <dt>Created</dt><dd>${fmtDateTime(c.createdAt)}</dd>
        </dl>
        ${c.description ? `<p style="margin-top:12px;white-space:pre-wrap;color:var(--text-muted);font-size:13px">${c.description}</p>` : ''}
      </div>

      <div class="drawer__section">
        <h4>Add note</h4>
        <textarea id="noteInput" rows="2" placeholder="Log a customer interaction or internal note…"></textarea>
        <button class="btn btn--sm" id="addNote" style="margin-top:8px">Add note</button>
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
  const accLink = drawer.querySelector('[data-acc]');
  if (accLink) accLink.onclick = (e) => { e.preventDefault(); closeDrawer(); openAccountDrawer(accLink.dataset.acc); };
  const shpLink = drawer.querySelector('[data-shp]');
  if (shpLink) shpLink.onclick = (e) => { e.preventDefault(); closeDrawer(); openShipmentDrawer(shpLink.dataset.shp); };
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
  return `<div class="deal-card" data-deal="${d.id}">
    <div class="deal-card__name">${d.name}</div>
    <div class="deal-card__meta">
      <span>${d.accountName || 'Prospect'} ${brandChip(d.brand)}</span>
      <span class="deal-card__val">${fmtMoney(d.value)}</span>
    </div>
    <div class="probbar"><i style="width:${d.probability}%"></i></div>
  </div>`;
}

async function openDealDrawer(id) {
  const deals = await api.deals(bq());
  const d = deals.find((x) => x.id === id);
  if (!d) return;
  const m = state.meta;
  openDrawer(`
    <div class="drawer__head">
      <button class="drawer__close" data-close>×</button>
      <div class="drawer__eyebrow">${d.id} · ${brandChip(d.brand)}</div>
      <div class="drawer__title">${d.name}</div>
    </div>
    <div class="drawer__body">
      <div class="drawer__section">
        <dl class="dl">
          <dt>Account</dt><dd>${d.accountName || d.prospectName || '—'}</dd>
          <dt>Value</dt><dd class="cell-strong">${fmtMoney(d.value)}</dd>
          <dt>Weighted</dt><dd>${fmtMoney(d.weightedValue)} (${d.probability}%)</dd>
          <dt>Service</dt><dd>${d.serviceType}</dd>
          <dt>Owner</dt><dd>${d.ownerName || '—'}</dd>
          <dt>Source</dt><dd>${d.source || '—'}</dd>
          <dt>Expected close</dt><dd>${d.expectedCloseAt ? fmtDate(d.expectedCloseAt) : '—'}</dd>
          ${d.lostReason ? `<dt>Lost reason</dt><dd>${d.lostReason}</dd>` : ''}
        </dl>
      </div>
      <div class="drawer__section">
        <h4>Move stage</h4>
        <label class="field"><select id="stageSel">${m.dealStages.map((s) => `<option value="${s.key}" ${s.key === d.stage ? 'selected' : ''}>${s.label} (${s.probability}%)</option>`).join('')}</select></label>
        <label class="field"><span>Value</span><input id="valInput" type="number" value="${d.value}" /></label>
        <button class="btn btn--primary btn--sm" id="saveDeal">Save</button>
      </div>
    </div>`);
  drawer.querySelector('[data-close]').onclick = closeDrawer;
  drawer.querySelector('#saveDeal').onclick = async () => {
    await api.updateDeal(id, { stage: val('stageSel'), value: Number(val('valInput')) });
    toast('Deal updated', '', 'success'); closeDrawer(); router();
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
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:var(--text-muted)">
      <span><b style="color:var(--text)">${a.openCases}</b> cases</span>
      <span><b style="color:var(--text)">${a.openDeals}</b> deals</span>
      <span><b style="color:var(--text)">${a.activeShipments}</b> shipments</span>
      <span>${fmtMoney(a.annualRevenue)}/yr</span>
    </div>
  </div>`;
}

async function openAccountDrawer(id) {
  const a = await api.account(id);
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
    <div class="inline-item"><div class="cell-strong">${d.name}</div><div>${badge(titleCase(d.stage), 'b-slate')} <b>${fmtMoney(d.value)}</b></div></div>`).join('') || '<div class="cell-sub">No deals.</div>';

  const shipments = a.shipments.slice(0, 6).map((s) => `
    <div class="inline-item clickable" data-shp="${s.id}">
      <div><span class="mono">${s.reference}</span><div class="cell-sub">${s.origin} → ${s.destination}</div></div>
      ${shipmentStatusBadge(s.status)}
    </div>`).join('') || '<div class="cell-sub">No shipments.</div>';

  const activities = a.activities.slice(0, 8).map((x) => `
    <div class="timeline__item"><div class="timeline__msg">${titleCase(x.type)}: ${x.subject}</div><div class="timeline__time">${fmtDateTime(x.at)}</div></div>`).join('') || '<div class="cell-sub">No activity.</div>';

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
  drawer.querySelectorAll('[data-case]').forEach((n) => n.onclick = () => { closeDrawer(); openCaseDrawer(n.dataset.case); });
  drawer.querySelectorAll('[data-shp]').forEach((n) => n.onclick = () => { closeDrawer(); openShipmentDrawer(n.dataset.shp); });
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

(async function init() {
  state.meta = await api.meta();
  if (!location.hash) location.hash = '#/dashboard';
  await router();
})();
