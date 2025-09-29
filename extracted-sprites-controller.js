import { elements } from 'dom-elements';
import { appState, addSpriteToSelection, removeSpriteFromSelection, clearSelectedSprites, addAllAvailableSpritesToSelection, reorderSelectedSprites } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-generator';
import { createPreviewItemElement, displayAvailableSprites, displaySelectedSprites } from './sprite-renderer.js';
import { handleAvailableSpriteClick, handleSelectedSpriteClick, handleAddAllAvailable, handleRemoveAllSelected } from './sprite-selection.js';
import { initDragAndDrop } from './sprite-drag-drop.js';
import { updateSpriteStats, updateSelectionCounts, updateButtonStates } from './sprite-stats.js';

export function initExtractedSpritesController() {
    elements.availableSpritesDisplayContainer.addEventListener('click', handleAvailableSpriteClick);
    elements.selectedSpritesDisplayContainer.addEventListener('click', handleSelectedSpriteClick);

    elements.addAllAvailableButton.addEventListener('click', handleAddAllAvailable);
    elements.removeAllSelectedButton.addEventListener('click', handleRemoveAllSelected);

    // Initialize drag and drop
    initDragAndDrop();
}

/**
 * Renders both the 'Available' and 'Selected' sprite panels.
 */
export function displayExtractedSprites() {
    displayAvailableSprites();
    displaySelectedSprites();
    updateSelectionCounts();
    updateSpriteStats();
    updateButtonStates();
}

/**
 * Clears both the available and selected sprite display areas.
 */
export function clearExtractedSpritesDisplay() {
    // Clear cache when re-rendering previews
    const { previewSourceCanvasCache } = require('./sprite-renderer.js');
    previewSourceCanvasCache.clear();
    
    if (elements.availableSpritesDisplayContainer) {
        elements.availableSpritesDisplayContainer.innerHTML = '<p>Click \'Detect Sprites\' after loading an image.</p>';
    }
    if (elements.selectedSpritesDisplayContainer) {
        if (appState.selectedSpritesForSheet.length === 0) {
            elements.selectedSpritesDisplayContainer.innerHTML = '<p>Add sprites from the \'Available\' panel.</p>';
        } else {
            displaySelectedSprites();
        }
    }
    updateSelectionCounts();
    updateSpriteStats();
    updateButtonStates();
}