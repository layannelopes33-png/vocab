/**
 * app.js — telas e interação. Todo acesso a dados passa por `storage`.
 */
import { storage } from './storage.js';
import * as srs from './srs.js';

const LANGS = {
  en: { code: 'EN', label: 'Inglês', tts: 'en-US' },
  es: { code: 'ES', label: 'Espanhol', tts: 'es-ES' },
  ru: { code: 'RU', label: 'Russo', tts: 'ru-RU' },
};
const LANG_KEYS = Object.keys(LANGS);
const STATUS = {
  recognize: 'Reconheço',
  produced: 'Produzi no estudo',
  spontaneous: 'Usei espontâneo',
};
const FIELDS = [
  ['item', 'Item (bloco de palavras)', 'ex.: make up my mind'],
  ['definition', 'Definição', ''],
  ['originalSentence', 'Frase original', 'onde você encontrou'],
  ['mySentence', 'Minha frase', 'use o item exatamente como escrito acima'],
  ['nuance', 'Vizinhas / nuance (opcional)', ''],
  ['source', 'Fonte', 'livro, série, podcast…'],
];

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const view = $('#view');
let settings = null;
let session = null;

/* ---------------- utilidades ---------------- */

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}

function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
}

function fmtDate(d) {
  if (!d) return 'novo';
  const t = srs.today();
  if (d <= t) return 'hoje';
  if (d === srs.addDays(t, 1)) return 'amanhã';
  const [y, m, day] = d.split('-');
  return `${day}/${m}${y === t.slice(0, 4) ? '' : '/' + y}`;
}

const langPill = (l) => `<span class="pill lang-${l}">${LANGS[l].code}</span>`;
const statusPill = (s) => `<span class="pill status-${s}">${STATUS[s]}</span>`;

function newItem(f) {
  return {
    lang: f.lang,
    item: f.item.trim(),
    definition: (f.definition || '').trim(),
    originalSentence: (f.originalSentence || '').trim(),
    mySentence: (f.mySentence || '').trim(),
    nuance: (f.nuance || '').trim(),
    source: (f.source || '').trim(),
    status: 'recognize',
    producedAt: null,
    spontaneousAt: null,
    introducedOn: null,
    cards: srs.cardsFor(f.lang),
  };
}

/** Garante que um item (ex.: vindo de backup) tenha todos os campos. */
function normalizeItem(raw) {
  if (!raw || !raw.id || !LANGS[raw.lang] || !raw.item) return null;
  const base = newItem({ ...raw, item: String(raw.item) });
  const it = { ...base, ...raw, cards: { ...base.cards, ...(raw.cards || {}) } };
  if (it.lang !== 'ru') delete it.cards.reading;
  if (!STATUS[it.status]) it.status = 'recognize';
  return it;
}

/** Frase com lacuna no lugar do item; null se o item não aparece literalmente. */
function makeCloze(sentence, item) {
  if (!sentence || !item) return null;
  const idx = sentence.toLowerCase().indexOf(item.toLowerCase());
  if (idx < 0) return null;
  return esc(sentence.slice(0, idx)) + '<span class="gap">＿＿＿</span>' + esc(sentence.slice(idx + item.length));
}

/* ---------------- voz (Web Speech API) ---------------- */

