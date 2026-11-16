import { useEffect, useState } from 'react';
import { Building2, ArrowLeft, ArrowRight, Users, Calendar } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { SchoolService, AcademicYearsService } from '@/services';
import type { SchoolEntity, AcademicYearEntity } from '@/types';

export function SchoolPage() {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [school, setSchool] = useState<SchoolEntity | null>(null);
  const [year, setYear] = useState<AcademicYearEntity | null>(null);

  useEffect(() => {
    SchoolService.get().then(s => setSchool(s ?? null));
    AcademicYearsService.getCurrent().then(y => setYear(y ?? null));
  }, []);

  const NextIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 safe-top safe-bottom">
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Building2 size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {school ? (lang === 'ar' ? school.name : lang === 'fr' ? school.nameEn : school.name) : t('school')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('schoolWelcome')}</p>
        </div>

        <div className="card p-5 space-y-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
              <Users size={20} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('username')}</p>
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{user?.displayName}</p>
            </div>
          </div>
          {year && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center shrink-0">
                <Calendar size={20} className="text-accent-600 dark:text-accent-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('academicYears')}</p>
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{year.year} {year.isCurrent && `(${t('current')})`}</p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate({ name: 'general' })}
          className="btn-primary w-full text-base py-3.5 flex items-center justify-center gap-2"
        >
          {t('schoolProceed')}
          <NextIcon size={20} />
        </button>
      </div>
    </div>
  );
}
