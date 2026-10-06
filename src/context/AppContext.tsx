'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, Company } from '@/types/database';
import { Language, translations } from '@/lib/i18n';
import { dataProvider } from '@/lib/data-provider';

export type NavTab = 'vehicles' | 'sales' | 'customers' | 'expenses' | 'advances' | 'attendance' | 'team' | 'reports' | 'admin';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface AppContextType {
  session: UserSession | null;
  setSession: (s: UserSession | null) => void;
  isInitializing: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  t: (typeof translations)['en'];
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  actingCompany: Company | null;
  setActingCompany: (c: Company | null) => void;
  dataVersion: number;
  triggerRefresh: () => void;
  currency: string;
  setCurrency: (c: string) => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Synchronous session recovery from localStorage prevents login page flash on refresh
  const [session, setSessionState] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('garage_erp_session_cache');
        if (cached) return JSON.parse(cached);
      } catch (e) {
        // ignore
      }
    }
    return dataProvider.getCurrentSession();
  });

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [language, setLanguageState] = useState<Language>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Synchronous activeTab recovery from localStorage
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTab = localStorage.getItem('garage_erp_active_tab') as NavTab;
        if (savedTab) return savedTab;
      } catch (e) {
        // ignore
      }
    }
    return 'vehicles';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dataVersion, setDataVersion] = useState(0);

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('garage_erp_active_tab', tab);
      } catch (e) {
        // ignore
      }
    }
  };

  // Initialize session and sync directly from Supabase
  useEffect(() => {
    async function init() {
      try {
        await dataProvider.syncFromSupabase();
        const cur = dataProvider.getCurrentSession();
        if (cur) {
          setSessionState(cur);
          // If no saved tab, set sensible default based on role
          const savedTab = localStorage.getItem('garage_erp_active_tab');
          if (!savedTab) {
            if (['superadmin', 'superstaff'].includes(cur.profile.role)) {
              setActiveTab('admin');
            } else {
              setActiveTab('vehicles');
            }
          }
        }
      } catch (err) {
        console.error('Initial Supabase sync error:', err);
      } finally {
        setIsInitializing(false);
        setDataVersion((v) => v + 1);
      }
    }
    init();

    const savedLang = localStorage.getItem('garage_erp_lang') as Language;
    if (savedLang === 'en' || savedLang === 'ar') {
      setLanguageState(savedLang);
      document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = savedLang;
    }

    const savedTheme = localStorage.getItem('garage_erp_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const actingCompany = session?.actingCompany || null;

  // Keep browser document title synced with active workshop name, and listen to sync errors
  useEffect(() => {
    const compName = actingCompany?.name || session?.company?.name;
    if (compName && typeof document !== 'undefined') {
      document.title = compName;
    }

    const handleSyncError = (e: any) => {
      if (e.detail?.message) {
        // use showToast but we don't have it in scope of this hook easily unless we add it
        // wait, we can just use an alert or a window toast, but we want the app toast.
        // It's better to add the listener inside a separate useEffect that depends on showToast and triggerRefresh
      }
    };
  }, [session, actingCompany]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('garage_erp_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('garage_erp_theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const setSession = (s: UserSession | null) => {
    setSessionState(s);
    if (s && ['superadmin', 'superstaff'].includes(s.profile.role)) {
      setActiveTab('admin');
    } else if (s) {
      setActiveTab('vehicles');
    }
  };

  const setActingCompany = (c: Company | null) => {
    dataProvider.setActingCompany(c?.id || null);
    setSessionState(dataProvider.getCurrentSession());
    triggerRefresh();
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const triggerRefresh = () => {
    dataProvider.syncFromSupabase().finally(() => {
      setDataVersion((v) => v + 1);
    });
  };

  useEffect(() => {
    const handleSyncError = (e: any) => {
      if (e.detail?.message) {
        showToast(e.detail.message, 'error');
        setDataVersion((v) => v + 1); // trigger react render to clear rolled-back row
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('app-sync-error', handleSyncError);
      return () => window.removeEventListener('app-sync-error', handleSyncError);
    }
  }, []);

  const logout = async () => {
    await dataProvider.logout();
    setSessionState(null);
    showToast('Signed out successfully', 'info');
  };

  const t = translations[language];

  const currency = session?.actingCompany?.currency || session?.company?.currency || 'AED';

  const setCurrency = async (newCurrency: string) => {
    const targetCompId = session?.actingCompany?.id || session?.company?.id;
    if (!targetCompId) return;
    const res = await dataProvider.updateCompanyCurrency(targetCompId, newCurrency);
    if (res.success) {
      showToast(`Currency updated to ${newCurrency.toUpperCase()}!`, 'success');
      setSessionState(dataProvider.getCurrentSession());
      triggerRefresh();
    } else {
      showToast(res.error || 'Failed to update currency', 'error');
    }
  };

  return (
    <AppContext.Provider
      value={{
        session,
        setSession,
        isInitializing,
        language,
        setLanguage,
        theme,
        toggleTheme,
        activeTab,
        setActiveTab,
        mobileMenuOpen,
        setMobileMenuOpen,
        t,
        toasts,
        showToast,
        actingCompany,
        setActingCompany,
        dataVersion,
        triggerRefresh,
        currency,
        setCurrency,
        logout,
      }}
    >
      {children}
      {/* Toast Notifications Overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center justify-between border transition-all transform animate-in slide-in-from-bottom-2 ${
              toast.type === 'error'
                ? 'bg-rose-950/95 text-rose-200 border-rose-800'
                : toast.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-200 border-emerald-800'
                : toast.type === 'warning'
                ? 'bg-amber-950/95 text-amber-200 border-amber-800'
                : 'bg-slate-900/95 text-slate-100 border-slate-700'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
