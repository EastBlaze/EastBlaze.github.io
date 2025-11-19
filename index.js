// Theme toggle functionality
(function() {
  const modeToggle = document.getElementById('mode-toggle');
  const root = document.documentElement;

  // Get saved theme or default to system preference
  function getPreferredTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Apply theme
  function applyTheme(theme) {
    if (theme === 'dark') {
      root.style.setProperty('--bg-color', '#1a1a1a');
      root.style.setProperty('--text-color', '#e0e0e0');
      root.style.setProperty('--heading-border-color', '#4a4a4a');
      root.style.setProperty('--link-color', '#58a6ff');
      root.style.setProperty('--skill-bg-color', '#2f363d');
      root.style.setProperty('--skill-border-color', '#444d56');
      root.style.setProperty('--code-bg-color', 'rgba(240, 246, 252, 0.05)');
      root.style.setProperty('--logo', 'url("/logo-white.svg")');
      modeToggle.classList.add('dark');
    } else {
      root.style.setProperty('--bg-color', '#ffffff');
      root.style.setProperty('--text-color', '#333333');
      root.style.setProperty('--heading-border-color', '#eaecef');
      root.style.setProperty('--link-color', '#0366d6');
      root.style.setProperty('--skill-bg-color', '#f1f8ff');
      root.style.setProperty('--skill-border-color', '#c8e1ff');
      root.style.setProperty('--code-bg-color', 'rgba(27, 31, 35, 0.05)');
      root.style.setProperty('--logo', 'url("/logo-black.svg")');
      modeToggle.classList.remove('dark');
    }
  }

  // Toggle theme
  function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || getPreferredTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  }

  // Initialize theme on page load
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // Add click event listener
  modeToggle.addEventListener('click', toggleTheme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
})();
