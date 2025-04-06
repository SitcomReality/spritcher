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
     // Check for transferable ArrayBuffer support for ImageData (more robust check)
     try {
        const ab = new ArrayBuffer(1);
        new MessageChannel().port1.postMessage(ab, [ab]);
        if (ab.byteLength !== 0) {
             throw new Error("Transferable ArrayBuffer check failed byteLength");
        }
        // Also check if ImageData itself can be transferred (less common support)
        // const id = new ImageData(1,1);
        // new MessageChannel().port1.postMessage(id, [id]); // This might throw if not supported
     } catch(e) {
         console.warn('Transferable ArrayBuffer or MessageChannel might not be fully supported. Performance may be impacted.', e);
     }


    if (errors.length > 0) {
        alert('Spritcher may not work correctly:\n- ' + errors.join('\n- '));
        return false;
    }
    return true;
}


document.addEventListener('DOMContentLoaded', () => {
    if (checkCompatibility()) {
        initUI();
    } else {
         document.body.innerHTML = '<p style="color: red; font-weight: bold;">Sorry, your browser does not support the required features for Spritcher to run.</p>';
    }
});