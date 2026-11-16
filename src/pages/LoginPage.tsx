import { useState } from 'react';
import { GraduationCap, Lock, User, AlertCircle, Loader2, Ticket, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun, Globe } from 'lucide-react';
import { AuthService } from '@/services';

export function LoginPage() {
  const { login } = useAuth();
  const { t, lang, setLang, dir } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!inviteCode.trim() || !username.trim() || !password.trim()) {
          setError(t('invalidInviteCode'));
          setLoading(false);
          return;
        }
        const user = await AuthService.registerWithInvite(
          inviteCode.trim().toUpperCase(),
          username.trim(),
          displayName.trim() || username.trim(),
          password,
        );
        await login(user.username, password);
      } else {
        await login(username.trim(), password);
      }
    } catch (err: any) {
      if (err?.message === 'banned') setError(t('loginBanned'));
      else if (err?.message === 'invalid_code') setError(t('invalidInviteCode'));
      else if (err?.message === 'username_taken') setError(t('usernameTaken'));
      else setError(t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  const langs: typeof lang[] = ['ar', 'en', 'fr'];
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 safe-top safe-bottom">
      {/* Top controls */}
      <div className="flex justify-end gap-2 p-4">
        <button
          onClick={() => setLang(langs[(langs.indexOf(lang) + 1) % 3])}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur shadow-sm text-slate-600 dark:text-slate-300 hover:shadow-md transition-all"
        >
          <Globe size={20} />
        </button>
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur shadow-sm text-slate-600 dark:text-slate-300 hover:shadow-md transition-all"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <GraduationCap size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('appName')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('appSubtitle')}</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'login' ? 'bg-primary-600 text-white shadow-md' : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300'}`}
          >
            {t('loginBtn')}
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'register' ? 'bg-primary-600 text-white shadow-md' : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300'}`}
          >
            {t('register')}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="label">{t('inviteCode')}</label>
              <div className="relative">
                <Ticket size={18} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  className="input ps-11 font-mono uppercase tracking-wider"
                  placeholder="ABCDEFGH"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">{t('username')}</label>
            <div className="relative">
              <User size={18} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input ps-11"
                placeholder={t('username')}
                required
                autoComplete="username"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="label">{t('welcomeBack')}</label>
              <div className="relative">
                <User size={18} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="input ps-11"
                  placeholder={t('welcomeBack')}
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">{t('password')}</label>
            <div className="relative">
              <Lock size={18} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input ps-11"
                placeholder={t('password')}
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 rounded-xl px-4 py-3 text-sm animate-fade-in">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password || (mode === 'register' && !inviteCode)}
            className="btn-primary w-full text-base py-3.5"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : mode === 'register' ? t('registerBtn') : t('loginBtn')}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100/70 dark:bg-slate-800/50 rounded-lg px-4 py-2 inline-block">
              {t('defaultAdminHint')}
            </p>
          </div>
        )}

        {mode === 'register' && (
          <div className="mt-6 text-center">
            <button onClick={() => { setMode('login'); setError(''); }} className="text-sm text-slate-500 hover:text-primary-500 transition-colors flex items-center justify-center gap-1">
              <BackIcon size={16} />
              {t('loginBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
