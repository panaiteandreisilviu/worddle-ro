/** SQLite schema for stats. Dropped/recreated freely — no migrations. */

export const SCHEMA_VERSION = 2;

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
  word TEXT NOT NULL,
  results_json TEXT NOT NULL,
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
  avgGuessesAll: null,
  winRateIn3: null,
  winRateIn4: null,
  lastPlayedAt: null,
  daysPlayed: 0,
  totalPlayTimeMs: 0,
  avgPlayTimeMs: null,
  winsByTries: Object.freeze({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
  sumGuessesOnWins: 0,
  currentWinStreak: 0,
  maxWinStreak: 0,
  currentLossStreak: 0,
  maxLossStreak: 0,
  validGuesses: 0,
  invalidAttempts: 0,
  invalidRate: null,
  gamesAbandoned: 0,
  abandonRate: null,
  uniqueAnswersPlayed: 0,
  uniqueAnswersWon: 0,
  uniqueAnswersLost: 0,
  replays: 0,
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
  violetGameRate: null,
  badgeTotal: 0,
  guessedWords: Object.freeze([]),
  triedWords: Object.freeze([]),
  triedLetters: Object.freeze([]),
});

export const STAT_CATEGORIES = [
  {
    id: "overview",
    label: "General",
    keys: [
      "gamesPlayed",
      "wins",
      "losses",
      "winRate",
      "avgGuessesOnWins",
      "avgGuessesAll",
      "winRateIn3",
      "winRateIn4",
    ],
  },
  {
    id: "distribution",
    label: "Distribuție",
    kind: "distribution",
    keys: [],
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
    label: "Timp & activitate",
    keys: [
      "validGuesses",
      "invalidAttempts",
      "invalidRate",
      "gamesAbandoned",
      "abandonRate",
      "lastPlayedAt",
      "daysPlayed",
      "totalPlayTimeMs",
      "avgPlayTimeMs",
      "fastestWinMs",
      "slowestWinMs",
      "avgWinTimeMs",
      "avgLossTimeMs",
      "longestGameMs",
    ],
  },
  {
    id: "board",
    label: "Indicii",
    keys: [
      "greenTiles",
      "yellowTiles",
      "violetTiles",
      "grayTiles",
      "avgFirstRowGreens",
      "bestFirstRowGreens",
      "gamesWithViolet",
      "violetGameRate",
      "badgeTotal",
    ],
  },
  {
    id: "guessed",
    label: "Răspunsuri",
    kind: "guessedWords",
    keys: [
      "uniqueAnswersPlayed",
      "uniqueAnswersWon",
      "uniqueAnswersLost",
      "replays",
    ],
  },
  {
    id: "tried",
    label: "Ghiciri",
    kind: "triedWords",
  },
  {
    id: "letters",
    label: "Litere",
    kind: "triedLetters",
  },
];

export const STAT_LABELS = {
  gamesPlayed: "Jocuri jucate",
  wins: "Victorii",
  losses: "Înfrângeri",
  winRate: "Rată de victorii",
  avgGuessesOnWins: "Medie încercări (victorii)",
  avgGuessesAll: "Medie încercări (toate)",
  winRateIn3: "Victorii în ≤3 încercări",
  winRateIn4: "Victorii în ≤4 încercări",
  lastPlayedAt: "Ultimul joc",
  daysPlayed: "Zile jucate",
  totalPlayTimeMs: "Timp total de joc",
  avgPlayTimeMs: "Timp mediu pe joc",
  currentWinStreak: "Serie curentă de victorii",
  maxWinStreak: "Serie maximă de victorii",
  currentLossStreak: "Serie curentă de înfrângeri",
  maxLossStreak: "Serie maximă de înfrângeri",
  validGuesses: "Ghiciri valide",
  invalidAttempts: "Cuvinte necunoscute",
  invalidRate: "Rată cuvinte necunoscute",
  gamesAbandoned: "Jocuri abandonate",
  abandonRate: "Rată de abandon",
  uniqueAnswersPlayed: "Răspunsuri unice",
  uniqueAnswersWon: "Răspunsuri unice ghicite",
  uniqueAnswersLost: "Răspunsuri unice ratate",
  replays: "Rejucări",
  fastestWinMs: "Cea mai rapidă victorie",
  slowestWinMs: "Cea mai lentă victorie",
  avgWinTimeMs: "Timp mediu pe victorie",
  longestGameMs: "Cel mai lung joc",
  avgLossTimeMs: "Timp mediu pe înfrângere",
  greenTiles: "Litere verzi",
  yellowTiles: "Litere galbene",
  violetTiles: "Litere violet",
  grayTiles: "Litere gri",
  avgFirstRowGreens: "Medie verzi pe primul rând",
  bestFirstRowGreens: "Max verzi pe primul rând",
  gamesWithViolet: "Jocuri cu cel puțin un violet",
  violetGameRate: "Rată jocuri cu violet",
  badgeTotal: "Indicii +N (total)",
};

/** Short explanations shown under the label. */
export const STAT_HINTS = {
  avgGuessesAll: "Înfrângerile contează ca 6 încercări",
  winRateIn3: "Procent din jocurile terminate ghicit în cel mult 3",
  winRateIn4: "Procent din jocurile terminate ghicit în cel mult 4",
  validGuesses: "Cuvinte acceptate pe care le-ai trimis ca ghiciri",
  invalidAttempts: "Cuvinte respinse pentru că nu sunt în dicționar",
  invalidRate: "Din toate cuvintele trimise (valide + respinse)",
  gamesAbandoned: "Partide începute pe care le-ai părăsit înainte de final",
  abandonRate: "Din partidele începute (terminate + abandonate)",
  uniqueAnswersPlayed: "Câte răspunsuri diferite ai întâlnit (fără duplicate)",
  uniqueAnswersWon: "Câte răspunsuri diferite ai ghicit corect",
  uniqueAnswersLost: "Câte răspunsuri diferite nu ai ghicit în 6 încercări",
  replays: "Jocuri în plus pe un răspuns pe care îl mai jucaseși",
  avgPlayTimeMs: "Timp mediu pe o partidă terminată",
  greenTiles: "Litere pe poziția corectă, pe toate partidele",
  yellowTiles: "Litere prezente în cuvânt, dar pe altă poziție",
  violetTiles: "Același grup diacritic pe loc, formă greșită (ă/â, î, ș, ț)",
  grayTiles: "Litere absente din cuvânt",
  avgFirstRowGreens: "Câte verzi ai, în medie, pe primul rând al unei partide",
  bestFirstRowGreens: "Cel mai bun prim rând: câte litere verzi dintr-o dată",
  gamesWithViolet: "Partide în care a apărut cel puțin un indiciu violet",
  violetGameRate: "Procent din partidele terminate cu cel puțin un violet",
  badgeTotal: "Indicii +N (galben/violet) pe alte poziții, în total",
};
