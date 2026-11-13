/**
 * srs.js — revisão espaçada (SM-2) e regras de fila. Não acessa dados.
 *
 * Notas da avaliação → qualidade do SM-2 (0–5):
 *   errei = 1, difícil = 3, bom = 4, fácil = 5
 */

export const GRADES = [
  { key: 'again', label: 'Errei', q: 1 },
  { key: 'hard', label: 'Difícil', q: 3 },
  { key: 'good', label: 'Bom', q: 4 },
  { key: 'easy', label: 'Fácil', q: 5 },
];

/* ---------- datas locais no formato AAAA-MM-DD ---------- */

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function today() {
  return fmt(new Date());
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return fmt(new Date(y, m - 1, d + n));
}

/* ---------- cartões ---------- */

export function newCard() {
  return { reps: 0, interval: 0, ease: 2.5, lapses: 0, due: null, last: null };
}

/** Produção para todos; leitura extra para o russo. */
export function cardsFor(lang) {
  const cards = { production: newCard() };
  if (lang === 'ru') cards.reading = newCard();
  return cards;
}

/**
 * Aplica uma avaliação SM-2 e devolve o cartão atualizado (não altera o original).
 * q < 3: o cartão volta para o início (reps = 0) e continua pendente hoje.
 */
export function review(card, q, t = today()) {
  const c = { ...card };
  if (q < 3) {
    c.reps = 0;
    c.interval = 0;
    c.lapses = (c.lapses || 0) + 1;
    c.due = t;
  } else {
    if (c.reps === 0) c.interval = 1;
    else if (c.reps === 1) c.interval = 6;
    else c.interval = Math.max(1, Math.round(c.interval * c.ease));
    c.reps += 1;
    c.due = addDays(t, c.interval);
  }
  c.ease = Math.max(1.3, c.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  c.last = t;
  return c;
}

/** Próxima revisão de um item: menor `due` entre os cartões, ou null se nunca estudado. */
export function nextReview(item) {
  const dues = Object.values(item.cards || {}).map((c) => c.due).filter(Boolean);
  return dues.length ? dues.sort()[0] : null;
}

/**
 * Monta a fila de estudo para os idiomas pedidos.
 * - Cartões com due <= hoje entram como revisão.
 * - Cartões ainda sem due de itens já apresentados (ex.: o cartão de leitura
 *   de um item russo iniciado hoje) também entram.
 * - Itens nunca apresentados entram até o limite diário de novos do idioma.
 */
export function collect(items, langs, newPerDay, t = today()) {
  const due = [];
  const fresh = [];
  let newItems = 0;
  for (const lang of langs) {
    const mine = items.filter((i) => i.lang === lang);
    const introducedToday = mine.filter((i) => i.introducedOn === t).length;
    const remaining = Math.max(0, (newPerDay[lang] ?? 0) - introducedToday);
    const newbies = mine
      .filter((i) => !i.introducedOn)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .slice(0, remaining);
    newItems += newbies.length;

    for (const i of mine) {
      if (!i.introducedOn) continue;
      for (const [type, c] of Object.entries(i.cards)) {
        if (c.due && c.due <= t) due.push({ id: i.id, type });
        else if (!c.due) fresh.push({ id: i.id, type });
      }
    }
    for (const i of newbies) {
      for (const type of Object.keys(i.cards)) fresh.push({ id: i.id, type, isNew: true });
    }
  }
  // "reviews" = cartões já iniciados que estão pendentes hoje
  const reviews = due.length + fresh.filter((f) => !f.isNew).length;
  return { due, fresh, newItems, reviews };
}
