import { initUI } from 'ui-controller';

// Basic check for browser compatibility
function checkCompatibility() {
    const errors = [];
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        errors.push('File APIs are not fully supported in this browser.');
    }
    if (!document.createElement('canvas').getContext) {
        errors.push('Canvas API is not supported in this browser.');
    }
    if (!window.Worker) {
        // Not critical for initial version, but good to know
        console.warn('Web Workers are not supported in this browser. Performance may be impacted for large images.');
    }
    // Check for Transferable support more robustly if needed later
    // if (typeof new ImageData(1,1).data.buffer === 'undefined') {
    //     console.warn('Transferable ImageData buffer might not be supported. Performance may be impacted.');
    // }

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
        document.body.innerHTML = '<p style="color: red; font-weight: bold;">Sorry, your browser does not support the required features for Spritcher to run.</p>';
    }
});