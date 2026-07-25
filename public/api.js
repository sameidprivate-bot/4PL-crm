// Thin REST client for the CRM API.

function qs(params = {}) {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return clean.length ? '?' + new URLSearchParams(clean).toString() : '';
}

async function req(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

export const api = {
  meta: () => req('GET', '/meta'),
  dashboard: (q) => req('GET', '/dashboard' + qs(q)),

  accounts: (q) => req('GET', '/accounts' + qs(q)),
  account: (id) => req('GET', `/accounts/${id}`),
  createAccount: (b) => req('POST', '/accounts', b),
  updateAccount: (id, b) => req('PATCH', `/accounts/${id}`, b),
  addActivity: (id, b) => req('POST', `/accounts/${id}/activities`, b),
  createContact: (b) => req('POST', '/contacts', b),

  addDocument: (id, b) => req('POST', `/accounts/${id}/documents`, b),
  updateDocument: (id, b) => req('PATCH', `/documents/${id}`, b),
  deleteDocument: (id) => req('DELETE', `/documents/${id}`),
  addAction: (id, b) => req('POST', `/accounts/${id}/actions`, b),
  updateAction: (id, b) => req('PATCH', `/actions/${id}`, b),

  cases: (q) => req('GET', '/cases' + qs(q)),
  case: (id) => req('GET', `/cases/${id}`),
  createCase: (b) => req('POST', '/cases', b),
  updateCase: (id, b) => req('PATCH', `/cases/${id}`, b),
  addCaseNote: (id, b) => req('POST', `/cases/${id}/notes`, b),

  deals: (q) => req('GET', '/deals' + qs(q)),
  deal: (id) => req('GET', `/deals/${id}`),
  dealBoard: (q) => req('GET', '/deals/board' + qs(q)),
  createDeal: (b) => req('POST', '/deals', b),
  updateDeal: (id, b) => req('PATCH', `/deals/${id}`, b),
  saveBlueSheet: (id, b) => req('PUT', `/deals/${id}/bluesheet`, b),

  shipments: (q) => req('GET', '/shipments' + qs(q)),
  shipment: (id) => req('GET', `/shipments/${id}`),

  events: (q) => req('GET', '/events' + qs(q)),
  sendEvent: (b) => req('POST', '/events/efmapp', b),
};
