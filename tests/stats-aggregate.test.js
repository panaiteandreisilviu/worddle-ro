import { describe, expect, it } from "vitest";
import {
  aggregateStats,
  localDayKey,
  scoreGuessLetters,
  summarizeBoard,
} from "../js/stats/aggregate.js";

describe("summarizeBoard", () => {
  it("counts statuses, badges, and first-row greens", () => {
    const summary = summarizeBoard([
      [
        { status: "correct", badges: [] },
        { status: "present", badges: [{ status: "diacritic", count: 1 }] },
        { status: "absent", badges: [] },
      ],
      [
        { status: "diacritic", badges: [{ status: "present", count: 1 }] },
        { status: "correct", badges: [] },
        { status: "absent", badges: [] },
      ],
    ]);
    expect(summary).toEqual({
      green_tiles: 2,
      yellow_tiles: 1,
      violet_tiles: 1,
      gray_tiles: 2,
      first_row_greens: 1,
      badge_total: 2,
      had_violet: 1,
    });
  });
});

describe("scoreGuessLetters", () => {
  it("counts unique letters via keyboard coloring, including badge upgrades", () => {
    const scored = scoreGuessLetters("aba", [
      { status: "absent", badges: [{ status: "present", count: 1 }] },
      { status: "correct", badges: [] },
      { status: "present", badges: [] },
    ]);
    // a upgraded to present (once), b correct
    expect(scored).toEqual({
      green: 1,
      yellow: 1,
      purple: 0,
      absent: 0,
      total: 2,
      statuses: { a: "present", b: "correct" },
    });
  });
});

