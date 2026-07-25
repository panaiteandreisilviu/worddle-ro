import { stripDiacritics } from "./diacritics.js";
import { clearGameSave, readGameSave, writeGameSave } from "./game-save.js";
import { GuessColoring } from "./guess-coloring.js";
import { HELP_EXAMPLES } from "./help-examples.js";
import { KeyboardColoring } from "./keyboard-coloring.js";
import { statsService } from "./stats/service.js";
import { createStatsView } from "./stats/stats-ui.js";

const MAX_GUESSES = 6;
const MIN_LEN = 3;
const MAX_LEN = 12;

const guessColoring = new GuessColoring();

function applyTileStatuses(tile, result) {
  tile.classList.remove("correct", "present", "diacritic", "absent");
  tile.style.background = "";
  tile.style.borderColor = "";
  tile.style.color = "";
  tile.querySelector(".tile-bands")?.remove();
  tile.querySelector(".tile-badges")?.remove();

  tile.classList.add(result.status || "absent");

  if (!result.badges?.length) return;

  const wrap = document.createElement("div");
  wrap.className = "tile-badges";
  wrap.setAttribute("aria-hidden", "true");
  for (const badge of result.badges) {
    const el = document.createElement("span");
    el.className = `tile-badge ${badge.status}`;
    el.textContent = `+${badge.count}`;
    wrap.appendChild(el);
  }
  tile.appendChild(wrap);
}

const STATUS_LABEL = {
  correct: "Verde",
  present: "Galben",
  diacritic: "Violet",
  absent: "Gri",
};

function describeStatus(status) {
  switch (status) {
    case "correct":
      return "litera e exactă pe această poziție";
    case "diacritic":
      return "pe această poziție e același grup diacritic, dar forma greșită";
    case "present":
      return "litera exactă există pe o altă poziție";
    case "absent":
      return "litera nu e pe această poziție și nu apare exact în cuvânt";
    default:
      return "";
  }
}

function describeBadge(badge, tileStatus) {
  const n = badge.count;
  if (badge.status === "present") {
    if (tileStatus === "present") {
      return `+${n} galben: încă ${n} ${
        n === 1 ? "apariție exactă" : "apariții exacte"
      } pe alte poziții`;
    }
    return `+${n} galben: litera exactă apare în ${n} ${
      n === 1 ? "altă poziție" : "alte poziții"
    }`;
  }
  return `+${n} violet: ${n} ${
    n === 1 ? "literă" : "litere"
  } din același grup diacritic (formă diferită) pe alte poziții`;
}

function hideExplain() {
  explainOverlay.classList.add("hidden");
}

function showExplain() {
  explainBody.innerHTML = "";

  if (!state.guesses.length) {
    const empty = document.createElement("p");
    empty.className = "explain-empty";
    empty.textContent =
      "Nu ai nicio încercare încă. După ce trimiți un cuvânt, aici vei vedea ce înseamnă fiecare culoare și fiecare +N.";
    explainBody.appendChild(empty);
  } else {
    state.guesses.forEach((entry, index) => {
      const block = document.createElement("article");
      block.className = "explain-guess";

      const label = document.createElement("p");
      label.className = "explain-guess-label";
      label.textContent = `Încercarea ${index + 1} · ${entry.word.toUpperCase()}`;
      block.appendChild(label);

      const row = document.createElement("div");
      row.className = "explain-row";
      [...entry.word].forEach((ch, i) => {
        row.appendChild(renderDemoTile(ch, entry.results[i]));
      });
      block.appendChild(row);

      const list = document.createElement("div");
      list.className = "explain-letters";
      [...entry.word].forEach((ch, i) => {
        const result = entry.results[i];
        const item = document.createElement("div");
        item.className = "explain-letter";
        item.appendChild(renderDemoTile(ch, result));

        const copy = document.createElement("div");
        copy.className = "explain-letter-copy";
        const title = document.createElement("p");
        title.innerHTML = `<strong>${ch.toUpperCase()}</strong> — ${STATUS_LABEL[result.status]}: ${describeStatus(result.status)}.`;
        copy.appendChild(title);

        if (result.badges.length) {
          const bits = document.createElement("ul");
          bits.className = "explain-bits";
          for (const badge of result.badges) {
            const li = document.createElement("li");
            li.textContent = describeBadge(badge, result.status);
            bits.appendChild(li);
          }
          copy.appendChild(bits);
        }

        item.appendChild(copy);
        list.appendChild(item);
      });
      block.appendChild(list);
      explainBody.appendChild(block);
    });
  }

  explainOverlay.classList.remove("hidden");
}

const QWERTY = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["Backspace", "z", "x", "c", "v", "b", "n", "m", "Enter"],
];

const DIACRITIC_ROW = ["ă", "â", "î", "ș", "ț"];

const DIFFICULTY_LABELS = {
  easy: "Ușor",
  medium: "Mediu",
  hard: "Greu",
  all: "Toate",
  custom: "Propriu",
};

const state = {
  language: "ro",
  letterCount: 5,
  difficulty: "easy",
  useDiacritics: true,
  words: [],
  solutions: [],
  answer: "",
  forcedAnswer: null,
  row: 0,
  col: 0,
  grid: [],
  guesses: [],
  keyboard: new KeyboardColoring(),
  done: false,
  revealing: false,
  roundStartedAt: 0,
};

