import { useState, useEffect } from 'react';
import { Plus, CalendarDays, Trash2, MapPin } from 'lucide-react';
import { Header } from '@/components/Header';
import { SeminarsService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/utils/format';
import type { SeminarEntity } from '@/types';

export function SeminarsPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [seminars, setSeminars] = useState<SeminarEntity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'internal' | 'external'>('internal');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');

  const load = () => SeminarsService.getAll().then(setSeminars);
  useEffect(() => { load(); }, []);

  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';

  const create = async () => {
    if (!title.trim() || !date || !user) return;
    await SeminarsService.create(title.trim(), type, new Date(date).getTime(), content.trim(), location.trim(), user.id);
    setTitle(''); setDate(''); setLocation(''); setContent(''); setType('internal');
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await SeminarsService.delete(id);
    load();
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title={t('seminars')} showBack />
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {canWrite && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary w-full">
            <Plus size={18} /> {t('newSeminar')}
          </button>
        )}

        {showForm && canWrite && (
          <div className="card p-4 space-y-2 animate-slide-up">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('seminarTitle')} className="input" />
            <select value={type} onChange={e => setType(e.target.value as any)} className="input">
              <option value="internal">{t('internal')}</option>
              <option value="external">{t('external')}</option>
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('location')} className="input" />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t('content')} className="input" rows={3} />
            <div className="flex gap-2">
              <button onClick={create} className="btn-primary flex-1">{t('save')}</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">{t('cancel')}</button>
            </div>
          </div>
        )}

        {seminars.length > 0 ? seminars.map(s => (
          <div key={s.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <CalendarDays size={20} className="text-primary-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(s.date, lang)}</p>
                  {s.location && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={12} /> {s.location}</p>}
                  {s.content && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{s.content}</p>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.type === 'internal' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400'}`}>
                  {s.type === 'internal' ? t('internal') : t('external')}
                </span>
                {canWrite && <button onClick={() => remove(s.id)} className="p-1 rounded hover:bg-error-50 dark:hover:bg-error-900/20"><Trash2 size={14} className="text-error-500" /></button>}
              </div>
            </div>
          </div>
        )) : <p className="text-sm text-slate-400 text-center py-4">{t('noSeminars')}</p>}
      </div>
    </div>
  );
}
