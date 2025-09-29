import { elements } from 'dom-elements';
import { appState } from 'state';
import { calculateRecommendedLayout } from 'spritesheet-generator';
import { displayAvailableSprites, displaySelectedSprites } from './sprite-renderer.js';

/**
 * Updates the sprite count displays.
 */
export function updateSelectionCounts() {
    if (elements.availableSpritesCountSpan) {
        elements.availableSpritesCountSpan.textContent = `${appState.extractedSprites.length} available (current image).`;
    }
    if (elements.selectedSpritesCountSpan) {
        elements.selectedSpritesCountSpan.textContent = `${appState.selectedSpritesForSheet.length} sprites selected (total).`;
    }
}

/**
 * Calculates and displays sprite statistics in the selected sprites panel.
 */
export function updateSpriteStats() {
    const statsContainer = elements.selectedSpritesStatsDiv;
    if (!statsContainer) return;

    const selectedSprites = appState.selectedSpritesForSheet;

    if (selectedSprites.length === 0) {
        statsContainer.innerHTML = '<p>Select sprites to see size information.</p>';
        return;
    }

    let totalW = 0;
    let totalH = 0;

    // Calculate recommended layout based on current selection and padding
    const padding = parseInt(elements.paddingInput?.value || "0", 10);
    const layout = calculateRecommendedLayout(selectedSprites, padding);

    if (!layout) {
         statsContainer.innerHTML = '<p>Could not calculate sprite stats.</p>';
         return;
    }

    const largestW = Math.round(layout.maxSpriteWidth);
    const largestH = Math.round(layout.maxSpriteHeight);

    // Calculate average size based on valid sprites used in layout calculation
     selectedSprites.forEach(sprite => {
        if (sprite?.blob?.bounds) {
            const w = sprite.blob.bounds.width;
            const h = sprite.blob.bounds.height;
            if (typeof w === 'number') totalW += w;
            if (typeof h === 'number') totalH += h;
        }
    });
    const avgW = (totalW / selectedSprites.length).toFixed(1);
    const avgH = (totalH / selectedSprites.length).toFixed(1);

    // Get current user-defined cell size (if any)
    const userCellW = parseInt(elements.cellWidthInput?.value, 10) || null;
    const userCellH = parseInt(elements.cellHeightInput?.value, 10) || null;

    const finalCellW = userCellW || layout.recommendedCellWidth;
    const finalCellH = userCellH || layout.recommendedCellHeight;

    statsContainer.innerHTML = `
        <p><strong>Largest Sprite:</strong> ${largestW} x ${largestH} px</p>
        <p><strong>Average Size:</strong> ${avgW} x ${avgH} px</p>
        <p><strong>Rec. Cell Size:</strong> ${layout.recommendedCellWidth} x ${layout.recommendedCellHeight} px <small>(Largest + ${padding}px pad)</small></p>
        <p><strong>Current Cell Size:</strong> ${finalCellW} x ${finalCellH} px ${userCellW ? '<small>(User Defined)</small>' : '<small>(Auto)</small>'}</p>
    `;
}

/**
 * Updates the enabled/disabled state of buttons in the section.
 */
export function updateButtonStates() {
    const availableCount = appState.extractedSprites.length;
    const selectedCount = appState.selectedSpritesForSheet.length;

    // Calculate if all *currently available* sprites are already selected
    const currentAvailableIds = new Set(appState.extractedSprites.map(s => s.uniqueId));
    const selectedIds = new Set(appState.selectedSpritesForSheet.map(s => s.uniqueId));
    const allCurrentAvailableAreSelected = availableCount > 0 && [...currentAvailableIds].every(id => selectedIds.has(id));

    if (elements.addAllAvailableButton) {
        elements.addAllAvailableButton.disabled = (availableCount === 0 || allCurrentAvailableAreSelected);
    }
    if (elements.removeAllSelectedButton) {
        elements.removeAllSelectedButton.disabled = (selectedCount === 0);
    }
    if(elements.useRecommendedSizeButton) {
         elements.useRecommendedSizeButton.disabled = (selectedCount === 0);
    }

    // Update spritesheet generation button state based on *selected* sprites
    if(elements.generateSpritesheetButton) {
        // Enable if sprites are selected, regardless of whether an image is currently loaded
        elements.generateSpritesheetButton.disabled = (selectedCount === 0);
    }
    // Also update layout controls based on selection
    if (elements.gridColsInput) elements.gridColsInput.disabled = (selectedCount === 0);
    if (elements.paddingInput) elements.paddingInput.disabled = (selectedCount === 0);
    if (elements.cellWidthInput) elements.cellWidthInput.disabled = (selectedCount === 0);
    if (elements.cellHeightInput) elements.cellHeightInput.disabled = (selectedCount === 0);
    if (elements.alignHSelect) elements.alignHSelect.disabled = (selectedCount === 0);
    if (elements.alignVSelect) elements.alignVSelect.disabled = (selectedCount === 0);
}