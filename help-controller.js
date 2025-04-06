import { elements } from 'dom-elements';

export function initHelpController() {
    if (!elements.helpButton || !elements.helpDialog || !elements.helpCloseButton) {
        console.warn("Help modal elements not found, cannot initialize help controller.");
        return;
    }

    elements.helpButton.addEventListener('click', openHelpModal);
    elements.helpCloseButton.addEventListener('click', closeHelpModal);

    // Optional: Close modal if clicked outside (on the backdrop)
    elements.helpDialog.addEventListener('click', (event) => {
        // Check if the click target is the dialog itself (the backdrop)
        if (event.target === elements.helpDialog) {
            closeHelpModal();
        }
    });

    // Optional: Close modal with Escape key (native dialog behavior, but can be explicit)
    // Note: The <dialog> element often handles 'Escape' natively.
    // This listener can be added for robustness or if native behavior is suppressed.
    elements.helpDialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeHelpModal();
        }
    });

    console.log("Help Controller Initialized.");
}

function openHelpModal() {
    if (elements.helpDialog && typeof elements.helpDialog.showModal === 'function') {
        elements.helpDialog.showModal();
        // Scroll to top when opened
        elements.helpDialog.scrollTop = 0;
        console.log("Help modal opened.");
    } else {
        console.error("Help dialog element not found or showModal() not supported.");
    }
}

function closeHelpModal() {
    if (elements.helpDialog && typeof elements.helpDialog.close === 'function') {
        elements.helpDialog.close();
        console.log("Help modal closed.");
    }
}