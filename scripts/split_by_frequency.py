#!/usr/bin/env python3
"""Split ro_RO word lists into easy/medium/hard using OpenSubtitles frequency.

Source: https://github.com/hermitdave/FrequencyWords (content/2018/ro)
License: CC BY-SA 4.0

Usage:
  ./scripts/split_by_frequency.py
  # downloads frequency list if missing, writes ro_RO/{n}-{easy,medium,hard}.txt
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FREQ_PATH = Path(__file__).resolve().parent / "ro_full.txt"
FREQ_URL = (
    "https://raw.githubusercontent.com/hermitdave/FrequencyWords/"
    "master/content/2018/ro/ro_full.txt"
)
OUT = ROOT / "public" / "ro_RO"

BASE = str.maketrans(
    {
        "ă": "a",
        "â": "a",
        "î": "i",
        "ș": "s",
        "ț": "t",
        "ş": "s",
        "ţ": "t",
        "Ă": "a",
        "Â": "a",
        "Î": "i",
        "Ș": "s",
        "Ț": "t",
        "Ş": "s",
        "Ţ": "t",
    }
)


def norm(w: str) -> str:
    return w.lower().translate(BASE)


def ensure_frequency_list() -> None:
    if FREQ_PATH.exists() and FREQ_PATH.stat().st_size > 1_000_000:
        return
    print(f"Downloading {FREQ_URL} …")
    urllib.request.urlretrieve(FREQ_URL, FREQ_PATH)
    print(f"Saved {FREQ_PATH} ({FREQ_PATH.stat().st_size // 1024} KB)")


def load_frequency() -> tuple[dict[str, int], dict[str, int]]:
    freq_exact: dict[str, int] = {}
    freq_flat: dict[str, int] = {}
    with FREQ_PATH.open(encoding="utf-8", errors="ignore") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 2:
                continue
            word, count_s = parts[0], parts[1]
            try:
                count = int(count_s)
            except ValueError:
                continue
            w = word.lower().replace("ş", "ș").replace("ţ", "ț")
            if not w.isalpha():
                continue
            if count > freq_exact.get(w, 0):
                freq_exact[w] = count
            flat = norm(w)
            if count > freq_flat.get(flat, 0):
                freq_flat[flat] = count
    return freq_exact, freq_flat


def split_length(
    words: list[str],
    freq_exact: dict[str, int],
    freq_flat: dict[str, int],
) -> tuple[list[str], list[str], list[str]]:
    scored: list[tuple[str, int]] = []
    unknown: list[str] = []
    for w in words:
        c = freq_exact.get(w)
        if c is None:
            c = freq_flat.get(norm(w))
        if c is None:
            unknown.append(w)
        else:
            scored.append((w, c))

    scored.sort(key=lambda x: (-x[1], x[0]))
    n = len(scored)
    n_easy = max(1, int(n * 0.25)) if n else 0
    n_med = max(1, int(n * 0.35)) if n else 0
    if n_easy + n_med > n:
        n_med = max(0, n - n_easy)

    easy = sorted({w for w, _ in scored[:n_easy]})
    medium = sorted({w for w, _ in scored[n_easy : n_easy + n_med]})
    hard = sorted({w for w, _ in scored[n_easy + n_med :]} | set(unknown))
    return easy, medium, hard


def main() -> None:
    ensure_frequency_list()
    freq_exact, freq_flat = load_frequency()
    print(f"Frequency entries: exact={len(freq_exact)} flat={len(freq_flat)}")

    print(f"{'len':>3} {'all':>6} {'easy':>6} {'med':>6} {'hard':>6}")
    for length in range(3, 13):
        src = OUT / f"{length}.txt"
        words = [w.strip() for w in src.read_text(encoding="utf-8").splitlines() if w.strip()]
        easy, medium, hard = split_length(words, freq_exact, freq_flat)
        (OUT / f"{length}-easy.txt").write_text(
            "\n".join(easy) + ("\n" if easy else ""), encoding="utf-8"
        )
        (OUT / f"{length}-medium.txt").write_text(
            "\n".join(medium) + ("\n" if medium else ""), encoding="utf-8"
        )
        (OUT / f"{length}-hard.txt").write_text(
            "\n".join(hard) + ("\n" if hard else ""), encoding="utf-8"
        )
        print(f"{length:3d} {len(words):6d} {len(easy):6d} {len(medium):6d} {len(hard):6d}")


if __name__ == "__main__":
    main()
