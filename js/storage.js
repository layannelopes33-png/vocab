/**
 * storage.js — o ÚNICO módulo que lê e grava dados.
 *
 * O resto do app só usa o objeto `storage` exportado no fim deste arquivo.
 * Todas as funções são assíncronas (retornam Promise), então trocar o
 * IndexedDB por um serviço remoto (ex.: Supabase) significa reescrever
 * apenas este arquivo, mantendo os mesmos nomes, parâmetros e retornos.
 *
 * Formato de um item (linha da "tabela" items):
 * {
 *   id: string,                 // gerado aqui (UUID)
 *   lang: 'en' | 'es' | 'ru',
 *   item: string,               // o bloco de palavras
 *   definition: string,
 *   originalSentence: string,
 *   mySentence: string,
 *   nuance: string,             // vizinhas / nuance (opcional)
 *   source: string,
 *   status: 'recognize' | 'produced' | 'spontaneous',
 *   producedAt: 'AAAA-MM-DD' | null,
 *   spontaneousAt: 'AAAA-MM-DD' | null,
 *   introducedOn: 'AAAA-MM-DD' | null,   // dia em que foi estudado pela 1ª vez
 *   cards: { production: Card, reading?: Card },  // estado do SM-2 por cartão
 *   createdAt: ISO string,      // gerado aqui
 *   updatedAt: ISO string       // gerado aqui a cada gravação
 * }
 * A "próxima revisão" do item é a menor data `due` entre seus cartões.
 */

const DB_NAME = 'vocab';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS = {
  newPerDay: { en: 8, es: 8, ru: 2 },
  theme: 'auto', // 'auto' | 'light' | 'dark'
};

/* ---------- infraestrutura IndexedDB (privada) ---------- */

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('items')) {
          const items = db.createObjectStore('items', { keyPath: 'id' });
          items.createIndex('lang', 'lang');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/** Executa `fn(store)` numa transação e resolve quando ela termina. */
async function run(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const out = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação abortada'));
  });
}

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const nowIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

function mergeSettings(v = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...v,
    newPerDay: { ...DEFAULT_SETTINGS.newPerDay, ...(v.newPerDay || {}) },
  };
}

/* ---------- API pública ---------- */

/** Abre o banco e pede ao navegador para não apagar os dados. */
async function init() {
  await openDb();
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* opcional */ }
}

/** Todos os itens. */
async function listItems() {
  return run('items', 'readonly', (s) => s.getAll());
}

/** Um item pelo id, ou null. */
async function getItem(id) {
  return (await run('items', 'readonly', (s) => s.get(id))) ?? null;
}

/**
 * Cria itens novos. Recebe objetos sem id/createdAt/updatedAt
 * e devolve os itens gravados (com esses campos preenchidos).
 */
async function addItems(list) {
  const rows = list.map((x, i) => {
    const ts = nowIso(i); // +i ms preserva a ordem de colagem
    return { ...x, id: uid(), createdAt: ts, updatedAt: ts };
  });
  await run('items', 'readwrite', (s) => rows.forEach((r) => s.put(r)));
  return rows;
}

/** Grava (substitui) um item existente. Devolve o item gravado. */
async function saveItem(item) {
  const row = { ...item, updatedAt: nowIso() };
  await run('items', 'readwrite', (s) => s.put(row));
  return row;
}

async function deleteItem(id) {
  await run('items', 'readwrite', (s) => s.delete(id));
}

async function getSettings() {
  const row = await run('meta', 'readonly', (s) => s.get('settings'));
  return mergeSettings(row?.value);
}

async function saveSettings(value) {
  const merged = mergeSettings(value);
  await run('meta', 'readwrite', (s) => s.put({ key: 'settings', value: merged }));
  return merged;
}

/** Objeto completo para backup em JSON. */
async function exportBackup() {
  return {
    app: 'vocab',
    schema: 1,
    exportedAt: nowIso(),
    settings: await getSettings(),
    items: await listItems(),
  };
}

/**
 * Restaura um backup.
 * mode 'merge'   → mantém o que existe; para ids repetidos fica a versão mais recente (updatedAt).
 * mode 'replace' → apaga tudo e grava o backup (inclusive as configurações).
 */
async function importBackup(data, { mode = 'merge' } = {}) {
  const incoming = Array.isArray(data?.items) ? data.items : [];
  if (mode === 'replace') {
    await run('items', 'readwrite', (s) => {
      s.clear();
      incoming.forEach((r) => s.put(r));
    });
    if (data.settings) await saveSettings(data.settings);
    return { written: incoming.length, skipped: 0 };
  }
  const existing = new Map((await listItems()).map((i) => [i.id, i]));
  const toWrite = incoming.filter((r) => {
    const e = existing.get(r.id);
    return !e || (r.updatedAt || '') > (e.updatedAt || '');
  });
  await run('items', 'readwrite', (s) => toWrite.forEach((r) => s.put(r)));
  return { written: toWrite.length, skipped: incoming.length - toWrite.length };
}

export const storage = {
  init,
  listItems,
  getItem,
  addItems,
  saveItem,
  deleteItem,
  getSettings,
  saveSettings,
  exportBackup,
  importBackup,
};
