import { sameGroup } from "./diacritics.js";

/**
 * Board tile coloring: one solid status per position, plus elsewhere badges.
 *
 * Status (this position only):
 * - correct (green): exact match here
 * - diacritic (purple): same diacritic group here, wrong form
 * - present (yellow): exact letter elsewhere (no frequency cap)
 * - absent (gray): none of the above
 *
 * Badges (other positions only):
 * - present +N: other exact matches (on yellow tiles, N is extras beyond the first)
 * - diacritic +N: other same-group non-exact matches
 */
export class GuessColoring {
  /**
   * @param {string} guess
   * @param {string} answer
   * @param {boolean} useDiacritics
   * @returns {{ status: string, badges: { status: string, count: number }[] }[]}
   */
  evaluate(guess, answer, useDiacritics) {
    if (guess.length !== answer.length) {
      throw new Error(
        `Guess length (${guess.length}) must match answer length (${answer.length})`
      );
    }

    const n = guess.length;
    return Array.from({ length: n }, (_, i) => {
      const g = guess[i];
      let exactElsewhere = 0;
      let relatedElsewhere = 0;

      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        if (g === answer[j]) {
          exactElsewhere++;
        } else if (useDiacritics && sameGroup(g, answer[j])) {
          relatedElsewhere++;
        }
      }

      let status;
      if (g === answer[i]) {
        status = "correct";
      } else if (useDiacritics && sameGroup(g, answer[i])) {
        status = "diacritic";
      } else if (exactElsewhere > 0) {
        status = "present";
      } else {
        status = "absent";
      }

      const badges = [];
      if (status === "present") {
        const extra = exactElsewhere - 1;
        if (extra > 0) badges.push({ status: "present", count: extra });
      } else if (exactElsewhere > 0) {
        badges.push({ status: "present", count: exactElsewhere });
      }
      if (relatedElsewhere > 0) {
        badges.push({ status: "diacritic", count: relatedElsewhere });
      }

      return { status, badges };
    });
  }
}
