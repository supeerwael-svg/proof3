import { useRef, useState, useEffect, useCallback } from 'react';
import { attachGestures } from './gestures';

interface ImageGalleryProps {
  url: string;
  name: string;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}

// Fullscreen image gallery with pinch/double-tap zoom, pan, swipe nav, swipe-down to close.
export function ImageGallery({ url, name, hasNext, hasPrev, onNext, onPrev }: ImageGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<number>(0);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 2500);
  }, []);

  useEffect(() => {
    reset();
    setShowControls(true);
    scheduleHide();
  }, [url, reset, scheduleHide]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.touchAction = 'none';

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchBase: { dist: number; scale: number } | null = null;
    let panBase: { x: number; y: number; tx: number; ty: number } | null = null;
    let downAt = 0;
    let downX = 0;
    let downY = 0;
    let moved = false;

    const clampPan = (s: number, x: number, y: number): [number, number] => {
      if (s <= 1) return [0, 0];
      const maxX = (s - 1) * (imgRef.current?.clientWidth ?? 0) / 2;
      const maxY = (s - 1) * (imgRef.current?.clientHeight ?? 0) / 2;
      return [Math.min(maxX, Math.max(-maxX, x)), Math.min(maxY, Math.max(-maxY, y))];
    };

    const detach = attachGestures(el, {
      onPointerDown: (e) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        downAt = Date.now();
        downX = e.clientX;
        downY = e.clientY;
        moved = false;
        if (pointers.size === 2) {
          const [a, b] = Array.from(pointers.values());
          pinchBase = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
          panBase = null;
        } else if (pointers.size === 1) {
          panBase = { x: e.clientX, y: e.clientY, tx, ty };
        }
        setShowControls(true);
        scheduleHide();
      },
      onPointerMove: (e) => {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        p.x = e.clientX;
        p.y = e.clientY;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
        if (pointers.size === 2 && pinchBase) {
          const [a, b] = Array.from(pointers.values());
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const s = Math.min(5, Math.max(1, pinchBase.scale * (d / (pinchBase.dist || 1))));
          setScale(s);
        } else if (pointers.size === 1 && panBase && scale > 1) {
          const [nx, ny] = clampPan(scale, panBase.tx + (e.clientX - panBase.x), panBase.ty + (e.clientY - panBase.y));
          setTx(nx);
          setTy(ny);
        } else if (pointers.size === 1 && panBase && scale === 1) {
          // swipe-down-to-close preview
          const dy = e.clientY - panBase.y;
          if (dy > 0) {
            const progress = Math.min(1, dy / 300);
            el.style.opacity = String(1 - progress * 0.5);
            el.style.transform = `translateY(${dy * 0.3}px)`;
          }
        }
      },
      onPointerUp: (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size === 0) {
          if (pinchBase) { pinchBase = null; return; }
          if (panBase) {
            const dy = e.clientY - panBase.y;
            const dx = e.clientX - panBase.x;
            if (scale === 1 && dy > 100 && Math.abs(dx) < 80) {
              // swipe down to close
              el.style.opacity = '0';
              el.style.transform = 'translateY(100%)';
              setTimeout(() => {
                const evt = new CustomEvent('gallery-close');
                el.dispatchEvent(evt);
              }, 180);
              return;
            }
            if (scale === 1 && Math.abs(dx) > 60 && Math.abs(dy) < 60) {
              if (dx < 0 && hasNext) onNext();
              else if (dx > 0 && hasPrev) onPrev();
              else reset();
              return;
            }
            panBase = null;
          }
          el.style.opacity = '1';
          el.style.transform = '';
        }
      },
      onDoubleTap: (x, y) => {
        const now = Date.now();
        void x; void y;
        const rect = el.getBoundingClientRect();
        void rect;
        if (scale > 1) {
          reset();
        } else {
          setScale(2.5);
        }
      },
    }, { minScale: 1, maxScale: 5 });

    return () => {
      detach();
      el.removeEventListener('touchmove', preventDefault);
    };
  }, [scale, tx, ty, hasNext, hasPrev, onNext, onPrev, reset, scheduleHide]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClose = () => {
      const closeBtn = el.closest('[data-viewer-root]')?.querySelector('[data-close-btn]');
      (closeBtn as HTMLElement | null)?.click();
    };
    el.addEventListener('gallery-close', onClose);
    return () => el.removeEventListener('gallery-close', onClose);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: 'black' }}
    >
      <img
        ref={imgRef}
        src={url}
        alt={name}
        draggable={false}
        className="max-w-full max-h-full object-contain transition-transform duration-150 ease-out"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: 'center' }}
      />
      {!showControls && (
        <div
          className="absolute inset-0"
          onClick={() => { setShowControls(true); scheduleHide(); }}
        />
      )}
      {showControls && hasNext && (
        <button
          onClick={onNext}
          className="absolute end-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label="next"
        >
          ›
        </button>
      )}
      {showControls && hasPrev && (
        <button
          onClick={onPrev}
          className="absolute start-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label="prev"
        >
          ‹
        </button>
      )}
      {scale > 1 && (
        <button
          onClick={reset}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-xs"
        >
          100%
        </button>
      )}
    </div>
  );
}

function preventDefault(e: TouchEvent) {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}