const $ = (sel) => document.querySelector(sel);
const setupEl = $("#setup");
const gameEl = $("#game");
const helpEl = $("#help");
const statsEl = $("#stats");
const wordlistEl = $("#wordlist");
const boardEl = $("#board");
const keyboardEl = $("#keyboard");
const statusEl = $("#status");
const toastEl = $("#toast");
const endOverlay = $("#end-overlay");
const endTitle = $("#end-title");
const endDetail = $("#end-detail");
const endEmoji = $("#end-emoji");
const customWordOverlay = $("#custom-word-overlay");
const customWordForm = $("#custom-word-form");
const customWordInput = $("#custom-word-input");
const customWordCancel = $("#custom-word-cancel");
const explainOverlay = $("#explain-overlay");
const explainBody = $("#explain-body");
const explainClose = $("#explain-close");
const letterCountInput = $("#letter-count");
const letterCountValue = $("#letter-count-value");
const wordlistLetterCountInput = $("#wordlist-letter-count");
const wordlistLetterCountValue = $("#wordlist-letter-count-value");
const difficultyInput = $("#difficulty");
const diacriticsInput = $("#diacritics");
const diacriticsSoftInput = $("#diacritics-soft");
const diaHint = $("#dia-hint");
const diaSeg = document.querySelector(".dia-seg");
const diffPicker = document.querySelector(".diff-picker");
const wordlistDiffPicker = document.querySelector(".wordlist-diff-picker");
const diffHint = $("#diff-hint");
const wordlistDiffHint = $("#wordlist-diff-hint");
const themeBtn = $("#btn-theme");
const themeBtnLabel = $("#theme-toggle-label");
const themeBtnIcon = $("#theme-toggle-icon");
const themeOverlay = $("#theme-overlay");
const themeClose = $("#theme-close");
const modeLabel = $("#mode-label");
const helpBody = $("#help-body");
const statsBody = $("#stats-body");
const wordlistBody = $("#wordlist-body");
const wordlistStatus = $("#wordlist-status");
const resumeBlock = $("#resume-block");
const resumeHint = $("#resume-hint");
const btnResume = $("#btn-resume");
const btnNewGame = $("#btn-new-game");
const btnStart = $("#btn-start");

const THEME_KEY = "wordle-ro-theme";
const THEME_LABELS = {
  auto: "Auto",
  light: "Clar",
  dark: "Întunecat",
};
const THEME_ICONS = {
  auto: `<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4" stroke-linecap="round"/>`,
  light: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke-linecap="round"/>`,
  dark: `<path d="M21 14.5A8.5 8.5 0 1110.5 3a7 7 0 0010.5 11.5z" stroke-linejoin="round"/>`,
};
const themeMq =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function getThemePref() {
  try {
    let v = localStorage.getItem(THEME_KEY);
    if (v === "system") v = "auto";
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

function resolveTheme(pref = getThemePref()) {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return themeMq?.matches ? "dark" : "light";
}

function applyResolvedTheme(resolved) {
  document.documentElement.setAttribute("data-theme", resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = resolved === "dark" ? "#121416" : "#f0f2f5";
  }
}

function syncThemeUi(pref = getThemePref()) {
  const label = THEME_LABELS[pref] || pref;
  if (themeBtnLabel) themeBtnLabel.textContent = label;
  if (themeBtnIcon) {
    themeBtnIcon.innerHTML = THEME_ICONS[pref] || THEME_ICONS.auto;
  }
  if (themeBtn) {
    themeBtn.setAttribute("aria-label", `Temă: ${label}`);
  }
  themeOverlay?.querySelectorAll(".theme-option").forEach((btn) => {
    const active = btn.dataset.themePref === pref;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setThemePref(pref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* ignore */
  }
  applyResolvedTheme(resolveTheme(pref));
  syncThemeUi(pref);
}

function showThemeModal() {
  syncThemeUi();
  themeOverlay?.classList.remove("hidden");
}

function hideThemeModal() {
  themeOverlay?.classList.add("hidden");
}

function initTheme() {
  const pref = getThemePref();
  applyResolvedTheme(resolveTheme(pref));
  syncThemeUi(pref);

  themeBtn?.addEventListener("click", showThemeModal);
  themeClose?.addEventListener("click", hideThemeModal);
  themeOverlay?.addEventListener("click", (e) => {
    if (e.target === themeOverlay) hideThemeModal();
  });
  themeOverlay?.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      setThemePref(btn.dataset.themePref);
      hideThemeModal();
    });
  });

  const onSystemChange = () => {
    if (getThemePref() === "auto") {
      applyResolvedTheme(resolveTheme("auto"));
    }
  };
  if (themeMq) {
    if (typeof themeMq.addEventListener === "function") {
      themeMq.addEventListener("change", onSystemChange);
    } else if (typeof themeMq.addListener === "function") {
      themeMq.addListener(onSystemChange);
    }
  }
}

const fileCache = new Map();
let countRequestId = 0;
let wordlistRequestId = 0;
let toastTimer = null;
let revealClicks = 0;
let revealClickTimer = null;
/** @type {Record<string, number|null>} */
let difficultyCounts = { easy: null, medium: null, hard: null, all: null };

function formatCount(n) {
  return n.toLocaleString("ro-RO");
}

const DIA_HINTS = {
  on: "Cuvinte cu ăâîșț; potriviri apropiate apar violet",
  soft: "Același dicționar, fără diacritice; joci doar cu a–z",
  off: "Fără diacritice deloc — nici în cuvinte, nici pe tastatură",
};

/** Strict diacritics only when main toggle is on and soft mode is off. */
function effectiveUseDiacritics() {
  return diacriticsInput.checked && !diacriticsSoftInput.checked;
}

function currentDiaMode() {
  if (!diacriticsInput.checked) return "off";
  if (diacriticsSoftInput.checked) return "soft";
  return "on";
}

function setDiaMode(mode) {
  diacriticsInput.checked = mode !== "off";
  diacriticsSoftInput.checked = mode === "soft";
  syncDiacriticsUi();
}

function showToast(msg, ms = 1600) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function syncDiacriticsUi() {
  const mode = currentDiaMode();
  if (diaSeg) {
    diaSeg.querySelectorAll(".dia-seg-btn").forEach((btn) => {
      const active = btn.dataset.dia === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }
  if (diaHint) diaHint.textContent = DIA_HINTS[mode] || "";
}

function syncLengthUi() {
  const n = Number(letterCountInput.value) || 5;
  state.letterCount = n;
  letterCountValue.textContent = String(n);
  wordlistLetterCountInput.value = String(n);
  wordlistLetterCountValue.textContent = String(n);
}

function formatAvailableWords(n) {
  if (n === 1) return "1 cuvânt disponibil";
  return `${formatCount(n)} cuvinte disponibile`;
}

function updateDiffHint() {
  const text = (() => {
    const d = state.difficulty;
    if (d === "custom") {
      return state.forcedAnswer
        ? `Cuvânt propriu: ${state.forcedAnswer.toUpperCase()}`
        : "Alege tu cuvântul de ghicit";
    }
    const n = difficultyCounts[d];
    if (n == null) return "Se încarcă…";
    return formatAvailableWords(n);
  })();

  if (diffHint) diffHint.textContent = text;
  if (wordlistDiffHint) wordlistDiffHint.textContent = text;
}

function setDifficulty(d) {
  state.difficulty = d;
  difficultyInput.value = d;
  document.querySelectorAll(".diff-btn").forEach((b) => {
    const active = b.dataset.difficulty === d;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active ? "true" : "false");
  });
  updateDiffHint();
}

function initDiffPicker() {
  diffPicker.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const d = btn.dataset.difficulty;
      if (d === "custom") {
        await promptCustomWord();
      } else {
        state.forcedAnswer = null;
        setDifficulty(d);
      }
    });
  });

  wordlistDiffPicker.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.dataset.difficulty;
      state.forcedAnswer = null;
      setDifficulty(d);
      refreshDifficultyCounts();
      refreshWordList();
    });
  });
}

function initSliders() {
  letterCountInput.addEventListener("input", () => {
    syncLengthUi();
    refreshDifficultyCounts();
  });

  wordlistLetterCountInput.addEventListener("input", () => {
    letterCountInput.value = wordlistLetterCountInput.value;
    syncLengthUi();
    refreshDifficultyCounts();
    refreshWordList();
  });

  diacriticsInput.addEventListener("change", () => {
    syncDiacriticsUi();
    refreshDifficultyCounts();
    if (!wordlistEl.classList.contains("hidden")) refreshWordList();
  });
  diacriticsSoftInput.addEventListener("change", () => {
    syncDiacriticsUi();
    refreshDifficultyCounts();
    if (!wordlistEl.classList.contains("hidden")) refreshWordList();
  });

  diaSeg?.addEventListener("click", (e) => {
    const btn = e.target.closest(".dia-seg-btn");
    if (!btn) return;
    setDiaMode(btn.dataset.dia);
    refreshDifficultyCounts();
    if (!wordlistEl.classList.contains("hidden")) refreshWordList();
  });

  syncLengthUi();
  syncDiacriticsUi();
  setDifficulty(state.difficulty);
}

function normalizeWordList(words, length, useDiacritics) {
  if (!useDiacritics) {
    const seen = new Set();
    const normalized = [];
    for (const w of words) {
      const flat = stripDiacritics(w);
      if (flat.length === length && !seen.has(flat) && /^[a-z]+$/.test(flat)) {
        seen.add(flat);
        normalized.push(flat);
      }
    }
    return normalized;
  }
  return words.filter((w) => w.length === length);
}

async function fetchWordFile(path) {
  if (fileCache.has(path)) return fileCache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Nu am putut încărca ${path}`);
  const words = (await res.text())
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  fileCache.set(path, words);
  return words;
}

