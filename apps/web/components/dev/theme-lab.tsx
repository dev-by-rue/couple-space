"use client";

/**
 * TEMPORARY — Theme Lab (dev exploration only)
 *
 * Teardown checklist:
 * 1. Remove ThemeLab mount from `app/layout.tsx` and unset `NEXT_PUBLIC_THEME_LAB`
 * 2. Delete `apps/web/components/dev/`
 * 3. Delete the EXPLORATION PALETTES block at the bottom of `app/globals.css`
 * 4. Optionally clear localStorage keys `cs-theme-lab:palette` and `cs-theme-lab:dark`
 */

import { useEffect, useState } from "react";

const PALETTES = ["harbor", "sage", "honey", "blush", "clay"] as const;
type PaletteId = (typeof PALETTES)[number];

const STORAGE_PALETTE = "cs-theme-lab:palette";
const STORAGE_DARK = "cs-theme-lab:dark";

function isPaletteId(value: string | null): value is PaletteId {
  return PALETTES.includes(value as PaletteId);
}

function applyTheme(palette: PaletteId, dark: boolean) {
  const root = document.documentElement;
  root.dataset.palette = palette;
  root.classList.toggle("dark", dark);
}

export function ThemeLab() {
  const [palette, setPalette] = useState<PaletteId>("harbor");
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedPalette = window.localStorage.getItem(STORAGE_PALETTE);
    const storedDark = window.localStorage.getItem(STORAGE_DARK) === "1";
    const nextPalette = isPaletteId(storedPalette) ? storedPalette : "harbor";
    setPalette(nextPalette);
    setDark(storedDark);
    applyTheme(nextPalette, storedDark);
    setReady(true);
  }, []);

  function onPaletteChange(next: PaletteId) {
    setPalette(next);
    window.localStorage.setItem(STORAGE_PALETTE, next);
    applyTheme(next, dark);
  }

  function onDarkChange(next: boolean) {
    setDark(next);
    window.localStorage.setItem(STORAGE_DARK, next ? "1" : "0");
    applyTheme(palette, next);
  }

  if (!ready) return null;

  return (
    <div className="fixed right-3 bottom-3 z-50 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-xs text-card-foreground shadow-panel">
      <p className="font-medium text-muted-foreground">Theme lab</p>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Palette</span>
        <select
          className="rounded border border-input bg-background px-2 py-1 text-foreground"
          value={palette}
          onChange={(event) => onPaletteChange(event.target.value as PaletteId)}
        >
          {PALETTES.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={dark}
          onChange={(event) => onDarkChange(event.target.checked)}
        />
        <span>Dark</span>
      </label>
    </div>
  );
}
