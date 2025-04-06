import { elements } from 'dom-elements';
import { appState, deleteBlobByIndex } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { updateDebugOverlays } from 'debug-controller';
import { updateEditModeUI } from 'mode-controller';
import { displayExtractedSprites } from 'extracted-sprites-controller'; // Keep this to update both lists

export function initDeleteController() {
    elements.deleteSelectedButton.addEventListener('click', handleDeleteSelected);
}

function handleDeleteSelected() {
    const selectedIndex = appState.editing.selectedBlobIndex; // Index in detectedBlobs

    if (selectedIndex !== null) {
        const originalDetectedCount = appState.detectedBlobs.length;
        // deleteBlobByIndex now handles removing from detected, extracted, AND selected state arrays
        const success = deleteBlobByIndex(selectedIndex);

        if (success) {
            const currentDetectedCount = appState.detectedBlobs.length;
            console.log(`Blob ${selectedIndex} (original detected index) deleted.`);
            clearGeneratedSpritesheet(); // Invalidate generated sheet

            elements.processingStatusDiv.textContent = `Sprite deleted (${currentDetectedCount} remaining). Regeneration needed if it was selected.`;

            updateDebugOverlays(); // Remove box from main view
            displayExtractedSprites(); // Update both available and selected lists
            updateEditModeUI(); // Update button states (e.g., delete button disable)

        } else {
            console.error(`Failed to delete blob at index ${selectedIndex}. State inconsistency?`);
        }
    } else {
        console.warn("Delete button clicked but no blob selected.");
    }
}