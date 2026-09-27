export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'taskflow_theme_preference';

export const themeManager = {
  getInitialTheme: (): ThemeMode => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // ignore
    }
    return 'light';
  },

  applyTheme: (theme: ThemeMode) => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      if (body) body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      if (body) body.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  },
};
