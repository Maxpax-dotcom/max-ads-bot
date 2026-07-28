/**
 * ডার্ক/লাইট মোড টগল করার ফাংশন।
 * ইউজারের পছন্দ localStorage-এ জমা রাখে।
 */
(function () {
  const themeToggle = document.getElementById('themeToggle');
  const root = document.documentElement;

  // সংরক্ষিত থিম বা ডিফল্ট ডার্ক মোড সেট করো
  const storedTheme = localStorage.getItem('theme') || 'dark';
  root.setAttribute('data-theme', storedTheme);
  updateIcon(storedTheme);

  // টগল বাটনে ক্লিক ইভেন্ট
  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcon(next);
  });

  // বর্তমান থিম অনুযায়ী আইকন পরিবর্তন করো
  function updateIcon(theme) {
    themeToggle.innerHTML = theme === 'dark'
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  }
})();