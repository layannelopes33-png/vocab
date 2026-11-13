/**
 * mascot.js — a Ervilha, mascote do app, desenhada em SVG.
 * mascot(mood, size) devolve uma string <svg>.
 * Humores: 'neutral' | 'happy' | 'cheer' | 'sleep' | 'think' | 'oops'
 */

let n = 0;

const C = {
  line: '#24481a',
  leaf: '#7cc142',
  leafDark: '#5a9e2f',
  cheek: '#ff9a8a',
  accent: '#ff8a3d',
};

const EYE_Y = 47;

const EYES = {
  open: (x) => `
    <ellipse cx="${x}" cy="${EYE_Y}" rx="5.6" ry="7.6" fill="${C.line}"/>
    <circle cx="${x + 1.8}" cy="${EYE_Y - 3}" r="2.2" fill="#fff"/>`,
  happy: (x) => `<path d="M${x - 6.5} ${EYE_Y + 2} Q${x} ${EYE_Y - 8} ${x + 6.5} ${EYE_Y + 2}" fill="none" stroke="${C.line}" stroke-width="3.8" stroke-linecap="round"/>`,
  closed: (x) => `<path d="M${x - 6.5} ${EYE_Y} Q${x} ${EYE_Y + 6} ${x + 6.5} ${EYE_Y}" fill="none" stroke="${C.line}" stroke-width="3.6" stroke-linecap="round"/>`,
};

/** Sorriso largo com dentes (estilo desenho animado antigo). */
function grin(id, x1, x2, top, bottom) {
  const mid = (x1 + x2) / 2;
  const shape = `M${x1} ${top} Q${mid} ${top + 4} ${x2} ${top} Q${x2 - 1} ${bottom} ${mid} ${bottom} Q${x1 + 1} ${bottom} ${x1} ${top} Z`;
  const step = (x2 - x1) / 6;
  let teeth = '';
  for (let i = 1; i < 6; i++) {
    const x = x1 + step * i;
    teeth += `<path d="M${x} ${top - 2} L${x} ${bottom + 2}"/>`;
  }
  return `
    <clipPath id="${id}-m"><path d="${shape}"/></clipPath>
    <path d="${shape}" fill="#fff"/>
    <g clip-path="url(#${id}-m)" stroke="${C.line}" stroke-width="1.8">${teeth}</g>
    <path d="${shape}" fill="none" stroke="${C.line}" stroke-width="3" stroke-linejoin="round"/>`;
}

const MOUTH = {
  big: (id) => grin(id, 41, 79, 62, 82),
  small: (id) => grin(id, 46, 74, 63, 77),
  nervous: (id) => grin(id, 47, 73, 64, 74),
  o: () => `<ellipse cx="60" cy="68" rx="3.4" ry="3.8" fill="${C.line}"/>`,
  flat: () => `<path d="M52 68 Q60 66 68 68" fill="none" stroke="${C.line}" stroke-width="3.2" stroke-linecap="round"/>`,
};

const EXTRA = {
  sparkles: `
    <g stroke="${C.accent}" stroke-width="3" stroke-linecap="round">
      <path d="M100 30 l6 -6"/><path d="M104 40 l8 -1"/><path d="M96 22 l1 -8"/>
    </g>`,
  confetti: `
    <rect x="10" y="22" width="6" height="6" rx="1.5" fill="${C.accent}" transform="rotate(20 13 25)"/>
    <rect x="102" y="18" width="6" height="6" rx="1.5" fill="#3d7be0" transform="rotate(-15 105 21)"/>
    <circle cx="16" cy="44" r="3" fill="#c6e85b"/>
    <circle cx="108" cy="44" r="3" fill="${C.accent}"/>
    <rect x="98" y="4" width="5" height="5" rx="1.5" fill="#8a5cd6"/>`,
  zzz: `<text x="90" y="28" font-family="Poppins, sans-serif" font-weight="700" font-size="16" fill="${C.line}" opacity=".7">z<tspan font-size="12" dy="-8">z</tspan></text>`,
  question: `<text x="96" y="32" font-family="Poppins, sans-serif" font-weight="800" font-size="24" fill="${C.accent}">?</text>`,
  drop: `<path d="M88 34 q4 6 0 9 q-4 -3 0 -9z" fill="#7cc6ff"/>`,
};

