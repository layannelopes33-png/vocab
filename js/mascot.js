/**
 * mascot.js — o Broto, mascote do app, desenhado em SVG.
 * mascot(mood, size) devolve uma string <svg>.
 * Humores: 'neutral' | 'happy' | 'cheer' | 'sleep' | 'think' | 'oops'
 */

let n = 0;

const C = {
  line: '#2f5d1e',
  leaf: '#7cc142',
  leafDark: '#5a9e2f',
  cheek: '#ff9a8a',
  accent: '#ff8a3d',
};

const EYES = {
  open: (x) => `
    <ellipse cx="${x}" cy="58" rx="5.2" ry="7" fill="${C.line}"/>
    <circle cx="${x + 1.6}" cy="55.2" r="2" fill="#fff"/>`,
  happy: (x) => `<path d="M${x - 6} 60 Q${x} 51 ${x + 6} 60" fill="none" stroke="${C.line}" stroke-width="3.6" stroke-linecap="round"/>`,
  closed: (x) => `<path d="M${x - 6} 58 Q${x} 64 ${x + 6} 58" fill="none" stroke="${C.line}" stroke-width="3.4" stroke-linecap="round"/>`,
};

const MOUTH = {
  smile: `<path d="M53 71 Q60 77 67 71" fill="none" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>`,
  open: `<path d="M51 69 Q60 83 69 69 Z" fill="${C.line}"/><path d="M55 74 Q60 79 65 74" fill="${C.cheek}"/>`,
  o: `<ellipse cx="60" cy="73" rx="3" ry="3.4" fill="${C.line}"/>`,
  flat: `<path d="M54 73 Q60 71 66 73" fill="none" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>`,
  wobble: `<path d="M52 74 Q56 70 60 74 Q64 78 68 74" fill="none" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>`,
};

const EXTRA = {
  sparkles: `
    <g stroke="${C.accent}" stroke-width="3" stroke-linecap="round">
      <path d="M100 30 l6 -6"/><path d="M104 40 l8 -1"/><path d="M96 22 l1 -8"/>
    </g>`,
  confetti: `
    <rect x="10" y="22" width="6" height="6" rx="1.5" fill="${C.accent}" transform="rotate(20 13 25)"/>
    <rect x="102" y="18" width="6" height="6" rx="1.5" fill="#3d7be0" transform="rotate(-15 105 21)"/>
    <circle cx="18" cy="44" r="3" fill="#c6e85b"/>
    <circle cx="106" cy="42" r="3" fill="${C.accent}"/>
    <rect x="96" y="4" width="5" height="5" rx="1.5" fill="#8a5cd6"/>`,
  zzz: `<text x="88" y="30" font-family="Poppins, sans-serif" font-weight="700" font-size="16" fill="${C.line}" opacity=".7">z<tspan font-size="12" dy="-8">z</tspan></text>`,
  question: `<text x="94" y="34" font-family="Poppins, sans-serif" font-weight="800" font-size="24" fill="${C.accent}">?</text>`,
  drop: `<path d="M83 50 q4 6 0 9 q-4 -3 0 -9z" fill="#7cc6ff"/>`,
};

const MOODS = {
  neutral: { eyes: 'open', mouth: 'smile', arms: 'down' },
  happy: { eyes: 'happy', mouth: 'open', arms: 'down', extra: 'sparkles' },
  cheer: { eyes: 'happy', mouth: 'open', arms: 'up', extra: 'confetti' },
  sleep: { eyes: 'closed', mouth: 'o', arms: 'down', extra: 'zzz' },
  think: { eyes: 'open', mouth: 'flat', arms: 'down', extra: 'question' },
  oops: { eyes: 'open', mouth: 'wobble', arms: 'down', extra: 'drop' },
};

export function mascot(mood = 'neutral', size = 96) {
  const m = MOODS[mood] || MOODS.neutral;
  const id = `broto${++n}`;
  const arm = (cx, cy, rot) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="5.5" fill="${C.leaf}" stroke="${C.line}" stroke-width="2.6" transform="rotate(${rot} ${cx} ${cy})"/>`;
  const arms = m.arms === 'up' ? arm(23, 46, -45) + arm(97, 46, 45) : arm(25, 72, 30) + arm(95, 72, -30);

  return `<svg class="mascot mascot-${mood}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Broto, o mascote">
  <defs>
    <radialGradient id="${id}" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#e3f79a"/>
      <stop offset=".45" stop-color="#9ad44f"/>
      <stop offset="1" stop-color="#5a9e2f"/>
    </radialGradient>
  </defs>
  <ellipse cx="60" cy="113" rx="28" ry="4" fill="#000" opacity=".12"/>
  <ellipse cx="47" cy="106" rx="14" ry="6" fill="${C.leafDark}" stroke="${C.line}" stroke-width="2.6" transform="rotate(-8 47 106)"/>
  <ellipse cx="73" cy="106" rx="14" ry="6" fill="${C.leafDark}" stroke="${C.line}" stroke-width="2.6" transform="rotate(8 73 106)"/>
  <rect x="55" y="88" width="10" height="17" rx="4" fill="${C.leafDark}" stroke="${C.line}" stroke-width="2.6"/>
  <path d="M60 30 Q59 22 60 15" fill="none" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>
  <path d="M60 30 Q59 22 60 15" fill="none" stroke="${C.leafDark}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M60 16 C51 4 37 5 33 13 C42 21 53 21 60 16Z" fill="${C.leaf}" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M60 14 C68 1 84 1 89 9 C81 18 68 19 60 14Z" fill="#9ad44f" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round"/>
  ${arms}
  <path d="M60 26 C85 26 97 44 97 62 C97 83 80 95 60 95 C40 95 23 83 23 62 C23 44 35 26 60 26Z" fill="url(#${id})" stroke="${C.line}" stroke-width="3"/>
  <ellipse cx="45" cy="40" rx="8" ry="4.5" fill="#fff" opacity=".45" transform="rotate(-25 45 40)"/>
  ${EYES[m.eyes](47)}${EYES[m.eyes](73)}
  <ellipse cx="38" cy="70" rx="6" ry="3.5" fill="${C.cheek}" opacity=".7"/>
  <ellipse cx="82" cy="70" rx="6" ry="3.5" fill="${C.cheek}" opacity=".7"/>
  ${MOUTH[m.mouth]}
  ${m.extra ? EXTRA[m.extra] : ''}
</svg>`;
}