describe("aggregateStats", () => {
  const baseGame = {
    difficulty: "easy",
    letter_count: 5,
    answer: "carte",
    won: 1,
    guess_count: 3,
    play_time_ms: 10000,
    finished_at: 1_000_000,
    day: "2026-07-25",
    green_tiles: 5,
    yellow_tiles: 2,
    violet_tiles: 1,
    gray_tiles: 3,
    first_row_greens: 2,
    badge_total: 1,
    had_violet: 1,
  };

  it("aggregates a win", () => {
    const stats = aggregateStats({
      games: [baseGame],
      invalids: [],
      abandons: [],
      validGuesses: [
        { difficulty: "easy", letter_count: 5, at: 1 },
        { difficulty: "easy", letter_count: 5, at: 2 },
        { difficulty: "easy", letter_count: 5, at: 3 },
      ],
    });
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.winsByTries[3]).toBe(1);
    expect(stats.sumGuessesOnWins).toBe(3);
    expect(stats.avgGuessesOnWins).toBe(3);
    expect(stats.avgGuessesAll).toBe(3);
    expect(stats.winRate).toBe(1);
    expect(stats.winRateIn3).toBe(1);
    expect(stats.winRateIn4).toBe(1);
    expect(stats.validGuesses).toBe(3);
    expect(stats.uniqueAnswersPlayed).toBe(1);
    expect(stats.uniqueAnswersWon).toBe(1);
    expect(stats.replays).toBe(0);
    expect(stats.currentWinStreak).toBe(1);
    expect(stats.maxWinStreak).toBe(1);
    expect(stats.fastestWinMs).toBe(10000);
    expect(stats.avgPlayTimeMs).toBe(10000);
    expect(stats.gamesWithViolet).toBe(1);
    expect(stats.violetGameRate).toBe(1);
    expect(stats.avgFirstRowGreens).toBe(2);
    expect(stats.guessedWords).toEqual([
      { answer: "carte", finishedAt: 1_000_000, guessCount: 3, won: true },
    ]);
  });

  it("lists all games newest first with win/loss", () => {
    const stats = aggregateStats({
      games: [
        { ...baseGame, won: 1, finished_at: 100, answer: "unu", guess_count: 2 },
        { ...baseGame, won: 0, finished_at: 200, answer: "doi", guess_count: 6 },
        { ...baseGame, won: 1, finished_at: 300, answer: "trei", guess_count: 4 },
      ],
      invalids: [],
      abandons: [],
      validGuesses: [],
    });
    expect(stats.guessedWords).toEqual([
      { answer: "trei", finishedAt: 300, guessCount: 4, won: true },
      { answer: "doi", finishedAt: 200, guessCount: 6, won: false },
      { answer: "unu", finishedAt: 100, guessCount: 2, won: true },
    ]);
  });

  it("aggregates tried words by tries desc with color percentages", () => {
    const tile = (status, badges = []) => ({ status, badges });
    const stats = aggregateStats({
      games: [],
      invalids: [],
      abandons: [],
      validGuesses: [
        {
          difficulty: "easy",
          letter_count: 3,
          word: "abc",
          results: [
            tile("correct"),
            tile("present"),
            tile("absent"),
          ],
        },
        {
          difficulty: "easy",
          letter_count: 3,
          word: "abc",
          results: [
            tile("correct"),
            tile("diacritic"),
            tile("absent"),
          ],
        },
        {
          difficulty: "easy",
          letter_count: 3,
          word: "xyz",
          results: [
            tile("present"),
            tile("absent"),
            tile("absent"),
          ],
        },
      ],
    });
    expect(stats.triedWords).toEqual([
      {
        word: "abc",
        tries: 2,
        // try1: g1 y1 a1; try2: g1 p1 a1 → g2 y1 p1 a2 / total 6
        greenPct: 33.3,
        yellowPct: 16.7,
        purplePct: 16.7,
      },
      {
        word: "xyz",
        tries: 1,
        // y1 a2 / total 3
        greenPct: 0,
        yellowPct: 33.3,
        purplePct: 0,
      },
    ]);
    expect(stats.triedLetters).toEqual([
      { letter: "a", tries: 2, greenPct: 100, yellowPct: 0, purplePct: 0 },
      { letter: "b", tries: 2, greenPct: 0, yellowPct: 50, purplePct: 50 },
      { letter: "c", tries: 2, greenPct: 0, yellowPct: 0, purplePct: 0 },
      { letter: "x", tries: 1, greenPct: 0, yellowPct: 100, purplePct: 0 },
      { letter: "y", tries: 1, greenPct: 0, yellowPct: 0, purplePct: 0 },
      { letter: "z", tries: 1, greenPct: 0, yellowPct: 0, purplePct: 0 },
    ]);
  });

  it("tracks streaks across wins and losses", () => {
    const stats = aggregateStats({
      games: [
        { ...baseGame, won: 1, finished_at: 1, answer: "a" },
        { ...baseGame, won: 1, finished_at: 2, answer: "b" },
        { ...baseGame, won: 0, guess_count: 6, finished_at: 3, answer: "c" },
        { ...baseGame, won: 0, guess_count: 6, finished_at: 4, answer: "d" },
        { ...baseGame, won: 1, finished_at: 5, answer: "e" },
      ],
      invalids: [],
      abandons: [],
      validGuesses: [],
    });
    expect(stats.maxWinStreak).toBe(2);
    expect(stats.maxLossStreak).toBe(2);
    expect(stats.currentWinStreak).toBe(1);
    expect(stats.currentLossStreak).toBe(0);
    expect(stats.losses).toBe(2);
    expect(stats.uniqueAnswersLost).toBe(2);
  });

  it("filters by difficulty and letter count", () => {
    const games = [
      { ...baseGame, difficulty: "easy", letter_count: 5, answer: "a" },
      { ...baseGame, difficulty: "hard", letter_count: 5, answer: "b" },
      { ...baseGame, difficulty: "easy", letter_count: 6, answer: "c" },
    ];
    const all = aggregateStats({ games, invalids: [], abandons: [], validGuesses: [] }, {});
    expect(all.gamesPlayed).toBe(3);

    const easyAllLens = aggregateStats(
      { games, invalids: [], abandons: [], validGuesses: [] },
      { difficulty: "easy", letterCount: null }
    );
    expect(easyAllLens.gamesPlayed).toBe(2);

    const allDiffLen5 = aggregateStats(
      { games, invalids: [], abandons: [], validGuesses: [] },
      { difficulty: null, letterCount: 5 }
    );
    expect(allDiffLen5.gamesPlayed).toBe(2);

    const easy5 = aggregateStats(
      { games, invalids: [], abandons: [], validGuesses: [] },
      { difficulty: "easy", letterCount: 5 }
    );
    expect(easy5.gamesPlayed).toBe(1);
  });

  it("includes abandons in play time and counts", () => {
    const stats = aggregateStats({
      games: [baseGame],
      invalids: [{ difficulty: "easy", letter_count: 5, at: 1 }],
      abandons: [
        {
          difficulty: "easy",
          letter_count: 5,
          guesses_made: 2,
          play_time_ms: 5000,
          at: 2,
        },
      ],
      validGuesses: [],
    });
    expect(stats.gamesAbandoned).toBe(1);
    expect(stats.invalidAttempts).toBe(1);
    expect(stats.totalPlayTimeMs).toBe(15000);
    expect(stats.longestGameMs).toBe(10000);
    expect(stats.abandonRate).toBe(0.5);
    expect(stats.invalidRate).toBe(1);
    expect(stats.avgPlayTimeMs).toBe(10000);
  });

  it("counts losses as 6 guesses and tracks replays", () => {
    const stats = aggregateStats({
      games: [
        { ...baseGame, won: 1, guess_count: 2, answer: "carte", finished_at: 100 },
        { ...baseGame, won: 0, guess_count: 6, answer: "carte", finished_at: 200 },
        { ...baseGame, won: 1, guess_count: 4, answer: "altce", finished_at: 300 },
      ],
      invalids: [
        { difficulty: "easy", letter_count: 5, at: 1 },
        { difficulty: "easy", letter_count: 5, at: 2 },
      ],
      abandons: [],
      validGuesses: [
        { difficulty: "easy", letter_count: 5, at: 1 },
        { difficulty: "easy", letter_count: 5, at: 2 },
        { difficulty: "easy", letter_count: 5, at: 3 },
        { difficulty: "easy", letter_count: 5, at: 4 },
        { difficulty: "easy", letter_count: 5, at: 5 },
        { difficulty: "easy", letter_count: 5, at: 6 },
      ],
    });
    expect(stats.avgGuessesAll).toBeCloseTo((2 + 6 + 4) / 3);
    expect(stats.winRateIn3).toBeCloseTo(1 / 3);
    expect(stats.winRateIn4).toBeCloseTo(2 / 3);
    expect(stats.replays).toBe(1);
    expect(stats.invalidRate).toBeCloseTo(2 / 8);
  });
});

describe("localDayKey", () => {
  it("formats YYYY-MM-DD", () => {
    expect(localDayKey(Date.UTC(2026, 6, 25, 12))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
