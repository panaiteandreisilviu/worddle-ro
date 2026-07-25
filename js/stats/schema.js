/** SQLite schema for stats. Dropped/recreated freely — no migrations. */

export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finished_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  difficulty TEXT NOT NULL,
  letter_count INTEGER NOT NULL,
  answer TEXT NOT NULL,
  won INTEGER NOT NULL,
  guess_count INTEGER NOT NULL,
  play_time_ms INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  day TEXT NOT NULL,
  green_tiles INTEGER NOT NULL DEFAULT 0,
  yellow_tiles INTEGER NOT NULL DEFAULT 0,
  violet_tiles INTEGER NOT NULL DEFAULT 0,
  gray_tiles INTEGER NOT NULL DEFAULT 0,
  first_row_greens INTEGER NOT NULL DEFAULT 0,
  badge_total INTEGER NOT NULL DEFAULT 0,
  had_violet INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invalid_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  difficulty TEXT NOT NULL,
  letter_count INTEGER NOT NULL,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS abandons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  difficulty TEXT NOT NULL,
  letter_count INTEGER NOT NULL,
  guesses_made INTEGER NOT NULL DEFAULT 0,
  play_time_ms INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS valid_guesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  difficulty TEXT NOT NULL,
  letter_count INTEGER NOT NULL,
  at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_filter
  ON finished_games (difficulty, letter_count, finished_at);
CREATE INDEX IF NOT EXISTS idx_invalid_filter
  ON invalid_attempts (difficulty, letter_count);
CREATE INDEX IF NOT EXISTS idx_abandons_filter
  ON abandons (difficulty, letter_count);
CREATE INDEX IF NOT EXISTS idx_guesses_filter
  ON valid_guesses (difficulty, letter_count);
`;

export const EMPTY_STATS = Object.freeze({
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  winRate: null,
  avgGuessesOnWins: null,
  lastPlayedAt: null,
  daysPlayed: 0,
  totalPlayTimeMs: 0,
  winsByTries: Object.freeze({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
  sumGuessesOnWins: 0,
  currentWinStreak: 0,
  maxWinStreak: 0,
  currentLossStreak: 0,
  maxLossStreak: 0,
  validGuesses: 0,
  invalidAttempts: 0,
  gamesAbandoned: 0,
  uniqueAnswersPlayed: 0,
  uniqueAnswersWon: 0,
  uniqueAnswersLost: 0,
  fastestWinMs: null,
  slowestWinMs: null,
  avgWinTimeMs: null,
  sumWinTimeMs: 0,
  longestGameMs: 0,
  totalLossTimeMs: 0,
  avgLossTimeMs: null,
  greenTiles: 0,
  yellowTiles: 0,
  violetTiles: 0,
  grayTiles: 0,
  firstRowGreens: 0,
  avgFirstRowGreens: null,
  bestFirstRowGreens: 0,
  gamesWithViolet: 0,
  badgeTotal: 0,
  guessedWords: Object.freeze([]),
});

export const STAT_CATEGORIES = [
  {
    id: "overview",
    label: "Prezentare",
    keys: [
      "gamesPlayed",
      "wins",
      "losses",
      "winRate",
      "avgGuessesOnWins",
      "lastPlayedAt",
      "daysPlayed",
      "totalPlayTimeMs",
    ],
  },
  {
    id: "guessed",
    label: "Cuvinte",
    kind: "guessedWords",
  },
  {
    id: "distribution",
    label: "Distribuție",
    keys: [
      "winsByTries.1",
      "winsByTries.2",
      "winsByTries.3",
      "winsByTries.4",
      "winsByTries.5",
      "winsByTries.6",
      "sumGuessesOnWins",
    ],
  },
  {
    id: "streaks",
    label: "Serii",
    keys: [
      "currentWinStreak",
      "maxWinStreak",
      "currentLossStreak",
      "maxLossStreak",
    ],
  },
  {
    id: "activity",
    label: "Activitate",
    keys: [
      "validGuesses",
      "invalidAttempts",
      "gamesAbandoned",
      "uniqueAnswersPlayed",
      "uniqueAnswersWon",
      "uniqueAnswersLost",
    ],
  },
  {
    id: "speed",
    label: "Viteză",
    keys: [
      "fastestWinMs",
      "slowestWinMs",
      "avgWinTimeMs",
      "longestGameMs",
      "totalLossTimeMs",
      "avgLossTimeMs",
    ],
  },
  {
    id: "board",
    label: "Tablă",
    keys: [
      "greenTiles",
      "yellowTiles",
      "violetTiles",
      "grayTiles",
      "firstRowGreens",
      "avgFirstRowGreens",
      "bestFirstRowGreens",
      "gamesWithViolet",
      "badgeTotal",
    ],
  },
];

export const STAT_LABELS = {
  gamesPlayed: "Jocuri jucate",
  wins: "Victorii",
  losses: "Înfrângeri",
  winRate: "Rată de succes",
  avgGuessesOnWins: "Medie încercări (victorii)",
  lastPlayedAt: "Ultima jucare",
  daysPlayed: "Zile jucate",
  totalPlayTimeMs: "Timp total de joc",
  "winsByTries.1": "Victorii în 1 încercare",
  "winsByTries.2": "Victorii în 2 încercări",
  "winsByTries.3": "Victorii în 3 încercări",
  "winsByTries.4": "Victorii în 4 încercări",
  "winsByTries.5": "Victorii în 5 încercări",
  "winsByTries.6": "Victorii în 6 încercări",
  sumGuessesOnWins: "Suma încercărilor la victorii",
  currentWinStreak: "Serie curentă de victorii",
  maxWinStreak: "Serie maximă de victorii",
  currentLossStreak: "Serie curentă de înfrângeri",
  maxLossStreak: "Serie maximă de înfrângeri",
  validGuesses: "Încercări valide",
  invalidAttempts: "Cuvinte necunoscute",
  gamesAbandoned: "Jocuri abandonate",
  uniqueAnswersPlayed: "Cuvinte unice jucate",
  uniqueAnswersWon: "Cuvinte unice ghicite",
  uniqueAnswersLost: "Cuvinte unice ratate",
  fastestWinMs: "Cea mai rapidă victorie",
  slowestWinMs: "Cea mai lentă victorie",
  avgWinTimeMs: "Timp mediu pe victorie",
  longestGameMs: "Cel mai lung joc",
  totalLossTimeMs: "Timp total pe înfrângeri",
  avgLossTimeMs: "Timp mediu pe înfrângere",
  greenTiles: "Pătrate verzi",
  yellowTiles: "Pătrate galbene",
  violetTiles: "Pătrate violet",
  grayTiles: "Pătrate gri",
  firstRowGreens: "Verzi pe primul rând (total)",
  avgFirstRowGreens: "Medie verzi pe primul rând",
  bestFirstRowGreens: "Max verzi pe primul rând",
  gamesWithViolet: "Jocuri cu cel puțin un violet",
  badgeTotal: "Badge-uri +N (total)",
};
