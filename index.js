// Theme toggle functionality
(function() {
  const modeToggle = document.getElementById('mode-toggle');
  const body = document.body;

  // Get saved theme or default to system preference
  function getPreferredTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Apply theme by setting body class
  function applyTheme(theme) {
    body.classList.remove('light', 'dark');
    body.classList.add(theme);
  }

  // Toggle theme
  function toggleTheme() {
    const currentTheme = body.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  }

  // Initialize theme on page load
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // Add click event listener
  modeToggle.addEventListener('click', toggleTheme);

  // Listen for system theme changes (only if user hasn't set a preference)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
})();
