import { useState, useEffect, useRef } from 'react';
import { Star, MoreVertical, Download, Trash2, Pencil, FolderInput } from 'lucide-react';
import { FilesService, FoldersService, SectionsService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { FileIcon } from './FileIcon';
import { formatBytes, getFileIconName } from '@/utils/format';
import type { FileEntity, FolderEntity, SectionEntity } from '@/types';

interface FileGridCardProps {
  file: FileEntity;
  onOpen: (file: FileEntity) => void;
  onChanged: () => void;
}

export function FileGridCard({ file, onOpen, onChanged }: FileGridCardProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [showMove, setShowMove] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';
  const type = getFileIconName(file.mimeType);

  useEffect(() => {
    if (type !== 'image') return;
    const url = URL.createObjectURL(file.blob);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, type]);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
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
    <div className="card p-2 flex flex-col relative overflow-hidden">
      <button onClick={() => onOpen(file)} className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-square flex items-center justify-center group">
        {thumbUrl ? (
          <img src={thumbUrl} alt={file.name} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
        ) : (
          <FileIcon mimeType={file.mimeType} size={48} />
        )}
        {file.favorite && (
          <span className="absolute top-1.5 start-1.5">
            <Star size={14} fill="#f59e0b" color="#f59e0b" />
          </span>
        )}
      </button>

      <div className="pt-2 px-0.5">
        {renaming ? (
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            onBlur={handleRename}
            autoFocus
            className="input text-xs py-1"
          />
        ) : (
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
        )}
        <p className="text-[10px] text-slate-400 mt-0.5">{formatBytes(file.size)}</p>
      </div>

      <div className="absolute top-2 end-2 flex flex-col gap-1" ref={menuRef}>
        <button
          onClick={toggleFav}
          className="p-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm"
        >
          <Star size={13} fill={file.favorite ? '#f59e0b' : 'none'} color={file.favorite ? '#f59e0b' : 'currentColor'} className="text-slate-500" />
        </button>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm"
        >
          <MoreVertical size={13} className="text-slate-500" />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute end-2 top-16 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20 animate-fade-in">
          <button onClick={handleDownload} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
            <Download size={15} /> {t('download')}
          </button>
          {canWrite && (
            <>
              <button onClick={() => { setRenaming(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                <Pencil size={15} /> {t('rename')}
              </button>
              <button onClick={() => { setShowMove(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                <FolderInput size={15} /> {t('move')}
              </button>
              <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20">
                <Trash2 size={15} /> {t('delete')}
              </button>
            </>
          )}
        </div>
      )}

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
