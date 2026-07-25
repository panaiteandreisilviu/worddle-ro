/** Romanian diacritic groups: same group → violet feedback */
export const DIACRITIC_GROUPS = [
  new Set(["a", "ă", "â"]),
  new Set(["i", "î"]),
  new Set(["s", "ș"]),
  new Set(["t", "ț"]),
];

const BASE_OF = (() => {
  const map = {};
  for (const group of DIACRITIC_GROUPS) {
    const base = [...group][0];
    for (const ch of group) map[ch] = base;
  }
  return map;
})();

export const stripDiacritics = (s) =>
  [...s.toLowerCase()].map((c) => BASE_OF[c] ?? c).join("");

export const sameGroup = (a, b) => {
  if (a === b) return true;
  for (const g of DIACRITIC_GROUPS) {
    if (g.has(a) && g.has(b)) return true;
  }
  return false;
};

/** Higher rank wins when collapsing board info onto a single keyboard key. */
export const STATUS_RANK = {
  correct: 4,
  present: 3,
  diacritic: 2,
  absent: 1,
};
