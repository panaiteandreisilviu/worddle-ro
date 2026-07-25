import { beforeEach, describe, expect, it } from "vitest";
import { GuessColoring } from "../js/guess-coloring.js";
import { KeyboardColoring } from "../js/keyboard-coloring.js";

const guessColoring = new GuessColoring();

describe("KeyboardColoring", () => {
  /** @type {KeyboardColoring} */
  let keyboard;

  beforeEach(() => {
    keyboard = new KeyboardColoring();
  });

  describe("upgrade rank", () => {
    it("stores the first status for a letter", () => {
      keyboard.upgrade("a", "absent");
      expect(keyboard.getStatus("a")).toBe("absent");
    });

    it("upgrades absent → diacritic → present → correct", () => {
      keyboard.upgrade("a", "absent");
      keyboard.upgrade("a", "diacritic");
      expect(keyboard.getStatus("a")).toBe("diacritic");

      keyboard.upgrade("a", "present");
      expect(keyboard.getStatus("a")).toBe("present");

      keyboard.upgrade("a", "correct");
      expect(keyboard.getStatus("a")).toBe("correct");
    });

    it("never downgrades a higher status", () => {
      keyboard.upgrade("t", "correct");
      keyboard.upgrade("t", "present");
      keyboard.upgrade("t", "diacritic");
      keyboard.upgrade("t", "absent");
      expect(keyboard.getStatus("t")).toBe("correct");
    });

    it("tracks letters independently", () => {
      keyboard.upgrade("a", "correct");
      keyboard.upgrade("b", "absent");
      expect(keyboard.getStatus("a")).toBe("correct");
      expect(keyboard.getStatus("b")).toBe("absent");
    });

    it("returns null for unseen letters", () => {
      expect(keyboard.getStatus("z")).toBeNull();
    });
  });

  describe("applyGuessResults", () => {
    it("applies tile status to each letter", () => {
      keyboard.applyGuessResults("ab", [
        { status: "correct", badges: [] },
        { status: "absent", badges: [] },
      ]);
      expect(keyboard.getStatus("a")).toBe("correct");
      expect(keyboard.getStatus("b")).toBe("absent");
    });

    it("lets a yellow badge raise purple tile to present on the key", () => {
      // Purple here + exact elsewhere → key should become present
      keyboard.applyGuessResults("a", [
        {
          status: "diacritic",
          badges: [{ status: "present", count: 1 }],
        },
      ]);
      expect(keyboard.getStatus("a")).toBe("present");
    });

    it("lets a purple badge raise gray tile to diacritic on the key", () => {
      keyboard.applyGuessResults("a", [
        {
          status: "absent",
          badges: [{ status: "diacritic", count: 1 }],
        },
      ]);
      expect(keyboard.getStatus("a")).toBe("diacritic");
    });

    it("keeps correct when green tile also has yellow/purple badges", () => {
      keyboard.applyGuessResults("a", [
        {
          status: "correct",
          badges: [
            { status: "present", count: 1 },
            { status: "diacritic", count: 1 },
          ],
        },
      ]);
      expect(keyboard.getStatus("a")).toBe("correct");
    });

    it("uses the best status when the same letter appears multiple times", () => {
      keyboard.applyGuessResults("aa", [
        { status: "absent", badges: [] },
        { status: "present", badges: [] },
      ]);
      expect(keyboard.getStatus("a")).toBe("present");
    });

    it("throws when guess and results lengths differ", () => {
      expect(() =>
        keyboard.applyGuessResults("ab", [{ status: "correct", badges: [] }])
      ).toThrow(/length/i);
    });
  });

  describe("integration with GuessColoring", () => {
    it("maps ATTTT vs TAAAA keys to present", () => {
      const results = guessColoring.evaluate("atttt", "taaaa", false);
      keyboard.applyGuessResults("atttt", results);
      expect(keyboard.getStatus("a")).toBe("present");
      expect(keyboard.getStatus("t")).toBe("present");
    });

    it("maps PARTE vs PÂINE: A key is diacritic", () => {
      const results = guessColoring.evaluate("parte", "pâine", true);
      keyboard.applyGuessResults("parte", results);
      expect(keyboard.getStatus("a")).toBe("diacritic");
      expect(keyboard.getStatus("p")).toBe("correct");
      expect(keyboard.getStatus("e")).toBe("correct");
    });

    it("maps ABATE vs PÂINE: A key is diacritic via badge", () => {
      const results = guessColoring.evaluate("abate", "pâine", true);
      keyboard.applyGuessResults("abate", results);
      expect(keyboard.getStatus("a")).toBe("diacritic");
    });

    it("accumulates across guesses without downgrading", () => {
      keyboard.applyGuessResults(
        "xxxxx",
        guessColoring.evaluate("xxxxx", "carte", false)
      );
      expect(keyboard.getStatus("x")).toBe("absent");

      keyboard.applyGuessResults(
        "carte",
        guessColoring.evaluate("carte", "carte", false)
      );
      expect(keyboard.getStatus("c")).toBe("correct");
      expect(keyboard.getStatus("x")).toBe("absent");
    });
  });

  describe("reset and getAll", () => {
    it("clears all key statuses on reset", () => {
      keyboard.upgrade("a", "correct");
      keyboard.reset();
      expect(keyboard.getStatus("a")).toBeNull();
      expect(keyboard.getAll()).toEqual({});
    });

    it("getAll returns a shallow copy", () => {
      keyboard.upgrade("m", "present");
      const snapshot = keyboard.getAll();
      snapshot.m = "absent";
      expect(keyboard.getStatus("m")).toBe("present");
    });
  });
});