const MOODS = {
  neutral: { eyes: 'open', mouth: 'small', arms: 'down' },
  happy: { eyes: 'happy', mouth: 'big', arms: 'down', extra: 'sparkles' },
  cheer: { eyes: 'happy', mouth: 'big', arms: 'up', extra: 'confetti' },
  sleep: { eyes: 'closed', mouth: 'o', arms: 'down', extra: 'zzz' },
  think: { eyes: 'open', mouth: 'flat', arms: 'down', extra: 'question' },
  oops: { eyes: 'open', mouth: 'nervous', arms: 'down', extra: 'drop' },
};

export function mascot(mood = 'neutral', size = 96) {
  const m = MOODS[mood] || MOODS.neutral;
  const id = `ervilha${++n}`;
  const arm = (cx, cy, rot) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="5.5" fill="${C.leaf}" stroke="${C.line}" stroke-width="2.6" transform="rotate(${rot} ${cx} ${cy})"/>`;
  const arms = m.arms === 'up' ? arm(22, 36, -50) + arm(98, 36, 50) : arm(24, 70, 30) + arm(96, 70, -30);

  return `<svg class="mascot mascot-${mood}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Ervilha, a mascote">
  <defs>
    <radialGradient id="${id}" cx="36%" cy="30%" r="78%">
      <stop offset="0" stop-color="#e6f8a4"/>
      <stop offset=".45" stop-color="#9ed654"/>
      <stop offset="1" stop-color="#4f9a2c"/>
    </radialGradient>
  </defs>
  <ellipse cx="60" cy="113" rx="26" ry="4" fill="#000" opacity=".12"/>
  <!-- pezinhos de folha e caule -->
  <ellipse cx="48" cy="106" rx="13" ry="5.5" fill="${C.leafDark}" stroke="${C.line}" stroke-width="2.6" transform="rotate(-8 48 106)"/>
  <ellipse cx="72" cy="106" rx="13" ry="5.5" fill="${C.leafDark}" stroke="${C.line}" stroke-width="2.6" transform="rotate(8 72 106)"/>
  <rect x="55.5" y="84" width="9" height="21" rx="4" fill="${C.leafDark}" stroke="${C.line}" stroke-width="2.6"/>
  <!-- gavinha enroladinha e folhinha no topo -->
  <path d="M60 24 C60 16 63 10 69 9 C75 8 78 14 74 17 C71 19 68 16 70 14" fill="none" stroke="${C.line}" stroke-width="5.4" stroke-linecap="round"/>
  <path d="M60 24 C60 16 63 10 69 9 C75 8 78 14 74 17 C71 19 68 16 70 14" fill="none" stroke="${C.leaf}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M58 23 C52 12 40 11 35 17 C42 25 51 26 58 23Z" fill="${C.leaf}" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M57 22 C50 18 44 17 39 17" fill="none" stroke="${C.line}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
  ${arms}
  <!-- corpo: ervilha redondinha -->
  <circle cx="60" cy="55" r="34" fill="url(#${id})" stroke="${C.line}" stroke-width="3"/>
  <ellipse cx="44" cy="34" rx="8.5" ry="4.5" fill="#fff" opacity=".5" transform="rotate(-30 44 34)"/>
  ${EYES[m.eyes](47)}${EYES[m.eyes](73)}
  <ellipse cx="32" cy="60" rx="5" ry="3" fill="${C.cheek}" opacity=".75"/>
  <ellipse cx="88" cy="60" rx="5" ry="3" fill="${C.cheek}" opacity=".75"/>
  ${MOUTH[m.mouth](id)}
  ${m.extra ? EXTRA[m.extra] : ''}
</svg>`;
}
