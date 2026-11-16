import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, ChevronLeft, ChevronRight, ChevronDown, Plus, Pencil, Trash2, ArrowUp, ArrowDown,
  FileSpreadsheet, Upload, Download, Share2, Search, X, Copy, RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { StudentListsService, STUDENT_LEVELS, STUDENT_TERMS } from '@/services/studentLists';
import { useI18n } from '@/i18n/I18nContext';
import type { TranslationKey } from '@/i18n/translations';
import { useAuth } from '@/contexts/AuthContext';
import { structureConfig } from '@/config/structure';
import { formatBytes, formatDate } from '@/utils/format';
import type { StudentClassEntity, StudentListFileEntity, StudentLevelKey } from '@/types';

type View =
  | { kind: 'levels' }
  | { kind: 'classes'; level: StudentLevelKey }
  | { kind: 'terms'; level: StudentLevelKey; classId: string; className: string };

type Translate = (k: TranslationKey) => string;

interface StudentListsPageProps {
  onClose: () => void;
}

export function StudentListsPage({ onClose }: StudentListsPageProps) {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const [view, setView] = useState<View>({ kind: 'levels' });
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey(k => k + 1), []);
  const ChevronNext = dir === 'rtl' ? ChevronLeft : ChevronRight;

  const title =
    view.kind === 'levels' ? t('studentLists')
      : view.kind === 'classes' ? levelName(view.level, lang)
      : view.className;

  return (
    <div className="min-h-screen pb-20">
      <Header title={title} showBack onBack={onClose} />
      {view.kind === 'levels' && (
        <LevelsView onOpen={level => setView({ kind: 'classes', level })} chevron={ChevronNext} refreshKey={refreshKey} />
      )}
      {view.kind === 'classes' && (
        <ClassesView
          level={view.level}
          onOpen={cls => setView({ kind: 'terms', level: view.level, classId: cls.id, className: clsName(cls, lang) })}
          onBack={() => setView({ kind: 'levels' })}
          chevron={ChevronNext}
          refreshKey={refreshKey}
        />
      )}
      {view.kind === 'terms' && (
        <TermsView
          classId={view.classId}
          canWrite={user?.role === 'super_admin' || user?.role === 'teacher_write'}
          ownerId={user?.id ?? 'system'}
          refreshKey={refreshKey}
          onChanged={reload}
          lang={lang}
          t={t}
        />
      )}
    </div>
  );
}

function levelName(level: StudentLevelKey, lang: string): string {
  const names = structureConfig.levelNames[level];
  return lang === 'ar' ? names.ar : lang === 'fr' ? names.fr : names.en;
}

function clsName(cls: StudentClassEntity, lang: string): string {
  return lang === 'ar' ? cls.name : lang === 'fr' ? cls.nameFr : cls.nameEn;
}

// ---- Levels ----
function LevelsView({ onOpen, chevron: ChevronNext, refreshKey }: {
  onOpen: (level: StudentLevelKey) => void;
  chevron: typeof ChevronLeft;
  refreshKey: number;
}) {
  const { t, lang } = useI18n();

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-2">
      {STUDENT_LEVELS.map(level => (
        <button
          key={level}
          onClick={() => onOpen(level)}
          className="card p-4 flex items-center gap-3 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all w-full text-start"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
            <Users size={20} className="text-primary-600 dark:text-primary-400" />
          </div>
          <span className="flex-1 font-semibold text-sm text-slate-800 dark:text-slate-200">
            {levelName(level, lang)}
          </span>
          <ChevronNext size={16} className="text-slate-400" />
        </button>
      ))}
      <p className="text-xs text-slate-400 text-center pt-2">{t('studentListsHint')}</p>
      <span className="hidden">{refreshKey}</span>
    </div>
  );
}

