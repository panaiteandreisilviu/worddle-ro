import { EMPTY_STATS } from "./schema.js";

/**
 * @param {{ difficulty?: string|null, letterCount?: number|null }} filter
 * difficulty null/"all" = all difficulties; letterCount null = all lengths
 */
export function matchesFilter(row, filter) {
  const diff = filter.difficulty;
  const len = filter.letterCount;
  if (diff && diff !== "all" && row.difficulty !== diff) return false;
  if (len != null && Number(row.letter_count) !== Number(len)) return false;
  return true;
}

function streakFromResults(resultsChronological) {
  let currentWin = 0;
  let currentLoss = 0;
  let maxWin = 0;
  let maxLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  for (const won of resultsChronological) {
    if (won) {
      runWin += 1;
      runLoss = 0;
      maxWin = Math.max(maxWin, runWin);
    } else {
      runLoss += 1;
      runWin = 0;
      maxLoss = Math.max(maxLoss, runLoss);
    }
  }
  if (resultsChronological.length) {
    const last = resultsChronological[resultsChronological.length - 1];
    currentWin = last ? runWin : 0;
    currentLoss = last ? 0 : runLoss;
  }
  return { currentWin, maxWin, currentLoss, maxLoss };
}

/**
 * Pure aggregation over raw row arrays (SQLite-shaped).
 * @param {{
 *   games: object[],
 *   invalids: object[],
 *   abandons: object[],
 *   validGuesses: object[],
 * }} data
 * @param {{ difficulty?: string|null, letterCount?: number|null }} filter
 */
export function aggregateStats(data, filter = {}) {
  const games = (data.games || []).filter((r) => matchesFilter(r, filter));
  const invalids = (data.invalids || []).filter((r) => matchesFilter(r, filter));
  const abandons = (data.abandons || []).filter((r) => matchesFilter(r, filter));
  const validGuesses = (data.validGuesses || []).filter((r) =>
    matchesFilter(r, filter)
  );

  const stats = {
    ...EMPTY_STATS,
    winsByTries: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    guessedWords: [],
  };

  stats.gamesPlayed = games.length;
  stats.invalidAttempts = invalids.length;
  stats.gamesAbandoned = abandons.length;
  stats.validGuesses = validGuesses.length;

  const played = new Set();
  const wonSet = new Set();
  const lostSet = new Set();
  const days = new Set();
  const chrono = [];

  let sumGuessesOnWins = 0;
  let sumWinTime = 0;
  let totalLossTime = 0;
  let fastest = null;
  let slowest = null;
  let longest = 0;
  let lastPlayed = null;
  let green = 0;
  let yellow = 0;
  let violet = 0;
  let gray = 0;
  let firstRowGreens = 0;
  let bestFirst = 0;
  let withViolet = 0;
  let badges = 0;
  let abandonPlayTime = 0;

  for (const g of games) {
    const won = !!g.won;
    const guessCount = Number(g.guess_count) || 0;
    const playTime = Number(g.play_time_ms) || 0;
    const finishedAt = Number(g.finished_at) || 0;

    if (won) {
      stats.wins += 1;
      if (guessCount >= 1 && guessCount <= 6) {
        stats.winsByTries[guessCount] += 1;
      }
      sumGuessesOnWins += guessCount;
      sumWinTime += playTime;
      if (fastest == null || playTime < fastest) fastest = playTime;
      if (slowest == null || playTime > slowest) slowest = playTime;
      wonSet.add(g.answer);
    } else {
      stats.losses += 1;
      totalLossTime += playTime;
      lostSet.add(g.answer);
    }

    stats.guessedWords.push({
      answer: String(g.answer || ""),
      finishedAt: finishedAt || 0,
      guessCount,
      won,
    });

    played.add(g.answer);
    if (g.day) days.add(g.day);
    chrono.push(won);
    longest = Math.max(longest, playTime);
    if (finishedAt && (lastPlayed == null || finishedAt > lastPlayed)) {
      lastPlayed = finishedAt;
    }

    green += Number(g.green_tiles) || 0;
    yellow += Number(g.yellow_tiles) || 0;
    violet += Number(g.violet_tiles) || 0;
    gray += Number(g.gray_tiles) || 0;
    firstRowGreens += Number(g.first_row_greens) || 0;
    bestFirst = Math.max(bestFirst, Number(g.first_row_greens) || 0);
    if (g.had_violet) withViolet += 1;
    badges += Number(g.badge_total) || 0;
  }

  for (const a of abandons) {
    abandonPlayTime += Number(a.play_time_ms) || 0;
    longest = Math.max(longest, Number(a.play_time_ms) || 0);
  }

  const streaks = streakFromResults(chrono);

  stats.sumGuessesOnWins = sumGuessesOnWins;
  stats.winRate = stats.gamesPlayed ? stats.wins / stats.gamesPlayed : null;
  stats.avgGuessesOnWins = stats.wins ? sumGuessesOnWins / stats.wins : null;
  stats.lastPlayedAt = lastPlayed;
  stats.daysPlayed = days.size;
  stats.totalPlayTimeMs =
    games.reduce((s, g) => s + (Number(g.play_time_ms) || 0), 0) +
    abandonPlayTime;
  stats.currentWinStreak = streaks.currentWin;
  stats.maxWinStreak = streaks.maxWin;
  stats.currentLossStreak = streaks.currentLoss;
  stats.maxLossStreak = streaks.maxLoss;
  stats.uniqueAnswersPlayed = played.size;
  stats.uniqueAnswersWon = wonSet.size;
  stats.uniqueAnswersLost = lostSet.size;
  stats.fastestWinMs = fastest;
  stats.slowestWinMs = slowest;
  stats.sumWinTimeMs = sumWinTime;
  stats.avgWinTimeMs = stats.wins ? sumWinTime / stats.wins : null;
  stats.longestGameMs = longest;
  stats.totalLossTimeMs = totalLossTime;
  stats.avgLossTimeMs = stats.losses ? totalLossTime / stats.losses : null;
  stats.greenTiles = green;
  stats.yellowTiles = yellow;
  stats.violetTiles = violet;
  stats.grayTiles = gray;
  stats.firstRowGreens = firstRowGreens;
  stats.avgFirstRowGreens = stats.gamesPlayed
    ? firstRowGreens / stats.gamesPlayed
    : null;
  stats.bestFirstRowGreens = bestFirst;
  stats.gamesWithViolet = withViolet;
  stats.badgeTotal = badges;
  stats.guessedWords.sort((a, b) => b.finishedAt - a.finishedAt);

  return stats;
}

/** Summarize board feedback from evaluate() results for one game. */
export function summarizeBoard(resultsByRow) {
  let green = 0;
  let yellow = 0;
  let violet = 0;
  let gray = 0;
  let badges = 0;
  let firstRowGreens = 0;
  let hadViolet = false;

  resultsByRow.forEach((row, rowIndex) => {
    for (const tile of row) {
      if (tile.status === "correct") {
        green += 1;
        if (rowIndex === 0) firstRowGreens += 1;
      } else if (tile.status === "present") yellow += 1;
      else if (tile.status === "diacritic") {
        violet += 1;
        hadViolet = true;
      } else if (tile.status === "absent") gray += 1;
      for (const b of tile.badges || []) {
        badges += 1;
        if (b.status === "diacritic") hadViolet = true;
      }
    }
  });

  return {
    green_tiles: green,
    yellow_tiles: yellow,
    violet_tiles: violet,
    gray_tiles: gray,
    first_row_greens: firstRowGreens,
    badge_total: badges,
    had_violet: hadViolet ? 1 : 0,
  };
}

export function localDayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
