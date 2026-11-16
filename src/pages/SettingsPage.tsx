import { useState, useEffect } from 'react';
import { Sun, Moon, Globe, Download, Upload, HardDrive, Shield, LogOut, Type, FileArchive, CalendarDays, AlertTriangle, Loader2, Palette, Pipette, Check } from 'lucide-react';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/contexts/ThemeContext';
import { StorageService, SettingsService } from '@/services';
import { useRouter } from '@/contexts/RouterContext';
import { formatBytes } from '@/utils/format';
import { PALETTES, getPaletteName, deriveShades } from '@/config/palettes';

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme, fontSize, setFontSize, paletteId, customColor, setPalette, setCustomColor } = useTheme();
  const { user, logout } = useAuth();
  const { navigate } = useRouter();
  const [usage, setUsage] = useState({ usage: 0, quota: 0 });
  const [exporting, setExporting] = useState<null | 'json' | 'zip'>(null);
  const [importing, setImporting] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    StorageService.getUsage().then(setUsage);
    SettingsService.get().then(s => {
      if (s) {
        const daysSince = (Date.now() - s.lastBackupReminder) / 86400000;
        if (daysSince > 7) setShowReminder(true);
      }
    });
  }, []);

  const isAdmin = user?.role === 'super_admin';

  const handleExportJson = async () => {
    setExporting('json');
    try {
      const blob = await StorageService.exportAll();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `teacher-portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      SettingsService.update({ lastBackupReminder: Date.now() });
      setShowReminder(false);
    } finally {
      setExporting(null);
    }
  };

  const handleExportZip = async () => {
    setExporting('zip');
    try {
      const blob = await StorageService.exportZip();
      const { saveAs } = await import('file-saver');
      saveAs(blob, `teacher-portfolio-backup-${new Date().toISOString().split('T')[0]}.zip`);
      SettingsService.update({ lastBackupReminder: Date.now() });
      setShowReminder(false);
    } finally {
      setExporting(null);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
      if (file.name.endsWith('.zip')) {
        await StorageService.importZip(file);
      } else {
        const text = await file.text();
        await StorageService.importAll(text);
      }
      location.reload();
      } catch {
        setImporting(false);
        alert(t('error'));
      }
    };
    input.click();
  };

  const usagePercent = usage.quota > 0 ? Math.round((usage.usage / usage.quota) * 100) : 0;
  const storageNearFull = usagePercent > 85;

  const langs: { key: 'ar' | 'en' | 'fr'; label: string }[] = [
    { key: 'ar', label: 'العربية' },
    { key: 'en', label: 'English' },
    { key: 'fr', label: 'Français' },
  ];

  return (
    <div className="min-h-screen pb-20">
      <Header title={t('settings')} />
      <div className="max-w-md mx-auto px-4 py-4 space-y-5">
        {/* Appearance */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3">{t('appearance')}</h2>
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                {t('theme')}
              </span>
              <button onClick={toggleTheme} className="btn-secondary px-4 py-2 text-sm">
                {theme === 'light' ? t('dark') : t('light')}
              </button>
            </div>

            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                <Globe size={18} /> {t('language')}
              </span>
              <div className="flex gap-2">
                {langs.map(l => (
                  <button
                    key={l.key}
                    onClick={() => setLang(l.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      lang === l.key
                        ? 'text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                    style={lang === l.key ? { backgroundColor: 'var(--c-primary-600)' } : undefined}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                <Type size={18} /> {t('fontSize')}
              </span>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFontSize(s)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      fontSize === s
                        ? 'text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                    style={fontSize === s ? { backgroundColor: 'var(--c-primary-600)' } : undefined}
                  >
                    {t(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Palette size={18} style={{ color: 'var(--c-primary-600)' }} />
            {t('colorPalette')}
          </h2>
          <div className="card p-4 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {PALETTES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPalette(p.id)}
                  className={`relative rounded-xl p-2.5 flex flex-col items-center gap-1.5 transition-all border-2 ${
                    paletteId === p.id && !customColor
                      ? 'border-slate-800 dark:border-white'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: p.shades[500] }}
                  />
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 text-center leading-tight">
                    {getPaletteName(p, lang)}
                  </span>
                  {paletteId === p.id && !customColor && (
                    <Check size={12} className="absolute top-1 end-1 text-slate-800 dark:text-white" />
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                <Pipette size={16} /> {t('customColor')}
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={customColor ?? '#0ea5e9'}
                  onChange={e => setCustomColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-slate-200 dark:border-slate-600 cursor-pointer bg-transparent p-0"
                />
                {customColor && (
                  <>
                    <div className="flex items-center gap-1">
                      {(['400','500','600','700','800'] as const).map(k => (
                        <div key={k} className="w-6 h-6 rounded-md" style={{ backgroundColor: deriveShades(customColor)[k] }} />
                      ))}
                    </div>
                    <button
                      onClick={() => setPalette('blue')}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 ms-auto"
                    >
                      {t('resetDefault')}
                    </button>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => setPalette('blue')}
              className="btn-secondary w-full text-sm"
            >
              {t('resetDefault')}
            </button>
          </div>
        </div>

        {/* Document viewer */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <BookOpen size={18} style={{ color: 'var(--c-primary-600)' }} />
            عارض المستندات
          </h2>
          <div className="card p-4 space-y-4">
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-2">وضع القراءة الافتراضي</span>
              <div className="flex gap-2">
                {(['continuous', 'paged'] as ReadingMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => { setPrefs({ readingMode: m }); forcePrefs(n => n + 1); }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewerPrefs.readingMode === m ? 'text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                    style={viewerPrefs.readingMode === m ? { backgroundColor: 'var(--c-primary-600)' } : undefined}
                  >
                    {m === 'continuous' ? 'تمرير متواصل' : 'صفحة بصفحة'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-2">اتجاه سحب الصفحات</span>
              <div className="flex gap-2">
                {(['auto', 'rtl', 'ltr'] as SwipeDirection[]).map(d => (
                  <button
                    key={d}
                    onClick={() => { setPrefs({ swipeDirection: d }); forcePrefs(n => n + 1); }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewerPrefs.swipeDirection === d ? 'text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                    style={viewerPrefs.swipeDirection === d ? { backgroundColor: 'var(--c-primary-600)' } : undefined}
                  >
                    {d === 'auto' ? 'تلقائي' : d === 'rtl' ? 'عربي (يمين←يسار)' : 'فرنسي/إنجليزي'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3">{t('storage')}</h2>
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <HardDrive size={18} />
              <span>{t('storageUsed')}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${storageNearFull ? 'bg-error-500' : 'bg-primary-500'}`}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {formatBytes(usage.usage)} / {formatBytes(usage.quota)}
            </p>
            {storageNearFull && (
              <div className="flex items-center gap-2 bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 rounded-lg px-3 py-2 text-xs font-semibold">
                <AlertTriangle size={16} />
                {t('storageWarning')}
              </div>
            )}
          </div>
        </div>

        {/* Academic Year */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3">{t('academicYears')}</h2>
          <button
            onClick={() => navigate({ name: 'academic-year' })}
            className="card p-4 w-full flex items-center gap-3 hover:shadow-md transition-shadow text-start"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center">
              <CalendarDays size={20} className="text-accent-600 dark:text-accent-400" />
            </div>
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t('academicYearGateway')}</span>
          </button>
        </div>

        {/* Backup */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3">{t('backup')}</h2>
          <div className="card p-4 space-y-3">
            {showReminder && (
              <div className="flex items-center gap-2 bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400 rounded-lg px-3 py-2 text-xs">
                <AlertTriangle size={14} />
                {t('backupReminder')}
              </div>
            )}
            <button onClick={handleExportZip} disabled={exporting !== null} className="btn-primary w-full">
              {exporting === 'zip' ? <Loader2 size={18} className="animate-spin" /> : <FileArchive size={18} />}
              {exporting === 'zip' ? t('loading') : t('exportZip')}
            </button>
            <button onClick={handleExportJson} disabled={exporting !== null} className="btn-secondary w-full">
              {exporting === 'json' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {exporting === 'json' ? t('loading') : t('exportData')}
            </button>
            <button onClick={handleImport} disabled={importing} className="btn-secondary w-full">
              {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {importing ? t('loading') : t('importData')}
            </button>
          </div>
        </div>

        {/* Admin */}
        {isAdmin && (
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3">{t('adminPanel')}</h2>
            <button
              onClick={() => navigate({ name: 'admin' })}
              className="card p-4 w-full flex items-center gap-3 hover:shadow-md transition-shadow text-start"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <Shield size={20} className="text-primary-600 dark:text-primary-400" />
              </div>
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t('manageUsers')}</span>
            </button>
          </div>
        )}

        {/* Account */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3">{t('account')}</h2>
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: user?.avatarColor }}>
                {user?.displayName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{user?.displayName}</p>
                <p className="text-xs text-slate-500">{user?.username}</p>
              </div>
            </div>
            <button onClick={() => logout()} className="btn-danger w-full">
              <LogOut size={18} /> {t('logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
