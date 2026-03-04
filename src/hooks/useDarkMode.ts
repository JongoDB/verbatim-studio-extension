import { useEffect } from 'react';
import { useStore } from './useStore';
import { getSettings } from '@/lib/storage';

export function useDarkMode() {
  const { darkMode, setDarkMode } = useStore();

  useEffect(() => {
    getSettings().then((settings) => {
      if (settings.darkMode === 'dark') {
        setDarkMode(true);
      } else if (settings.darkMode === 'light') {
        setDarkMode(false);
      } else {
        setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    });
  }, [setDarkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return darkMode;
}
