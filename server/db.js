// Lightweight JSON-file datastore.
// Zero native dependencies so the CRM runs anywhere Node does.
// The whole dataset lives in memory and is flushed to disk on write.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'crm.json');

// Collections the store manages. Each is an array of records with an `id`.
const COLLECTIONS = [
  'accounts',
  'contacts',
  'cases',
  'deals',
  'shipments',
  'events',
  'activities',
  'agents',
  'documents',
  'actions',
];

function emptyState() {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
}

class Store {
  constructor() {
    this.state = emptyState();
    this._counters = {};
    this._loaded = false;
  }

  load() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        this.state = { ...emptyState(), ...raw };
      } catch (err) {
        console.error('[db] failed to parse data file, starting empty:', err.message);
        this.state = emptyState();
      }
    }
    this._loaded = true;
    return this;
  }

  save() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2));
  }

  reset(nextState) {
    this.state = { ...emptyState(), ...(nextState || {}) };
    this.save();
    return this;
  }

  collection(name) {
    if (!this.state[name]) this.state[name] = [];
    return this.state[name];
  }

  // Human-friendly, prefixed sequential ids, e.g. CASE-1042, DEAL-3.
  nextId(prefix, start = 1) {
    if (this._counters[prefix] == null) {
      // Derive the current max from existing records so ids stay unique
      // across restarts even though counters are not persisted.
      this._counters[prefix] = start - 1;
    }
    this._counters[prefix] += 1;
    return `${prefix}-${this._counters[prefix]}`;
  }

  // Seed the counters from loaded data so generated ids don't collide.
  syncCounters(map) {
    for (const [collection, cfg] of Object.entries(map)) {
      const records = this.collection(collection);
      let max = cfg.start - 1;
      for (const r of records) {
        const n = Number(String(r.id).split('-').pop());
        if (Number.isFinite(n) && n > max) max = n;
      }
      this._counters[cfg.prefix] = max;
    }
  }

  find(collection, predicate) {
    return this.collection(collection).find(predicate);
  }

  filter(collection, predicate) {
    return this.collection(collection).filter(predicate);
  }

  getById(collection, id) {
    return this.collection(collection).find((r) => r.id === id);
  }

  insert(collection, record) {
    this.collection(collection).push(record);
    this.save();
    return record;
  }

  update(collection, id, patch) {
    const record = this.getById(collection, id);
    if (!record) return null;
    Object.assign(record, patch, { updatedAt: new Date().toISOString() });
    this.save();
    return record;
  }

  remove(collection, id) {
    const arr = this.collection(collection);
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    this.save();
    return true;
  }
}

export const db = new Store();

export { COLLECTIONS, DATA_FILE };