let voices = [];
if ('speechSynthesis' in window) {
  const load = () => (voices = speechSynthesis.getVoices());
  load();
  speechSynthesis.addEventListener?.('voiceschanged', load);
}
function voiceFor(lang) {
  const full = LANGS[lang].tts.toLowerCase();
  const norm = (v) => v.lang.replace('_', '-').toLowerCase();
  return voices.find((v) => norm(v) === full) || voices.find((v) => norm(v).startsWith(full.slice(0, 2)));
}
/** Fala o texto; devolve false se não houver voz para o idioma. */
function speak(text, lang) {
  if (!('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANGS[lang].tts;
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = 0.9;
  speechSynthesis.speak(u);
  return !!v || voices.length === 0; // sem lista de vozes ainda: tenta mesmo assim
}

/* ---------------- roteamento ---------------- */

const routes = {
  '': viewHome,
  review: viewReview,
  add: viewAdd,
  items: viewItems,
  edit: viewEdit,
  settings: viewSettings,
};

function route() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  document.onkeydown = null;
  const [, name = '', arg] = location.hash.replace(/^#/, '').split('/');
  const fn = routes[name] || viewHome;
  const tab = name === 'edit' ? 'items' : name || 'home';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  window.scrollTo(0, 0);
  fn(arg ? decodeURIComponent(arg) : undefined).catch((err) => {
    console.error(err);
    view.innerHTML = `<div class="panel"><p>Algo deu errado: ${esc(err.message)}</p></div>`;
  });
}

/* ---------------- Início ---------------- */

async function viewHome() {
  const items = await storage.listItems();
  const t = srs.today();
  const since = srs.addDays(t, -27);
  const spont = items.filter((i) => i.spontaneousAt && i.spontaneousAt >= since).length;

  if (!items.length) {
    view.innerHTML = `
      <section class="panel empty">
        <h2>Comece adicionando itens</h2>
        <p class="muted">Blocos de palavras funcionam melhor que palavras soltas.</p>
        <a class="btn primary" href="#/add">Adicionar itens</a>
      </section>`;
    return;
  }

  const rows = LANG_KEYS.map((l) => {
    const s = srs.collect(items, [l], settings.newPerDay, t);
    return { l, ...s, total: items.filter((i) => i.lang === l).length };
  });
  const all = rows.reduce((n, r) => n + r.reviews + r.newItems, 0);

  view.innerHTML = `
    <section class="panel stat">
      <div class="big">${spont}</div>
      <div>itens <strong>usados espontaneamente</strong><br><span class="muted">nos últimos 28 dias</span></div>
    </section>

    <section class="panel">
      <h2>Para hoje</h2>
      <ul class="langs">
        ${rows
          .map(
            (r) => `
          <li>
            <div class="lang-name">${langPill(r.l)} ${LANGS[r.l].label}</div>
            <div class="counts">
              <span><strong>${r.reviews}</strong> revisões</span>
              <span><strong>${r.newItems}</strong> novos</span>
            </div>
            ${
              r.reviews + r.newItems
                ? `<a class="btn small" href="#/review/${r.l}">Estudar</a>`
                : `<span class="done-mark" title="Nada pendente">✓</span>`
            }
          </li>`
          )
          .join('')}
      </ul>
      ${all ? `<a class="btn primary block" href="#/review">Estudar tudo (${all})</a>` : `<p class="muted center">Nada pendente hoje. 🎉</p>`}
    </section>`;
}

/* ---------------- Revisão ---------------- */

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function viewReview(lang) {
  const items = await storage.listItems();
  const langs = lang && LANGS[lang] ? [lang] : LANG_KEYS;
  const { due, fresh } = srs.collect(items, langs, settings.newPerDay);
  // novos: produção primeiro, leitura depois (separa os dois cartões do mesmo item russo)
  const freshOrdered = [...fresh.filter((f) => f.type === 'production'), ...fresh.filter((f) => f.type !== 'production')];
  session = {
    queue: [...shuffle(due), ...freshOrdered],
    items: new Map(items.map((i) => [i.id, i])),
    done: 0,
  };
  showCard();
}

function showCard() {
  const s = session;
  if (!s.queue.length) return renderDone();
  const { id, type } = s.queue[0];
  const item = s.items.get(id);
  if (!item || !item.cards[type]) {
    s.queue.shift();
    return showCard();
  }
  const card = item.cards[type];
  const isNew = !card.due;
  const isReading = type === 'reading';

  let front;
  if (isReading) {
    front = `
      <p class="prompt-label">Leia em voz alta</p>
      <p class="cyr">${esc(item.item)}</p>`;
  } else {
    const cloze = makeCloze(item.mySentence, item.item);
    const useCloze = cloze && (!item.definition || Math.random() < 0.5);
    front = useCloze
      ? `<p class="prompt-label">Diga a frase em voz alta, completando a lacuna</p>
         <p class="prompt">${cloze}</p>
         ${item.definition ? `<button class="link" id="hint">Mostrar dica</button><p class="muted hint" hidden>${esc(item.definition)}</p>` : ''}`
      : `<p class="prompt-label">Diga em voz alta o item que corresponde a</p>
         <p class="prompt">${esc(item.definition)}</p>`;
  }

  const back = isReading
    ? `
      <div class="answer">
        <p class="cyr small">${esc(item.item)}</p>
        <button class="btn small ghost" id="speak">🔊 Ouvir de novo</button>
        <p id="no-voice" class="warn" hidden>Não encontrei voz em russo neste aparelho. No Android: Configurações → Idioma → Saída de conversão de texto em voz → instale o russo.</p>
      </div>
      <dl class="details">
        ${item.definition ? `<dt>Significado</dt><dd>${esc(item.definition)}</dd>` : ''}
        ${item.originalSentence ? `<dt>Frase original</dt><dd>${esc(item.originalSentence)}</dd>` : ''}
      </dl>`
    : `
      <div class="answer">
        <p class="item-big">${esc(item.item)}</p>
        <button class="btn small ghost" id="speak">🔊 Ouvir</button>
      </div>
      <dl class="details">
        ${item.definition ? `<dt>Definição</dt><dd>${esc(item.definition)}</dd>` : ''}
        ${item.mySentence ? `<dt>Minha frase</dt><dd>${esc(item.mySentence)}</dd>` : ''}
        ${item.originalSentence ? `<dt>Frase original</dt><dd>${esc(item.originalSentence)}</dd>` : ''}
        ${item.nuance ? `<dt>Vizinhas / nuance</dt><dd>${esc(item.nuance)}</dd>` : ''}
        ${item.source ? `<dt>Fonte</dt><dd>${esc(item.source)}</dd>` : ''}
      </dl>`;

  const grades = srs.GRADES.map((g, n) => {
    const next = srs.review(card, g.q);
    const when = g.q < 3 ? 'de novo' : next.interval === 1 ? '1 dia' : `${next.interval} dias`;
    return `<button class="grade grade-${g.key}" data-q="${g.q}"><span>${g.label}</span><small>${when}</small><kbd>${n + 1}</kbd></button>`;
  }).join('');

  view.innerHTML = `
    <div class="progress"><span>${s.done} feitos</span><span>${s.queue.length} na fila</span></div>
    <article class="flashcard">
      <div class="card-meta">
        ${langPill(item.lang)}
        <span class="muted">${isReading ? 'Leitura' : 'Produção'}</span>
        ${isNew ? '<span class="pill new">novo</span>' : ''}
        <span class="spacer"></span>
        ${statusPill(item.status)}
      </div>
      <div class="front">${front}</div>
      <div class="back" hidden>${back}</div>
    </article>
    <div class="review-actions">
      <button class="btn primary block big" id="flip">Mostrar resposta <kbd>espaço</kbd></button>
      <div class="grades" hidden>${grades}</div>
      <button class="btn ghost block spont" id="spont" hidden>${spontLabel(item)}</button>
    </div>`;

  const flip = () => {
    $('.back').hidden = false;
    $('#flip').hidden = true;
    $('.grades').hidden = false;
    $('#spont').hidden = false;
    if (isReading && !speak(item.item, 'ru')) $('#no-voice').hidden = false;
  };
  $('#flip').onclick = flip;
  $('#hint')?.addEventListener('click', (e) => {
    e.target.hidden = true;
    $('.hint').hidden = false;
  });
  $('#speak').onclick = () => {
    if (!speak(item.item, item.lang) && $('#no-voice')) $('#no-voice').hidden = false;
  };
  $('#spont').onclick = async () => {
    const saved = await markSpontaneous(item);
    s.items.set(saved.id, saved);
    $('#spont').textContent = spontLabel(saved);
    $('.card-meta .pill[class*="status-"]').outerHTML = statusPill(saved.status);
    toast('Marcado como usado espontaneamente hoje');
  };
  view.querySelectorAll('.grade').forEach((b) => (b.onclick = () => grade(Number(b.dataset.q))));

  document.onkeydown = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (!$('#flip') ) return;
    if (!$('#flip').hidden && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      flip();
    } else if ($('#flip').hidden && /^[1-4]$/.test(e.key)) {
      grade(srs.GRADES[Number(e.key) - 1].q);
    }
  };
}

function spontLabel(item) {
  return item.spontaneousAt === srs.today() ? '✓ Usei espontâneo hoje' : '★ Usei espontâneo';
}

let grading = false;
async function grade(q) {
  if (grading) return;
  grading = true;
  try {
    const s = session;
    const { id, type } = s.queue.shift();
    const item = { ...s.items.get(id) };
    const t = srs.today();
    item.cards = { ...item.cards, [type]: srs.review(item.cards[type], q, t) };
    if (!item.introducedOn) item.introducedOn = t;
    if (type === 'production' && q >= 3 && item.status === 'recognize') {
      item.status = 'produced';
      item.producedAt = t;
    }
    const saved = await storage.saveItem(item);
    s.items.set(id, saved);
    if (q < 3) s.queue.push({ id, type }); // errou: volta no fim da sessão
    else s.done += 1;
    showCard();
  } finally {
    grading = false;
  }
}

function renderDone() {
  document.onkeydown = null;
  view.innerHTML = `
    <section class="panel empty">
      <h2>Sessão concluída</h2>
      <p class="muted">${session.done} cartões revisados.</p>
      <a class="btn primary" href="#/">Voltar ao início</a>
    </section>`;
}

async function markSpontaneous(item) {
  return storage.saveItem({ ...item, status: 'spontaneous', spontaneousAt: srs.today() });
}

/* ---------------- Adicionar ---------------- */

function langSelect(name, value) {
  return `<div class="seg" role="radiogroup">
    ${LANG_KEYS.map(
      (l) => `<label><input type="radio" name="${name}" value="${l}" ${l === value ? 'checked' : ''}><span>${LANGS[l].code}</span></label>`
    ).join('')}
  </div>`;
}

function itemFields(it = {}) {
  return FIELDS.map(([k, label, ph]) => {
    const multi = k !== 'item' && k !== 'source';
    const attrs = `name="${k}" id="f-${k}" placeholder="${esc(ph)}" ${k === 'item' ? 'required' : ''}`;
    return `<label class="field" for="f-${k}"><span>${label}</span>${
      multi ? `<textarea ${attrs} rows="2">${esc(it[k])}</textarea>` : `<input ${attrs} value="${esc(it[k])}" autocomplete="off">`
    }</label>`;
  }).join('');
}

function readForm(form) {
  const fd = new FormData(form);
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
}

let lastLang = 'en';

async function viewAdd(mode = 'one') {
  const tabs = `
    <div class="tabs">
      <a href="#/add/one" class="${mode === 'one' ? 'active' : ''}">Um item</a>
      <a href="#/add/bulk" class="${mode === 'bulk' ? 'active' : ''}">Colar vários</a>
    </div>`;

  if (mode === 'bulk') {
    view.innerHTML = `${tabs}
      <section class="panel">
        <p class="muted">Um item por linha, campos separados por <code>|</code>, nesta ordem:</p>
        <pre class="format">idioma | item | definição | frase original | minha frase | vizinhas | fonte</pre>
        <p class="muted small">O idioma (EN, ES ou RU) é opcional: sem ele, uso o idioma escolhido abaixo. Só <em>item</em> e <em>definição</em> (ou <em>minha frase</em>) são obrigatórios; campos vazios podem ficar em branco entre as barras.</p>
        <form id="bulk">
          <div class="field"><span>Idioma padrão</span>${langSelect('lang', lastLang)}</div>
          <textarea name="text" rows="10" placeholder="EN | make up my mind | decidir | I can't make up my mind. | I finally made up my mind… | decide, settle on | podcast"></textarea>
          <button class="btn primary block" type="submit">Adicionar linhas</button>
        </form>
        <div id="bulk-result"></div>
      </section>`;
    $('#bulk').onsubmit = onBulk;
    return;
  }

  view.innerHTML = `${tabs}
    <form class="panel" id="one">
      <div class="field"><span>Idioma</span>${langSelect('lang', lastLang)}</div>
      ${itemFields()}
      <button class="btn primary block" type="submit">Salvar</button>
    </form>`;
  $('#one').onsubmit = async (e) => {
    e.preventDefault();
    const f = readForm(e.target);
    if (!f.definition && !f.mySentence) return toast('Preencha a definição ou a minha frase.');
    const existing = await storage.listItems();
    if (existing.some((i) => i.lang === f.lang && i.item.toLowerCase() === f.item.toLowerCase()) &&
        !confirm('Já existe um item igual neste idioma. Salvar mesmo assim?')) return;
    await storage.addItems([newItem(f)]);
    lastLang = f.lang;
    e.target.reset();
    e.target.querySelector(`input[value="${f.lang}"]`).checked = true;
    $('#f-item').focus();
    toast('Item salvo');
  };
}

async function onBulk(e) {
  e.preventDefault();
  const form = e.target;
  const defLang = new FormData(form).get('lang');
  lastLang = defLang;
  const existing = await storage.listItems();
  const seen = new Set(existing.map((i) => `${i.lang}|${i.item.toLowerCase()}`));
  const ok = [];
  const bad = [];
  const dup = [];
  const lines = form.text.value.split(/\r?\n/);

  lines.forEach((line, n) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const parts = line.split('|').map((p) => p.trim());
    let lang = defLang;
    if (LANGS[parts[0]?.toLowerCase()]) lang = parts.shift().toLowerCase();
    const [item = '', definition = '', originalSentence = '', mySentence = '', nuance = '', source = ''] = parts;
    if (!item || (!definition && !mySentence)) {
      bad.push({ n: n + 1, line, why: !item ? 'sem item' : 'sem definição nem minha frase' });
      return;
    }
    const key = `${lang}|${item.toLowerCase()}`;
    if (seen.has(key)) {
      dup.push({ n: n + 1, line });
      return;
    }
    seen.add(key);
    ok.push(newItem({ lang, item, definition, originalSentence, mySentence, nuance, source }));
  });

  if (ok.length) await storage.addItems(ok);
  // deixa no campo só as linhas com problema, para corrigir
  form.text.value = bad.map((b) => b.line).join('\n');
  $('#bulk-result').innerHTML = `
    <p class="ok">${ok.length} ${ok.length === 1 ? 'item adicionado' : 'itens adicionados'}.</p>
    ${dup.length ? `<p class="muted">${dup.length} ignorado(s) por já existirem: ${dup.map((d) => `linha ${d.n}`).join(', ')}.</p>` : ''}
    ${bad.length ? `<p class="warn">${bad.length} linha(s) com problema (mantidas no campo acima):</p>
      <ul class="errors">${bad.map((b) => `<li>Linha ${b.n}: ${b.why}</li>`).join('')}</ul>` : ''}`;
}

