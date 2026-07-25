import { STATUS_RANK } from "./diacritics.js";

/**
 * Keyboard key coloring: each key keeps a single highest-rank status.
 * Rank: correct > present > diacritic > absent.
 */
export class KeyboardColoring {
  constructor() {
    /** @type {Record<string, string>} */
    this.keyStatus = {};
  }

  reset() {
    this.keyStatus = {};
  }

  /**
   * @param {string} letter
   * @param {string} status
   */
  upgrade(letter, status) {
    const prev = this.keyStatus[letter];
    if (!prev || STATUS_RANK[status] > STATUS_RANK[prev]) {
      this.keyStatus[letter] = status;
    }
  }

  /**
   * Apply one guess row: tile status plus each badge status for that letter.
   * @param {string} guess
   * @param {{ status: string, badges: { status: string }[] }[]} results
   */
  applyGuessResults(guess, results) {
    if (guess.length !== results.length) {
      throw new Error(
        `Guess length (${guess.length}) must match results length (${results.length})`
      );
    }
    for (let i = 0; i < guess.length; i++) {
      const { status, badges } = results[i];
      this.upgrade(guess[i], status);
      for (const badge of badges) {
        this.upgrade(guess[i], badge.status);
      }
    }
  }

  /** @param {string} letter */
  getStatus(letter) {
    return this.keyStatus[letter] ?? null;
  }

  /** @returns {Readonly<Record<string, string>>} */
  getAll() {
    return { ...this.keyStatus };
  }
}
