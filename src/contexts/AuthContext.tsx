import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { AuthService, SettingsService } from '@/services';
import type { UserEntity } from '@/types';

interface AuthContextType {
  user: UserEntity | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_KEY = 'tp_session_user_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserEntity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      AuthService.getUserById(sessionId).then(u => {
        if (u && u.deletedAt === null && u.role !== 'banned') {
          setUser(u);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const u = await AuthService.login(username, password);
    if (!u) throw new Error('invalid');
    localStorage.setItem(SESSION_KEY, u.id);
    setUser(u);
  };

  const logout = async () => {
    if (user) await AuthService.logout(user.id);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
