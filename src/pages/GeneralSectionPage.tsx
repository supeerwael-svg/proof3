import { useState, useEffect } from 'react';
import { Megaphone, Pin, Trash2, Plus, LayoutGrid, ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { Header } from '@/components/Header';
import { AnnouncementsService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { timeAgo } from '@/utils/format';
import type { AnnouncementEntity } from '@/types';

export function GeneralSectionPage() {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementEntity[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const load = () => AnnouncementsService.getAll().then(setAnnouncements);
  useEffect(() => { load(); }, []);

  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';
  const NextIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const add = async () => {
    if (!title.trim() || !user) return;
    await AnnouncementsService.create(title.trim(), content.trim(), user.id);
    setTitle(''); setContent(''); setShowAdd(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await AnnouncementsService.delete(id);
    load();
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title={t('generalSection')} subtitle={t('announcementsBoard')} showBack />
      <div className="max-w-md mx-auto px-4 py-4 space-y-5">
        {/* Announcements board */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Megaphone size={18} className="text-primary-500" />
              {t('announcementsBoard')}
            </h2>
            {canWrite && (
              <button onClick={() => setShowAdd(!showAdd)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <Plus size={20} className="text-primary-500" />
              </button>
            )}
          </div>

          {showAdd && canWrite && (
            <div className="card p-4 mb-3 space-y-2 animate-slide-up">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('topicTitle')} className="input" />
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t('content')} className="input" rows={3} />
              <div className="flex gap-2">
                <button onClick={add} className="btn-primary flex-1">{t('save')}</button>
                <button onClick={() => setShowAdd(false)} className="btn-secondary">{t('cancel')}</button>
              </div>
            </div>
          )}

          {announcements.length > 0 ? (
            <div className="space-y-2">
              {announcements.map(ann => (
                <div key={ann.id} className={`card p-4 ${ann.pinned ? 'border-primary-300 dark:border-primary-700' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {ann.pinned && <Pin size={14} className="text-primary-500" />}
                      <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{ann.title}</h3>
                    </div>
                    {canWrite && (
                      <button onClick={() => del(ann.id)} className="p-1 rounded hover:bg-error-50 dark:hover:bg-error-900/20">
                        <Trash2 size={14} className="text-error-500" />
                      </button>
                    )}
                  </div>
                  {ann.content && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{ann.content}</p>}
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Clock size={12} /> {timeAgo(ann.createdAt, lang)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">{t('noNews')}</p>
          )}
        </div>

        {/* Proceed to sections */}
        <button
          onClick={() => navigate({ name: 'home' })}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <LayoutGrid size={20} />
          {t('navSections')}
          <NextIcon size={20} />
        </button>
      </div>
    </div>
  );
}
