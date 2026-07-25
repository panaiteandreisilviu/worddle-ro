import { STAT_CATEGORIES, STAT_HINTS, STAT_LABELS } from "./schema.js";

const DIFF_OPTIONS = [
  { value: "all", label: "Toate" },
  { value: "easy", label: "Ușor" },
  { value: "medium", label: "Mediu" },
  { value: "hard", label: "Greu" },
];

function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatValue(key, stats) {
  const raw = key.includes(".")
    ? key.split(".").reduce((o, k) => o?.[k], stats)
    : stats[key];

  if (raw == null || Number.isNaN(raw)) return "—";

  if (
    key === "winRate" ||
    key === "winRateIn3" ||
    key === "winRateIn4" ||
    key === "invalidRate" ||
    key === "abandonRate" ||
    key === "violetGameRate"
  ) {
    return `${Math.round(raw * 100)}%`;
  }
  if (
    key === "avgGuessesOnWins" ||
    key === "avgGuessesAll" ||
    key === "avgFirstRowGreens"
  ) {
    return Number(raw).toFixed(2);
  }
  if (key.endsWith("Ms") || key === "totalPlayTimeMs") {
    return formatDuration(raw);
  }
  if (key === "lastPlayedAt") {
    try {
      return new Date(raw).toLocaleString("ro-RO");
    } catch {
      return "—";
    }
  }
  if (typeof raw === "number" && !Number.isInteger(raw)) {
    return raw.toFixed(2);
  }
  return String(raw);
}

