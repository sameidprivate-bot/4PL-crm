// Presentation helpers: formatting + badge rendering.

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function fmtMoney(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(iso);
}

export function titleCase(s) {
  if (!s) return '';
  return String(s).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Escape a value for safe use inside a double-quoted HTML attribute.
export function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Escape text for safe use in HTML body content.
export function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function badge(text, cls = 'b-slate') {
  return `<span class="badge ${cls}">${text}</span>`;
}

export function brandChip(brand) {
  if (!brand) return '';
  return `<span class="brand-chip brand-${brand}">${brand}</span>`;
}

const PRIORITY_CLS = { urgent: 'b-red', high: 'b-amber', medium: 'b-blue', low: 'b-slate' };
export function priorityBadge(p) {
  return `<span class="badge ${PRIORITY_CLS[p] || 'b-slate'}"><span class="dot"></span>${titleCase(p)}</span>`;
}

const STATUS_CLS = {
  new: 'b-blue', open: 'b-blue', pending: 'b-amber', escalated: 'b-red',
  resolved: 'b-green', closed: 'b-slate',
};
export function statusBadge(s) {
  return `<span class="badge ${STATUS_CLS[s] || 'b-slate'}">${titleCase(s)}</span>`;
}

export function slaBadge(c) {
  const map = {
    breached: ['b-red', 'SLA breached'],
    'due-soon': ['b-amber', 'Due soon'],
    'on-track': ['b-green', 'On track'],
    met: ['b-slate', 'SLA met'],
    none: ['b-slate', 'No SLA'],
  };
  const [cls, label] = map[c.slaState] || map.none;
  let suffix = '';
  if (c.slaState === 'on-track' && c.slaHoursRemaining != null) suffix = ` · ${c.slaHoursRemaining}h`;
  if (c.slaState === 'breached' && c.slaHoursRemaining != null) suffix = ` · ${Math.abs(c.slaHoursRemaining)}h over`;
  return `<span class="badge ${cls}">${label}${suffix}</span>`;
}

export function healthBadge(h) {
  const map = { healthy: 'b-green', watch: 'b-amber', 'at-risk': 'b-red' };
  return `<span class="badge ${map[h] || 'b-slate'}"><span class="dot"></span>${titleCase(h)}</span>`;
}

const SHIP_CLS = {
  booked: 'b-slate', 'picked-up': 'b-blue', 'in-transit': 'b-blue', 'at-hub': 'b-blue',
  'out-for-delivery': 'b-violet', delivered: 'b-green', 'pod-captured': 'b-green',
  delayed: 'b-amber', exception: 'b-red', 'customs-hold': 'b-red', damaged: 'b-red',
  'failed-delivery': 'b-red', lost: 'b-red', returned: 'b-amber',
};
export function shipmentStatusBadge(s) {
  return `<span class="badge ${SHIP_CLS[s] || 'b-slate'}">${titleCase(s)}</span>`;
}

const EVENT_ICONS = {
  booked: { icon: '📋', bg: 'var(--slate-bg)', fg: 'var(--slate)' },
  'picked-up': { icon: '📦', bg: 'var(--blue-bg)', fg: 'var(--blue)' },
  'in-transit': { icon: '🚚', bg: 'var(--blue-bg)', fg: 'var(--blue)' },
  'at-hub': { icon: '🏬', bg: 'var(--blue-bg)', fg: 'var(--blue)' },
  'out-for-delivery': { icon: '🛵', bg: 'var(--violet-bg)', fg: 'var(--violet)' },
  delivered: { icon: '✅', bg: 'var(--green-bg)', fg: 'var(--green)' },
  'pod-captured': { icon: '✍️', bg: 'var(--green-bg)', fg: 'var(--green)' },
  delayed: { icon: '⏱️', bg: 'var(--amber-bg)', fg: 'var(--amber)' },
  exception: { icon: '⚠️', bg: 'var(--red-bg)', fg: 'var(--red)' },
  'customs-hold': { icon: '🛃', bg: 'var(--red-bg)', fg: 'var(--red)' },
  damaged: { icon: '💥', bg: 'var(--red-bg)', fg: 'var(--red)' },
  'failed-delivery': { icon: '🚫', bg: 'var(--red-bg)', fg: 'var(--red)' },
  lost: { icon: '❓', bg: 'var(--red-bg)', fg: 'var(--red)' },
  returned: { icon: '↩️', bg: 'var(--amber-bg)', fg: 'var(--amber)' },
};
export function eventIcon(status) {
  return EVENT_ICONS[status] || { icon: '•', bg: 'var(--slate-bg)', fg: 'var(--slate)' };
}

const DOC_META = {
  'rate-card': { icon: '💲', cls: 'b-green', label: 'Rate Card' },
  agreement: { icon: '📄', cls: 'b-blue', label: 'Agreement' },
  qbr: { icon: '📊', cls: 'b-violet', label: 'QBR' },
  'monthly-deck': { icon: '🗓️', cls: 'b-amber', label: 'Monthly Deck' },
  other: { icon: '📎', cls: 'b-slate', label: 'Other' },
};
export function docMeta(type) {
  return DOC_META[type] || DOC_META.other;
}
export function docTypeBadge(type) {
  const m = docMeta(type);
  return `<span class="badge ${m.cls}">${m.icon} ${m.label}</span>`;
}

const ACTION_CLS = { open: 'b-blue', 'in-progress': 'b-amber', blocked: 'b-red', done: 'b-green' };
export function actionStatusBadge(s) {
  return `<span class="badge ${ACTION_CLS[s] || 'b-slate'}">${titleCase(s)}</span>`;
}

const CARRIER_STATUS_CLS = { preferred: 'b-green', active: 'b-blue', onboarding: 'b-amber', suspended: 'b-red' };
export function carrierStatusBadge(s) {
  return `<span class="badge ${CARRIER_STATUS_CLS[s] || 'b-slate'}">${titleCase(s)}</span>`;
}

const RESP_CLS = { carrier: 'b-amber', internal: 'b-blue', customer: 'b-violet' };
export function responsibilityBadge(r) {
  if (!r) return '';
  const label = r === 'carrier' ? '↳ With carrier' : titleCase(r);
  return `<span class="badge ${RESP_CLS[r] || 'b-slate'}">${label}</span>`;
}

const QUOTE_CLS = { draft: 'b-slate', sent: 'b-blue', accepted: 'b-green', declined: 'b-red', expired: 'b-amber' };
export function quoteStatusBadge(s) {
  return `<span class="badge ${QUOTE_CLS[s] || 'b-slate'}">${titleCase(s)}</span>`;
}

let toastId = 0;
export function toast(title, msg = '', type = 'info') {
  const wrap = document.getElementById('toasts');
  const id = `toast-${++toastId}`;
  const node = el(`<div class="toast toast--${type}" id="${id}">
    <div class="toast__title">${title}</div>
    ${msg ? `<div class="toast__msg">${msg}</div>` : ''}
  </div>`);
  wrap.appendChild(node);
  setTimeout(() => { node.style.opacity = '0'; node.style.transition = 'opacity .3s'; setTimeout(() => node.remove(), 300); }, 4200);
}
