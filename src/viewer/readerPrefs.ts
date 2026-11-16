// Viewer preferences persisted in localStorage (fast sync access per render).
// Reading state (per file) and global viewer prefs live here, not in Dexie,
// so the viewer can read them synchronously during mount.

export type ReadingMode = 'continuous' | 'paged';
export type SwipeDirection = 'auto' | 'rtl' | 'ltr';
export type ComfortMode = 'light' | 'sepia' | 'night';

export interface ReaderState {
  page: number;
  zoom: number | null; // null = fit-width
  rotation: number;
  bookmarks: number[];
  totalPages: number;
}

const PREFS_KEY = 'tp_viewer_prefs';
const STATE_KEY = 'tp_viewer_state';

interface ViewerPrefs {
  readingMode: ReadingMode;
  swipeDirection: SwipeDirection;
  comfortMode: ComfortMode;
  keepAwake: boolean;
}

interface StateMap {
  [fileId: string]: ReaderState;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked — prefs are non-critical
  }
}

let prefs: ViewerPrefs = readJSON<ViewerPrefs>(PREFS_KEY, {
  readingMode: 'continuous',
  swipeDirection: 'auto',
  comfortMode: 'light',
  keepAwake: true,
});

const listeners = new Set<() => void>();

export function getPrefs(): ViewerPrefs {
  return prefs;
}

export function setPrefs(patch: Partial<ViewerPrefs>): void {
  prefs = { ...prefs, ...patch };
  writeJSON(PREFS_KEY, prefs);
  listeners.forEach(l => l());
}

export function subscribePrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePref<T>(selector: (p: ViewerPrefs) => T): T {
  // Minimal inline subscription — the shell re-renders on any pref change.
  return selector(prefs);
}

export function onPrefsChange(fn: () => void): () => void {
  return subscribePrefs(fn);
}

// ---- per-file reading state ----

export function loadReaderState(fileId: string): ReaderState | null {
  const map = readJSON<StateMap>(STATE_KEY, {});
  return map[fileId] ?? null;
}

export function saveReaderState(fileId: string, state: ReaderState): void {
  const map = readJSON<StateMap>(STATE_KEY, {});
  map[fileId] = state;
  // Keep at most 200 files worth of state
  const keys = Object.keys(map);
  if (keys.length > 200) {
    keys.sort();
    for (const k of keys.slice(0, keys.length - 200)) delete map[k];
  }
  writeJSON(STATE_KEY, map);
}

// ---- screen wake lock ----

let wakeLock: { release(): Promise<void> } | null = null;

export async function setKeepAwake(on: boolean): Promise<void> {
  try {
    if (on) {
      const nav = navigator as Navigator & {
        wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
      };
      if (nav.wakeLock && !wakeLock) {
        wakeLock = await nav.wakeLock.request('screen');
      }
    } else {
      await wakeLock?.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}