async function loadWords(length, useDiacritics, difficulty) {
  const allRaw = await fetchWordFile(`ro_RO/${length}.txt`);
  const words = normalizeWordList(allRaw, length, useDiacritics);
  if (words.length === 0) {
    throw new Error("Lista de cuvinte este goală pentru aceste setări.");
  }

  if (difficulty === "custom") {
    if (!state.forcedAnswer) {
      throw new Error("Alege un cuvânt la dificultatea Propriu.");
    }
    const answer = state.forcedAnswer;
    const guessList = words.includes(answer) ? words : [...words, answer];
    return { words: guessList, solutions: [answer] };
  }

  let solutions = words;
  if (difficulty !== "all") {
    const solRaw = await fetchWordFile(`ro_RO/${length}-${difficulty}.txt`);
    solutions = normalizeWordList(solRaw, length, useDiacritics);
    const allowed = new Set(words);
    solutions = solutions.filter((w) => allowed.has(w));
    if (solutions.length === 0) {
      throw new Error("Nu există cuvinte pentru această dificultate.");
    }
  }

  return { words, solutions };
}

async function refreshDifficultyCounts() {
  const requestId = ++countRequestId;
  const length = Number(letterCountInput.value) || state.letterCount;
  const useDiacritics = effectiveUseDiacritics();

  difficultyCounts = { easy: null, medium: null, hard: null, all: null };
  updateDiffHint();

  try {
    const allRaw = await fetchWordFile(`ro_RO/${length}.txt`);
    if (requestId !== countRequestId) return;

    const words = normalizeWordList(allRaw, length, useDiacritics);
    const allowed = new Set(words);
    const counts = { all: words.length };

    await Promise.all(
      ["easy", "medium", "hard"].map(async (diff) => {
        const raw = await fetchWordFile(`ro_RO/${length}-${diff}.txt`);
        const list = normalizeWordList(raw, length, useDiacritics).filter((w) =>
          allowed.has(w)
        );
        counts[diff] = list.length;
      })
    );

    if (requestId !== countRequestId) return;

    difficultyCounts = counts;
    updateDiffHint();
  } catch {
    if (requestId !== countRequestId) return;
    difficultyCounts = { easy: 0, medium: 0, hard: 0, all: 0 };
    updateDiffHint();
  }
}

