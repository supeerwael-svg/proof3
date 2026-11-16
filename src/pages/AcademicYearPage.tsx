import { useState, useEffect } from 'react';
import { CalendarPlus, Archive, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { AcademicYearsService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { formatDate } from '@/utils/format';
import type { AcademicYearEntity } from '@/types';

export function AcademicYearPage() {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [current, setCurrent] = useState<AcademicYearEntity | null>(null);
  const [archived, setArchived] = useState<AcademicYearEntity[]>([]);
  const [yearName, setYearName] = useState('');
  const [copyFiles, setCopyFiles] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setCurrent((await AcademicYearsService.getCurrent()) ?? null);
    setArchived(await AcademicYearsService.getArchived());
  };

  useEffect(() => { load(); }, []);

  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';
  const NextIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;

  const create = async () => {
    if (!yearName.trim() || !user) return;
    setCreating(true);
    setError('');
    try {
      await AcademicYearsService.createWithStructure(yearName.trim(), copyFiles, user.id);
      setYearName('');
      setCopyFiles(false);
      await load();
    } catch {
      setError(t('error'));
    } finally {
      setCreating(false);
    }
  };

  const switchYear = async (id: string) => {
    if (!confirm(t('switchYear') + '?')) return;
    await AcademicYearsService.switchTo(id);
    await load();
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title={t('academicYearGateway')} showBack />
      <div className="max-w-md mx-auto px-4 py-4 space-y-6">
        {/* Current year */}
        {current && (
          <div className="card p-5 border-primary-300 dark:border-primary-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <Check size={24} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('current')}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{current.year}</p>
              </div>
            </div>
          </div>
        )}

        {/* Create new year */}
        {canWrite && (
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <CalendarPlus size={18} className="text-accent-500" />
              {t('createNewYear')}
            </h2>
            <div className="card p-4 space-y-3">
              <input
                value={yearName}
                onChange={e => setYearName(e.target.value)}
                placeholder={t('yearName')}
                className="input"
              />
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="copyMode"
                    checked={!copyFiles}
                    onChange={() => setCopyFiles(false)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{t('copyStructureOnly')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="copyMode"
                    checked={copyFiles}
                    onChange={() => setCopyFiles(true)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{t('copyStructureAndFiles')}</span>
                </label>
              </div>
              {error && <p className="text-sm text-error-500">{error}</p>}
              <button
                onClick={create}
                disabled={creating || !yearName.trim()}
                className="btn-primary w-full"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : t('createNewYear')}
              </button>
            </div>
          </div>
        )}

        {/* Archived years */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Archive size={18} className="text-slate-400" />
            {t('archivedYears')}
          </h2>
          {archived.length > 0 ? (
            <div className="space-y-2">
              {archived.map(y => (
                <div key={y.id} className="card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{y.year}</p>
                    <p className="text-xs text-slate-400">{formatDate(y.createdAt, lang)}</p>
                  </div>
                  {canWrite && (
                    <button
                      onClick={() => switchYear(y.id)}
                      className="btn-secondary text-xs flex items-center gap-1"
                    >
                      {t('switchYear')}
                      <NextIcon size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">{t('noArchivedYears')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
