import { elements } from 'dom-elements';

let helpContentLoaded = false; // Flag to check if content is already loaded

export function initHelpController() {
    if (!elements.helpButton || !elements.helpDialog || !elements.helpCloseButton) {
        console.warn("Help modal elements not found, cannot initialize help controller.");
        return;
    }

    elements.helpButton.addEventListener('click', openHelpModal);
    elements.helpCloseButton.addEventListener('click', closeHelpModal);

    // Optional: Close modal if clicked outside (on the backdrop)
    elements.helpDialog.addEventListener('click', (event) => {
        if (event.target === elements.helpDialog) {
            closeHelpModal();
        }
    });

    // Optional: Close modal with Escape key
    elements.helpDialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeHelpModal();
        }
    });

    console.log("Help Controller Initialized.");
}

async function loadHelpContent() {
    const container = document.getElementById('help-content-container');
    if (!container) {
         console.error("Help content container not found.");
         return false;
    }

    if (helpContentLoaded) {
        console.log("Help content already loaded.");
        return true; // Already loaded
    }

    container.innerHTML = '<p>Loading help content...</p>'; // Show loading message

    try {
        const response = await fetch('./help-content.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const contentHtml = await response.text();
        container.innerHTML = contentHtml;
        helpContentLoaded = true;
        console.log("Help content loaded successfully.");
        return true;
    } catch (error) {
        console.error("Failed to load help content:", error);
        container.innerHTML = '<p class="error-message">Sorry, could not load the help content. Please try reloading the page.</p>';
        return false;
    }
}


async function openHelpModal() {
    if (elements.helpDialog && typeof elements.helpDialog.showModal === 'function') {
        // Load content before showing the modal
        const loaded = await loadHelpContent();
        if (loaded) {
            elements.helpDialog.showModal();
            // Scroll to top when opened
            elements.helpDialog.scrollTop = 0;
            console.log("Help modal opened.");
        } else {
             // If loading failed, still show the dialog with the error message
            elements.helpDialog.showModal();
            elements.helpDialog.scrollTop = 0;
            console.log("Help modal opened (content loading failed).");
        }
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