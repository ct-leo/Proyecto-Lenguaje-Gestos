export type ThemeName = 'light' | 'dark' | 'neo';
const STORAGE_KEY = 'app_theme_v1';

export function getTheme(): ThemeName {
  const t = (localStorage.getItem(STORAGE_KEY) as ThemeName) || 'light';
  return t;
}

export function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme() {
  const saved = getTheme();
  applyTheme(saved);
}
