import { Home, LayoutGrid, CalendarDays, MessageSquare, Settings } from 'lucide-react';
import { useRouter } from '@/contexts/RouterContext';
import { useI18n } from '@/i18n/I18nContext';
import { useRipple } from '@/hooks/useRipple';

export function BottomNav() {
  const { route, navigate } = useRouter();
  const { t } = useI18n();
  const ripple = useRipple();

  const items = [
    { key: 'home', icon: Home, label: t('navHome'), route: { name: 'home' } as const },
    { key: 'sections', icon: LayoutGrid, label: t('navLibrary'), route: { name: 'sections' } as const },
    { key: 'seminars', icon: CalendarDays, label: t('navCalendar'), route: { name: 'seminars' } as const },
    { key: 'forum', icon: MessageSquare, label: t('navForum'), route: { name: 'forum' } as const },
    { key: 'settings', icon: Settings, label: t('navSettings'), route: { name: 'settings' } as const },
  ];

  const activeKey = route.name === 'section' || route.name === 'folder' ? 'sections'
    : route.name === 'forum-topic' || route.name === 'chat' ? 'forum'
    : route.name === 'admin' ? 'settings'
    : route.name;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-700 safe-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto h-16 px-2">
        {items.map(item => {
          const active = activeKey === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={(e) => { ripple.addRipple(e); navigate(item.route); }}
              className={`ripple flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-2 py-1.5 rounded-2xl transition-all ${
                active
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : ''
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 2}
                className={active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}
                style={active ? { color: 'var(--c-primary-600)' } : undefined}
              />
              <span
                className={`text-[10px] leading-tight ${active ? 'font-bold' : 'font-medium'} ${
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'
                }`}
                style={active ? { color: 'var(--c-primary-600)' } : undefined}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
