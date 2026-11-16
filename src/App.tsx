import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nProvider } from '@/i18n/I18nContext';
import { RouterProvider, useRouter } from '@/contexts/RouterContext';
import { BottomNav } from '@/components/BottomNav';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { SectionsPage } from '@/pages/SectionsPage';
import { SectionPage } from '@/pages/SectionPage';
import { FolderPage } from '@/pages/FolderPage';
import { ForumPage } from '@/pages/ForumPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AdminPage } from '@/pages/AdminPage';
import { SearchPage } from '@/pages/SearchPage';
import { SeminarsPage } from '@/pages/SeminarsPage';
import { SchoolPage } from '@/pages/SchoolPage';
import { GeneralSectionPage } from '@/pages/GeneralSectionPage';
import { AcademicYearPage } from '@/pages/AcademicYearPage';
import { seedDatabase } from '@/config/seed';
import { StorageService } from '@/services';

function RouteRenderer() {
  const { route } = useRouter();

  switch (route.name) {
    case 'school': return <SchoolPage />;
    case 'general': return <GeneralSectionPage />;
    case 'home': return <HomePage />;
    case 'sections': return <SectionsPage />;
    case 'section': return <SectionPage sectionKey={route.key} />;
    case 'folder': return <FolderPage folderId={route.folderId} />;
    case 'forum': return <ForumPage />;
    case 'seminars': return <SeminarsPage />;
    case 'academic-year': return <AcademicYearPage />;
    case 'settings': return <SettingsPage />;
    case 'admin': return <AdminPage />;
    case 'search': return <SearchPage />;
    default: return <HomePage />;
  }
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <>
      <RouteRenderer />
      <BottomNav />
    </>
  );
}

function App() {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    seedDatabase().then(() => {
      StorageService.requestPersistent();
      setSeeded(true);
    });
  }, []);

  if (!seeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <RouterProvider>
            <AppContent />
          </RouterProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