function formatDateTime(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatTries(n) {
  return `${n}/6`;
}

function formatPct(n) {
  return `${Number(n).toFixed(1)}%`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const RESULT_ICON_WIN = `<svg class="stats-guessed-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const RESULT_ICON_LOSS = `<svg class="stats-guessed-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>`;

/**
 * @param {{
 *   bodyEl: HTMLElement,
 *   getStats: (filter) => Promise<object>,
 *   resetStats?: () => Promise<void>,
 *   initial?: { difficulty?: string, letterCount?: number|null }
 * }} opts
 */
export function createStatsView({ bodyEl, getStats, resetStats, initial = {} }) {
  let difficulty = initial.difficulty || "all";
  let letterCount = initial.letterCount ?? null;
  let tab = STAT_CATEGORIES[0].id;
  let loading = false;
  let ignoreScrollUntil = 0;

  const letterSliderValue = () => (letterCount == null ? 2 : letterCount);

  function renderShell() {
    bodyEl.innerHTML = `
      <div class="stats-chrome">
        <div class="stats-filters">
          <label class="field">
            <span class="field-label">
              Dificultate
              <strong class="field-value" data-stats-diff-label></strong>
            </span>
            <input type="range" class="slider" data-stats-diff min="0" max="3" step="1" />
            <div class="slider-ends"><span>Toate</span><span>Greu</span></div>
          </label>
          <label class="field">
            <span class="field-label">
              Număr de litere
              <strong class="field-value" data-stats-len-label></strong>
            </span>
            <input type="range" class="slider" data-stats-len min="2" max="12" step="1" />
            <div class="slider-ends"><span>Toate</span><span>12</span></div>
          </label>
        </div>
        <div class="stats-tabs" role="tablist"></div>
      </div>
      <div class="stats-scroll" data-stats-scroll>
        <div class="stats-sections" data-stats-sections></div>
        <button type="button" class="btn-secondary stats-reset" data-stats-reset>
          Resetează statisticile
        </button>
      </div>
    `;

    const scrollEl = () => bodyEl.querySelector("[data-stats-scroll]");

    const diffSlider = bodyEl.querySelector("[data-stats-diff]");
    const lenSlider = bodyEl.querySelector("[data-stats-len]");
    diffSlider.value = String(
      Math.max(0, DIFF_OPTIONS.findIndex((d) => d.value === difficulty))
    );
    lenSlider.value = String(letterSliderValue());

    const tabs = bodyEl.querySelector(".stats-tabs");
    for (const cat of STAT_CATEGORIES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stats-tab";
      btn.dataset.tab = cat.id;
      btn.textContent = cat.label;
      btn.setAttribute("role", "tab");
      tabs.appendChild(btn);
    }

    diffSlider.addEventListener("input", () => {
      difficulty = DIFF_OPTIONS[Number(diffSlider.value)]?.value || "all";
      refresh();
    });
    lenSlider.addEventListener("input", () => {
      const v = Number(lenSlider.value);
      letterCount = v <= 2 ? null : v;
      refresh();
    });
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tab]");
      if (!btn) return;
      scrollToSection(btn.dataset.tab);
    });

    scrollEl()?.addEventListener("scroll", () => {
      if (Date.now() < ignoreScrollUntil) return;
      updateActiveFromScroll();
    });

    bodyEl.querySelector("[data-stats-reset]")?.addEventListener("click", async () => {
      if (!resetStats) return;
      const ok = window.confirm(
        "Ștergi toate statisticile?\n\nAceastă acțiune nu poate fi anulată."
      );
      if (!ok) return;
      try {
        await resetStats();
        await refresh();
      } catch (err) {
        const sections = bodyEl.querySelector("[data-stats-sections]");
        if (sections) {
          sections.innerHTML = `<p class="stats-empty">${err.message || "Eroare la resetare"}</p>`;
        }
      }
    });

    syncFilterLabels();
    renderTabs();
  }

  function syncFilterLabels() {
    const diffLabel = bodyEl.querySelector("[data-stats-diff-label]");
    const lenLabel = bodyEl.querySelector("[data-stats-len-label]");
    if (diffLabel) {
      diffLabel.textContent =
        DIFF_OPTIONS.find((d) => d.value === difficulty)?.label || "Toate";
    }
    if (lenLabel) {
      lenLabel.textContent = letterCount == null ? "Toate" : String(letterCount);
    }
    const diffSlider = bodyEl.querySelector("[data-stats-diff]");
    const lenSlider = bodyEl.querySelector("[data-stats-len]");
    if (diffSlider) {
      diffSlider.value = String(
        Math.max(0, DIFF_OPTIONS.findIndex((d) => d.value === difficulty))
      );
    }
    if (lenSlider) lenSlider.value = String(letterSliderValue());
  }

  function renderTabs() {
    bodyEl.querySelectorAll(".stats-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
      btn.setAttribute("aria-selected", btn.dataset.tab === tab ? "true" : "false");
    });
  }

  function offsetInScroller(scroller, el) {
    return (
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop
    );
  }

  function updateActiveFromScroll() {
    const scroller = bodyEl.querySelector("[data-stats-scroll]");
    if (!scroller) return;
    const marker = scroller.scrollTop + 12;
    let current = STAT_CATEGORIES[0].id;
    for (const cat of STAT_CATEGORIES) {
      const el = scroller.querySelector(`[data-section="${cat.id}"]`);
      if (!el) continue;
      if (offsetInScroller(scroller, el) <= marker) current = cat.id;
    }
    if (current !== tab) {
      tab = current;
      renderTabs();
    }
  }

  function scrollToSection(id) {
    const scroller = bodyEl.querySelector("[data-stats-scroll]");
    const el = scroller?.querySelector(`[data-section="${id}"]`);
    if (!scroller || !el) return;
    tab = id;
    renderTabs();
    ignoreScrollUntil = Date.now() + 700;
    const top = Math.max(0, offsetInScroller(scroller, el));
    scroller.scrollTo({ top, behavior: "smooth" });
  }

  function buildKeyList(cat, stats) {
    const list = document.createElement("dl");
    list.className = "stats-list";
    for (const key of cat.keys || []) {
      const row = document.createElement("div");
      row.className = "stats-row";
      const dt = document.createElement("dt");
      const label = document.createElement("span");
      label.className = "stats-row-label";
      label.textContent = STAT_LABELS[key] || key;
      dt.appendChild(label);
      const hint = STAT_HINTS[key];
      if (hint) {
        const hintEl = document.createElement("span");
        hintEl.className = "stats-row-hint";
        hintEl.textContent = hint;
        dt.appendChild(hintEl);
      }
      const dd = document.createElement("dd");
      dd.textContent = formatValue(key, stats);
      row.append(dt, dd);
      list.appendChild(row);
    }
    return list;
  }

  function buildDistribution(stats) {
    const wrap = document.createElement("div");
    wrap.className = "stats-dist";
    const hist = document.createElement("div");
    hist.className = "stats-hist";

    const rows = [1, 2, 3, 4, 5, 6].map((n) => ({
      label: n === 1 ? "1 încercare" : `${n} încercări`,
      count: Number(stats.winsByTries?.[n]) || 0,
      kind: "win",
    }));
    rows.push({
      label: "Pierdute",
      count: Number(stats.losses) || 0,
      kind: "loss",
    });

    const max = Math.max(1, ...rows.map((r) => r.count));
    for (const item of rows) {
      const row = document.createElement("div");
      row.className = "stats-hist-row";
      const label = document.createElement("span");
      label.className = "stats-hist-label";
      label.textContent = item.label;
      const track = document.createElement("div");
      track.className = "stats-hist-track";
      const bar = document.createElement("div");
      bar.className = "stats-hist-bar";
      if (item.kind === "loss") bar.classList.add("is-loss");
      if (item.count > 0) bar.classList.add("has-value");
      const pctWidth =
        item.count === 0 ? null : Math.max(14, (item.count / max) * 100);
      if (pctWidth == null) {
        bar.style.width = "1.8rem";
      } else {
        bar.style.width = `${pctWidth}%`;
      }
      bar.textContent = String(item.count);
      track.appendChild(bar);
      row.append(label, track);
      hist.appendChild(row);
    }
    wrap.appendChild(hist);
    return wrap;
  }

  function buildGuessedWords(stats) {
    const words = stats.guessedWords || [];
    if (!words.length) {
      const empty = document.createElement("p");
      empty.className = "stats-empty";
      empty.textContent = "Niciun joc înregistrat încă";
      return empty;
    }
    const list = document.createElement("ul");
    list.className = "stats-guessed-list";
    for (const row of words) {
      const li = document.createElement("li");
      const won = !!row.won;
      li.className = `stats-guessed-row ${won ? "is-win" : "is-loss"}`;
      li.innerHTML = `
        <span class="stats-guessed-result" title="${won ? "Reușit" : "Eșuat"}" aria-label="${won ? "Reușit" : "Eșuat"}">
          ${won ? RESULT_ICON_WIN : RESULT_ICON_LOSS}
        </span>
        <span class="stats-guessed-word">${escapeHtml(String(row.answer || "").toUpperCase())}</span>
        <span class="stats-guessed-date">${escapeHtml(formatDateTime(row.finishedAt))}</span>
        <span class="stats-guessed-tries">${escapeHtml(formatTries(row.guessCount))}</span>
      `;
      list.appendChild(li);
    }
    return list;
  }

  function buildComposite(cat, stats) {
    const wrap = document.createElement("div");
    wrap.className = "stats-dist";
    if (cat.keys?.length) {
      wrap.appendChild(buildKeyList(cat, stats));
    }
    if (cat.kind === "guessedWords") {
      wrap.appendChild(buildGuessedWords(stats));
    } else if (cat.kind === "triedWords") {
      wrap.appendChild(buildTriedWords(stats));
    } else if (cat.kind === "triedLetters") {
      wrap.appendChild(buildTriedLetters(stats));
    }
    return wrap;
  }

  function buildTriedWords(stats) {
    const words = stats.triedWords || [];
    if (!words.length) {
      const empty = document.createElement("p");
      empty.className = "stats-empty";
      empty.textContent = "Nicio încercare înregistrată încă";
      return empty;
    }
    const list = document.createElement("ul");
    list.className = "stats-tried-list";
    for (const row of words) {
      const li = document.createElement("li");
      li.className = "stats-tried-row";
      const triesLabel = row.tries === 1 ? "1×" : `${row.tries}×`;
      li.innerHTML = `
        <span class="stats-tried-word">${escapeHtml(String(row.word || "").toUpperCase())}</span>
        <span class="stats-tried-count">${escapeHtml(triesLabel)}</span>
        <span class="stats-tried-pcts">
          <span class="stats-tried-pct is-green">${escapeHtml(formatPct(row.greenPct))}</span>
          <span class="stats-tried-pct is-yellow">${escapeHtml(formatPct(row.yellowPct))}</span>
          <span class="stats-tried-pct is-purple">${escapeHtml(formatPct(row.purplePct))}</span>
        </span>
      `;
      list.appendChild(li);
    }
    return list;
  }

  function buildTriedLetters(stats) {
    const letters = stats.triedLetters || [];
    if (!letters.length) {
      const empty = document.createElement("p");
      empty.className = "stats-empty";
      empty.textContent = "Nicio literă înregistrată încă";
      return empty;
    }
    const list = document.createElement("ul");
    list.className = "stats-tried-list";
    for (const row of letters) {
      const li = document.createElement("li");
      li.className = "stats-tried-row";
      const triesLabel = row.tries === 1 ? "1×" : `${row.tries}×`;
      li.innerHTML = `
        <span class="stats-tried-word">${escapeHtml(String(row.letter || "").toUpperCase())}</span>
        <span class="stats-tried-count">${escapeHtml(triesLabel)}</span>
        <span class="stats-tried-pcts">
          <span class="stats-tried-pct is-green">${escapeHtml(formatPct(row.greenPct))}</span>
          <span class="stats-tried-pct is-yellow">${escapeHtml(formatPct(row.yellowPct))}</span>
          <span class="stats-tried-pct is-purple">${escapeHtml(formatPct(row.purplePct))}</span>
        </span>
      `;
      list.appendChild(li);
    }
    return list;
  }

  function buildSectionContent(cat, stats) {
    if (cat.kind === "distribution") return buildDistribution(stats);
    if (cat.kind === "guessedWords") return buildComposite(cat, stats);
    if (cat.kind === "triedWords") return buildTriedWords(stats);
    if (cat.kind === "triedLetters") return buildTriedLetters(stats);
    return buildKeyList(cat, stats);
  }

  function renderSections(stats) {
    const root = bodyEl.querySelector("[data-stats-sections]");
    if (!root) return;
    if (!stats) {
      root.innerHTML = `<p class="stats-empty">Se încarcă…</p>`;
      return;
    }
    root.innerHTML = "";
    for (const cat of STAT_CATEGORIES) {
      const section = document.createElement("section");
      section.className = "stats-section";
      section.dataset.section = cat.id;
      section.id = `stats-section-${cat.id}`;

      const title = document.createElement("h3");
      title.className = "stats-section-title";
      title.textContent = cat.label;

      const panel = document.createElement("div");
      panel.className = "stats-panel";
      panel.appendChild(buildSectionContent(cat, stats));

      section.append(title, panel);
      root.appendChild(section);
    }
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    syncFilterLabels();
    renderSections(null);
    try {
      const stats = await getStats({
        difficulty: difficulty === "all" ? null : difficulty,
        letterCount,
      });
      bodyEl._statsCache = stats;
      renderSections(stats);
      renderTabs();
      requestAnimationFrame(updateActiveFromScroll);
    } catch (err) {
      const root = bodyEl.querySelector("[data-stats-sections]");
      if (root) {
        root.innerHTML = `<p class="stats-empty">${err.message || "Eroare"}</p>`;
      }
    } finally {
      loading = false;
    }
  }

  renderShell();
  refresh();

  return { refresh, getFilter: () => ({ difficulty, letterCount }) };
}