function pickAnswer(words) {
  return words[Math.floor(Math.random() * words.length)];
}

function buildBoard() {
  boardEl.style.setProperty("--cols", String(state.letterCount));
  boardEl.innerHTML = "";
  state.grid = [];

  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement("div");
    row.className = "row";
    const tiles = [];
    for (let c = 0; c < state.letterCount; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = String(r);
      tile.dataset.col = String(c);
      row.appendChild(tile);
      tiles.push(tile);
    }
    boardEl.appendChild(row);
    state.grid.push(tiles);
  }
}

function createKeyButton(key) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "key";
  if (key === "Enter" || key === "Backspace") btn.classList.add("wide");
  btn.dataset.key = key;
  if (key === "Backspace") {
    btn.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><path d="M18 9l-6 6M12 9l6 6"/></svg>';
    btn.setAttribute("aria-label", "Șterge");
  } else if (key === "Enter") {
    btn.textContent = "Enter";
  } else {
    btn.textContent = key;
  }
  const st = state.keyboard.getStatus(key);
  if (st) btn.classList.add(st);
  btn.addEventListener("click", () => onKey(key));
  return btn;
}

function buildKeyboard() {
  keyboardEl.innerHTML = "";
  keyboardEl.classList.toggle("with-diacritics", state.useDiacritics);

  if (state.useDiacritics) {
    const diacritics = document.createElement("div");
    diacritics.className = "kb-row keyboard-diacritics";
    diacritics.setAttribute("aria-label", "Diacritice");
    for (const key of DIACRITIC_ROW) {
      diacritics.appendChild(createKeyButton(key));
    }
    keyboardEl.appendChild(diacritics);
  }

  for (const keys of QWERTY) {
    const row = document.createElement("div");
    row.className = "kb-row";
    for (const key of keys) {
      row.appendChild(createKeyButton(key));
    }
    keyboardEl.appendChild(row);
  }
}

function currentGuess() {
  const row = state.grid?.[state.row];
  if (!row) return "";
  return row.map((t) => t.dataset.letter || "").join("");
}

function setTileLetter(row, col, letter) {
  const tile = state.grid[row][col];
  if (letter) {
    tile.textContent = letter;
    tile.dataset.letter = letter;
    tile.classList.add("filled");
  } else {
    tile.textContent = "";
    delete tile.dataset.letter;
    tile.classList.remove("filled");
  }
}

function refreshKeyboardColors() {
  keyboardEl.querySelectorAll(".key").forEach((btn) => {
    const key = btn.dataset.key;
    btn.classList.remove("correct", "present", "diacritic", "absent");
    const st = state.keyboard.getStatus(key);
    if (st) btn.classList.add(st);
  });
}

function onKey(key) {
  if (state.done || state.revealing) return;

  if (key === "Backspace") {
    if (state.col > 0) {
      state.col--;
      setTileLetter(state.row, state.col, "");
    }
    return;
  }

  if (key === "Enter") {
    submitGuess();
    return;
  }

  if (key.length !== 1) return;
  let letter = key.toLowerCase();

  if (state.useDiacritics) {
    if (!/^[a-zăâîșț]$/.test(letter)) return;
  } else {
    letter = stripDiacritics(letter);
    if (!/^[a-z]$/.test(letter)) return;
  }

  if (state.col >= state.letterCount) return;
  setTileLetter(state.row, state.col, letter);
  state.col++;
}

async function submitGuess() {
  if (state.col < state.letterCount) {
    showToast("Completează cuvântul");
    shakeRow(state.row);
    return;
  }

  const guess = currentGuess();
  if (!state.words.includes(guess)) {
    showToast("Cuvânt necunoscut");
    shakeRow(state.row);
    void statsService.recordInvalidAttempt({
      difficulty: state.difficulty,
      letterCount: state.letterCount,
    });
    return;
  }

  state.revealing = true;
  const results = guessColoring.evaluate(
    guess,
    state.answer,
    state.useDiacritics
  );
  state.guesses.push({ word: guess, results });
  void statsService.recordValidGuess({
    difficulty: state.difficulty,
    letterCount: state.letterCount,
    word: guess,
    results,
  });

  await revealRow(state.row, results);

  state.keyboard.applyGuessResults(guess, results);
  refreshKeyboardColors();
  state.revealing = false;

  if (guess === state.answer) {
    state.done = true;
    clearGameSave();
    statusEl.textContent = `Bravo! ${state.row + 1}/${MAX_GUESSES}`;
    void recordFinishedStats(true);
    showEndScreen(true);
    return;
  }

  state.row++;
  state.col = 0;

  if (state.row >= MAX_GUESSES) {
    state.done = true;
    clearGameSave();
    statusEl.textContent = `Răspuns: ${state.answer.toUpperCase()}`;
    void recordFinishedStats(false);
    showEndScreen(false);
    return;
  }

  saveProgress();
}

function recordFinishedStats(won) {
  return statsService.recordFinishedGame({
    difficulty: state.difficulty,
    letterCount: state.letterCount,
    answer: state.answer,
    won,
    guessCount: won ? state.row + 1 : MAX_GUESSES,
    playTimeMs: Math.max(0, Date.now() - (state.roundStartedAt || Date.now())),
    resultsByRow: state.guesses.map((g) => g.results),
  });
}

