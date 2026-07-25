import { describe, expect, it } from "vitest";
import {
  DIACRITIC_GROUPS,
  STATUS_RANK,
  sameGroup,
  stripDiacritics,
} from "../js/diacritics.js";

describe("diacritics helpers", () => {
  it("groups Romanian diacritic variants", () => {
    expect(DIACRITIC_GROUPS).toHaveLength(4);
    expect(sameGroup("a", "ă")).toBe(true);
    expect(sameGroup("a", "â")).toBe(true);
    expect(sameGroup("ă", "â")).toBe(true);
    expect(sameGroup("i", "î")).toBe(true);
    expect(sameGroup("s", "ș")).toBe(true);
    expect(sameGroup("t", "ț")).toBe(true);
  });

  it("does not group unrelated letters", () => {
    expect(sameGroup("a", "i")).toBe(false);
    expect(sameGroup("ș", "ț")).toBe(false);
    expect(sameGroup("a", "b")).toBe(false);
  });

  it("treats identical letters as same group", () => {
    expect(sameGroup("ă", "ă")).toBe(true);
    expect(sameGroup("z", "z")).toBe(true);
  });

  it("strips diacritics to base letters", () => {
    expect(stripDiacritics("pâine")).toBe("paine");
    expect(stripDiacritics("ăâîșț")).toBe("aaist");
    expect(stripDiacritics("CARTE")).toBe("carte");
    expect(stripDiacritics("Țară")).toBe("tara");
  });

  it("ranks statuses for keyboard collapse", () => {
    expect(STATUS_RANK.correct).toBeGreaterThan(STATUS_RANK.present);
    expect(STATUS_RANK.present).toBeGreaterThan(STATUS_RANK.diacritic);
    expect(STATUS_RANK.diacritic).toBeGreaterThan(STATUS_RANK.absent);
  });
});
