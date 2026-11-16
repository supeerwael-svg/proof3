import { useState, useEffect } from 'react';
import { UserPlus, Ban, KeyRound, Users, Wifi, Ticket, Trash2, Check, Copy, Shield, RotateCcw } from 'lucide-react';
import { Header } from '@/components/Header';
import { AuthService, ActivityLogService, InviteCodesService, SectionsService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { timeAgo, formatDate } from '@/utils/format';
import type { UserEntity, ActivityLogEntity, UserRole, InviteCodeEntity, SectionEntity, Permission } from '@/types';

export function AdminPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserEntity[]>([]);
  const [logs, setLogs] = useState<ActivityLogEntity[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [invites, setInvites] = useState<InviteCodeEntity[]>([]);
  const [sections, setSections] = useState<SectionEntity[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editingPerms, setEditingPerms] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('teacher_write');
  const [inviteRole, setInviteRole] = useState<UserRole>('teacher_write');
  const [inviteMaxUses, setInviteMaxUses] = useState(5);
  const [inviteDays, setInviteDays] = useState(30);
  const [copiedCode, setCopiedCode] = useState('');

  const load = async () => {
    setUsers(await AuthService.getAllUsers());
    setLogs(await ActivityLogService.getRecent(10));
    setOnlineCount(await AuthService.getOnlineCount());
    setInvites(await InviteCodesService.getAll());
    setSections(await SectionsService.getAll());
  };

  useEffect(() => { load(); }, []);

  if (user?.role !== 'super_admin') return null;

  const addUser = async () => {
    if (!newUsername.trim() || !newPassword.trim() || !user) return;
    await AuthService.createUser(newUsername.trim(), newDisplayName.trim() || newUsername.trim(), newPassword, newRole, [], user.id);
    setNewUsername(''); setNewDisplayName(''); setNewPassword(''); setNewRole('teacher_write');
    setShowAdd(false); load();
  };

  const genInvite = async () => {
    if (!user) return;
    await InviteCodesService.create(inviteRole, inviteMaxUses, inviteDays, user.id);
    setShowInvite(false); load();
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const resetPW = async (uid: string) => {
    const pw = prompt(t('resetPassword'));
    if (!pw) return;
    await AuthService.resetPassword(uid, pw);
  };

  const ban = async (uid: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await AuthService.banUser(uid);
    load();
  };

  const unban = async (uid: string) => {
    await AuthService.unbanUser(uid);
    load();
  };

  const changeRole = async (uid: string, role: UserRole) => {
    await AuthService.updateRole(uid, role);
    load();
  };

  const setPermission = (userId: string, sectionKey: string, access: Permission['access']) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const others = target.permissions.filter(p => p.section !== sectionKey);
    const updated = access === 'none' ? others : [...others, { section: sectionKey, access }];
    AuthService.updatePermissions(userId, updated).then(load);
  };

  const roleLabel = (r: UserRole) => r === 'super_admin' ? t('superAdmin') : r === 'teacher_write' ? t('teacherWrite') : r === 'teacher_read' ? t('teacherRead') : t('banned');

  const inviteStatus = (inv: InviteCodeEntity) => {
    if (inv.expiresAt < Date.now()) return 'expired';
    if (inv.usedCount >= inv.maxUses) return 'used';
    return 'active';
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title={t('adminPanel')} showBack />
      <div className="max-w-md mx-auto px-4 py-4 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <Users size={24} className="mx-auto mb-1 text-primary-500" />
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{users.length}</p>
            <p className="text-xs text-slate-500">{t('registeredUsers')}</p>
          </div>
          <div className="card p-4 text-center">
            <Wifi size={24} className="mx-auto mb-1 text-success-500" />
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{onlineCount}</p>
            <p className="text-xs text-slate-500">{t('onlineUsers')}</p>
          </div>
        </div>

        {/* Add teacher */}
        <div>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary w-full">
            <UserPlus size={18} /> {t('addTeacher')}
          </button>
          {showAdd && (
            <div className="card p-4 mt-2 space-y-2 animate-slide-up">
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder={t('username')} className="input" />
              <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder={t('topicTitle')} className="input" />
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('password')} className="input" />
              <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className="input">
                <option value="teacher_write">{t('teacherWrite')}</option>
                <option value="teacher_read">{t('teacherRead')}</option>
              </select>
              <div className="flex gap-2">
                <button onClick={addUser} className="btn-primary flex-1">{t('save')}</button>
                <button onClick={() => setShowAdd(false)} className="btn-secondary">{t('cancel')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Invite codes */}
        <div>
          <button onClick={() => setShowInvite(!showInvite)} className="btn-secondary w-full">
            <Ticket size={18} /> {t('generateInvite')}
          </button>
          {showInvite && (
            <div className="card p-4 mt-2 space-y-2 animate-slide-up">
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as UserRole)} className="input">
                <option value="teacher_write">{t('teacherWrite')}</option>
                <option value="teacher_read">{t('teacherRead')}</option>
              </select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label">{t('maxUses')}</label>
                  <input type="number" value={inviteMaxUses} onChange={e => setInviteMaxUses(Number(e.target.value))} className="input" min={1} />
                </div>
                <div className="flex-1">
                  <label className="label">{t('validityDays')}</label>
                  <input type="number" value={inviteDays} onChange={e => setInviteDays(Number(e.target.value))} className="input" min={1} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={genInvite} className="btn-primary flex-1">{t('generateInvite')}</button>
                <button onClick={() => setShowInvite(false)} className="btn-secondary">{t('cancel')}</button>
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <div className="mt-3 space-y-2">
              {invites.map(inv => {
                const status = inviteStatus(inv);
                return (
                  <div key={inv.id} className="card p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-bold text-primary-600 dark:text-primary-400">{inv.code}</code>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          status === 'active' ? 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400'
                          : status === 'used' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          : 'bg-error-50 dark:bg-error-900/20 text-error-500'
                        }`}>
                          {t(status)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {inv.usedCount}/{inv.maxUses} · {roleLabel(inv.role)} · {formatDate(inv.expiresAt, lang)}
                      </p>
                    </div>
                    <button onClick={() => copyCode(inv.code)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0">
                      {copiedCode === inv.code ? <Check size={16} className="text-success-500" /> : <Copy size={16} className="text-slate-500" />}
                    </button>
                    <button onClick={() => InviteCodesService.delete(inv.id).then(load)} className="p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 shrink-0">
                      <Trash2 size={16} className="text-error-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Users list */}
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">{t('manageUsers')}</h2>
          {users.map(u => (
            <div key={u.id} className="card p-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: u.avatarColor }}>
                  {u.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{u.displayName}</p>
                  <p className="text-xs text-slate-500">{u.username} · {u.isOnline ? t('online') : t('offline')}</p>
                </div>
                {u.role !== 'super_admin' && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => resetPW(u.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" title={t('resetPassword')}>
                      <KeyRound size={16} className="text-slate-500" />
                    </button>
                    <button onClick={() => setEditingPerms(editingPerms === u.id ? null : u.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" title={t('permissions')}>
                      <Shield size={16} className="text-slate-500" />
                    </button>
                    {u.role === 'banned' ? (
                      <button onClick={() => unban(u.id)} className="p-2 rounded-lg hover:bg-success-50 dark:hover:bg-success-900/20" title={t('unban')}>
                        <RotateCcw size={16} className="text-success-500" />
                      </button>
                    ) : (
                      <button onClick={() => ban(u.id)} className="p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20" title={t('ban')}>
                        <Ban size={16} className="text-error-500" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Role selector */}
              {u.role !== 'super_admin' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">{t('role')}:</span>
                  <select
                    value={u.role}
                    onChange={e => changeRole(u.id, e.target.value as UserRole)}
                    className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 outline-none"
                  >
                    <option value="teacher_write">{t('teacherWrite')}</option>
                    <option value="teacher_read">{t('teacherRead')}</option>
                    <option value="banned">{t('banned')}</option>
                  </select>
                </div>
              )}

              {/* Permissions editor */}
              {editingPerms === u.id && u.role !== 'super_admin' && (
                <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2 animate-slide-up">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('sectionAccess')}</p>
                  {sections.slice(0, 6).map(sec => {
                    const perm = u.permissions.find(p => p.section === sec.key);
                    const access = perm?.access ?? 'none';
                    return (
                      <div key={sec.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 truncate">
                          {lang === 'ar' ? sec.name : lang === 'fr' ? sec.nameFr : sec.nameEn}
                        </span>
                        <select
                          value={access}
                          onChange={e => setPermission(u.id, sec.key, e.target.value as Permission['access'])}
                          className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 outline-none"
                        >
                          <option value="none">{t('accessNone')}</option>
                          <option value="read">{t('accessRead')}</option>
                          <option value="write">{t('accessWrite')}</option>
                          <option value="comment">{t('accessComment')}</option>
                        </select>
                      </div>
                    );
                  })}
                  {sections.length > 6 && <p className="text-xs text-slate-400">+{sections.length - 6}...</p>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent activity */}
        {logs.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">{t('recentActivity')}</h2>
            {logs.map(l => (
              <div key={l.id} className="card p-3 mb-1">
                <p className="text-sm text-slate-700 dark:text-slate-300">{l.userName} — {l.action}</p>
                <p className="text-xs text-slate-400">{timeAgo(l.createdAt, lang)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