function maybeRecordAbandon() {
  if (state.done || !state.answer) return;
  if (!state.guesses.length && state.row === 0 && state.col === 0) return;
  void statsService.recordAbandon({
    difficulty: state.difficulty,
    letterCount: state.letterCount,
    guessesMade: state.guesses.length,
    playTimeMs: Math.max(0, Date.now() - (state.roundStartedAt || Date.now())),
  });
  state.done = true;
}

function hasActiveProgress() {
  return Boolean(state.answer && !state.done);
}

function buildSavePayload() {
  if (!hasActiveProgress()) return null;
  return {
    version: 1,
    language: state.language || "ro",
    letterCount: state.letterCount,
    difficulty: state.difficulty,
    diaMode: currentDiaMode(),
    answer: state.answer,
    forcedAnswer: state.forcedAnswer,
    row: state.row,
    col: state.col,
    guesses: state.guesses.map((g) => ({
      word: g.word,
      results: g.results,
    })),
    partial: currentGuess(),
    roundStartedAt: state.roundStartedAt || Date.now(),
    savedAt: Date.now(),
  };
}

function saveProgress() {
  const payload = buildSavePayload();
  if (!payload) return;
  writeGameSave(payload);
}

function syncResumeUi() {
  const saved = readGameSave();
  if (!saved) {
    resumeBlock?.classList.add("hidden");
    btnStart?.classList.remove("hidden");
    return;
  }
  const diffLabel = DIFFICULTY_LABELS[saved.difficulty] || saved.difficulty;
  const tries = saved.guesses?.length ?? 0;
  if (resumeHint) {
    resumeHint.textContent = `${saved.letterCount} litere · ${diffLabel} · ${tries}/${MAX_GUESSES} încercări`;
  }
  resumeBlock?.classList.remove("hidden");
  btnStart?.classList.add("hidden");
}

function abandonSavedGame(saved) {
  if (!saved?.answer) return;
  const guessesMade = saved.guesses?.length ?? 0;
  if (!guessesMade && !saved.partial) return;
  void statsService.recordAbandon({
    difficulty: saved.difficulty,
    letterCount: saved.letterCount,
    guessesMade,
    playTimeMs: Math.max(0, Date.now() - (saved.roundStartedAt || Date.now())),
  });
}

function discardSavedGame() {
  if (hasActiveProgress()) {
    maybeRecordAbandon();
  } else {
    const saved = readGameSave();
    if (saved) abandonSavedGame(saved);
  }
  clearGameSave();
  state.answer = "";
  state.guesses = [];
  state.row = 0;
  state.col = 0;
  state.done = false;
  syncResumeUi();
}

function savedGameHasProgress(saved) {
  if (!saved) return false;
  return (saved.guesses?.length ?? 0) > 0 || Boolean(saved.partial);
}

