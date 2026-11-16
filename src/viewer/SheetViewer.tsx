import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';

interface SheetViewerProps {
  blob: Blob;
  dir: 'rtl' | 'ltr';
}

const ROW_CHUNK = 100;

// Excel / CSV viewer: SheetJS, lazy rows, sticky header + first column, sheet tabs, search.
export function SheetViewer({ blob, dir }: SheetViewerProps) {
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>([]);
  const [active, setActive] = useState(0);
  const [visibleRows, setVisibleRows] = useState(ROW_CHUNK);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cellMenuRef = useRef<{ r: number; c: number; value: string } | null>(null);
  const [menu, setMenu] = useState<{ r: number; c: number; value: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const XLSX = await import('xlsx');
        const buf = await blob.arrayBuffer();
        if (cancelled) return;
        const wb = XLSX.read(buf, { type: 'array' });
        const parsed = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
          return { name, rows: rows.map(r => (r ?? []).map(c => String(c ?? ''))) };
        });
        if (!cancelled) { setSheets(parsed); setLoading(false); }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [blob]);

  const sheet = sheets[active];
  const filteredRows = useMemo(() => {
    if (!sheet) return [];
    if (!query.trim()) return sheet.rows;
    const q = query.trim().toLowerCase();
    return sheet.rows.filter(r => r.some(c => c.toLowerCase().includes(q)));
  }, [sheet, query]);

  useEffect(() => { setVisibleRows(ROW_CHUNK); }, [active, query]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 400) {
      setVisibleRows(v => (v < filteredRows.length ? v + ROW_CHUNK : v));
    }
  };

  const copyCell = async (value: string) => {
    try { await navigator.clipboard.writeText(value); } catch { /* denied */ }
    setMenu(null);
  };

  const rowsToShow = filteredRows.slice(0, visibleRows);
  const colCount = Math.max(...rowsToShow.map(r => r.length), 0);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" /></div>;
  if (error) return <div className="flex items-center justify-center h-full text-white/70 text-sm">⚠ تعذّر فتح الجدول</div>;
  if (!sheet) return null;

  return (
    <div className="absolute inset-0 flex flex-col" dir={dir}>
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto bg-slate-900/90 backdrop-blur-sm shrink-0">
          {sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
                i === active ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/70'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 shrink-0">
          <Search size={16} className="text-white/60" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث في الجدول..."
            className="flex-1 bg-transparent text-white text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')}><X size={16} className="text-white/60" /></button>
          )}
        </div>
      )}

      {/* Table */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="border-collapse text-sm" style={{ minWidth: '100%' }}>
          <thead>
            <tr>
              {Array.from({ length: colCount }, (_, c) => (
                <th key={c} className="sticky top-0 z-20 bg-slate-800 text-white border border-slate-600 px-3 py-2 whitespace-nowrap font-semibold text-xs">
                  {sheet.rows[0]?.[c] ?? ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsToShow.slice(1).map((row, ri) => (
              <tr key={ri} className={ri % 2 ? 'bg-white/5' : ''}>
                {Array.from({ length: colCount }, (_, c) => (
                  <td
                    key={c}
                    onContextMenu={(e) => { e.preventDefault(); setMenu({ r: ri + 1, c, value: row[c] ?? '' }); }}
                    className={`border border-slate-300 dark:border-slate-600 px-3 py-1.5 whitespace-nowrap text-slate-800 dark:text-slate-100 ${c === 0 ? 'sticky start-0 z-10 bg-slate-100 dark:bg-slate-700 font-medium' : 'bg-white dark:bg-slate-800'}`}
                  >
                    {query ? highlight(row[c] ?? '', query) : (row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows < filteredRows.length && (
          <div className="text-center py-3 text-xs text-white/50">…</div>
        )}
      </div>

      {/* Cell copy menu */}
      {menu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setMenu(null)}
        >
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl w-full max-w-md p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-xs text-slate-500 truncate">{menu.value}</p>
            <button
              onClick={() => copyCell(menu.value)}
              className="btn-primary w-full text-sm"
            >
              نسخ الخلية
            </button>
          </div>
        </div>
      )}

      {/* Search toggle */}
      {!searchOpen && (
        <button
          onClick={() => setSearchOpen(true)}
          className="absolute bottom-4 end-4 p-3.5 rounded-full bg-primary-600 text-white shadow-lg min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label="search"
        >
          <Search size={20} />
        </button>
      )}
    </div>
  );
}

function highlight(text: string, q: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-warning-500/60 rounded-sm">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
