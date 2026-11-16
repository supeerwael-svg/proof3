import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Header } from '@/components/Header';
import { FilesService, FoldersService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { FileCard } from '@/components/FileCard';
import { DocumentViewer } from '@/viewer/DocumentViewer';
import type { FileEntity } from '@/types';

export function SearchPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileEntity[]>([]);
  const [previewFile, setPreviewFile] = useState<FileEntity | null>(null);

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setResults(await FilesService.search(q.trim()));
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title={t('sections')} showBack />
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="relative">
          <Search size={18} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => search(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="input ps-11"
            autoFocus
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400">
              <X size={18} />
            </button>
          )}
        </div>

        {results.length > 0 ? (
          <div className="space-y-2">
            {results.map(f => (
              <FileCard key={f.id} file={f} onOpen={setPreviewFile} onChanged={() => search(query)} />
            ))}
          </div>
        ) : query.trim().length >= 2 ? (
          <p className="text-sm text-slate-400 text-center py-8">{t('noFilesFound')}</p>
        ) : null}
      </div>
      <DocumentViewer file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
