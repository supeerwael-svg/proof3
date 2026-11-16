import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { SectionsService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useRouter } from '@/contexts/RouterContext';
import { getIcon } from '@/components/iconMap';
import type { SectionEntity } from '@/types';

export function SectionsPage() {
  const { t, lang, dir } = useI18n();
  const { navigate } = useRouter();
  const [sections, setSections] = useState<SectionEntity[]>([]);

  useEffect(() => { SectionsService.getAll().then(setSections); }, []);

  const ChevronNext = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div className="min-h-screen pb-20">
      <Header title={t('sections')} showSearch />
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {sections.map(s => {
            const Icon = getIcon(s.icon);
            return (
              <button
                key={s.id}
                onClick={() => navigate({ name: 'section', key: s.key })}
                className="card p-4 flex flex-col items-center gap-3 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 flex items-center justify-center">
                  <Icon size={28} className="text-primary-600 dark:text-primary-400" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
                  {lang === 'ar' ? s.name : lang === 'fr' ? s.nameFr : s.nameEn}
                </span>
                <ChevronNext size={16} className="text-slate-400" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
