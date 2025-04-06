import { elements } from 'dom-elements';
import { appState, deleteBlobByIndex } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { invalidateProcessing } from 'processing-controller';
import { updateDebugOverlays } from 'debug-controller';
import { updateEditModeUI } from 'mode-controller';

export function initDeleteController() {
    elements.deleteSelectedButton.addEventListener('click', handleDeleteSelected);
}

function handleDeleteSelected() {
    const selectedIndex = appState.editing.selectedBlobIndex;

    if (selectedIndex !== null) {
        const success = deleteBlobByIndex(selectedIndex); // Delete from state

        if (success) {
            console.log(`Blob ${selectedIndex} deleted.`);
            clearGeneratedSpritesheet(); // Invalidate generated sheet
            invalidateProcessing(true); // Re-process blobs (optional, could just update UI)
            elements.processingStatusDiv.textContent = `Sprite ${selectedIndex} deleted. Regeneration needed.`;

            updateDebugOverlays(); // Redraw overlays without the deleted box
            updateEditModeUI(); // Update button states (delete/edit should be disabled)
            // Status update will happen via mode-controller's update flow triggered by selection change

        } else {
            // This case should ideally not happen if the selectedIndex is valid
            console.error(`Failed to delete blob at index ${selectedIndex}. State inconsistency?`);
        }
    } else {
        console.warn("Delete button clicked but no blob selected.");
        // Optionally provide user feedback like a brief message or button shake
    }
}