function promptConfirm({ title, detail, confirmLabel }) {
  return new Promise((resolve) => {
    const overlay = $("#confirm-overlay");
    const titleEl = $("#confirm-title");
    const detailEl = $("#confirm-detail");
    const okBtn = $("#confirm-ok");
    const cancelBtn = $("#confirm-cancel");
    if (!overlay || !okBtn || !cancelBtn) {
      resolve(false);
      return;
    }
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.textContent = detail;
    okBtn.textContent = confirmLabel || "Confirmă";
    overlay.classList.remove("hidden");

    const finish = (value) => {
      overlay.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (e) => {
      if (e.target === overlay) finish(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    };
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

async function startNewGameFromSetup() {
  const saved = readGameSave();
  const inProgress = hasActiveProgress();
  if (saved || inProgress) {
    const hasProgress =
      (inProgress &&
        (state.guesses.length > 0 || Boolean(currentGuess()))) ||
      savedGameHasProgress(saved);
    if (hasProgress) {
      const ok = await promptConfirm({
        title: "Joc nou",
        detail: "Abandonezi partida curentă și începi una nouă?",
        confirmLabel: "Da, joc nou",
      });
      if (!ok) return;
    }
    discardSavedGame();
  }
  await startGame();
}

function paintRestoredBoard() {
  buildBoard();
  buildKeyboard();
  state.keyboard.reset();

  for (let r = 0; r < state.guesses.length; r++) {
    const { word, results } = state.guesses[r];
    for (let c = 0; c < word.length; c++) {
      setTileLetter(r, c, word[c]);
      applyTileStatuses(state.grid[r][c], results[c]);
    }
    state.keyboard.applyGuessResults(word, results);
  }

  const partial = state._partial || "";
  delete state._partial;
  for (let c = 0; c < partial.length; c++) {
    setTileLetter(state.row, c, partial[c]);
  }
  state.col = partial.length;
  refreshKeyboardColors();
}

async function restoreFromSave(saved) {
  setDiaMode(saved.diaMode || "on");
  setLetterCount(saved.letterCount);
  setDifficulty(saved.difficulty);
  if (saved.difficulty === "custom") {
    state.forcedAnswer = saved.forcedAnswer || saved.answer;
  } else {
    state.forcedAnswer = null;
  }

  state.language = saved.language || "ro";
  state.letterCount = saved.letterCount;
  state.difficulty = saved.difficulty;
  state.useDiacritics = effectiveUseDiacritics();
  state.answer = saved.answer;
  state.row = saved.row || 0;
  state.col = 0;
  state.guesses = (saved.guesses || []).map((g) => ({
    word: g.word,
    results: g.results,
  }));
  state._partial = saved.partial || "";
  state.done = false;
  state.revealing = false;
  state.roundStartedAt = saved.roundStartedAt || Date.now();
  revealClicks = 0;

  statusEl.textContent = "Se încarcă…";
  setupEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  hideEndScreen();
  hideExplain();
  gameEl.classList.remove("game-over");

  try {
    const loaded = await loadWords(
      state.letterCount,
      state.useDiacritics,
      state.difficulty
    );
    state.words = loaded.words;
    state.solutions = loaded.solutions;

    if (
      state.difficulty !== "custom" &&
      !state.solutions.includes(state.answer) &&
      !state.words.includes(state.answer)
    ) {
      throw new Error("Partida salvată nu mai este validă.");
    }

    const diffLabel = DIFFICULTY_LABELS[state.difficulty] || state.difficulty;
    const diaLabel = state.useDiacritics
      ? "cu diacritice"
      : diacriticsInput.checked
        ? "fără forțare"
        : "fără diacritice";
    statusEl.textContent = `${state.letterCount} litere · ${diffLabel} · ${diaLabel}`;
    modeLabel.textContent = diffLabel;
    paintRestoredBoard();
    saveProgress();
  } catch (err) {
    clearGameSave();
    syncResumeUi();
    showToast(err.message || "Nu am putut continua partida", 2500);
    gameEl.classList.add("hidden");
    setupEl.classList.remove("hidden");
  }
}

async function resumeGame() {
  if (hasActiveProgress() && state.grid?.length) {
    setupEl.classList.add("hidden");
    helpEl.classList.add("hidden");
    statsEl.classList.add("hidden");
    wordlistEl.classList.add("hidden");
    gameEl.classList.remove("hidden");
    saveProgress();
    return;
  }
  const saved = readGameSave();
  if (!saved) {
    syncResumeUi();
    return;
  }
  await restoreFromSave(saved);
}

function showEndScreen(won) {
  endEmoji.textContent = won ? "✓" : "✗";
  endEmoji.style.color = won ? "var(--correct)" : "var(--absent)";
  endTitle.textContent = won ? "Ai câștigat!" : "Ai pierdut";
  endDetail.textContent = won
    ? `Ai ghicit în ${state.row + 1}/${MAX_GUESSES} încercări.`
    : `Cuvântul era ${state.answer.toUpperCase()}.`;
  endOverlay.classList.remove("hidden");
  gameEl.classList.add("game-over");
}

function hideEndScreen() {
  endOverlay.classList.add("hidden");
}

function dismissEndScreen() {
  hideEndScreen();
}

function shakeRow(r) {
  const row = boardEl.children[r];
  row.style.animation = "none";
  row.offsetHeight;
  row.style.animation = "shake 0.4s ease";
  setTimeout(() => {
    row.style.animation = "";
  }, 400);
}

function revealRow(r, results) {
  return new Promise((resolve) => {
    const tiles = state.grid[r];
    tiles.forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add("reveal");
        applyTileStatuses(tile, results[i]);
        if (i === tiles.length - 1) {
          setTimeout(resolve, 350);
        }
      }, i * 280);
    });
  });
}

function setLetterCount(n) {
  letterCountInput.value = String(n);
  syncLengthUi();
  refreshDifficultyCounts();
}

function applyCustomWord(raw) {
  let word = raw.trim().toLowerCase().replace(/ş/g, "ș").replace(/ţ/g, "ț");
  if (!effectiveUseDiacritics()) word = stripDiacritics(word);
  if (!/^[a-zăâîșț]+$/.test(word) || word.length < MIN_LEN || word.length > MAX_LEN) {
    return null;
  }
  state.forcedAnswer = word;
  setDifficulty("custom");
  setLetterCount(word.length);
  showToast(`Cuvânt setat: ${word.toUpperCase()}`, 2000);
  return word;
}

function promptCustomWord() {
  return new Promise((resolve) => {
    customWordInput.value = state.forcedAnswer || "";
    customWordOverlay.classList.remove("hidden");
    requestAnimationFrame(() => {
      customWordInput.focus();
      customWordInput.select();
    });

    const finish = (ok) => {
      customWordOverlay.classList.add("hidden");
      customWordForm.removeEventListener("submit", onSubmit);
      customWordCancel.removeEventListener("click", onCancel);
      customWordOverlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown, true);
      resolve(ok);
    };

    const onSubmit = (e) => {
      e.preventDefault();
      const word = applyCustomWord(customWordInput.value);
      if (!word) {
        showToast("Cuvânt invalid");
        customWordInput.focus();
        return;
      }
      finish(true);
    };

    const onCancel = () => finish(false);
    const onBackdrop = (e) => {
      if (e.target === customWordOverlay) finish(false);
    };
    const onKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    };

    customWordForm.addEventListener("submit", onSubmit);
    customWordCancel.addEventListener("click", onCancel);
    customWordOverlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown, true);
  });
}

function resetRound() {
  maybeRecordAbandon();
  if (state.difficulty === "custom" && state.forcedAnswer) {
    state.answer = state.forcedAnswer;
  } else {
    state.answer = pickAnswer(state.solutions);
  }
  state.row = 0;
  state.col = 0;
  state.guesses = [];
  state.keyboard.reset();
  state.done = false;
  state.revealing = false;
  state.roundStartedAt = Date.now();
  revealClicks = 0;
  hideEndScreen();
  hideExplain();
  gameEl.classList.remove("game-over");
  const diffLabel = DIFFICULTY_LABELS[state.difficulty] || state.difficulty;
  const diaLabel = state.useDiacritics
    ? "cu diacritice"
    : diacriticsInput.checked
      ? "fără forțare"
      : "fără diacritice";
  statusEl.textContent = `${state.letterCount} litere · ${diffLabel} · ${diaLabel}`;
  modeLabel.textContent = diffLabel;
  buildBoard();
  buildKeyboard();
  saveProgress();
}

