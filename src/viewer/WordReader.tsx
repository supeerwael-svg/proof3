import { useState, useEffect, useRef } from 'react';

interface WordReaderProps {
  blob: Blob;
  fontSizePx: number;
  paged: boolean;
  dir: 'rtl' | 'ltr';
}

interface WordPage {
  html: string;
}

// .docx reader: mammoth → clean HTML, flow or paged reading, pinch/font-size control.
export function WordReader({ blob, fontSizePx, paged, dir }: WordReaderProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<WordPage[]>([]);
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setHtml(null);
    (async () => {
      try {
        const buf = await blob.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (!cancelled) {
          setHtml(result.value);
          if (paged) splitPages(result.value);
        }
      } catch {
        if (!cancelled) setError('corrupt');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob, paged]);

  const splitPages = (fullHtml: string) => {
    // Split into ~500-word chunks respecting block tags
    const doc = new DOMParser().parseFromString(`<div>${fullHtml}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) { setPages([{ html: fullHtml }]); return; }
    const blocks = Array.from(root.children);
    if (blocks.length === 0) { setPages([{ html: fullHtml }]); return; }
    const chunks: string[][] = [];
    let current: string[] = [];
    let words = 0;
    for (const b of blocks) {
      const len = (b.textContent ?? '').split(/\s+/).filter(Boolean).length;
      if (words + len > 400 && current.length > 0) {
        chunks.push(current);
        current = [];
        words = 0;
      }
      current.push(b.outerHTML);
      words += len;
    }
    if (current.length) chunks.push(current);
    setPages(chunks.map(c => ({ html: c.join('') })));
  };

  // pinch to zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.touchAction = 'pan-y';
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchBase: { dist: number; scale: number } | null = null;

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        pinchBase = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: scaleRef.current };
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 2 && pinchBase) {
        const [a, b] = Array.from(pointers.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const s = Math.min(3, Math.max(0.6, pinchBase.scale * (d / (pinchBase.dist || 1))));
        setScale(s);
        scaleRef.current = s;
      }
    };
    const onUp = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchBase = null; };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  if (error) return <div className="flex items-center justify-center h-full text-white/70 text-sm">⚠ تعذّر فتح المستند</div>;
  if (!html) return <div className="flex items-center justify-center h-full"><div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" /></div>;

  const content = paged ? (pages[page]?.html ?? '') : html;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-auto" style={{ touchAction: 'pan-y' }}>
      {paged && pages.length > 1 && (
        <div className="flex items-center justify-center gap-2 py-2 text-white/80 text-xs sticky top-0 bg-black/40 backdrop-blur-sm z-10">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-full bg-white/10 disabled:opacity-30">‹</button>
          <span>{page + 1} / {pages.length}</span>
          <button onClick={() => setPage(p => Math.min(pages.length - 1, p + 1))} disabled={page >= pages.length - 1} className="px-3 py-1.5 rounded-full bg-white/10 disabled:opacity-30">›</button>
        </div>
      )}
      <div
        ref={contentRef}
        dir={dir}
        className="mx-auto max-w-2xl px-4 py-6"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
      >
        <div
          className="bg-white rounded-xl shadow-lg p-6 sm:p-10"
          style={{ fontSize: `${fontSizePx}px`, lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
        <style>{`
          .word-content h1, .word-content h2, .word-content h3 { font-weight: 700; margin: 1em 0 0.5em; }
          .word-content p { margin: 0.6em 0; }
          .word-content table { border-collapse: collapse; width: 100%; }
          .word-content td, .word-content th { border: 1px solid #d1d5db; padding: 6px 8px; }
          .word-content img { max-width: 100%; height: auto; }
          .word-content ul, .word-content ol { padding-inline-start: 1.5em; }
        `}</style>
      </div>
      <div className="word-content-anchor hidden" />
    </div>
  );
}
