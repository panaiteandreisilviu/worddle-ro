import { aggregateStats, localDayKey, summarizeBoard } from "./aggregate.js";
import { openStatsDatabase } from "./db.js";
import { EMPTY_STATS } from "./schema.js";

export class StatsService {
  constructor() {
    this.db = null;
    this.ready = null;
  }

  init() {
    if (!this.ready) {
      this.ready = openStatsDatabase().then((db) => {
        this.db = db;
        return this;
      });
    }
    return this.ready;
  }

  /** Custom / propriu games are not tracked. */
  shouldTrack(difficulty) {
    return difficulty && difficulty !== "custom";
  }

  async recordValidGuess({ difficulty, letterCount, word, results }) {
    if (!this.shouldTrack(difficulty)) return;
    await this.init();
    await this.db.execute(
      `INSERT INTO valid_guesses (difficulty, letter_count, word, results_json, at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        difficulty,
        letterCount,
        String(word || "").toLowerCase(),
        JSON.stringify(results || []),
        Date.now(),
      ]
    );
  }

  async recordInvalidAttempt({ difficulty, letterCount }) {
    if (!this.shouldTrack(difficulty)) return;
    await this.init();
    await this.db.execute(
      `INSERT INTO invalid_attempts (difficulty, letter_count, at) VALUES (?, ?, ?)`,
      [difficulty, letterCount, Date.now()]
    );
  }

  async recordAbandon({ difficulty, letterCount, guessesMade, playTimeMs }) {
    if (!this.shouldTrack(difficulty)) return;
    await this.init();
    await this.db.execute(
      `INSERT INTO abandons (difficulty, letter_count, guesses_made, play_time_ms, at)
       VALUES (?, ?, ?, ?, ?)`,
      [difficulty, letterCount, guessesMade || 0, playTimeMs || 0, Date.now()]
    );
  }

  /**
   * @param {{
   *   difficulty: string,
   *   letterCount: number,
   *   answer: string,
   *   won: boolean,
   *   guessCount: number,
   *   playTimeMs: number,
   *   resultsByRow: object[][],
   * }} game
   */
  async recordFinishedGame(game) {
    if (!this.shouldTrack(game.difficulty)) return;
    await this.init();
    const board = summarizeBoard(game.resultsByRow || []);
    const finishedAt = Date.now();
    await this.db.execute(
      `INSERT INTO finished_games (
        difficulty, letter_count, answer, won, guess_count, play_time_ms,
        finished_at, day, green_tiles, yellow_tiles, violet_tiles, gray_tiles,
        first_row_greens, badge_total, had_violet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        game.difficulty,
        game.letterCount,
        game.answer,
        game.won ? 1 : 0,
        game.guessCount,
        game.playTimeMs || 0,
        finishedAt,
        localDayKey(finishedAt),
        board.green_tiles,
        board.yellow_tiles,
        board.violet_tiles,
        board.gray_tiles,
        board.first_row_greens,
        board.badge_total,
        board.had_violet,
      ]
    );
  }

  async getStats(filter = {}) {
    await this.init();
    const [games, invalids, abandons, validGuesses] = await Promise.all([
      this.db.select(
        `SELECT difficulty, letter_count, answer, won, guess_count, play_time_ms,
                finished_at, day, green_tiles, yellow_tiles, violet_tiles, gray_tiles,
                first_row_greens, badge_total, had_violet
         FROM finished_games
         ORDER BY finished_at ASC, id ASC`
      ),
      this.db.select(
        `SELECT difficulty, letter_count, at FROM invalid_attempts`
      ),
      this.db.select(
        `SELECT difficulty, letter_count, guesses_made, play_time_ms, at FROM abandons`
      ),
      this.db.select(
        `SELECT difficulty, letter_count, word, results_json, at FROM valid_guesses`
      ),
    ]);

    return aggregateStats(
      { games, invalids, abandons, validGuesses },
      {
        difficulty: filter.difficulty ?? null,
        letterCount: filter.letterCount ?? null,
      }
    );
  }

  async resetAll() {
    await this.init();
    await this.db.execute("DELETE FROM valid_guesses");
    await this.db.execute("DELETE FROM abandons");
    await this.db.execute("DELETE FROM invalid_attempts");
    await this.db.execute("DELETE FROM finished_games");
  }

  empty() {
    return {
      ...EMPTY_STATS,
      winsByTries: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      guessedWords: [],
      triedWords: [],
      triedLetters: [],
    };
  }
}

export const statsService = new StatsService();
