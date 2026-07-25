import { STAT_CATEGORIES, STAT_LABELS } from "./schema.js";

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

  if (key === "winRate") {
    return `${Math.round(raw * 100)}%`;
  }
  if (
    key === "avgGuessesOnWins" ||
    key === "avgFirstRowGreens"
  ) {
    return Number(raw).toFixed(2);
  }
  if (
    key.endsWith("Ms") ||
    key === "totalPlayTimeMs" ||
    key === "fastestWinMs" ||
    key === "slowestWinMs" ||
    key === "avgWinTimeMs" ||
    key === "longestGameMs" ||
    key === "totalLossTimeMs" ||
    key === "avgLossTimeMs"
  ) {
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatTries(n) {
  if (n === 1) return "1 încercare";
  return `${n} încercări`;
}

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
  let letterCount = initial.letterCount ?? null; // null = all
  let tab = STAT_CATEGORIES[0].id;
  let loading = false;

  const letterSliderValue = () =>
    letterCount == null ? 2 : letterCount; // slider 2 = All, 3-12 = length

  function renderShell() {
    bodyEl.innerHTML = `
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
      <div class="stats-panel" data-stats-panel></div>
      <button type="button" class="btn-secondary stats-reset" data-stats-reset>
        Resetează statisticile
      </button>
    `;

    const diffSlider = bodyEl.querySelector("[data-stats-diff]");
    const lenSlider = bodyEl.querySelector("[data-stats-len]");
    diffSlider.value = String(
      Math.max(
        0,
        DIFF_OPTIONS.findIndex((d) => d.value === difficulty)
      )
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
      tab = btn.dataset.tab;
      renderTabs();
      renderPanel(bodyEl._statsCache);
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
        const panel = bodyEl.querySelector("[data-stats-panel]");
        if (panel) {
          panel.innerHTML = `<p class="stats-empty">${err.message || "Eroare la resetare"}</p>`;
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
        Math.max(
          0,
          DIFF_OPTIONS.findIndex((d) => d.value === difficulty)
        )
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

  function renderGuessedWords(panel, stats) {
    const words = stats.guessedWords || [];
    if (!words.length) {
      panel.innerHTML = `<p class="stats-empty">Niciun cuvânt ghicit încă</p>`;
      return;
    }
    const list = document.createElement("ul");
    list.className = "stats-guessed-list";
    for (const row of words) {
      const li = document.createElement("li");
      li.className = "stats-guessed-row";
      li.innerHTML = `
        <span class="stats-guessed-word">${escapeHtml(String(row.answer || "").toUpperCase())}</span>
        <span class="stats-guessed-meta">
          <span class="stats-guessed-date">${escapeHtml(formatDateTime(row.finishedAt))}</span>
          <span class="stats-guessed-tries">${escapeHtml(formatTries(row.guessCount))}</span>
        </span>
      `;
      list.appendChild(li);
    }
    panel.innerHTML = "";
    panel.appendChild(list);
  }

  function renderPanel(stats) {
    const panel = bodyEl.querySelector("[data-stats-panel]");
    if (!panel) return;
    if (!stats) {
      panel.innerHTML = `<p class="stats-empty">Se încarcă…</p>`;
      return;
    }
    const cat = STAT_CATEGORIES.find((c) => c.id === tab) || STAT_CATEGORIES[0];
    if (cat.kind === "guessedWords") {
      renderGuessedWords(panel, stats);
      return;
    }
    const list = document.createElement("dl");
    list.className = "stats-list";
    for (const key of cat.keys || []) {
      const row = document.createElement("div");
      row.className = "stats-row";
      const dt = document.createElement("dt");
      dt.textContent = STAT_LABELS[key] || key;
      const dd = document.createElement("dd");
      dd.textContent = formatValue(key, stats);
      row.append(dt, dd);
      list.appendChild(row);
    }
    panel.innerHTML = "";
    panel.appendChild(list);
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    syncFilterLabels();
    renderPanel(null);
    try {
      const stats = await getStats({
        difficulty: difficulty === "all" ? null : difficulty,
        letterCount,
      });
      bodyEl._statsCache = stats;
      renderPanel(stats);
    } catch (err) {
      const panel = bodyEl.querySelector("[data-stats-panel]");
      if (panel) {
        panel.innerHTML = `<p class="stats-empty">${err.message || "Eroare"}</p>`;
      }
    } finally {
      loading = false;
    }
  }

  renderShell();
  refresh();

  return { refresh, getFilter: () => ({ difficulty, letterCount }) };
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
