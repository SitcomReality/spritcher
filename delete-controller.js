import { elements } from 'dom-elements';
import { appState, deleteBlobByIndex } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { updateDebugOverlays } from 'debug-controller';
import { updateEditModeUI } from 'mode-controller';
import { displayExtractedSprites } from 'extracted-sprites-controller';

export function initDeleteController() {
    elements.deleteSelectedButton.addEventListener('click', handleDeleteSelected);
}

function handleDeleteSelected() {
    const selectedIndex = appState.editing.selectedBlobIndex;

    if (selectedIndex !== null) {
        const originalDetectedCount = appState.detectedBlobs.length;
        const success = deleteBlobByIndex(selectedIndex);

        if (success) {
            const currentDetectedCount = appState.detectedBlobs.length;
            console.log(`Blob ${selectedIndex} (original detected index) deleted.`);
            clearGeneratedSpritesheet();

            elements.processingStatusDiv.textContent = `Sprite deleted (${currentDetectedCount} remaining). Regeneration needed.`;

            updateDebugOverlays();
            displayExtractedSprites();
            updateEditModeUI();

        } else {
            console.error(`Failed to delete blob at index ${selectedIndex}. State inconsistency?`);
        }
    } else {
        console.warn("Delete button clicked but no blob selected.");
    }
}