const MAX_GUESSES = 6;
const MIN_LEN = 3;
const MAX_LEN = 12;

/** Romanian diacritic groups: same group → orange feedback */
const DIACRITIC_GROUPS = [
  new Set(["a", "ă", "â"]),
  new Set(["i", "î"]),
  new Set(["s", "ș"]),
  new Set(["t", "ț"]),
];

const BASE_OF = (() => {
  const map = {};
  for (const group of DIACRITIC_GROUPS) {
    const base = [...group][0];
    for (const ch of group) map[ch] = base;
  }
  return map;
})();

const stripDiacritics = (s) =>
  [...s.toLowerCase()].map((c) => BASE_OF[c] ?? c).join("");

const sameGroup = (a, b) => {
  if (a === b) return true;
  for (const g of DIACRITIC_GROUPS) {
    if (g.has(a) && g.has(b)) return true;
  }
  return false;
};

const RANK = { correct: 4, present: 3, diacritic: 2, absent: 1 };
const STATUS_ORDER = ["correct", "present", "diacritic", "absent"];

function orderStatuses(statuses) {
  const set = new Set(statuses);
  return STATUS_ORDER.filter((s) => set.has(s));
}

/**
 * Each guess letter is compared to every letter in the answer.
 * A tile can get multiple statuses (shown as left→right color stripes):
 * - correct (green): exact match at this position, OR same diacritic group at this position
 * - present (yellow): exact letter appears elsewhere in the answer
 * - diacritic (purple): same diacritic group as some answer letter, but not the exact character
 */
function evaluate(guess, answer, useDiacritics) {
  const n = guess.length;
  return Array.from({ length: n }, (_, i) => {
    const g = guess[i];
    const statuses = new Set();

    if (g === answer[i]) {
      statuses.add("correct");
    } else if (useDiacritics && sameGroup(g, answer[i])) {
      statuses.add("correct");
      statuses.add("diacritic");
    }

    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      if (g === answer[j]) {
        statuses.add("present");
      } else if (useDiacritics && sameGroup(g, answer[j])) {
        statuses.add("diacritic");
      }
    }

    const ordered = orderStatuses([...statuses]);
    return ordered.length ? ordered : ["absent"];
  });
}

function applyTileStatuses(tile, statuses) {
  tile.classList.remove(
    "correct",
    "present",
    "diacritic",
    "absent",
    "split-2",
    "split-3"
  );
  tile.style.background = "";
  tile.style.borderColor = "";
  tile.style.color = "";
  tile.querySelector(".tile-bands")?.remove();

  const ordered = orderStatuses(statuses);
  if (ordered.length <= 1) {
    tile.classList.add(ordered[0] || "absent");
    return;
  }

  tile.classList.add(ordered.length === 2 ? "split-2" : "split-3");
  tile.style.color = "#fff";

  const bands = document.createElement("div");
  bands.className = "tile-bands";
  bands.setAttribute("aria-hidden", "true");
  for (const s of ordered) {
    const band = document.createElement("i");
    band.className = s;
    bands.appendChild(band);
  }
  tile.prepend(bands);
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
  keyStatus: {},
  done: false,
  revealing: false,
};

const $ = (sel) => document.querySelector(sel);
const setupEl = $("#setup");
const gameEl = $("#game");
const helpEl = $("#help");
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
const letterCountInput = $("#letter-count");
const letterCountValue = $("#letter-count-value");
const wordlistLetterCountInput = $("#wordlist-letter-count");
const wordlistLetterCountValue = $("#wordlist-letter-count-value");
const difficultyInput = $("#difficulty");
const diacriticsInput = $("#diacritics");
const diacriticsSoftInput = $("#diacritics-soft");
const diacriticsSoftWrap = $("#diacritics-soft-wrap");
const diffPicker = document.querySelector(".diff-picker");
const wordlistDiffPicker = document.querySelector(".wordlist-diff-picker");
const modeLabel = $("#mode-label");
const helpBody = $("#help-body");
const wordlistBody = $("#wordlist-body");
const wordlistStatus = $("#wordlist-status");

const fileCache = new Map();
let countRequestId = 0;
let wordlistRequestId = 0;
let toastTimer = null;
let revealClicks = 0;
let revealClickTimer = null;

