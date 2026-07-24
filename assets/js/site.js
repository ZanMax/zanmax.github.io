// Shared across every page: theme toggle + mobile nav.

(() => {
    const root = document.documentElement;
    const toggle = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');

    const applyTheme = (theme) => {
        root.setAttribute('data-theme', theme);
        const dark = theme === 'dark';
        if (icon) icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
        if (toggle) toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };

    const stored = localStorage.getItem('theme');
    applyTheme(stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

    if (toggle) {
        toggle.addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            applyTheme(next);
        });
    }

    const menuBtn = document.getElementById('menu-btn');
    const mobileNav = document.getElementById('mobile-nav');

    if (menuBtn && mobileNav) {
        menuBtn.addEventListener('click', () => {
            const open = mobileNav.classList.toggle('open');
            menuBtn.setAttribute('aria-expanded', String(open));
            menuBtn.querySelector('i').className = open ? 'fas fa-xmark' : 'fas fa-bars';
        });

        mobileNav.addEventListener('click', (e) => {
            if (e.target.tagName !== 'A') return;
            mobileNav.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
            menuBtn.querySelector('i').className = 'fas fa-bars';
        });
    }
})();
