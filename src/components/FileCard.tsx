import { Star, MoreVertical, Download, Trash2, Pencil, Eye, FolderInput } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { FilesService, FoldersService, SectionsService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { FileIcon } from './FileIcon';
import { formatBytes, formatDate } from '@/utils/format';
import type { FileEntity, FolderEntity, SectionEntity } from '@/types';

interface FileCardProps {
  file: FileEntity;
  onOpen: (file: FileEntity) => void;
  onChanged: () => void;
}

export function FileCard({ file, onOpen, onChanged }: FileCardProps) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [showMove, setShowMove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) return;
    await FilesService.deleteFile(file.id);
    setMenuOpen(false);
    onChanged();
  };

  const handleRename = async () => {
    if (newName.trim()) {
      await FilesService.renameFile(file.id, newName.trim());
      setRenaming(false);
      onChanged();
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const toggleFav = async () => {
    await FilesService.toggleFavorite(file.id);
    onChanged();
  };

  return (
    <div className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
      <button onClick={() => onOpen(file)} className="shrink-0">
        <FileIcon mimeType={file.mimeType} size={44} />
      </button>

      <button onClick={() => onOpen(file)} className="flex-1 min-w-0 text-start">
        {renaming ? (
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            onBlur={handleRename}
            autoFocus
            className="input text-sm py-1"
          />
        ) : (
          <>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatBytes(file.size)} · {formatDate(file.createdAt, lang)}
            </p>
            {file.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {file.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </button>

      <button
        onClick={toggleFav}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
      >
        <Star size={18} fill={file.favorite ? '#f59e0b' : 'none'} color={file.favorite ? '#f59e0b' : 'currentColor'} className="text-slate-400" />
      </button>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <MoreVertical size={18} className="text-slate-400" />
        </button>
        {menuOpen && (
          <div className="absolute end-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20 animate-fade-in">
            <button onClick={() => { onOpen(file); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              <Eye size={16} /> {t('preview')}
            </button>
            <button onClick={handleDownload} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              <Download size={16} /> {t('download')}
            </button>
            {canWrite && (
              <>
                <button onClick={() => { setRenaming(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                  <Pencil size={16} /> {t('rename')}
                </button>
                <button onClick={() => { setShowMove(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                  <FolderInput size={16} /> {t('move')}
                </button>
                <button onClick={handleDelete} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20">
                  <Trash2 size={16} /> {t('delete')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showMove && (
        <MoveModal
          file={file}
          onClose={() => setShowMove(false)}
          onMoved={() => { setShowMove(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function MoveModal({ file, onClose, onMoved }: { file: FileEntity; onClose: () => void; onMoved: () => void }) {
  const { t, lang } = useI18n();
  const [sections, setSections] = useState<SectionEntity[]>([]);
  const [folders, setFolders] = useState<{ folder: FolderEntity; depth: number }[]>([]);
  const [selectedSection, setSelectedSection] = useState(file.sectionKey);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  useEffect(() => {
    SectionsService.getAll().then(setSections);
  }, []);

  useEffect(() => {
    FoldersService.getFolderTree(selectedSection).then(setFolders);
  }, [selectedSection]);

  const move = async () => {
    if (!targetFolderId) return;
    await FilesService.moveFile(file.id, targetFolderId, selectedSection);
    onMoved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-slate-200">{t('move')}</h3>
          <p className="text-xs text-slate-500 truncate mt-1">{file.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="label">{t('sections')}</label>
            <select
              value={selectedSection}
              onChange={e => { setSelectedSection(e.target.value); setTargetFolderId(null); }}
              className="input"
            >
              {sections.map(s => (
                <option key={s.id} value={s.key}>
                  {lang === 'ar' ? s.name : lang === 'fr' ? s.nameFr : s.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('folders')}</label>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {folders.map(({ folder, depth }) => (
                <button
                  key={folder.id}
                  onClick={() => setTargetFolderId(folder.id)}
                  className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${
                    targetFolderId === folder.id
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  style={{ paddingInlineStart: `${depth * 12 + 12}px` }}
                >
                  {lang === 'ar' ? folder.name : lang === 'fr' ? folder.nameFr : folder.nameEn}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2">
          <button onClick={move} disabled={!targetFolderId} className="btn-primary flex-1">
            {t('move')}
          </button>
          <button onClick={onClose} className="btn-secondary">{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}
