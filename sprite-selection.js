import { elements } from 'dom-elements';
import { appState, addSpriteToSelection, removeSpriteFromSelection, clearSelectedSprites, addAllAvailableSpritesToSelection } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-generator';
import { displayExtractedSprites, updateSelectionCounts, updateSpriteStats, updateButtonStates } from './sprite-stats.js';
import { displayAvailableSprites, displaySelectedSprites } from './sprite-renderer.js';

/**
 * Handles clicks within the 'Available Sprites' container.
 */
export function handleAvailableSpriteClick(event) {
    const itemDiv = event.target.closest('.sprite-preview-item');
    if (!itemDiv || itemDiv.classList.contains('already-selected')) return; // Ignore clicks on already selected items

    const spriteId = itemDiv.dataset.spriteId;
    if (!spriteId) return;

    const added = addSpriteToSelection(spriteId); // Adds sprite with current source image data

    if (added) {
        // Re-render both displays to update states (e.g., 'already-selected' class)
        displayAvailableSprites();
        displaySelectedSprites();
        updateSelectionCounts();
        updateSpriteStats();
        updateButtonStates();
        clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
    }
}

/**
 * Handles clicks within the 'Selected Sprites' container.
 */
export function handleSelectedSpriteClick(event) {
    const itemDiv = event.target.closest('.sprite-preview-item');
    if (!itemDiv) return;

    const spriteId = itemDiv.dataset.spriteId;
    if (!spriteId) return;

    const removed = removeSpriteFromSelection(spriteId);

    if (removed) {
        // Re-render both displays
        displayAvailableSprites(); // Update 'already-selected' status
        displaySelectedSprites(); // Remove the item
        updateSelectionCounts();
        updateSpriteStats();
        updateButtonStates();
        clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
    }
}

/**
 * Handles the "Add All" button click.
 */
export function handleAddAllAvailable() {
    addAllAvailableSpritesToSelection(); // Adds only from current image's available list
    // Re-render both displays
    displayAvailableSprites();
    displaySelectedSprites();
    updateSelectionCounts();
    updateSpriteStats();
    updateButtonStates();
    clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
}

/**
 * Handles the "Remove All" button click.
 */
export function handleRemoveAllSelected() {
    clearSelectedSprites(); // Clears the entire selected list
    // Re-render both displays
    displayAvailableSprites(); // Update 'already-selected' status
    displaySelectedSprites(); // Show empty placeholder
    updateSelectionCounts();
    updateSpriteStats();
    updateButtonStates();
    clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
}