import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Route =
  | { name: 'login' }
  | { name: 'school' }
  | { name: 'general' }
  | { name: 'home' }
  | { name: 'sections' }
  | { name: 'section'; key: string }
  | { name: 'folder'; folderId: string }
  | { name: 'forum' }
  | { name: 'forum-topic'; topicId: string }
  | { name: 'chat' }
  | { name: 'seminars' }
  | { name: 'academic-year' }
  | { name: 'settings' }
  | { name: 'admin' }
  | { name: 'search'; query: string };

interface RouterContextType {
  route: Route;
  navigate: (route: Route) => void;
  back: () => void;
  canGoBack: boolean;
}

const RouterContext = createContext<RouterContextType | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<Route[]>([{ name: 'school' }]);

  const route = history[history.length - 1];
  const canGoBack = history.length > 1;

  const navigate = (r: Route) => {
    setHistory(h => [...h, r]);
  };

  const back = () => {
    setHistory(h => h.length > 1 ? h.slice(0, -1) : h);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <RouterContext.Provider value={{ route, navigate, back, canGoBack }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be inside RouterProvider');
  return ctx;
}
