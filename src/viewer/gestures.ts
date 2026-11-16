import { useRef, useCallback } from 'react';

// Touch-first gesture layer built on Pointer Events.
// The container must set `touch-action: none` so the browser never
// competes for the gesture; we handle pan/zoom ourselves.

export interface GestureState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface GestureHandlers {
  onPointerDown?: (e: PointerEvent) => void;
  onPointerMove?: (e: PointerEvent, state: GestureState) => void;
  onPointerUp?: (e: PointerEvent, state: GestureState, moved: boolean) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onSwipe?: (dir: 'start' | 'end', deltaX: number, deltaY: number) => void;
  onDrag?: (dx: number, dy: number) => void;
}

interface ActivePointer {
  x: number;
  y: number;
}

const MAX_SCALE = 5;
const MIN_SCALE = 0.5;
const SWIPE_THRESHOLD = 60;
const DOUBLE_TAP_MS = 280;

export function attachGestures(
  el: HTMLElement,
  handlers: GestureHandlers,
  opts: { minScale?: number; maxScale?: number } = {}
): () => void {
  const minScale = opts.minScale ?? MIN_SCALE;
  const maxScale = opts.maxScale ?? MAX_SCALE;

  const state: GestureState = { scale: 1, offsetX: 0, offsetY: 0 };
  const pointers = new Map<number, ActivePointer>();
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let panStart: { x: number; y: number; ox: number; oy: number } | null = null;
  let swipeStart: { x: number; y: number; t: number } | null = null;
  let swiped = false;

  const dist = (a: ActivePointer, b: ActivePointer) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const clampScale = (s: number) => Math.min(maxScale, Math.max(minScale, s));

  function onPointerDown(e: PointerEvent) {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    handlers.onPointerDown?.(e);

    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      pinchStartDist = dist(a, b);
      pinchStartScale = state.scale;
      panStart = null;
      swipeStart = null;
    } else if (pointers.size === 1) {
      panStart = { x: e.clientX, y: e.clientY, ox: state.offsetX, oy: state.offsetY };
      swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
      swiped = false;
    }
  }

  function onPointerMove(e: PointerEvent) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      const d = dist(a, b);
      if (pinchStartDist > 0) {
        state.scale = clampScale(pinchStartScale * (d / pinchStartDist));
        handlers.onPointerMove?.(e, state);
      }
      return;
    }

    if (panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      state.offsetX = panStart.ox + dx;
      state.offsetY = panStart.oy + dy;
      handlers.onPointerMove?.(e, state);
      handlers.onDrag?.(dx, dy);
    }
  }

  function onPointerUp(e: PointerEvent) {
    const had = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);

    if (!had) return;

    // double tap detection
    const now = Date.now();
    if (now - lastTapTime < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 30) {
      handlers.onDoubleTap?.(e.clientX, e.clientY);
      lastTapTime = 0;
    } else {
      lastTapTime = now;
      lastTapX = e.clientX;
      lastTapY = e.clientY;
    }

    // swipe detection: single pointer, quick, mostly horizontal
    if (swipeStart && !swiped && pointers.size === 0) {
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      const dt = Date.now() - swipeStart.t;
      if (dt < 500 && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.4) {
        swiped = true;
        handlers.onSwipe?.(dx > 0 ? 'start' : 'end', dx, dy);
      }
    }

    if (pointers.size === 0) {
      panStart = null;
      handlers.onPointerUp?.(e, state, !swiped && panStart !== null);
    }
  }

  function onWheel(e: WheelEvent) {
    if (e.ctrlKey || !e.deltaMode) {
      // trackpad pinch or wheel zoom
      state.scale = clampScale(state.scale * (e.ctrlKey ? 1 - e.deltaY / 200 : 1));
    }
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('wheel', onWheel, { passive: true });

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    el.removeEventListener('wheel', onWheel);
  };
}

export function useGestures() {
  const elRef = useRef<HTMLElement | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  const attach = useCallback((el: HTMLElement | null, handlers: GestureHandlers, opts?: { minScale?: number; maxScale?: number }) => {
    detachRef.current?.();
    elRef.current = el;
    if (el) {
      detachRef.current = attachGestures(el, handlers, opts);
    }
  }, []);

  return { attach };
}
