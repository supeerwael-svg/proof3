import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { FileList } from '@/components/FileList';
import { SectionsService, FoldersService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useRouter } from '@/contexts/RouterContext';
import { Folder as FolderIcon, ChevronRight, ChevronLeft } from 'lucide-react';
import { StudentListsPage } from '@/pages/StudentListsPage';
import type { SectionEntity, FolderEntity } from '@/types';

interface SectionPageProps {
  sectionKey: string;
}

export function SectionPage({ sectionKey }: SectionPageProps) {
  const { t, lang, dir } = useI18n();
  const { navigate } = useRouter();
  const [section, setSection] = useState<SectionEntity | null>(null);
  const [rootFolders, setRootFolders] = useState<FolderEntity[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    SectionsService.getByKey(sectionKey).then(s => setSection(s ?? null));
    FoldersService.getRootBySection(sectionKey).then(setRootFolders);
  }, [sectionKey, refreshKey]);

  if (!section) return null;

  const title = lang === 'ar' ? section.name : lang === 'fr' ? section.nameFr : section.nameEn;

  if (section.key === 'forum') {
    return (
      <div className="min-h-screen pb-20">
        <Header title={title} showBack />
        <div className="max-w-md mx-auto px-4 py-4 space-y-3">
          <button onClick={() => navigate({ name: 'forum' })} className="btn-primary w-full">{t('forum')}</button>
          <button onClick={() => navigate({ name: 'chat' })} className="btn-secondary w-full">{t('chat')}</button>
        </div>
      </div>
    );
  }

  if (section.key === 'student_lists') {
    return (
      <StudentListsPage onClose={() => navigate({ name: 'sections' })} />
    );
  }

  // Single root folder wrapper — drill into it directly
  if (rootFolders.length === 1) {
    const root = rootFolders[0];
    return (
      <div className="min-h-screen pb-20">
        <Header title={title} showBack />
        <div className="max-w-md mx-auto px-4 py-4">
          <FileList key={refreshKey} folderId={root.id} sectionKey={sectionKey} onChanged={reload} />
        </div>
      </div>
    );
  }

  const ChevronNext = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div className="min-h-screen pb-20">
      <Header title={title} showBack />
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {rootFolders.length > 0 ? (
          <div className="space-y-2">
            {rootFolders.map(folder => (
              <button
                key={folder.id}
                onClick={() => navigate({ name: 'folder', folderId: folder.id })}
                className="card p-4 flex items-center gap-3 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all w-full text-start"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                  <FolderIcon size={20} className="text-primary-600 dark:text-primary-400" />
                </div>
                <span className="flex-1 font-semibold text-sm text-slate-800 dark:text-slate-200">
                  {lang === 'ar' ? folder.name : lang === 'fr' ? folder.nameFr : folder.nameEn}
                </span>
                <ChevronNext size={16} className="text-slate-400" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">{t('empty')}</p>
        )}
      </div>
    </div>
  );
}
