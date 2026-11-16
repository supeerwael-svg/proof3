import { useState, useEffect, useRef, type MouseEvent } from 'react';
import { Megaphone, Clock, Star, CalendarDays, Plus, Pin, Trash2, FolderOpen, GripVertical, PinOff, EyeOff, Eye, Pencil, X, Check } from 'lucide-react';
import { Header } from '@/components/Header';
import { AnnouncementsService, FilesService, SeminarsService, SectionsService, AcademicYearsService, SchoolService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from '@/contexts/RouterContext';
import { FileIcon } from '@/components/FileIcon';
import { DocumentViewer } from '@/viewer/DocumentViewer';
import { getIcon, iconChoices } from '@/components/iconMap';
import { SECTION_COLORS } from '@/config/palettes';
import { formatDate, timeAgo } from '@/utils/format';
import { useRipple } from '@/hooks/useRipple';
import type { AnnouncementEntity, FileEntity, SeminarEntity, SectionEntity, AcademicYearEntity, SchoolEntity } from '@/types';
import type { HomeCardState } from '@/types';

interface ProfileData {
  teacherName: string;
  schoolName: string;
  classes: string;
  yearLabel: string;
}

export function HomePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { homeCards, setHomeCards } = useTheme();
  const ripple = useRipple();

  const [announcements, setAnnouncements] = useState<AnnouncementEntity[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileEntity[]>([]);
  const [favorites, setFavorites] = useState<FileEntity[]>([]);
  const [seminars, setSeminars] = useState<SeminarEntity[]>([]);
  const [sections, setSections] = useState<SectionEntity[]>([]);
  const [previewFile, setPreviewFile] = useState<FileEntity | null>(null);
  const [showAddAnn, setShowAddAnn] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({ teacherName: '', schoolName: '', classes: '', yearLabel: '' });
  const [editProfile, setEditProfile] = useState<ProfileData>({ teacherName: '', schoolName: '', classes: '', yearLabel: '' });
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [editingSection, setEditingSection] = useState<SectionEntity | null>(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [editSectionIcon, setEditSectionIcon] = useState('FolderOpen');
  const [editSectionColor, setEditSectionColor] = useState<string | undefined>(undefined);

  const load = async () => {
    setAnnouncements(await AnnouncementsService.getAll());
    setRecentFiles(await FilesService.getRecent(5));
    setFavorites(await FilesService.getFavorites());
    setSeminars(await SeminarsService.getUpcoming(3));
    setSections(await SectionsService.getAll());

    const year = await AcademicYearsService.getCurrent();
    const school = await SchoolService.get();
    const yearLabel = year ? year.year : '';
    const schoolName = school ? (lang === 'ar' ? school.name : lang === 'fr' ? school.name : school.nameEn) : '';
    setProfile({
      teacherName: user?.displayName ?? '',
      schoolName,
      classes: '',
      yearLabel,
    });
  };

  useEffect(() => { load(); }, [lang, user?.displayName]);

  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';

  // Merge sections with homeCards state
  const cardStates: HomeCardState[] = sections.map((s, i) => {
    const saved = homeCards.find(c => c.sectionKey === s.key);
    return saved ?? { sectionKey: s.key, pinned: false, hidden: false, order: i };
  });

  const visibleCards = cardStates
    .filter(c => !c.hidden)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.order - b.order);

  const visibleSections = visibleCards
    .map(c => sections.find(s => s.key === c.sectionKey))
    .filter((s): s is SectionEntity => !!s);

  const saveCards = (cards: HomeCardState[]) => setHomeCards(cards);

  const togglePin = (key: string) => {
    const updated = cardStates.map(c => c.sectionKey === key ? { ...c, pinned: !c.pinned } : c);
    saveCards(updated);
  };

  const toggleHide = (key: string) => {
    const updated = cardStates.map(c => c.sectionKey === key ? { ...c, hidden: !c.hidden } : c);
    saveCards(updated);
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: MouseEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) return;
    const reordered = [...visibleCards];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(idx, 0, moved);
    const newStates = reordered.map((c, i) => ({ ...c, order: i }));
    const allStates = cardStates.filter(c => c.hidden).concat(newStates);
    saveCards(allStates);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const addAnnouncement = async () => {
    if (!annTitle.trim() || !user) return;
    await AnnouncementsService.create(annTitle.trim(), annContent.trim(), user.id);
    setAnnTitle('');
    setAnnContent('');
    setShowAddAnn(false);
    load();
  };

  const deleteAnn = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await AnnouncementsService.delete(id);
    load();
  };

  const saveProfile = () => {
    setProfile(editProfile);
    setEditingProfile(false);
  };

  const openEditSection = (s: SectionEntity) => {
    setEditingSection(s);
    setEditSectionName(lang === 'ar' ? s.name : lang === 'fr' ? s.nameFr : s.nameEn);
    setEditSectionIcon(s.icon);
    setEditSectionColor(s.color);
  };

  const saveSection = async () => {
    if (!editingSection || !editSectionName.trim()) return;
    await SectionsService.rename(editingSection.id, editSectionName.trim(), editSectionName.trim(), editSectionName.trim());
    await SectionsService.updateAppearance(editingSection.id, editSectionIcon, editSectionColor);
    setEditingSection(null);
    load();
  };

  const deleteSection = async (s: SectionEntity) => {
    if (!confirm(t('confirmDelete'))) return;
    await SectionsService.delete(s.id);
    const updatedCards = homeCards.filter(c => c.sectionKey !== s.key);
    setHomeCards(updatedCards);
    setEditingSection(null);
    load();
  };

  const startLongPress = () => {
    const timer = setTimeout(() => setEditMode(true), 600);
    setLongPressTimer(timer);
  };

  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Gradient top bar */}
      <Header
        title={t('appName')}
        variant="gradient"
        showSearch
        trailingText={t('appSubtitle')}
      />

      <div className="max-w-md mx-auto px-4 py-4 space-y-6 -mt-2">
        {/* Identity Card */}
        <div
          onClick={() => { setEditProfile(profile); setEditingProfile(true); }}
          className="rounded-4xl p-5 text-white shadow-lg cursor-pointer transition-transform active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, var(--c-primary-500), var(--c-primary-800))' }}
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shrink-0 border-2 border-white/30">
              {profile.teacherName?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white/70 shrink-0">{t('teacherName')}</span>
                <span className="text-sm font-semibold text-white truncate">{profile.teacherName || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white/70 shrink-0">{t('school')}</span>
                <span className="text-sm font-semibold text-white truncate">{profile.schoolName || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white/70 shrink-0">{t('assignedClasses')}</span>
                <span className="text-sm font-semibold text-white truncate">{profile.classes || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white/70 shrink-0">{t('academicYear')}</span>
                <span className="text-sm font-semibold text-white truncate">{profile.yearLabel || '—'}</span>
              </div>
            </div>
            <Pencil size={16} className="text-white/60 shrink-0 mt-1" />
          </div>
        </div>

        {/* Edit Profile Modal */}
        {editingProfile && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setEditingProfile(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('editProfile')}</h3>
                <button onClick={() => setEditingProfile(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
              <div>
                <label className="label">{t('enterName')}</label>
                <input value={editProfile.teacherName} onChange={e => setEditProfile({ ...editProfile, teacherName: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">{t('enterSchool')}</label>
                <input value={editProfile.schoolName} onChange={e => setEditProfile({ ...editProfile, schoolName: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">{t('enterClasses')}</label>
                <input value={editProfile.classes} onChange={e => setEditProfile({ ...editProfile, classes: e.target.value })} className="input" placeholder="1م1، 2م2، 3م3" />
              </div>
              <div>
                <label className="label">{t('academicYear')}</label>
                <input value={editProfile.yearLabel} onChange={e => setEditProfile({ ...editProfile, yearLabel: e.target.value })} className="input" placeholder="2026/2027" />
              </div>
              <button onClick={saveProfile} className="btn-primary w-full">
                <Check size={18} /> {t('save')}
              </button>
            </div>
          </div>
        )}

        {/* Section Grid Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FolderOpen size={18} style={{ color: 'var(--c-primary-500)' }} />
            {t('mySections')}
          </h2>
          <div className="flex items-center gap-2">
            {editMode && (
              <button onClick={() => setEditMode(false)} className="text-xs font-semibold text-primary-600 px-3 py-1 rounded-lg" style={{ color: 'var(--c-primary-600)' }}>
                {t('close')}
              </button>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <GripVertical size={14} />
              {t('dragToReorder')}
            </span>
          </div>
        </div>

        {/* Section Grid */}
        <div className="grid grid-cols-2 gap-3">
          {visibleSections.map((s, idx) => {
            const Icon = getIcon(s.icon);
            const cardState = visibleCards[idx];
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx && draggedIdx !== idx;
            const sectionColor = s.color || SECTION_COLORS[idx % SECTION_COLORS.length];
            return (
              <div
                key={s.id}
                draggable={editMode}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                onMouseDown={startLongPress}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={startLongPress}
                onTouchEnd={cancelLongPress}
                className={`relative rounded-3xl bg-white dark:bg-slate-800/60 border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                  isDragging ? 'opacity-50 scale-95' : ''
                } ${isDragOver ? 'border-primary-500 scale-105' : 'border-slate-200 dark:border-slate-700'} ${
                  editMode ? 'cursor-move' : 'cursor-pointer'
                }`}
                style={{ borderColor: cardState?.pinned ? 'var(--c-primary-300)' : undefined }}
              >
                {/* Action buttons in edit mode */}
                {editMode && (
                  <div className="absolute top-2 end-2 flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditSection(s); }}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Pencil size={14} className="text-slate-500" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(s.key); }}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      {cardState?.pinned ? <Pin size={14} style={{ color: 'var(--c-primary-600)' }} /> : <PinOff size={14} className="text-slate-400" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleHide(s.key); }}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                    >
                      <EyeOff size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSection(s); }}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                    >
                      <Trash2 size={14} className="text-error-500" />
                    </button>
                  </div>
                )}

                <button
                  onClick={(e) => { if (!editMode) { ripple.addRipple(e); navigate({ name: 'section', key: s.key }); } }}
                  className="flex flex-col items-center gap-2 w-full"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-colors"
                    style={{ backgroundColor: sectionColor + '18' }}
                  >
                    <Icon size={26} style={{ color: sectionColor }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
                    {lang === 'ar' ? s.name : lang === 'fr' ? s.nameFr : s.nameEn}
                  </span>
                </button>

                {/* Pin indicator */}
                {cardState?.pinned && !editMode && (
                  <Pin size={12} className="absolute top-2 end-2" style={{ color: 'var(--c-primary-500)' }} fill="currentColor" />
                )}

                {/* Drag handle dots */}
                {editMode && (
                  <div className="absolute bottom-1.5 end-1.5">
                    <GripVertical size={14} className="text-slate-300 dark:text-slate-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hidden sections restore */}
        {editMode && cardStates.some(c => c.hidden) && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">{t('hide')}</h3>
            <div className="flex flex-wrap gap-2">
              {cardStates.filter(c => c.hidden).map(c => {
                const s = sections.find(sec => sec.key === c.sectionKey);
                if (!s) return null;
                return (
                  <button
                    key={c.sectionKey}
                    onClick={() => toggleHide(c.sectionKey)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    <Eye size={14} />
                    {lang === 'ar' ? s.name : lang === 'fr' ? s.nameFr : s.nameEn}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Announcements */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Megaphone size={18} style={{ color: 'var(--c-primary-500)' }} />
              {t('announcements')}
            </h2>
            {canWrite && (
              <button onClick={() => setShowAddAnn(!showAddAnn)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <Plus size={20} style={{ color: 'var(--c-primary-500)' }} />
              </button>
            )}
          </div>

          {showAddAnn && canWrite && (
            <div className="card p-4 mb-3 space-y-2 animate-slide-up">
              <input
                value={annTitle}
                onChange={e => setAnnTitle(e.target.value)}
                placeholder={t('topicTitle')}
                className="input"
              />
              <textarea
                value={annContent}
                onChange={e => setAnnContent(e.target.value)}
                placeholder={t('content')}
                className="input min-h-20"
                rows={3}
              />
              <div className="flex gap-2">
                <button onClick={addAnnouncement} className="btn-primary flex-1">{t('save')}</button>
                <button onClick={() => setShowAddAnn(false)} className="btn-secondary">{t('cancel')}</button>
              </div>
            </div>
          )}

          {announcements.length > 0 ? (
            <div className="space-y-2">
              {announcements.map(ann => (
                <div key={ann.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {ann.pinned && <Pin size={14} style={{ color: 'var(--c-primary-500)' }} />}
                      <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{ann.title}</h3>
                    </div>
                    {canWrite && (
                      <button onClick={() => deleteAnn(ann.id)} className="p-1 rounded hover:bg-error-50 dark:hover:bg-error-900/20">
                        <Trash2 size={14} className="text-error-500" />
                      </button>
                    )}
                  </div>
                  {ann.content && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{ann.content}</p>}
                  <p className="text-xs text-slate-400 mt-2">{timeAgo(ann.createdAt, lang)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">{t('noAnnouncements')}</p>
          )}
        </div>

        {/* Recent Files */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Clock size={18} className="text-accent-500" />
            {t('recentFiles')}
          </h2>
          {recentFiles.length > 0 ? (
            <div className="space-y-2">
              {recentFiles.map(f => (
                <button
                  key={f.id}
                  onClick={() => setPreviewFile(f)}
                  className="card p-3 flex items-center gap-3 w-full text-start hover:shadow-md transition-shadow"
                >
                  <FileIcon mimeType={f.mimeType} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                    <p className="text-xs text-slate-500">{timeAgo(f.lastOpened ?? f.createdAt, lang)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">{t('noRecentFiles')}</p>
          )}
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Star size={18} className="text-warning-500" />
              {t('favorites')}
            </h2>
            <div className="space-y-2">
              {favorites.slice(0, 5).map(f => (
                <button
                  key={f.id}
                  onClick={() => setPreviewFile(f)}
                  className="card p-3 flex items-center gap-3 w-full text-start hover:shadow-md transition-shadow"
                >
                  <FileIcon mimeType={f.mimeType} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                    <p className="text-xs text-slate-500">{formatDate(f.createdAt, lang)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Seminars */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <CalendarDays size={18} className="text-success-500" />
            {t('upcomingSeminars')}
          </h2>
          {seminars.length > 0 ? (
            <div className="space-y-2">
              {seminars.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate({ name: 'seminars' })}
                  className="card p-4 w-full text-start hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{s.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.type === 'internal' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400'}`}>
                      {s.type === 'internal' ? t('internal') : t('external')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(s.date, lang)} · {s.location}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">{t('noSeminars')}</p>
          )}
        </div>
      </div>

      <DocumentViewer file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setEditingSection(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('renameSection')}</h3>
              <button onClick={() => setEditingSection(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div>
              <label className="label">{t('sectionName')}</label>
              <input value={editSectionName} onChange={e => setEditSectionName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">{t('changeIcon')}</label>
              <div className="grid grid-cols-6 gap-2">
                {iconChoices.map(icName => {
                  const Ic = getIcon(icName);
                  return (
                    <button
                      key={icName}
                      onClick={() => setEditSectionIcon(icName)}
                      className={`flex items-center justify-center w-11 h-11 rounded-xl border-2 transition-all ${
                        editSectionIcon === icName
                          ? 'border-slate-800 dark:border-white bg-slate-100 dark:bg-slate-700'
                          : 'border-transparent bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Ic size={20} className="text-slate-600 dark:text-slate-300" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label">{t('sectionColor')}</label>
              <div className="flex flex-wrap gap-2">
                {SECTION_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditSectionColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      editSectionColor === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button
                  onClick={() => setEditSectionColor(undefined)}
                  className={`text-xs px-3 rounded-lg border-2 transition-all ${
                    !editSectionColor ? 'border-slate-800 dark:border-white bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'border-transparent text-slate-400'
                  }`}
                >
                  {t('resetDefault')}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveSection} className="btn-primary flex-1">
                <Check size={18} /> {t('save')}
              </button>
              <button onClick={() => editingSection && deleteSection(editingSection)} className="btn-danger">
                <Trash2 size={18} /> {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