function formatCount(n) {
  return n.toLocaleString("ro-RO");
}

/** Strict diacritics only when main toggle is on and soft mode is off. */
function effectiveUseDiacritics() {
  return diacriticsInput.checked && !diacriticsSoftInput.checked;
}

function showToast(msg, ms = 1600) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function syncDiacriticsUi() {
  const on = diacriticsInput.checked;
  diacriticsSoftWrap.classList.toggle("hidden", !on);
  if (!on) diacriticsSoftInput.checked = false;
}

function syncLengthUi() {
  const n = Number(letterCountInput.value) || 5;
  state.letterCount = n;
  letterCountValue.textContent = String(n);
  wordlistLetterCountInput.value = String(n);
  wordlistLetterCountValue.textContent = String(n);
}

function updateCustomCountLabel() {
  const el = diffPicker.querySelector('[data-count-for="custom"]');
  if (!el) return;
  el.textContent = state.forcedAnswer
    ? state.forcedAnswer.toUpperCase()
    : "—";
}

function setDifficulty(d) {
  state.difficulty = d;
  difficultyInput.value = d;
  document.querySelectorAll(".diff-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.difficulty === d);
  });
  updateCustomCountLabel();
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

  document.querySelectorAll(".diff-count").forEach((el) => {
    if (el.dataset.countFor === "custom") return;
    el.textContent = "…";
  });

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

    document.querySelectorAll(".diff-count").forEach((el) => {
      const key = el.dataset.countFor;
      if (key === "custom") return;
      el.textContent = formatCount(counts[key] ?? 0);
    });
    updateCustomCountLabel();
  } catch {
    if (requestId !== countRequestId) return;
    document.querySelectorAll(".diff-count").forEach((el) => {
      if (el.dataset.countFor === "custom") return;
      el.textContent = "—";
    });
    updateCustomCountLabel();
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
  const st = state.keyStatus[key];
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
  return state.grid[state.row]
    .map((t) => t.dataset.letter || "")
    .join("");
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

function upgradeKey(letter, status) {
  const prev = state.keyStatus[letter];
  if (!prev || RANK[status] > RANK[prev]) {
    state.keyStatus[letter] = status;
  }
}

function refreshKeyboardColors() {
  keyboardEl.querySelectorAll(".key").forEach((btn) => {
    const key = btn.dataset.key;
    btn.classList.remove("correct", "present", "diacritic", "absent");
    const st = state.keyStatus[key];
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
    return;
  }

  state.revealing = true;
  const results = evaluate(guess, state.answer, state.useDiacritics);

  await revealRow(state.row, results);

  for (let i = 0; i < guess.length; i++) {
    for (const st of results[i]) {
      upgradeKey(guess[i], st);
    }
  }
  refreshKeyboardColors();
  state.revealing = false;

  if (guess === state.answer) {
    state.done = true;
    statusEl.textContent = `Bravo! ${state.row + 1}/${MAX_GUESSES}`;
    showEndScreen(true);
    return;
  }

  state.row++;
  state.col = 0;

  if (state.row >= MAX_GUESSES) {
    state.done = true;
    statusEl.textContent = `Răspuns: ${state.answer.toUpperCase()}`;
    showEndScreen(false);
  }
}

function showEndScreen(won) {
  endEmoji.textContent = won ? "✓" : "✗";
  endEmoji.style.color = won ? "var(--correct)" : "var(--absent)";
  endTitle.textContent = won ? "Ai câștigat!" : "Ai pierdut";
  endDetail.textContent = won
    ? `Ai ghicit în ${state.row + 1}/${MAX_GUESSES} încercări.`
    : `Cuvântul era ${state.answer.toUpperCase()}.`;
  endOverlay.classList.remove("hidden");
}

function hideEndScreen() {
  endOverlay.classList.add("hidden");
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
  if (state.difficulty === "custom" && state.forcedAnswer) {
    state.answer = state.forcedAnswer;
  } else {
    state.answer = pickAnswer(state.solutions);
  }
  state.row = 0;
  state.col = 0;
  state.keyStatus = {};
  state.done = false;
  state.revealing = false;
  revealClicks = 0;
  hideEndScreen();
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
  hideEndScreen();
  helpEl.classList.add("hidden");
  wordlistEl.classList.add("hidden");
  gameEl.classList.add("hidden");
  setupEl.classList.remove("hidden");
}

function showHelp() {
  renderHelp();
  setupEl.classList.add("hidden");
  gameEl.classList.add("hidden");
  wordlistEl.classList.add("hidden");
  helpEl.classList.remove("hidden");
}

function hideHelp() {
  helpEl.classList.add("hidden");
  setupEl.classList.remove("hidden");
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
  wordlistEl.classList.remove("hidden");
  refreshWordList();
}

function hideWordList() {
  wordlistEl.classList.add("hidden");
  setupEl.classList.remove("hidden");
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

const HELP_EXAMPLES = [
  {
    title: "Verde — loc corect",
    answer: "carte",
    guess: "carte",
    focus: 0,
    text: "Litera este exactă și pe poziția corectă. Exemplu: C din CARTE.",
  },
  {
    title: "Galben — altă poziție",
    answer: "maree",
    guess: "aerat",
    focus: 0,
    text: "Litera există în cuvânt, dar pe altă poziție. Exemplu: A din AERAT vs MAREE.",
  },
  {
    title: "Violet — grup diacritic",
    answer: "pâine",
    guess: "abate",
    focus: 0,
    text: "Litera e din același grup (a/ă/â), dar nu e forma exactă și nici pe locul corect. Exemplu: A din ABATE față de Â din PÂINE.",
  },
  {
    title: "Gri — absent",
    answer: "carte",
    guess: "noroc",
    focus: 0,
    text: "Litera nu apare deloc în cuvânt (nici ca variantă cu diacritic). Exemplu: N din NOROC vs CARTE.",
  },
  {
    title: "Două culori — verde + violet",
    answer: "pâine",
    guess: "parte",
    focus: 1,
    text: "A pe locul lui Â: poziție corectă (verde) și diacritic greșit (violet). Exemplu: A din PARTE vs Â din PÂINE.",
  },
  {
    title: "Două culori — galben + violet",
    answer: "tăiat",
    guess: "pastă",
    focus: 4,
    text: "Ă din PASTĂ: există exact în altă parte (galben) și e înrudit cu A din răspuns (violet).",
  },
  {
    title: "Trei culori — verde + galben + violet",
    answer: "tăiat",
    guess: "pastă",
    focus: 1,
    text: "A din PASTĂ: pe locul lui Ă (verde+violet) și mai există un A exact în altă parte (galben).",
  },
];

function renderDemoTile(letter, statuses) {
  const tile = document.createElement("div");
  tile.className = "tile demo-tile filled";
  tile.textContent = letter;
  applyTileStatuses(tile, statuses);
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
    "Fiecare literă din încercare este comparată cu toate literele din răspuns. O literă poate primi una, două sau trei culori simultan (benzi pe același pătrat).";
  colors.appendChild(intro);

  const legend = document.createElement("div");
  legend.className = "help-legend";
  legend.innerHTML = `
    <span><i class="swatch correct"></i> Verde — loc corect</span>
    <span><i class="swatch present"></i> Galben — altă poziție</span>
    <span><i class="swatch diacritic"></i> Violet — grup diacritic</span>
    <span><i class="swatch absent"></i> Gri — absent</span>
  `;
  colors.appendChild(legend);

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

    const results = evaluate(ex.guess, ex.answer, true);
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

$("#btn-back").addEventListener("click", backToSetup);
$("#btn-new").addEventListener("click", () => {
  if (!state.solutions.length) return;
  resetRound();
  showToast("Cuvânt nou");
});

$("#btn-help").addEventListener("click", showHelp);
$("#btn-help-back").addEventListener("click", hideHelp);
$("#btn-wordlist").addEventListener("click", showWordList);
$("#btn-wordlist-back").addEventListener("click", hideWordList);
$("#btn-play-again").addEventListener("click", () => {
  if (!state.solutions.length) return;
  resetRound();
});
$("#btn-end-setup").addEventListener("click", backToSetup);

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
  if (!helpEl.classList.contains("hidden")) return;
  if (!wordlistEl.classList.contains("hidden")) return;
  if (gameEl.classList.contains("hidden")) return;
  if (!endOverlay.classList.contains("hidden")) return;

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

initSliders();
initDiffPicker();
refreshDifficultyCounts();
