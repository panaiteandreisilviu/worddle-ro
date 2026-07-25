const SAVE_KEY = "wordle-ro-in-progress-v1";
const SAVE_VERSION = 1;

/**
 * @typedef {{
 *   version: number,
 *   language: string,
 *   letterCount: number,
 *   difficulty: string,
 *   diaMode: "on" | "soft" | "off",
 *   answer: string,
 *   forcedAnswer: string | null,
 *   row: number,
 *   col: number,
 *   guesses: { word: string, results: object[] }[],
 *   partial: string,
 *   roundStartedAt: number,
 *   savedAt: number,
 * }} GameSave
 */

/** @returns {GameSave | null} */
export function readGameSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!isValidSave(data)) {
      clearGameSave();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** @param {GameSave} data */
export function writeGameSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to save game progress", err);
  }
}

export function clearGameSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** @param {unknown} data */
function isValidSave(data) {
  if (!data || typeof data !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (data);
  if (s.version !== SAVE_VERSION) return false;
  if (typeof s.answer !== "string" || !s.answer) return false;
  if (typeof s.letterCount !== "number") return false;
  if (typeof s.difficulty !== "string") return false;
  if (s.diaMode !== "on" && s.diaMode !== "soft" && s.diaMode !== "off") {
    return false;
  }
  if (!Array.isArray(s.guesses)) return false;
  if (typeof s.row !== "number" || typeof s.col !== "number") return false;
  if (typeof s.partial !== "string") return false;
  if (typeof s.roundStartedAt !== "number") return false;
  return true;
}
