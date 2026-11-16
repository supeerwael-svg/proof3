import { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { ReadingMode, ComfortMode } from './readerPrefs';

export interface SwipeHandler {
  (dir: 'start' | 'end'): void;
}

interface PdfViewerProps {
  blob: Blob;
  mode: ReadingMode;
  comfort: ComfortMode;
  resumePage: number;
  resumeZoom: number | null;
  rotation: number;
  onDocReady: (numPages: number) => void;
  onVisiblePage: (page: number) => void;
  onZoomChange: (zoom: number | null) => void;
  onSwipe: SwipeHandler;
  pageTurnSignal: { page: number; dir: 1 | -1 } | null;
}

interface RenderEntry {
  canvas: HTMLCanvasElement;
  pageNum: number;
  lastUsed: number;
  rendering: boolean;
  renderTask: { cancel(): void } | null;
}

const MAX_CACHED_PAGES = 10;
const PAGE_GAP = 8;
const COMFORT_FILTER: Record<ComfortMode, string> = {
  light: 'none',
  sepia: 'sepia(0.5) saturate(0.8) brightness(1.02)',
  night: 'invert(0.92) hue-rotate(180deg) brightness(0.9) contrast(0.9)',
};

export function PdfViewer({
  blob, mode, comfort, resumePage, resumeZoom, rotation,
  onDocReady, onVisiblePage, onZoomChange, onSwipe, pageTurnSignal,
}: PdfViewerProps) {
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageHostRef = useRef<HTMLDivElement>(null);
  const entriesRef = useRef<Map<number, RenderEntry>>(new Map());
  const userZoomRef = useRef<number | null>(resumeZoom);
  const baseScaleRef = useRef(1);
  const visibleRef = useRef(1);
  const renderTokenRef = useRef(0);
  const pageDimsRef = useRef<{ w: number; h: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const pendingResumeRef = useRef(resumePage);

  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScaleState] = useState(1);
  const [page, setPageState] = useState(1);

  const setScale = useCallback((s: number | null) => {
    userZoomRef.current = s;
    setScaleState(s ?? baseScaleRef.current);
  }, []);

  const setPage = useCallback((p: number) => {
    visibleRef.current = p;
    setPageState(p);
    onVisiblePage(p);
  }, [onVisiblePage]);

  // ---- document load ----
  useEffect(() => {
    let cancelled = false;
    const token = ++renderTokenRef.current;
    setLoading(true);
    setError(false);
    setNumPages(0);
    setDims(null);

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const buf = await blob.arrayBuffer();
        if (cancelled || token !== renderTokenRef.current) return;
        const pdf = await pdfjs.getDocument({ data: buf, disableAutoFetch: false }).promise;
        if (cancelled || token !== renderTokenRef.current) return;
        pdfRef.current = pdf;
        const p1 = await pdf.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        pageDimsRef.current = { w: vp.width, h: vp.height };
        setDims({ w: vp.width, h: vp.height });
        setNumPages(pdf.numPages);
        onDocReady(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error('pdf load failed', err);
        if (!cancelled) { setError(true); setLoading(false); }
      }
    })();

    return () => {
      cancelled = true;
      renderTokenRef.current++;
      for (const [, e] of entriesRef.current) { e.renderTask?.cancel(); e.canvas.width = 0; }
      entriesRef.current.clear();
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  // ---- base scale: fit width ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !dims) return;
    baseScaleRef.current = host.clientWidth / dims.w;
    if (userZoomRef.current === null) setScaleState(baseScaleRef.current);
  }, [dims, setScaleState]);

  // ---- page host layout (continuous) ----
  useEffect(() => {
    const host = pageHostRef.current;
    if (!host || !dims || mode !== 'continuous') return;
    const rotated = rotation % 180 !== 0;
    const pw = (rotated ? dims.h : dims.w) * scale;
    const ph = (rotated ? dims.w : dims.h) * scale;
    host.style.width = `${pw}px`;
    // size each page slot
    for (const child of Array.from(host.children)) {
      const slot = child as HTMLElement;
      slot.style.width = `${pw}px`;
      slot.style.height = `${ph}px`;
    }
  }, [dims, scale, rotation, mode, numPages]);

  // ---- render a page ----
  const renderPage = useCallback(async (pageNum: number, entry: RenderEntry, scale: number, rotation: number) => {
    const pdf = pdfRef.current;
    if (!pdf || pageNum < 1 || pageNum > pdf.numPages || entry.rendering) return;
    entry.rendering = true;
    try {
      const page: PDFPageProxy = await pdf.getPage(pageNum);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: scale * dpr, rotation });
      const canvas = entry.canvas;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d')!;
      const task = page.render({ canvasContext: ctx, viewport: vp });
      entry.renderTask = task as unknown as { cancel(): void };
      await task.promise;
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name !== 'RenderingCancelledException') console.warn('render err', pageNum, err);
    } finally {
      entry.rendering = false;
      entry.renderTask = null;
    }
  }, []);

  // ---- render visible pages (virtualized) ----
  const renderVisible = useCallback(() => {
    const pdf = pdfRef.current;
    const host = hostRef.current;
    if (!pdf || !host || !pageDimsRef.current) return;

    const rotated = rotation % 180 !== 0;
    const ph = (rotated ? pageDimsRef.current.w : pageDimsRef.current.h) * scale;
    const wantSet: number[] = [];
    if (mode === 'paged') {
      wantSet.push(visibleRef.current - 1, visibleRef.current, visibleRef.current + 1);
    } else {
      const sc = scrollRef.current;
      if (!sc) return;
      const first = Math.max(1, Math.floor(sc.scrollTop / ph) - 1);
      const last = Math.min(pdf.numPages, Math.ceil((sc.scrollTop + host.clientHeight) / ph) + 1);
      for (let p = first; p <= last; p++) wantSet.push(p);
    }
    const want = new Set(wantSet.filter(p => p >= 1 && p <= pdf.numPages));

    // remove out-of-view entries
    for (const [p, entry] of entriesRef.current) {
      if (!want.has(p)) {
        entry.renderTask?.cancel();
        entry.canvas.width = 0;
        entry.canvas.remove();
        entriesRef.current.delete(p);
      }
    }

    // add missing page slots (continuous) and render
    if (mode === 'continuous' && pageHostRef.current) {
      const pageHost = pageHostRef.current;
      for (const p of want) {
        let slot = pageHost.querySelector(`[data-slot="${p}"]`) as HTMLElement | null;
        if (!slot) {
          slot = document.createElement('div');
          slot.dataset.slot = String(p);
          slot.style.position = 'relative';
          slot.style.background = 'rgba(255,255,255,0.06)';
          slot.style.overflow = 'hidden';
          slot.style.flexShrink = '0';
          pageHost.appendChild(slot);
        }
        let entry = entriesRef.current.get(p);
        if (!entry) {
          const canvas = document.createElement('canvas');
          canvas.style.position = 'absolute';
          canvas.style.inset = '0';
          slot.appendChild(canvas);
          entry = { canvas, pageNum: p, lastUsed: Date.now(), rendering: false, renderTask: null };
          entriesRef.current.set(p, entry);
          void renderPage(p, entry, scale, rotation);
        }
        entry.lastUsed = Date.now();
      }
    } else if (mode === 'paged') {
      for (const p of want) {
        let entry = entriesRef.current.get(p);
        if (!entry) {
          const canvas = document.createElement('canvas');
          canvas.style.position = 'absolute';
          canvas.style.inset = '0';
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.objectFit = 'contain';
          host.appendChild(canvas);
          entry = { canvas, pageNum: p, lastUsed: Date.now(), rendering: false, renderTask: null };
          entriesRef.current.set(p, entry);
          void renderPage(p, entry, scale, rotation);
        }
        entry.lastUsed = Date.now();
        // only show current page canvas; neighbors are pre-rendered hidden
        entry.canvas.style.display = p === visibleRef.current ? 'block' : 'none';
        entry.canvas.style.translate = '0px 0px';
      }
    }

    // memory cap: drop least-recently-used beyond cap
    const sorted = Array.from(entriesRef.current.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (sorted.length > MAX_CACHED_PAGES) {
      const [p, entry] = sorted.shift()!;
      if (want.has(p)) continue;
      entry.renderTask?.cancel();
      entry.canvas.width = 0;
      entry.canvas.remove();
      entriesRef.current.delete(p);
    }
  }, [mode, scale, rotation, renderPage]);

  // layout for paged mode
  useEffect(() => {
    if (mode !== 'paged' || !dims) return;
    const host = hostRef.current;
    if (!host) return;
    const rotated = rotation % 180 !== 0;
    const pw = (rotated ? dims.h : dims.w) * scale;
    const ph = (rotated ? dims.w : dims.h) * scale;
    for (const [, entry] of entriesRef.current) {
      entry.canvas.style.width = `${pw}px`;
      entry.canvas.style.height = `${ph}px`;
      entry.canvas.style.position = 'absolute';
      entry.canvas.style.left = '50%';
      entry.canvas.style.top = '50%';
      entry.canvas.style.transform = `translate(-50%, -50%)`;
    }
    void ph;
  }, [mode, dims, scale, rotation, numPages]);

  // re-render when scale/rotation/mode change
  useEffect(() => {
    if (!pdfRef.current) return;
    for (const [, entry] of entriesRef.current) entry.renderTask?.cancel();
    entriesRef.current.clear();
    // wipe page slots
    if (pageHostRef.current) pageHostRef.current.innerHTML = '';
    if (hostRef.current) {
      for (const c of Array.from(hostRef.current.querySelectorAll('canvas'))) c.remove();
    }
    renderVisible();
  }, [scale, rotation, mode, renderVisible]);

  // scroll tracking for continuous mode
  useEffect(() => {
    if (mode !== 'continuous') return;
    const sc = scrollRef.current;
    if (!sc) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        renderVisible();
        const ph = pageDimsRef.current
          ? ((rotation % 180 !== 0 ? pageDimsRef.current.w : pageDimsRef.current.h) * scale + PAGE_GAP)
          : 1;
        const p = Math.max(1, Math.round(sc.scrollTop / ph) + 1);
        if (p !== visibleRef.current) setPage(p);
      });
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, [mode, scale, rotation, renderVisible, setPage]);

  // resume scroll / page after doc ready
  useEffect(() => {
    if (loading || !numPages || !dims) return;
    const resume = pendingResumeRef.current;
    pendingResumeRef.current = 1;
    if (mode === 'paged') {
      setPage(Math.max(1, Math.min(numPages, resume)));
      renderVisible();
    } else if (resume > 1 && scrollRef.current) {
      const rotated = rotation % 180 !== 0;
      const ph = (rotated ? dims.w : dims.h) * scale + PAGE_GAP;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = (resume - 1) * ph;
          renderVisible();
        }
      });
    } else {
      renderVisible();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, numPages, dims]);

  // ---- gestures: pinch zoom, double-tap, pan, swipe ----
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.style.touchAction = 'none';

    const active = new Map<number, { x: number; y: number }>();
    let pinchBase: { dist: number; scale: number } | null = null;
    let panStart: { x: number; y: number } | null = null;
    let lastTap = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let swipeStart: { x: number; y: number; t: number } | null = null;
    let dragged = false;

    const onPointerDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (active.size === 2) {
        const [a, b] = Array.from(active.values());
        pinchBase = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: userZoomRef.current ?? baseScaleRef.current };
        panStart = null;
        swipeStart = null;
      } else if (active.size === 1) {
        panStart = { x: e.clientX, y: e.clientY };
        swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
        dragged = false;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = active.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;

      if (active.size === 2 && pinchBase) {
        const [a, b] = Array.from(active.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const target = Math.min(5, Math.max(0.5, pinchBase.scale * (d / (pinchBase.dist || 1))));
        if (Math.abs(target - (userZoomRef.current ?? baseScaleRef.current)) > 0.001) {
          setScale(target);
          renderVisible();
        }
      } else if (active.size === 1 && panStart && (userZoomRef.current ?? 1) > baseScaleRef.current * 1.02) {
        // pan while zoomed
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
        if (mode === 'paged') {
          panRef.current.x += e.movementX || dx * 0.5;
          panRef.current.y += e.movementY || dy * 0.5;
          for (const [, entry] of entriesRef.current) {
            if (entry.canvas.style.display !== 'none') {
              entry.canvas.style.translate = `${panRef.current.x}px ${panRef.current.y}px`;
            }
          }
        } else if (scrollRef.current) {
          scrollRef.current.scrollLeft -= e.movementX || dx * 0.5;
          scrollRef.current.scrollTop -= e.movementY || dy * 0.5;
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      active.delete(e.pointerId);
      if (active.size === 0) {
        pinchBase = null;
        panStart = null;
        // swipe detection
        if (swipeStart && !dragged && mode === 'paged') {
          const zoomedIn = (userZoomRef.current ?? 1) > baseScaleRef.current * 1.02;
          const dx = e.clientX - swipeStart.x;
          const dy = e.clientY - swipeStart.y;
          const dt = Date.now() - swipeStart.t;
          if (!zoomedIn && dt < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            onSwipe(dx > 0 ? 'start' : 'end');
          }
        }
        swipeStart = null;
      }
    };

    const onDoubleTap = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastTap < 300 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 40) {
        const base = baseScaleRef.current;
        const cur = userZoomRef.current ?? base;
        const zoomedIn = cur > base * 1.4;
        setScale(zoomedIn ? null : base * 2);
        panRef.current = { x: 0, y: 0 };
        onZoomChange(zoomedIn ? null : base * 2);
        renderVisible();
        lastTap = 0;
      } else {
        lastTap = now;
        lastTapX = e.clientX;
        lastTapY = e.clientY;
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('dblclick', onDoubleTap as EventListener);
    // prevent browser gestures (pull-to-refresh, double-tap zoom)
    const blockTouch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    el.addEventListener('touchmove', blockTouch, { passive: false });
    el.addEventListener('dblclick', (e) => e.preventDefault());

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('dblclick', onDoubleTap as EventListener);
      el.removeEventListener('touchmove', blockTouch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scale, renderVisible, setScale, onSwipe, onZoomChange]);

  // touch-based double-tap (mobile)
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let lastTap = 0;
    let lastX = 0;
    let lastY = 0;
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) return;
      const t = e.changedTouches[0];
      const now = Date.now();
      if (now - lastTap < 300 && Math.hypot(t.clientX - lastX, t.clientY - lastY) < 40) {
        const base = baseScaleRef.current;
        const cur = userZoomRef.current ?? base;
        const zoomedIn = cur > base * 1.4;
        setScale(zoomedIn ? null : base * 2);
        panRef.current = { x: 0, y: 0 };
        onZoomChange(zoomedIn ? null : base * 2);
        renderVisible();
        lastTap = 0;
      } else {
        lastTap = now;
        lastX = t.clientX;
        lastY = t.clientY;
      }
    };
    el.addEventListener('touchend', onTouchEnd);
    return () => el.removeEventListener('touchend', onTouchEnd);
  }, [setScale, onZoomChange, renderVisible]);

  // ---- page turn signal from parent ----
  useEffect(() => {
    if (!pageTurnSignal || mode !== 'paged' || !numPages) return;
    const target = Math.max(1, Math.min(numPages, pageTurnSignal.page));
    visibleRef.current = target;
    setPageState(target);
    onVisiblePage(target);
    panRef.current = { x: 0, y: 0 };
    renderVisible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTurnSignal]);

  // continuous layout
  if (mode === 'continuous') {
    return (
      <div ref={hostRef} className="absolute inset-0 overflow-hidden" style={{ background: '#1a1a1a' }}>
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-auto"
          style={{ WebkitOverflowScrolling: 'touch', filter: COMFORT_FILTER[comfort] }}
        >
          <div
            ref={pageHostRef}
            className="mx-auto flex flex-col"
            style={{ gap: `${PAGE_GAP}px`, paddingTop: 4, paddingBottom: 4 }}
          />
        </div>
        {loading && <PdfSkeleton />}
        {error && <PdfError />}
      </div>
    );
  }

  // paged mode
  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden" style={{ background: '#1a1a1a' }}>
      {loading && <PdfSkeleton />}
      {error && <PdfError />}
      <div className="absolute inset-0" style={{ filter: COMFORT_FILTER[comfort] }} />
    </div>
  );
}

function PdfSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
      <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );
}

function PdfError() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white z-10">
      <p className="text-3xl">⚠</p>
      <p className="text-sm">تعذّر فتح المستند — قد يكون تالفاً</p>
    </div>
  );
}
