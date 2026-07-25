import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GuessColoring } from "../js/guess-coloring.js";
import { HELP_EXAMPLES } from "../js/help-examples.js";

const coloring = new GuessColoring();

function loadDict(len) {
  return new Set(
    readFileSync(new URL(`../ro_RO/${len}.txt`, import.meta.url), "utf8")
      .split(/\n/)
      .filter(Boolean)
  );
}

const hasBadge = (tile, status) => tile.badges.some((b) => b.status === status);

const FOCUS_CHECKS = {
  "Verde — loc corect": (t) => t.status === "correct" && t.badges.length === 0,
  "Galben — altă poziție": (t) => t.status === "present" && t.badges.length === 0,
  "Violet — diacritic pe loc": (t) =>
    t.status === "diacritic" && t.badges.length === 0,
  "Gri — absent": (t) => t.status === "absent" && t.badges.length === 0,
  "Gri + badge violet": (t) =>
    t.status === "absent" && hasBadge(t, "diacritic") && !hasBadge(t, "present"),
  "Galben + badge galben": (t) => t.status === "present" && hasBadge(t, "present"),
  "Galben + badge violet": (t) =>
    t.status === "present" && hasBadge(t, "diacritic") && !hasBadge(t, "present"),
  "Violet + badge galben": (t) =>
    t.status === "diacritic" && hasBadge(t, "present") && !hasBadge(t, "diacritic"),
  "Violet + badge violet": (t) =>
    t.status === "diacritic" && hasBadge(t, "diacritic") && !hasBadge(t, "present"),
  "Violet + badge-uri galben și violet": (t) =>
    t.status === "diacritic" && hasBadge(t, "present") && hasBadge(t, "diacritic"),
  "Verde + badge galben": (t) =>
    t.status === "correct" && hasBadge(t, "present") && !hasBadge(t, "diacritic"),
  "Verde + badge violet": (t) =>
    t.status === "correct" && hasBadge(t, "diacritic") && !hasBadge(t, "present"),
  "Verde + badge-uri galben și violet": (t) =>
    t.status === "correct" && hasBadge(t, "present") && hasBadge(t, "diacritic"),
  "Galben + badge-uri galben și violet": (t) =>
    t.status === "present" && hasBadge(t, "present") && hasBadge(t, "diacritic"),
};

describe("HELP_EXAMPLES", () => {
  it("covers every documented coloring case", () => {
    expect(HELP_EXAMPLES.map((ex) => ex.title).sort()).toEqual(
      Object.keys(FOCUS_CHECKS).sort()
    );
  });

  for (const ex of HELP_EXAMPLES) {
    describe(ex.title, () => {
      it("uses real dictionary words of matching length", () => {
        expect(ex.guess.length).toBe(ex.answer.length);
        const dict = loadDict(ex.guess.length);
        expect(dict.has(ex.guess)).toBe(true);
        expect(dict.has(ex.answer)).toBe(true);
      });

      it("focus tile matches the case", () => {
        const tile = coloring.evaluate(ex.guess, ex.answer, true)[ex.focus];
        expect(FOCUS_CHECKS[ex.title](tile)).toBe(true);
      });
    });
  }
});