// ---- Classes ----
function ClassesView({ level, onOpen, onBack, chevron: ChevronNext, refreshKey }: {
  level: StudentLevelKey;
  onOpen: (cls: StudentClassEntity) => void;
  onBack: () => void;
  chevron: typeof ChevronLeft;
  refreshKey: number;
}) {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';
  const [classes, setClasses] = useState<StudentClassEntity[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<StudentClassEntity | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setClasses(await StudentListsService.getClasses(level));
  }, [level]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const addClass = async () => {
    if (!newName.trim() || !user) return;
    await StudentListsService.createClass(level, newName.trim(), newName.trim(), newName.trim(), user.id);
    setNewName('');
    setShowAdd(false);
    load();
  };

  const saveEdit = async () => {
    if (!editing || !editName.trim()) return;
    await StudentListsService.renameClass(editing.id, editName.trim(), editName.trim(), editName.trim());
    setEditing(null);
    load();
  };

  const move = async (cls: StudentClassEntity, direction: -1 | 1) => {
    await StudentListsService.reorderClass(cls.id, direction);
    load();
  };

  const remove = async (cls: StudentClassEntity) => {
    if (!confirm(t('confirmDelete'))) return;
    await StudentListsService.deleteClass(cls.id);
    load();
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-1">
          {dir==='rtl' ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>} {t('back')}
        </button>
        {canWrite && (
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm !px-3 !py-2">
            <Plus size={16} /> {t('addClass')}
          </button>
        )}
      </div>

      {classes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">{t('noClasses')}</p>
      ) : (
        classes.map((cls, idx) => (
          <div key={cls.id} className="card p-4 flex items-center gap-2">
            <button onClick={() => onOpen(cls)} className="flex items-center gap-3 flex-1 min-w-0 text-start">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                <Users size={20} className="text-primary-600 dark:text-primary-400" />
              </div>
              <span className="flex-1 font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                {clsName(cls, lang)}
              </span>
              <ChevronNext size={16} className="text-slate-400" />
            </button>
            {canWrite && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => move(cls, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
                  <ArrowUp size={14} className="text-slate-500" />
                </button>
                <button onClick={() => move(cls, 1)} disabled={idx === classes.length - 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
                  <ArrowDown size={14} className="text-slate-500" />
                </button>
                <button onClick={() => { setEditing(cls); setEditName(clsName(cls, lang)); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <Pencil size={14} className="text-slate-500" />
                </button>
                <button onClick={() => remove(cls)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 size={14} className="text-red-500" />
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {(showAdd || editing) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-fade-in" onClick={() => { setShowAdd(false); setEditing(null); }}>
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {editing ? t('renameClass') : t('addClass')}
              </h3>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <input
              value={editing ? editName : newName}
              onChange={e => editing ? setEditName(e.target.value) : setNewName(e.target.value)}
              className="input"
              placeholder="1M1"
              autoFocus
            />
            <button onClick={editing ? saveEdit : addClass} className="btn-primary w-full">{t('save')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Terms + files ----
function TermsView({ classId, canWrite, ownerId, refreshKey, onChanged, lang, t }: {
  classId: string;
  canWrite: boolean;
  ownerId: string;
  refreshKey: number;
  onChanged: () => void;
  lang: string;
  t: Translate;
}) {
  const [stats, setStats] = useState<Record<number, { count: number; lastUpdate: number | null }>>({});
  const [openTerm, setOpenTerm] = useState<(1 | 2 | 3) | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

  const load = useCallback(async () => {
    const s: Record<number, { count: number; lastUpdate: number | null }> = {};
    for (const { term } of STUDENT_TERMS) {
      s[term] = await StudentListsService.getFileStats(classId, term);
    }
    setStats(s);
  }, [classId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const copyFromPrev = async (term: 1 | 2 | 3) => {
    const prev = term === 2 ? 1 : 2;
    const n = await StudentListsService.copyTerm(prev, term, ownerId);
    setCopyMsg(n > 0 ? `${n} ${t('filesCopied')}` : t('nothingToCopy'));
    setTimeout(() => setCopyMsg(''), 3000);
    load();
    onChanged();
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      {copyMsg && (
        <div className="card p-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          {copyMsg}
        </div>
      )}
      {STUDENT_TERMS.map(({ term }) => {
        const st = stats[term] ?? { count: 0, lastUpdate: null };
        const isOpen = openTerm === term;
        return (
          <div key={term} className="card overflow-hidden">
            <button
              onClick={() => setOpenTerm(isOpen ? null : term)}
              className="w-full p-4 flex items-center gap-3 text-start"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={20} className="text-green-600 dark:text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{termName(term, t)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {st.count} {t('files')} · {st.lastUpdate ? formatDate(st.lastUpdate, lang) : t('noUpdate')}
                </p>
              </div>
              {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400 rtl:rotate-180" />}
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                <TermFiles classId={classId} term={term} canWrite={canWrite} ownerId={ownerId} onChanged={() => { load(); onChanged(); }} t={t} />
                {canWrite && term > 1 && (
                  <button
                    onClick={() => copyFromPrev(term)}
                    className="mt-3 w-full btn-secondary text-sm flex items-center justify-center gap-2"
                  >
                    <Copy size={15} />
                    {term === 2 ? t('copyFromT1') : t('copyFromT2')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function termName(term: 1 | 2 | 3, t: Translate): string {
  return t(`term${term}` as TranslationKey);
}

function TermFiles({ classId, term, canWrite, ownerId, onChanged, t }: {
  classId: string;
  term: 1 | 2 | 3;
  canWrite: boolean;
  ownerId: string;
  onChanged: () => void;
  t: Translate;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StudentListFileEntity[]>([]);
  const [preview, setPreview] = useState<StudentListFileEntity | null>(null);

  const load = useCallback(async () => {
    setFiles(await StudentListsService.getFiles(classId, term));
  }, [classId, term]);

  useEffect(() => { load(); }, [load]);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    for (const f of Array.from(list)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!['xlsx', 'xls', 'csv'].includes(ext)) continue;
      await StudentListsService.uploadFile(classId, term, f, ownerId);
    }
    onChanged();
    load();
  };

  const download = (f: StudentListFileEntity) => {
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async (f: StudentListFileEntity) => {
    if (navigator.share) {
      try {
        const fileToShare = new File([f.blob], f.name, { type: f.mimeType });
        await navigator.share({ files: [fileToShare], title: f.name });
      } catch { /* cancelled */ }
    } else {
      download(f);
    }
  };

  return (
    <div className="space-y-2">
      {canWrite && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            hidden
            onChange={e => { upload(e.target.files); e.target.value = ''; }}
          />
          <button onClick={() => fileInputRef.current?.click()} className="w-full btn-primary text-sm flex items-center justify-center gap-2">
            <Upload size={15} /> {t('uploadExcel')}
          </button>
        </>
      )}

      {files.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">{t('noExcelFiles')}</p>
      ) : (
        files.map(f => (
          <div key={f.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <button onClick={() => setPreview(f)} className="flex items-center gap-3 flex-1 min-w-0 text-start">
              <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={18} className="text-green-600 dark:text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(f.size)}</p>
              </div>
            </button>
            <button onClick={() => share(f)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <Share2 size={16} className="text-slate-500" />
            </button>
            <button onClick={() => download(f)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <Download size={16} className="text-slate-500" />
            </button>
            {canWrite && (
              <button
                onClick={async () => {
                  if (!confirm(t('confirmDelete'))) return;
                  await StudentListsService.deleteFile(f.id);
                  onChanged();
                  load();
                }}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={16} className="text-red-500" />
              </button>
            )}
          </div>
        ))
      )}

      {preview && <ExcelPreviewer file={preview} onClose={() => { setPreview(null); load(); onChanged(); }} t={t} />}
    </div>
  );
}

// ---- Excel table preview with search ----
function ExcelPreviewer({ file, onClose, t }: {
  file: StudentListFileEntity;
  onClose: () => void;
  t: Translate;
}) {
  const [rows, setRows] = useState<string[][]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    file.blob.arrayBuffer().then(buf => {
      import('xlsx').then(XLSX => {
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false });
        if (alive) {
          setRows(data.map(r => (r ?? []).map(c => String(c ?? ''))));
          setLoading(false);
        }
      });
    });
    return () => { alive = false; };
  }, [file]);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? rows.filter(r => r.some(c => c.toLowerCase().includes(normalized)))
    : rows;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-4 h-14 bg-slate-900 text-white safe-top shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{file.name}</p>
          <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700">
          <X size={20} />
        </button>
      </div>
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-700 shrink-0">
        <div className="relative max-w-md mx-auto">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('searchInSheet')}
            className="w-full bg-slate-800 text-white text-sm rounded-xl ps-9 pe-3 py-2 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">{t('noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse bg-white dark:bg-slate-800 mx-auto text-sm rounded-xl overflow-hidden shadow">
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} className={i === 0 ? 'font-bold bg-slate-100 dark:bg-slate-700' : ''}>
                    {row.map((cell, j) => (
                      <td key={j} className="border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
