import { initUI } from 'ui-controller';
import { elements } from 'dom-elements'; // Need this for fallback message

// Basic check for browser compatibility
function checkCompatibility() {
    const errors = [];
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        errors.push('File APIs are not fully supported.');
    }
    if (!document.createElement('canvas').getContext) {
        errors.push('Canvas API is not supported.');
    }
    if (!window.Worker) {
        // Not critical for initial version, but good to know
        console.warn('Web Workers are not supported in this browser. Performance may be impacted for large images.');
    }
    if (typeof window.localStorage === 'undefined') {
        console.warn('LocalStorage is not available. Theme preference will not be saved.');
        // Don't block functionality for this
    }
    if (!window.matchMedia) {
        console.warn('matchMedia API not available. Cannot detect system color scheme preference reliably.');
    }

    if (errors.length > 0) {
        alert('Spritcher may not work correctly:\n- ' + errors.join('\n- '));
        return false;
    }
    return true;
}

// Initialize the application once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (checkCompatibility()) {
        initUI(); // Call the main initialization function
    } else {
        // Try to use the container if it exists, otherwise fallback to body
        const container = document.querySelector('.app-container') || document.body;
        container.innerHTML = '<p style="color: red; font-weight: bold; padding: 20px;">Sorry, your browser does not support the required features (like File API or Canvas) for Spritcher to run.</p>';
        // Hide theme toggle if it exists
        const themeToggle = document.getElementById('theme-toggle-button');
        if (themeToggle) themeToggle.style.display = 'none';
    }
});