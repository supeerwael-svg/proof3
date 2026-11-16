import { ArrowRight, ArrowLeft, Search } from 'lucide-react';
import { useRouter } from '@/contexts/RouterContext';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showSearch?: boolean;
  onBack?: () => void;
  variant?: 'plain' | 'gradient';
  trailingText?: string;
}

export function Header({ title, subtitle, showBack, showSearch, onBack, variant = 'plain', trailingText }: HeaderProps) {
  const { back, navigate, canGoBack } = useRouter();
  const { dir } = useI18n();
  const { user } = useAuth();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const handleBack = onBack ?? back;
  const showBackBtn = showBack && (onBack ? true : canGoBack);

  if (variant === 'gradient') {
    return (
      <header
        className="sticky top-0 z-30 safe-top text-white"
        style={{ background: 'linear-gradient(135deg, var(--c-primary-600), var(--c-primary-800))' }}
      >
        <div className="flex items-center gap-3 px-4 h-16 max-w-md mx-auto">
          {showBackBtn && (
            <button
              onClick={handleBack}
              className="p-2 -ms-2 rounded-lg hover:bg-white/15 transition-colors"
            >
              <BackIcon size={22} />
            </button>
          )}
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-lg font-bold truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {trailingText && (
              <span className="text-xs text-white/80 truncate max-w-[120px]">{trailingText}</span>
            )}
            {showSearch && (
              <button
                onClick={() => navigate({ name: 'search', query: '' })}
                className="p-2 rounded-lg hover:bg-white/15 transition-colors"
              >
                <Search size={22} />
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700 safe-top">
      <div className="flex items-center gap-3 px-4 h-16 max-w-md mx-auto">
        {showBackBtn && (
          <button
            onClick={handleBack}
            className="p-2 -ms-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
          >
            <BackIcon size={22} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
        </div>
        {showSearch && (
          <button
            onClick={() => navigate({ name: 'search', query: '' })}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
          >
            <Search size={22} />
          </button>
        )}
        {user && !showBack && (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ backgroundColor: user.avatarColor }}
          >
            {user.displayName.charAt(0)}
          </div>
        )}
      </div>
    </header>
  );
}