async function startGame() {
  state.language = $("#language").value;
  state.letterCount = Number(letterCountInput.value) || 5;
  state.difficulty = difficultyInput.value || "easy";
  state.useDiacritics = effectiveUseDiacritics();

  if (state.difficulty === "custom") {
    if (!state.forcedAnswer && !(await promptCustomWord())) {
      return;
    }
    let forced = state.forcedAnswer;
    if (!state.useDiacritics) forced = stripDiacritics(forced);
    state.forcedAnswer = forced;
    if (forced.length !== state.letterCount) {
      setLetterCount(forced.length);
      state.letterCount = forced.length;
    }
  }

  statusEl.textContent = "Se încarcă…";
  setupEl.classList.add("hidden");
  gameEl.classList.remove("hidden");

  try {
    const loaded = await loadWords(
      state.letterCount,
      state.useDiacritics,
      state.difficulty
    );
    state.words = loaded.words;
    state.solutions = loaded.solutions;
    resetRound();
  } catch (err) {
    showToast(err.message || "Eroare la încărcare", 2500);
    gameEl.classList.add("hidden");
    setupEl.classList.remove("hidden");
  }
}

function backToSetup() {
  if (hasActiveProgress()) {
    saveProgress();
  } else {
    clearGameSave();
  }
  hideEndScreen();
  hideExplain();
  helpEl.classList.add("hidden");
  statsEl.classList.add("hidden");
  wordlistEl.classList.add("hidden");
  gameEl.classList.add("hidden");
  setupEl.classList.remove("hidden");
  syncResumeUi();
}

function showStats() {
  setupEl.classList.add("hidden");
  gameEl.classList.add("hidden");
  helpEl.classList.add("hidden");
  wordlistEl.classList.add("hidden");
  statsEl.classList.remove("hidden");
  const diff = difficultyInput.value || "easy";
  createStatsView({
    bodyEl: statsBody,
    getStats: (filter) => statsService.getStats(filter),
    resetStats: () => statsService.resetAll(),
    initial: {
      difficulty: diff === "custom" ? "all" : diff,
      letterCount: Number(letterCountInput.value) || 5,
    },
  });
}

function hideStats() {
  statsEl.classList.add("hidden");
  setupEl.classList.remove("hidden");
  syncResumeUi();
}

function showHelp() {
  renderHelp();
  setupEl.classList.add("hidden");
  gameEl.classList.add("hidden");
  statsEl.classList.add("hidden");
  wordlistEl.classList.add("hidden");
  helpEl.classList.remove("hidden");
}

function hideHelp() {
  helpEl.classList.add("hidden");
  setupEl.classList.remove("hidden");
  syncResumeUi();
}

function showWordList() {
  if (state.difficulty === "custom") {
    state.forcedAnswer = null;
    setDifficulty("all");
    refreshDifficultyCounts();
  }
  syncLengthUi();
  setupEl.classList.add("hidden");
  gameEl.classList.add("hidden");
  helpEl.classList.add("hidden");
  statsEl.classList.add("hidden");
  wordlistEl.classList.remove("hidden");
  refreshWordList();
}

function hideWordList() {
  wordlistEl.classList.add("hidden");
  setupEl.classList.remove("hidden");
  syncResumeUi();
}

async function refreshWordList() {
  const requestId = ++wordlistRequestId;
  const length = Number(letterCountInput.value) || state.letterCount;
  const difficulty =
    state.difficulty === "custom" ? "all" : state.difficulty || "easy";
  const useDiacritics = effectiveUseDiacritics();
  const diffLabel = DIFFICULTY_LABELS[difficulty] || difficulty;

  wordlistStatus.textContent = "Se încarcă…";
  wordlistBody.innerHTML = "";

  try {
    const loaded = await loadWords(length, useDiacritics, difficulty);
    if (requestId !== wordlistRequestId) return;

    const words = [...loaded.solutions].sort((a, b) =>
      a.localeCompare(b, "ro")
    );
    wordlistStatus.textContent = `${formatCount(words.length)} cuvinte · ${length} litere · ${diffLabel}`;

    if (words.length === 0) {
      const empty = document.createElement("p");
      empty.className = "wordlist-empty";
      empty.textContent = "Niciun cuvânt pentru aceste setări.";
      wordlistBody.appendChild(empty);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "wordlist-grid";
    const frag = document.createDocumentFragment();
    for (const word of words) {
      const el = document.createElement("span");
      el.textContent = word;
      frag.appendChild(el);
    }
    grid.appendChild(frag);
    wordlistBody.appendChild(grid);
  } catch (err) {
    if (requestId !== wordlistRequestId) return;
    wordlistStatus.textContent = "Nu am putut încărca lista.";
    const empty = document.createElement("p");
    empty.className = "wordlist-empty";
    empty.textContent = err.message || "Eroare la încărcare";
    wordlistBody.appendChild(empty);
  }
}

function renderDemoTile(letter, result) {
  const tile = document.createElement("div");
  tile.className = "tile demo-tile filled";
  tile.textContent = letter;
  applyTileStatuses(tile, result);
  return tile;
}

function renderHelp() {
  helpBody.innerHTML = "";

  const how = document.createElement("section");
  how.className = "help-section";
  how.innerHTML = `
    <h3 class="help-section-title">Cum se joacă</h3>
    <p class="help-intro">
      Ai 6 încercări să ghicești cuvântul secret din dicționarul românesc.
      Alege numărul de litere și dificultatea, apoi introduci câte un cuvânt valid pe rând.
      După fiecare încercare, literele se colorează ca să-ți arate cât de aproape ești.
      Poți juca cu diacritice (ă, â, î, ș, ț) sau fără, din meniul principal.
    </p>
  `;
  helpBody.appendChild(how);

  const colors = document.createElement("section");
  colors.className = "help-section";

  const colorsTitle = document.createElement("h3");
  colorsTitle.className = "help-section-title";
  colorsTitle.textContent = "Culorile";
  colors.appendChild(colorsTitle);

  const intro = document.createElement("p");
  intro.className = "help-intro";
  intro.textContent =
    "Fiecare literă primește o singură culoare pentru poziția curentă. Informațiile despre alte poziții apar ca badge-uri +N în colțul din dreapta sus.";
  colors.appendChild(intro);

  const legend = document.createElement("div");
  legend.className = "help-legend";
  legend.innerHTML = `
    <span><i class="swatch correct"></i> Verde — loc corect</span>
    <span><i class="swatch present"></i> Galben — altă poziție</span>
    <span><i class="swatch diacritic"></i> Violet — diacritic pe loc</span>
    <span><i class="swatch absent"></i> Gri — absent</span>
  `;
  colors.appendChild(legend);

  const badgesIntro = document.createElement("p");
  badgesIntro.className = "help-intro";
  badgesIntro.innerHTML = `
    <strong>Badge-uri</strong> (doar alte poziții):
    <strong>+N galben</strong> = literă exactă în altă parte;
    <strong>+N violet</strong> = aceeași familie diacritică (formă diferită) în altă parte.
    Pe o literă deja galbenă, +N galben înseamnă apariții <em>în plus</em> față de cea semnalată de galben.
    Violetul pe loc și badge-urile apar doar când joci cu diacritice.
  `.trim();
  colors.appendChild(badgesIntro);

  for (const ex of HELP_EXAMPLES) {
    const card = document.createElement("article");
    card.className = "help-card";

    const h = document.createElement("h3");
    h.textContent = ex.title;
    card.appendChild(h);

    const meta = document.createElement("p");
    meta.className = "help-meta";
    meta.innerHTML = `Răspuns: <strong>${ex.answer.toUpperCase()}</strong> · Încercare: <strong>${ex.guess.toUpperCase()}</strong>`;
    card.appendChild(meta);

    const results = guessColoring.evaluate(ex.guess, ex.answer, true);
    const row = document.createElement("div");
    row.className = "help-row";
    [...ex.guess].forEach((ch, i) => {
      const tile = renderDemoTile(ch, results[i]);
      if (i === ex.focus) tile.classList.add("demo-focus");
      row.appendChild(tile);
    });
    card.appendChild(row);

    const note = document.createElement("p");
    note.className = "help-note";
    note.textContent = ex.text;
    card.appendChild(note);

    colors.appendChild(card);
  }

  helpBody.appendChild(colors);
}

$("#setup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  startGame();
});

