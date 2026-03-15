import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  CreditCard,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  Moon,
  ReceiptIndianRupee,
  SlidersHorizontal,
  Sun,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'Snapshot & imports' },
  { id: 'spending', label: 'Spending', icon: WalletCards, desc: 'Outflows & habits' },
  { id: 'income', label: 'Income', icon: ReceiptIndianRupee, desc: 'Salary & credits' },
  { id: 'cards', label: 'Cards', icon: CreditCard, desc: 'Card spend & settlements' },
  { id: 'merchants', label: 'Merchants', icon: BarChart3, desc: 'Who gets paid' },
  { id: 'categories', label: 'Categories', icon: BarChart3, desc: 'Category drilldowns' },
  { id: 'review', label: 'Review', icon: SlidersHorizontal, desc: 'Overrides & cleanup' },
  { id: 'library', label: 'Library', icon: Database, desc: 'Statements & insights' },
  { id: 'transactions', label: 'Transactions', icon: FileSpreadsheet, desc: 'Search all entries' },
];

const themeKey = 'statement-atlas-theme';

const Layout = ({ children, hasData, statementCount, coverageLabel, onExport, onClear }) => {
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(themeKey);
    const shouldDark = storedTheme ? storedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(shouldDark);
    document.documentElement.classList.toggle('dark', shouldDark);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.2, 0.45, 0.7] },
    );

    navItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem(themeKey, next ? 'dark' : 'light');
  };

  const jumpTo = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(sectionId);
    setMobileOpen(false);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 p-6 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-700 via-sky-500 to-violet-500 shadow-lg shadow-indigo-500/25">
            <span className="text-lg font-black text-white">S</span>
          </div>
          {sidebarOpen || mobileOpen ? (
            <div>
              <span className="block text-lg font-black tracking-tight premium-gradient-text">Statement Atlas</span>
              <span className="text-xs font-medium text-slate-400">Personal finance cockpit</span>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-5">
        {sidebarOpen || mobileOpen ? (
          <p className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300 dark:text-white/20">
            Navigation
          </p>
        ) : null}
        {navItems.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpTo(item.id)}
              className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-premium ${
                active
                  ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-white/55 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              <item.icon size={19} className={`shrink-0 ${active ? 'text-white' : ''}`} />
              {sidebarOpen || mobileOpen ? (
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  {!active ? (
                    <p className="text-[10px] text-slate-400 transition-colors group-hover:text-indigo-400 dark:text-white/30">
                      {item.desc}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-100 p-4 dark:border-white/5">
        {sidebarOpen || mobileOpen ? (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-white/35">
              Stored profile
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
              {hasData ? `${statementCount} statement${statementCount === 1 ? '' : 's'}` : 'No data yet'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-white/55">
              {coverageLabel || 'Upload your first annual statement to begin.'}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/10"
          >
            {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-500" />}
            {sidebarOpen || mobileOpen ? (isDark ? 'Light' : 'Dark') : null}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!hasData}
            className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/10"
          >
            {sidebarOpen || mobileOpen ? 'Export' : 'Ex'}
          </button>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasData}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-rose-500/10"
        >
          <Trash2 size={16} />
          {sidebarOpen || mobileOpen ? 'Clear local profile' : null}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`relative flex min-h-screen overflow-hidden transition-colors duration-500 ${isDark ? 'bg-dark-bg dark' : 'bg-slate-50'}`}>
      <div className="pointer-events-none fixed left-[-10%] top-[-10%] h-[38%] w-[38%] rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-14%] right-[-8%] h-[34%] w-[34%] rounded-full bg-sky-500/10 blur-[110px]" />

      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 272 : 84 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="glass-card fixed z-30 hidden h-full border-r border-slate-200/60 shadow-premium md:block dark:border-white/5"
      >
        {sidebar}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="glass-card fixed left-0 top-0 z-50 h-full w-[278px] border-r border-slate-200/60 shadow-2xl dark:border-white/5 md:hidden"
            >
              <div className="absolute right-4 top-4">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-white/55 dark:hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
              {sidebar}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className={`relative z-10 flex-1 overflow-y-auto p-6 transition-all duration-500 md:p-10 ${sidebarOpen ? 'md:ml-[272px]' : 'md:ml-[84px]'}`}>
        <div className="mb-6 flex items-center justify-between rounded-[1.75rem] glass-card p-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-white/55 dark:hover:bg-white/10"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-700 via-sky-500 to-violet-500">
              <span className="text-sm font-black text-white">S</span>
            </div>
            <span className="text-base font-black premium-gradient-text">Statement Atlas</span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/55"
          >
            {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-500" />}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
};

export default Layout;