/* ---------------- Itens (lista) ---------------- */

const listState = { lang: 'all', q: '' };

async function viewItems() {
  const items = await storage.listItems();
  view.innerHTML = `
    <div class="list-tools">
      <input type="search" id="q" placeholder="Buscar…" value="${esc(listState.q)}">
      <div class="chips">
        ${['all', ...LANG_KEYS].map((l) => `<button data-l="${l}" class="${listState.lang === l ? 'active' : ''}">${l === 'all' ? 'Todos' : LANGS[l].code}</button>`).join('')}
      </div>
    </div>
    <ul class="item-list" id="list"></ul>`;

  const draw = () => {
    const q = listState.q.toLowerCase();
    const shown = items
      .filter((i) => listState.lang === 'all' || i.lang === listState.lang)
      .filter((i) => !q || [i.item, i.definition, i.mySentence, i.source].some((x) => (x || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    $('#list').innerHTML = shown.length
      ? shown
          .map(
            (i) => `
        <li><a href="#/edit/${encodeURIComponent(i.id)}">
          <div class="row1">${langPill(i.lang)} <strong>${esc(i.item)}</strong></div>
          <div class="row2"><span class="muted ellipsis">${esc(i.definition || i.mySentence)}</span></div>
          <div class="row3">${statusPill(i.status)}<span class="muted small">próx.: ${fmtDate(srs.nextReview(i))}</span></div>
        </a></li>`
          )
          .join('')
      : `<li class="muted center pad">Nenhum item.</li>`;
  };
  draw();
  $('#q').oninput = (e) => {
    listState.q = e.target.value;
    draw();
  };
  view.querySelectorAll('.chips button').forEach(
    (b) =>
      (b.onclick = () => {
        listState.lang = b.dataset.l;
        view.querySelectorAll('.chips button').forEach((x) => x.classList.toggle('active', x === b));
        draw();
      })
  );
}

/* ---------------- Editar ---------------- */

async function viewEdit(id) {
  const item = await storage.getItem(id);
  if (!item) {
    location.hash = '#/items';
    return;
  }
  view.innerHTML = `
    <a class="back-link" href="#/items">← Itens</a>
    <form class="panel" id="edit">
      <div class="field"><span>Idioma</span>${langSelect('lang', item.lang)}</div>
      ${itemFields(item)}
      <label class="field"><span>Status</span>
        <select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === item.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>
      <p class="muted small">Próxima revisão: <strong>${fmtDate(srs.nextReview(item))}</strong>
        ${item.spontaneousAt ? ` · usado espontaneamente em ${fmtDate(item.spontaneousAt) === 'hoje' ? 'hoje' : item.spontaneousAt.split('-').reverse().join('/')}` : ''}</p>
      <button class="btn ghost block" type="button" id="spont">${spontLabel(item)}</button>
      <button class="btn primary block" type="submit">Salvar alterações</button>
      <button class="btn danger block" type="button" id="del">Excluir item</button>
    </form>`;

  $('#spont').onclick = async () => {
    await markSpontaneous(item);
    toast('Marcado como usado espontaneamente hoje');
    viewEdit(id);
  };
  $('#del').onclick = async () => {
    if (!confirm(`Excluir "${item.item}"? Isso não pode ser desfeito.`)) return;
    await storage.deleteItem(id);
    toast('Item excluído');
    location.hash = '#/items';
  };
  $('#edit').onsubmit = async (e) => {
    e.preventDefault();
    const f = readForm(e.target);
    if (!f.item) return toast('O item não pode ficar vazio.');
    if (!f.definition && !f.mySentence) return toast('Preencha a definição ou a minha frase.');
    const next = { ...item, ...f, cards: { ...item.cards } };
    if (next.lang === 'ru' && !next.cards.reading) next.cards.reading = srs.newCard();
    if (next.lang !== 'ru') delete next.cards.reading;
    if (next.status === 'produced' && !next.producedAt) next.producedAt = srs.today();
    if (next.status === 'spontaneous' && !next.spontaneousAt) next.spontaneousAt = srs.today();
    if (next.status !== 'spontaneous') next.spontaneousAt = null;
    await storage.saveItem(next);
    toast('Alterações salvas');
    location.hash = '#/items';
  };
}

/* ---------------- Ajustes ---------------- */

async function viewSettings() {
  const items = await storage.listItems();
  let persisted = null;
  try {
    persisted = await navigator.storage?.persisted?.();
  } catch { /* indisponível */ }

  view.innerHTML = `
    <section class="panel">
      <h2>Itens novos por dia</h2>
      <div class="limits">
        ${LANG_KEYS.map(
          (l) => `<label class="field"><span>${langPill(l)} ${LANGS[l].label}</span>
            <input type="number" min="0" max="100" inputmode="numeric" data-lang="${l}" value="${settings.newPerDay[l]}"></label>`
        ).join('')}
      </div>
    </section>

    <section class="panel">
      <h2>Aparência</h2>
      <div class="seg" id="theme">
        ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']]
          .map(([v, t]) => `<label><input type="radio" name="theme" value="${v}" ${settings.theme === v ? 'checked' : ''}><span>${t}</span></label>`)
          .join('')}
      </div>
    </section>

    <section class="panel">
      <h2>Backup</h2>
      <p class="muted small">Os dados ficam só neste aparelho (${items.length} itens).
        ${persisted === true ? 'O navegador marcou o armazenamento como persistente.' : persisted === false ? 'O navegador pode apagar dados se faltar espaço: exporte com frequência.' : ''}</p>
      <button class="btn primary block" id="export">Exportar backup (JSON)</button>
      <div class="field"><span>Ao importar</span>
        <div class="seg">
          <label><input type="radio" name="imode" value="merge" checked><span>Mesclar</span></label>
          <label><input type="radio" name="imode" value="replace"><span>Substituir tudo</span></label>
        </div>
      </div>
      <label class="btn ghost block file-btn">Importar backup…<input type="file" id="import" accept="application/json,.json" hidden></label>
    </section>`;

  view.querySelectorAll('[data-lang]').forEach(
    (inp) =>
      (inp.onchange = async () => {
        const n = Math.max(0, Math.min(100, parseInt(inp.value, 10) || 0));
        inp.value = n;
        settings = await storage.saveSettings({ ...settings, newPerDay: { ...settings.newPerDay, [inp.dataset.lang]: n } });
        toast('Limite salvo');
      })
  );
  view.querySelectorAll('input[name="theme"]').forEach(
    (r) =>
      (r.onchange = async () => {
        settings = await storage.saveSettings({ ...settings, theme: r.value });
        applyTheme();
      })
  );
  $('#export').onclick = exportBackup;
  $('#import').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const mode = view.querySelector('input[name="imode"]:checked').value;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.items)) throw new Error('arquivo não parece um backup deste app');
      const clean = data.items.map(normalizeItem).filter(Boolean);
      const msg =
        mode === 'replace'
          ? `Substituir TODOS os ${items.length} itens atuais pelos ${clean.length} do backup?`
          : `Mesclar ${clean.length} itens do backup com os atuais?`;
      if (!confirm(msg)) return;
      const r = await storage.importBackup({ ...data, items: clean }, { mode });
      settings = await storage.getSettings();
      applyTheme();
      toast(`${r.written} itens gravados${r.skipped ? `, ${r.skipped} já estavam atualizados` : ''}`);
      viewSettings();
    } catch (err) {
      alert('Não foi possível importar: ' + err.message);
    }
  };
}

async function exportBackup() {
  const data = await storage.exportBackup();
  const name = `vocab-backup-${srs.today()}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  // No celular, o menu de compartilhar permite salvar no Drive/Arquivos
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- início ---------------- */

async function start() {
  await storage.init();
  settings = await storage.getSettings();
  applyTheme();
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

start().catch((err) => {
  view.innerHTML = `<div class="panel"><p>Não foi possível abrir o banco de dados: ${esc(err.message)}</p></div>`;
});
