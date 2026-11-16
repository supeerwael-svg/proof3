import { useRef, useState, type ChangeEvent } from 'react';
import { Upload, X, Tag, Plus, Loader2, Check } from 'lucide-react';
import { FilesService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { formatBytes } from '@/utils/format';

interface FileUploaderProps {
  folderId: string;
  sectionKey: string;
  onUploaded: () => void;
}

interface UploadProgress {
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

export function FileUploader({ folderId, sectionKey, onUploaded }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const { user } = useAuth();
  const { t } = useI18n();

  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';

  if (!canWrite) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setSelectedFiles(Array.from(files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(tags.filter(tg => tg !== tag));

  const upload = async () => {
    if (selectedFiles.length === 0 || !user) return;
    setUploading(true);
    const prog: UploadProgress[] = selectedFiles.map(f => ({ name: f.name, size: f.size, status: 'pending' }));
    setProgress(prog);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        prog[i].status = 'uploading';
        setProgress([...prog]);
        try {
          await FilesService.uploadFile(folderId, sectionKey, selectedFiles[i], tags, user.id);
          prog[i].status = 'done';
        } catch {
          prog[i].status = 'error';
        }
        setProgress([...prog]);
      }
      const allDone = prog.every(p => p.status === 'done');
      if (allDone) {
        setSelectedFiles([]);
        setTags([]);
        onUploaded();
      }
    } finally {
      setUploading(false);
      setTimeout(() => setProgress([]), 2000);
    }
  };

  const doneCount = progress.filter(p => p.status === 'done').length;
  const overallPercent = progress.length > 0 ? Math.round((doneCount / progress.length) * 100) : 0;

  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target) setIsDragging(false); }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.ogg,.mp4,.webm,.mov,.txt,.csv"
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
      />

      {selectedFiles.length === 0 && progress.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl py-8 flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all"
        >
          <Upload size={32} />
          <span className="font-semibold">{t('upload')}</span>
          <span className="text-xs">{t('dragDrop')}</span>
        </button>
      ) : progress.length > 0 ? (
        <div className="card p-4 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {doneCount} / {progress.length}
            </span>
            <span className="text-sm text-primary-600 dark:text-primary-400 font-semibold">{overallPercent}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div className="h-2.5 bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${overallPercent}%` }} />
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {progress.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                {p.status === 'done' ? (
                  <Check size={16} className="text-success-500 shrink-0" />
                ) : p.status === 'error' ? (
                  <X size={16} className="text-error-500 shrink-0" />
                ) : p.status === 'uploading' ? (
                  <Loader2 size={16} className="text-primary-500 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                )}
                <span className="truncate text-slate-700 dark:text-slate-300 flex-1">{p.name}</span>
                <span className="text-slate-400 shrink-0 text-xs">{formatBytes(p.size)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-4 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {selectedFiles.length} {t('files')}
            </span>
            <button onClick={() => setSelectedFiles([])} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2 max-h-32 overflow-y-auto">
            {selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="truncate text-slate-700 dark:text-slate-300">{f.name}</span>
                <span className="text-slate-400 shrink-0 ms-2">{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Tag size={14} /> {t('tags')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder={t('addTag')}
                className="input flex-1"
              />
              <button onClick={addTag} className="btn-secondary px-3">
                <Plus size={18} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full px-3 py-1 text-xs font-medium">
                    {tag}
                    <button onClick={() => removeTag(tag)}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={upload}
            disabled={uploading}
            className="btn-primary w-full"
          >
            <Upload size={18} />
            {uploading ? t('loading') : t('uploadMultiple')}
          </button>
        </div>
      )}

      {isDragging && (
        <div
          className="fixed inset-0 z-50 bg-primary-500/10 backdrop-blur-sm flex items-center justify-center"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
        >
          <div className="text-center text-primary-600 dark:text-primary-400">
            <Upload size={48} className="mx-auto mb-2" />
            <p className="text-lg font-bold">{t('dragDrop')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
