export type Theme = "dark" | "light";

const STORAGE_KEY = "word-compiler-theme";

function getInitialTheme(): Theme {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  }
  if (typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(STORAGE_KEY, t);
}

class ThemeStore {
  current = $state<Theme>(getInitialTheme());

  constructor() {
    applyTheme(this.current);
  }

  toggle() {
    this.current = this.current === "dark" ? "light" : "dark";
    applyTheme(this.current);
  }

  set(theme: Theme) {
    this.current = theme;
    applyTheme(this.current);
  }
}

export const theme = new ThemeStore();
