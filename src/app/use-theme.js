import { useLayoutEffect, useState } from 'react';

const themeKey = 'office-stock-theme';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // Theme switching is still available when storage is blocked.
    }
  }, [theme]);

  const toggleTheme = () => setTheme(current => current === 'dark' ? 'light' : 'dark');
  return { theme, toggleTheme };
}
