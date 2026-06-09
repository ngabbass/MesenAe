import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Backend database is now Firebase and does not require explicit Vercel API initialization

// Apply saved theme on initial load
const savedTheme = localStorage.getItem('mesenae-theme');
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else if (!savedTheme) {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('mesenae-theme', 'dark');
  }
}

window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

// Mount app immediately
createRoot(document.getElementById("root")!).render(<App />);

