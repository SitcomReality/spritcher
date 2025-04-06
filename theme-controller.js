import { elements } from 'dom-elements';

const THEME_KEY = 'spritcher-theme';

export function initThemeController() {
    elements.themeToggleButton.addEventListener('click', toggleTheme);
    loadThemePreference();
}

function applyTheme(isDarkMode) {
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
        elements.themeToggleButton.title = "Switch to Light Mode";
    } else {
        document.body.classList.remove('dark-mode');
        if (sunIcon) sunIcon.style.display = 'block';
        if (moonIcon) moonIcon.style.display = 'none';
        elements.themeToggleButton.title = "Switch to Dark Mode";
    }
}

function toggleTheme() {
    const isCurrentlyDark = document.body.classList.contains('dark-mode');
    applyTheme(!isCurrentlyDark);
    // Save preference
    try {
        localStorage.setItem(THEME_KEY, !isCurrentlyDark ? 'dark' : 'light');
        console.log(`Theme preference saved: ${!isCurrentlyDark ? 'dark' : 'light'}`);
    } catch (e) {
        console.warn("Could not save theme preference to localStorage:", e);
    }
}

function loadThemePreference() {
    let preferredTheme = 'light'; // Default
    try {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === 'dark' || savedTheme === 'light') {
            preferredTheme = savedTheme;
            console.log(`Loaded theme preference from localStorage: ${preferredTheme}`);
        } else {
            // If no preference saved, check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                preferredTheme = 'dark';
                console.log("Using system preference: dark mode");
            } else {
                 console.log("Using system preference: light mode");
            }
        }
    } catch (e) {
        console.warn("Could not access localStorage to load theme preference:", e);
        // Fallback to system preference if localStorage fails
         if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                preferredTheme = 'dark';
         }
    }
    applyTheme(preferredTheme === 'dark');
}

