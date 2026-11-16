import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Folder as FolderIcon, HardDrive, FileQuestion, LayoutGrid, List } from 'lucide-react';
import { FoldersService, FilesService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useRouter } from '@/contexts/RouterContext';
import { FileCard } from './FileCard';
import { FileGridCard } from './FileGridCard';
import { FileUploader } from './FileUploader';
import { DocumentViewer } from '@/viewer/DocumentViewer';
import { formatBytes } from '@/utils/format';
import type { FileEntity, FolderEntity } from '@/types';

interface FileListProps {
  folderId: string;
  sectionKey: string;
  onChanged?: () => void;
}

export function FileList({ folderId, sectionKey, onChanged }: FileListProps) {
  const { t, lang, dir } = useI18n();
  const { navigate } = useRouter();
  const [files, setFiles] = useState<FileEntity[]>([]);
  const [subfolders, setSubfolders] = useState<FolderEntity[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderEntity | null>(null);
  const [folderStats, setFolderStats] = useState({ count: 0, size: 0 });
  const [previewFile, setPreviewFile] = useState<FileEntity | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (localStorage.getItem('fileViewMode') as 'list' | 'grid') ?? 'list');
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    localStorage.setItem('fileViewMode', viewMode);
  }, [viewMode]);

  const isRootSentinel = folderId === '__root__';

  const load = useCallback(async () => {
    if (!isRootSentinel) {
      const folder = await FoldersService.getById(folderId);
      setCurrentFolder(folder ?? null);
      const subs = await FoldersService.getByParent(folderId);
      setSubfolders(subs);
    } else {
      setCurrentFolder(null);
      setSubfolders([]);
    }
    const f = await FilesService.getFilesByFolder(folderId);
    const sorted = [...f].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, lang);
      if (sortBy === 'size') return b.size - a.size;
      return b.createdAt - a.createdAt;
    });
    setFiles(sorted);
    const stats = await FilesService.getFolderStats(folderId);
    setFolderStats(stats);
    setVisibleCount(30);
  }, [folderId, sortBy, lang, isRootSentinel]);

  useEffect(() => { load(); }, [load]);

  const handleChanged = useCallback(() => {
    load();
    onChanged?.();
  }, [load, onChanged]);

  const onPrev = useCallback((current: FileEntity | null): FileEntity | null => {
    if (!current) return null;
    const idx = files.findIndex(f => f.id === current.id);
    if (idx <= 0) return null;
    return files[idx - 1];
  }, [files]);

  const onNext = useCallback((current: FileEntity | null): FileEntity | null => {
    if (!current) return null;
    const idx = files.findIndex(f => f.id === current.id);
    if (idx === -1 || idx >= files.length - 1) return null;
    return files[idx + 1];
  }, [files]);

  const ChevronNext = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-4">
      {currentFolder && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 px-1">
          <HardDrive size={14} />
          <span>{folderStats.count} {t('files')}</span>
          <span>·</span>
          <span>{formatBytes(folderStats.size)}</span>
        </div>
      )}

      {subfolders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 px-1">{t('folders')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {subfolders.map(sf => (
              <button
                key={sf.id}
                onClick={() => navigate({ name: 'folder', folderId: sf.id })}
                className="card p-3 flex items-center gap-3 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all text-start"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                  <FolderIcon size={20} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                    {lang === 'ar' ? sf.name : lang === 'fr' ? sf.nameFr : sf.nameEn}
                  </p>
                </div>
                <ChevronNext size={18} className="text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <FileUploader folderId={folderId} sectionKey={sectionKey} onUploaded={handleChanged} />

      {files.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('files')}</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  aria-label="list view"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  aria-label="grid view"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                className="text-xs bg-transparent text-slate-600 dark:text-slate-400 border-0 outline-none cursor-pointer"
              >
                <option value="date">{t('sortDate')}</option>
                <option value="name">{t('sortName')}</option>
                <option value="size">{t('sortSize')}</option>
              </select>
            </div>
          </div>
          {viewMode === 'list' ? (
            <div className="space-y-2">
              {files.slice(0, visibleCount).map(f => (
                <FileCard key={f.id} file={f} onOpen={setPreviewFile} onChanged={handleChanged} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.slice(0, visibleCount).map(f => (
                <FileGridCard key={f.id} file={f} onOpen={setPreviewFile} onChanged={handleChanged} />
              ))}
            </div>
          )}
          {visibleCount < files.length && (
            <button
              onClick={() => setVisibleCount(c => c + 30)}
              className="w-full py-2.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-xl transition-colors"
            >
              {t('loadMore')} ({files.length - visibleCount})
            </button>
          )}
        </div>
      ) : subfolders.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <FileQuestion size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-semibold">{t('empty')}</p>
          <p className="text-sm mt-1">{t('emptyHint')}</p>
        </div>
      ) : null}

      <DocumentViewer
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onShowLinked={(f) => setPreviewFile(f)}
        onPrev={onPrev ? () => onPrev(previewFile) : undefined}
        onNext={onNext ? () => onNext(previewFile) : undefined}
      />
    </div>
  );
}
