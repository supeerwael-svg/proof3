import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, Download, Share2, Star, Link2, ChevronRight, ChevronLeft, Printer, Bookmark,
  ScrollText, BookOpen, Search, List, RotateCw, Maximize, Minus, Plus, Sun, Moon, Eye, Type,
} from 'lucide-react';
import { FilesService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { FileIcon } from '@/components/FileIcon';
import { formatBytes, formatDate, getFileIconName } from '@/utils/format';
import type { FileEntity } from '@/types';
import { PdfViewer } from './PdfViewer';
import { ImageGallery } from './ImageGallery';
import { WordReader } from './WordReader';
import { SheetViewer } from './SheetViewer';
import { MediaPlayer } from './MediaPlayer';
import {
  getPrefs, setPrefs, loadReaderState, saveReaderState, setKeepAwake,
  type ReadingMode, type ComfortMode, type ReaderState,
} from './readerPrefs';

interface DocumentViewerProps {
  file: FileEntity | null;
  onClose: () => void;
  onShowLinked?: (file: FileEntity) => void;
  onPrev?: () => FileEntity | null;
  onNext?: () => FileEntity | null;
}

export function DocumentViewer({ file, onClose, onShowLinked, onPrev, onNext }: DocumentViewerProps) {
  const { t, lang, dir } = useI18n();
  const [prefsVersion, bumpPrefs] = useState(0);
  const prefs = useMemo(() => { void prefsVersion; return getPrefs(); }, [prefsVersion]);
  const [readerState, setReaderState] = useState<ReaderState | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [showThumbs, setShowThumbs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [showComfort, setShowComfort] = useState(false);
  const [showFont, setShowFont] = useState(false);
  const [fontPx, setFontPx] = useState(16);
  const [wordPaged, setWordPaged] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [linkedFile, setLinkedFile] = useState<FileEntity | null>(null);
  const [pageTurnSignal, setPageTurnSignal] = useState<{ page: number; dir: 1 | -1 } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const type = file ? getFileIconName(file.mimeType) : 'file';
  const isPdf = type === 'pdf';
  const isWord = type === 'word';
  const isSheet = type === 'excel' || type === 'csv';

  // Keep screen awake while viewer is open
  useEffect(() => {
    if (!file) return;
    if (prefs.keepAwake) setKeepAwake(true);
    return () => { setKeepAwake(false); };
  }, [file, prefs.keepAwake]);

  // Load per-file reading state
  useEffect(() => {
    if (!file) { setReaderState(null); return; }
    FilesService.markOpened(file.id);
    FilesService.getLinkedFile(file.id).then(setLinkedFile);
    const saved = loadReaderState(file.id);
    setReaderState(saved ?? { page: 1, zoom: null, rotation: 0, bookmarks: [], totalPages: 0 });
    setPage(saved?.page ?? 1);
    setRotation(saved?.rotation ?? 0);
    setNumPages(saved?.totalPages ?? 0);
    setChromeVisible(true);
    setShowThumbs(false); setShowSearch(false); setShowJump(false);
  }, [file]);

  // Persist reading state (debounced)
  const persistTimer = useRef<number>(0);
  useEffect(() => {
    if (!file || !readerState || numPages === 0) return;
    window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      saveReaderState(file.id, { ...readerState, page, zoom, rotation, totalPages: numPages });
    }, 400);
  }, [file, page, zoom, rotation, numPages, readerState]);

  // Fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      }
    } catch { /* unsupported */ }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const goPrev = useCallback(() => {
    if (onPrev) { const p = onPrev(); if (p) onShowLinked?.(p); }
  }, [onPrev, onShowLinked]);

  const goNext = useCallback(() => {
    if (onNext) { const n = onNext(); if (n) onShowLinked?.(n); }
  }, [onNext, onShowLinked]);

  // PDF swipe page turn
  const onPdfSwipe = useCallback((swipeDir: 'start' | 'end') => {
    // swipe direction follows doc language (auto: ar → rtl)
    const swDir = prefs.swipeDirection === 'auto' ? (lang === 'ar' ? 'rtl' : 'ltr') : prefs.swipeDirection;
    let turn: 1 | -1;
    if (swDir === 'rtl') turn = swipeDir === 'start' ? -1 : 1;
    else turn = swipeDir === 'start' ? 1 : -1;
    const next = Math.max(1, Math.min(numPages, page + turn));
    if (next !== page) {
      setPage(next);
      setPageTurnSignal({ page: next, dir: turn });
    } else if (numPages > 0) {
      // at edge — navigate files
      if (turn === 1 && hasNext) goNext();
      else if (turn === -1 && hasPrev) goPrev();
    }
  }, [prefs.swipeDirection, lang, page, numPages, goNext, goPrev]);

  const hasNext = !!onNext;
  const hasPrev = !!onPrev;

  // keyboard
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (showSearch) setShowSearch(false); else onClose(); }
      if (dir === 'rtl') { if (e.key === 'ArrowLeft') goNext(); if (e.key === 'ArrowRight') goPrev(); }
      else { if (e.key === 'ArrowLeft') goPrev(); if (e.key === 'ArrowRight') goNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, dir, goPrev, goNext, onClose, showSearch]);

  // tap to toggle chrome (immersive)
  const onTapToggle = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [data-ui]')) return;
    setChromeVisible(v => !v);
  }, []);

  if (!file) return null;

  const url = useMemoSafeUrl(file.blob);

  const download = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
  };

  const share = async () => {
    if (navigator.share) {
      try {
        const f = new File([file.blob], file.name, { type: file.mimeType });
        await navigator.share({ files: [f], title: file.name });
      } catch { /* cancelled */ }
    } else download();
  };

  const print = () => {
    if (!isPdf) { download(); return; }
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.inset = '0';
    printFrame.style.opacity = '0';
    printFrame.src = url;
    printFrame.onload = () => { try { printFrame.contentWindow?.print(); } catch { /* blocked */ } };
    document.body.appendChild(printFrame);
    setTimeout(() => printFrame.remove(), 30000);
  };

  const toggleFav = () => { FilesService.toggleFavorite(file.id); };
  const toggleBookmark = () => {
    if (!readerState || !isPdf) return;
    const has = readerState.bookmarks.includes(page);
    const bookmarks = has ? readerState.bookmarks.filter(b => b !== page) : [...readerState.bookmarks, page].sort((a, b) => a - b);
    setReaderState({ ...readerState, bookmarks });
  };

  const setMode = (mode: ReadingMode) => {
    setPrefs({ readingMode: mode });
    bumpPrefs(v => v + 1);
  };
  const setComfort = (c: ComfortMode) => {
    setPrefs({ comfortMode: c });
    bumpPrefs(v => v + 1);
  };

  const PrevIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      data-viewer-root
    >
      {/* Top toolbar */}
      <div
        className={`flex items-center gap-1 px-2 sm:px-4 h-14 bg-slate-900 text-white safe-top shrink-0 transition-transform duration-200 ${chromeVisible ? '' : '-translate-y-full absolute top-0 inset-x-0 z-20'}`}
      >
        {onPrev && (
          <button onClick={goPrev} className="p-2 rounded-lg hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0" title="prev file">
            <PrevIcon size={20} />
          </button>
        )}
        <div className="flex-1 min-w-0" data-ui onClick={() => setShowJump(true)}>
          <p className="text-sm font-semibold truncate">{file.name}</p>
          <p className="text-xs text-slate-400">
            {formatBytes(file.size)} · {formatDate(file.createdAt, lang)}
            {isPdf && numPages > 0 && ` · ${page} / ${numPages}`}
          </p>
        </div>
        {linkedFile && (
          <button
            onClick={() => onShowLinked?.(linkedFile)}
            className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0"
          >
            <Link2 size={14} />{t('showAnswer')}
          </button>
        )}
        <button onClick={toggleFav} className="p-2 rounded-lg hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0">
          <Star size={20} fill={file.favorite ? '#f59e0b' : 'none'} color={file.favorite ? '#f59e0b' : 'currentColor'} />
        </button>
        <button onClick={() => setShowSearch(true)} className="p-2 rounded-lg hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0" title="search">
          <Search size={20} />
        </button>
        <button onClick={() => setShowThumbs(v => !v)} className="p-2 rounded-lg hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0" title="thumbnails">
          <List size={20} />
        </button>
        <button onClick={share} className="p-2 rounded-lg hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 hidden sm:flex" title="share">
          <Share2 size={20} />
        </button>
        <button onClick={download} className="p-2 rounded-lg hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0" title="download">
          <Download size={20} />
        </button>
        <button onClick={onClose} data-close-btn className="p-2 rounded-lg hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0" title="close">
          <X size={20} />
        </button>
      </div>

      {/* Reading mode toolbar (PDF only) */}
      {isPdf && chromeVisible && (
        <div className="flex items-center gap-1 px-2 h-11 bg-slate-800 text-white text-xs shrink-0 overflow-x-auto">
          <button
            onClick={() => setMode(prefs.readingMode === 'continuous' ? 'paged' : 'continuous')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 shrink-0"
          >
            {prefs.readingMode === 'continuous' ? <><BookOpen size={14} />{'صفحة'}</> : <><ScrollText size={14} />{'تمرير'}</>}
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setZoom(z => Math.max(0.5, (z ?? 1) - 0.25))} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center"><Minus size={14} /></button>
            <button onClick={() => setZoom(z => Math.min(5, (z ?? 1) + 0.25))} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center"><Plus size={14} /></button>
            <button onClick={() => setZoom(null)} className="px-2 py-1.5 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center text-[10px]">{Math.round((zoom ?? 1) * 100)}%</button>
          </div>
          <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"><RotateCw size={14} /></button>
          <button onClick={toggleBookmark} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0">
            <Bookmark size={14} fill={readerState?.bookmarks.includes(page) ? '#f59e0b' : 'none'} color={readerState?.bookmarks.includes(page) ? '#f59e0b' : 'currentColor'} />
          </button>
          <button onClick={print} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"><Printer size={14} /></button>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"><Maximize size={14} /></button>
          <div className="relative shrink-0">
            <button onClick={() => setShowComfort(v => !v)} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center">
              {prefs.comfortMode === 'night' ? <Moon size={14} /> : prefs.comfortMode === 'sepia' ? <Eye size={14} /> : <Sun size={14} />}
            </button>
            {showComfort && (
              <div className="absolute top-full mt-1 end-0 bg-slate-900 rounded-xl shadow-xl py-1 min-w-[110px] z-30" data-ui>
                {(['light', 'sepia', 'night'] as ComfortMode[]).map(c => (
                  <button
                    key={c}
                    onClick={() => { setComfort(c); setShowComfort(false); }}
                    className={`block w-full text-start px-4 py-2 hover:bg-white/10 ${prefs.comfortMode === c ? 'text-primary-400 font-semibold' : ''}`}
                  >
                    {c === 'light' ? 'فاتح' : c === 'sepia' ? 'سيبيا' : 'ليلي'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Word font-size toolbar */}
      {isWord && chromeVisible && (
        <div className="flex items-center gap-2 px-3 h-11 bg-slate-800 text-white text-xs shrink-0">
          <button onClick={() => setWordPaged(p => !p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            <BookOpen size={14} />{wordPaged ? 'متابع' : 'صفحات'}
          </button>
          <div className="relative">
            <button onClick={() => setShowFont(v => !v)} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center"><Type size={14} /></button>
            {showFont && (
              <div className="absolute top-full mt-1 start-0 bg-slate-900 rounded-xl shadow-xl py-1 min-w-[110px] z-30" data-ui>
                {[14, 16, 18, 22, 26].map(px => (
                  <button key={px} onClick={() => { setFontPx(px); setShowFont(false); }} className={`block w-full text-start px-4 py-2 hover:bg-white/10 ${fontPx === px ? 'text-primary-400 font-semibold' : ''}`}>
                    {px}px
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={print} className="p-2 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center"><Printer size={14} /></button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 relative overflow-hidden" onMouseDown={onTapToggle} onTouchStart={onTapToggle} onTouchEnd={(e) => {
        if (!touchStart.current) return;
        const changed = e.changedTouches[0];
        const dx = changed.clientX - touchStart.current.x;
        const dy = changed.clientY - touchStart.current.y;
        touchStart.current = null;
        if (isPdf && prefs.readingMode === 'paged' && Math.abs(dx) > 60 && Math.abs(dy) < 40) {
          onPdfSwipe(dx > 0 ? 'start' : 'end');
        }
      }} onTouchMove={(e) => {
        if (!touchStart.current && e.touches[0]) {
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }}>
        {isPdf && readerState && (
          <PdfViewer
            blob={file.blob}
            mode={prefs.readingMode}
            comfort={prefs.comfortMode}
            resumePage={readerState.page}
            resumeZoom={readerState.zoom}
            rotation={rotation}
            onDocReady={setNumPages}
            onVisiblePage={setPage}
            onZoomChange={setZoom}
            onSwipe={onPdfSwipe}
            pageTurnSignal={pageTurnSignal}
          />
        )}
        {type === 'image' && (
          <ImageGallery url={url} name={file.name} hasNext={hasNext} hasPrev={hasPrev} onNext={goNext} onPrev={goPrev} />
        )}
        {isWord && (
          <div className="absolute inset-0 overflow-auto" style={{ background: prefs.comfortMode === 'night' ? '#111' : '#1a1a1a' }}>
            <WordReader blob={file.blob} fontSizePx={fontPx} paged={wordPaged} dir={detectWordDir(file.name)} />
          </div>
        )}
        {isSheet && <SheetViewer blob={file.blob} dir={lang === 'ar' ? 'rtl' : 'ltr'} />}
        {(type === 'audio' || type === 'video') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <MediaPlayer url={url} kind={type as 'audio' | 'video'} mimeType={file.mimeType} fileId={file.id} resumeKey={file.id} />
          </div>
        )}
        {!['pdf', 'image', 'word', 'excel', 'csv', 'audio', 'video'].includes(type) && (
          <FallbackView file={file} url={url} onDownload={download} />
        )}
      </div>

      {/* Bottom page bar (PDF) */}
      {isPdf && numPages > 0 && chromeVisible && (
        <div className="flex items-center gap-3 px-4 h-12 bg-slate-900 text-white shrink-0 safe-bottom">
          <span className="text-xs font-mono text-slate-300 shrink-0">{page} / {numPages}</span>
          <input
            type="range"
            min={1}
            max={numPages}
            value={page}
            onChange={e => {
              const p = parseInt(e.target.value, 10);
              setPage(p);
              setPageTurnSignal({ page: p, dir: p > page ? 1 : -1 });
            }}
            className="flex-1 accent-primary-500"
            style={{ accentColor: 'var(--c-primary-500)' }}
          />
          <button onClick={() => setShowJump(true)} className="text-xs px-2 py-1 rounded bg-white/10 shrink-0">→</button>
        </div>
      )}

      {/* Thumbnails panel */}
      {showThumbs && isPdf && (
        <ThumbPanel
          blob={file.blob}
          numPages={numPages}
          currentPage={page}
          bookmarks={readerState?.bookmarks ?? []}
          onPick={(p) => { setPage(p); setPageTurnSignal({ page: p, dir: p > page ? 1 : -1 }); setShowThumbs(false); }}
          onClose={() => setShowThumbs(false)}
        />
      )}

      {/* Search panel */}
      {showSearch && isPdf && (
        <SearchPanel
          blob={file.blob}
          onJump={(p) => { setPage(p); setPageTurnSignal({ page: p, dir: 1 }); setShowSearch(false); }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Jump to page dialog */}
      {showJump && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowJump(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-[min(90vw,320px)] space-y-3" onClick={e => e.stopPropagation()} data-ui>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">انتقل إلى صفحة</p>
            <input
              autoFocus
              type="number"
              min={1}
              max={numPages || 1}
              defaultValue={page}
              id="jump-page-input"
              className="input text-center"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (v >= 1 && v <= numPages) { setPage(v); setPageTurnSignal({ page: v, dir: v > page ? 1 : -1 }); }
                  setShowJump(false);
                }
              }}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowJump(false)} className="btn-secondary flex-1 text-sm">{t('cancel')}</button>
              <button
                onClick={() => {
                  const input = document.getElementById('jump-page-input') as HTMLInputElement;
                  const v = parseInt(input.value, 10);
                  if (v >= 1 && v <= numPages) { setPage(v); setPageTurnSignal({ page: v, dir: v > page ? 1 : -1 }); }
                  setShowJump(false);
                }}
                className="btn-primary flex-1 text-sm"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stable object URL per blob
const urlCache = new WeakMap<Blob, string>();
function useMemoSafeUrl(blob: Blob): string {
  let u = urlCache.get(blob);
  if (!u) {
    u = URL.createObjectURL(blob);
    urlCache.set(blob, u);
  }
  return u;
}

function detectWordDir(name: string): 'rtl' | 'ltr' {
  // Heuristic: Arabic filename → rtl
  return /[\u0600-\u06FF]/.test(name) ? 'rtl' : 'ltr';
}

function FallbackView({ file, url, onDownload }: { file: FileEntity; url: string; onDownload: () => void }) {
  const { lang } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-4 text-white">
      <FileIcon mimeType={file.mimeType} size={80} />
      <p className="font-semibold text-center">{file.name}</p>
      <p className="text-sm text-white/50">{formatBytes(file.size)} · {formatDate(file.createdAt, lang)}</p>
      <p className="text-sm text-white/40 text-center max-w-xs">لا تتوفر معاينة لهذا النوع من الملفات</p>
      <div className="flex gap-2">
        <a href={url} download={file.name} className="btn-primary text-sm"><Download size={16} />تنزيل</a>
        <button
          onClick={async () => {
            if (navigator.share) {
              try { await navigator.share({ files: [new File([file.blob], file.name, { type: file.mimeType })], title: file.name }); } catch { /* cancelled */ }
            }
          }}
          className="btn-secondary text-sm"
        >
          <Share2 size={16} />مشاركة
        </button>
      </div>
      <button onClick={onDownload} className="hidden" />
    </div>
  );
}

// ---- Thumbnails panel ----
function ThumbPanel({ blob, numPages, currentPage, bookmarks, onPick, onClose }: {
  blob: Blob; numPages: number; currentPage: number; bookmarks: number[];
  onPick: (p: number) => void; onClose: () => void;
}) {
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map());
  const pdfRef = useRef<PDFDocumentProxyRef>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const buf = await blob.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      pdfRef.current = pdf;
      const initial = Math.min(numPages, 20);
      for (let i = 1; i <= initial; i++) {
        if (cancelled) return;
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        const url = canvas.toDataURL('image/jpeg', 0.6);
        if (cancelled) return;
        setThumbs(prev => new Map(prev).set(i, url));
      }
    })();
    return () => { cancelled = true; };
  }, [blob, numPages]);

  return (
    <div className="absolute inset-y-0 start-0 w-64 bg-slate-900/95 backdrop-blur-sm z-30 flex flex-col border-e border-slate-700">
      <div className="flex items-center justify-between px-3 h-12 text-white text-sm font-semibold border-b border-slate-700">
        <span>الصفحات</span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
        {Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
              p === currentPage ? 'border-primary-500' : 'border-transparent hover:border-slate-600'
            }`}
          >
            {thumbs.has(p) ? (
              <img src={thumbs.get(p)} alt={`p${p}`} className="w-full aspect-[1/1.414] object-cover bg-white" />
            ) : (
              <div className="w-full aspect-[1/1.414] bg-white/10 animate-pulse" />
            )}
            <span className="absolute bottom-1 end-1 text-[10px] bg-black/60 text-white px-1.5 rounded">{p}</span>
            {bookmarks.includes(p) && (
              <Bookmark size={12} className="absolute top-1 start-1 text-warning-500" fill="currentColor" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

type PDFDocumentProxyRef = unknown;

// ---- Search panel ----
function SearchPanel({ blob, onJump, onClose }: { blob: Blob; onJump: (p: number) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ page: number; snippet: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const buf = await blob.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      const out: { page: number; snippet: string }[] = [];
      const q = query.trim().toLowerCase();
      const max = Math.min(pdf.numPages, 300);
      for (let i = 1; i <= max; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const text = tc.items.map((it: unknown) => (it as { str: string }).str).join(' ');
        const idx = text.toLowerCase().indexOf(q);
        if (idx >= 0) {
          out.push({ page: i, snippet: text.slice(Math.max(0, idx - 30), idx + 60) });
          if (out.length >= 30) break;
        }
      }
      setResults(out);
    } catch { /* ignore */ }
    setSearching(false);
  };

  return (
    <div className="absolute top-14 inset-x-0 bg-slate-900/95 backdrop-blur-sm z-30 p-3 space-y-2 border-b border-slate-700">
      <div className="flex gap-2">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
          placeholder="ابحث في المستند..."
          className="flex-1 bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
        />
        <button onClick={runSearch} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold">بحث</button>
        <button onClick={onClose} className="px-2 py-2 rounded-lg hover:bg-white/10 text-white"><X size={18} /></button>
      </div>
      {searching && <p className="text-xs text-white/50">جارٍ البحث…</p>}
      <div className="max-h-40 overflow-y-auto space-y-1">
        {results.map((r, i) => (
          <button key={i} onClick={() => onJump(r.page)} className="block w-full text-start px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs">
            <span className="font-bold text-primary-400">ص {r.page}</span> — {r.snippet}…
          </button>
        ))}
      </div>
    </div>
  );
}
