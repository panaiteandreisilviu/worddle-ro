import { describe, expect, it } from "vitest";
import { GuessColoring } from "../js/guess-coloring.js";

const coloring = new GuessColoring();

/** @param {{ status: string, badges: { status: string, count: number }[] }} tile */
function tile(status, badges = []) {
  return { status, badges };
}

describe("GuessColoring.evaluate", () => {
  describe("basic statuses", () => {
    it("marks exact position matches as correct (green)", () => {
      expect(coloring.evaluate("carte", "carte", true)).toEqual([
        tile("correct"),
        tile("correct"),
        tile("correct"),
        tile("correct"),
        tile("correct"),
      ]);
    });

    it("marks exact letter elsewhere as present (yellow)", () => {
      const results = coloring.evaluate("aerat", "maree", true);
      expect(results[0]).toEqual(tile("present")); // A elsewhere
    });

    it("marks total misses as absent (gray)", () => {
      const results = coloring.evaluate("noroc", "carte", true);
      expect(results[0]).toEqual(tile("absent")); // N
    });

    it("marks same-group wrong form on this slot as diacritic (purple)", () => {
      const results = coloring.evaluate("parte", "pâine", true);
      expect(results[1]).toEqual(tile("diacritic")); // A vs Â
    });
  });

  describe("no frequency cap", () => {
    it("colors every matching letter yellow for ATTTT vs TAAAA", () => {
      const results = coloring.evaluate("atttt", "taaaa", false);
      expect(results.map((r) => r.status)).toEqual([
        "present",
        "present",
        "present",
        "present",
        "present",
      ]);
      // A has 4 exact elsewhere → yellow implies 1, badge +3
      expect(results[0]).toEqual(
        tile("present", [{ status: "present", count: 3 }])
      );
      // each T has exactly one T elsewhere → yellow, no badge
      expect(results[1]).toEqual(tile("present"));
      expect(results[2]).toEqual(tile("present"));
      expect(results[3]).toEqual(tile("present"));
      expect(results[4]).toEqual(tile("present"));
    });
  });

  describe("yellow badges (exact elsewhere)", () => {
    it("on yellow tiles, +N is extras beyond the first", () => {
      const results = coloring.evaluate("abbb", "baaa", false);
      // A at 0: exact elsewhere count 3 → present + badge +2
      expect(results[0]).toEqual(
        tile("present", [{ status: "present", count: 2 }])
      );
    });

    it("on green tiles, +N is the full elsewhere count", () => {
      const results = coloring.evaluate("axxxx", "axaaa", false);
      expect(results[0]).toEqual(
        tile("correct", [{ status: "present", count: 3 }])
      );
    });

    it("on purple tiles, +N is the full elsewhere count", () => {
      const results = coloring.evaluate("pastă", "tăiat", true);
      // A vs Ă at index 1, exact A at index 3
      expect(results[1]).toEqual(
        tile("diacritic", [{ status: "present", count: 1 }])
      );
    });

    it("omits yellow badge when yellow tile has only one elsewhere copy", () => {
      const results = coloring.evaluate("xaxxx", "axxxx", false);
      expect(results[1]).toEqual(tile("present"));
    });
  });

  describe("purple badges (related elsewhere)", () => {
    it("uses gray + purple badge when related form is only elsewhere", () => {
      const results = coloring.evaluate("abate", "pâine", true);
      expect(results[0]).toEqual(
        tile("absent", [{ status: "diacritic", count: 1 }])
      );
    });

    it("adds purple badge on yellow when related form is also elsewhere", () => {
      const results = coloring.evaluate("pastă", "tăiat", true);
      // Ă at end: exact Ă elsewhere + related A elsewhere
      expect(results[4]).toEqual(
        tile("present", [{ status: "diacritic", count: 1 }])
      );
    });

    it("does not count this-slot related form in purple badge", () => {
      const results = coloring.evaluate("parte", "pâine", true);
      // A vs Â here only — no elsewhere related/exact for A
      expect(results[1]).toEqual(tile("diacritic"));
    });

    it("can show both yellow and purple badges on a purple tile", () => {
      // a instead of ă here; exact a elsewhere; ă elsewhere
      const results = coloring.evaluate("axxxx", "ăxaăx", true);
      expect(results[0]).toEqual(
        tile("diacritic", [
          { status: "present", count: 1 },
          { status: "diacritic", count: 1 },
        ])
      );
    });
  });

  describe("diacritics disabled", () => {
    it("treats a and ă as unrelated", () => {
      const results = coloring.evaluate("parte", "pâine", false);
      expect(results[1]).toEqual(tile("absent")); // A vs Â, no diacritic mode
    });

    it("never emits purple status or badges", () => {
      const results = coloring.evaluate("abate", "pâine", false);
      for (const r of results) {
        expect(r.status).not.toBe("diacritic");
        expect(r.badges.every((b) => b.status !== "diacritic")).toBe(true);
      }
    });
  });

  describe("green with elsewhere info", () => {
    it("keeps green when exact here and related elsewhere", () => {
      const results = coloring.evaluate("axxxx", "axăxx", true);
      expect(results[0]).toEqual(
        tile("correct", [{ status: "diacritic", count: 1 }])
      );
    });

    it("keeps green when exact here and exact elsewhere", () => {
      const results = coloring.evaluate("axxxx", "axaxx", false);
      expect(results[0]).toEqual(
        tile("correct", [{ status: "present", count: 1 }])
      );
    });
  });

  describe("validation", () => {
    it("throws when guess and answer lengths differ", () => {
      expect(() => coloring.evaluate("abc", "abcd", false)).toThrow(/length/i);
    });
  });
});