btnResume?.addEventListener("click", () => {
  void resumeGame();
});
btnNewGame?.addEventListener("click", () => {
  void startNewGameFromSetup();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveProgress();
});
window.addEventListener("pagehide", () => {
  saveProgress();
});

$("#btn-back").addEventListener("click", backToSetup);
$("#btn-explain").addEventListener("click", showExplain);
explainClose.addEventListener("click", hideExplain);
explainOverlay.addEventListener("click", (e) => {
  if (e.target === explainOverlay) hideExplain();
});
$("#btn-new").addEventListener("click", async () => {
  if (!state.solutions.length) return;
  if (hasActiveProgress()) {
    const ok = await promptConfirm({
      title: "Cuvânt nou",
      detail: "Abandonezi partida curentă și începi una nouă?",
      confirmLabel: "Da, cuvânt nou",
    });
    if (!ok) return;
  }
  resetRound();
  showToast("Cuvânt nou");
});

$("#btn-help").addEventListener("click", showHelp);
$("#btn-help-back").addEventListener("click", hideHelp);
$("#btn-stats").addEventListener("click", showStats);
$("#btn-stats-back").addEventListener("click", hideStats);
$("#btn-wordlist").addEventListener("click", showWordList);
$("#btn-wordlist-back").addEventListener("click", hideWordList);
$("#btn-play-again").addEventListener("click", () => {
  if (!state.solutions.length) return;
  resetRound();
});
$("#btn-end-setup").addEventListener("click", backToSetup);
$("#btn-end-close").addEventListener("click", dismissEndScreen);
endOverlay.addEventListener("click", (e) => {
  if (e.target === endOverlay) dismissEndScreen();
});

modeLabel.addEventListener("click", () => {
  if (gameEl.classList.contains("hidden") || !state.answer) return;
  revealClicks += 1;
  clearTimeout(revealClickTimer);
  revealClickTimer = setTimeout(() => {
    revealClicks = 0;
  }, 2500);
  if (revealClicks >= 5) {
    revealClicks = 0;
    showToast(state.answer.toUpperCase(), 2500);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (themeOverlay && !themeOverlay.classList.contains("hidden")) {
    if (e.key === "Escape") {
      e.preventDefault();
      hideThemeModal();
    }
    return;
  }
  const confirmOverlay = $("#confirm-overlay");
  if (confirmOverlay && !confirmOverlay.classList.contains("hidden")) {
    return;
  }
  if (!explainOverlay.classList.contains("hidden")) {
    if (e.key === "Escape") {
      e.preventDefault();
      hideExplain();
    }
    return;
  }
  if (!endOverlay.classList.contains("hidden")) {
    if (e.key === "Escape") {
      e.preventDefault();
      dismissEndScreen();
    }
    return;
  }
  if (!helpEl.classList.contains("hidden")) return;
  if (!statsEl.classList.contains("hidden")) return;
  if (!wordlistEl.classList.contains("hidden")) return;
  if (gameEl.classList.contains("hidden")) return;

  if (e.key === "Backspace") {
    e.preventDefault();
    onKey("Backspace");
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    onKey("Enter");
    return;
  }
  if (e.key.length === 1) {
    onKey(e.key);
  }
});

initTheme();
initSliders();
initDiffPicker();
refreshDifficultyCounts();
syncResumeUi();
void statsService.init().catch((err) => {
  console.warn("Stats DB init failed", err);
});
