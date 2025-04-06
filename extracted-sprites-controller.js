import { elements } from 'dom-elements';
import { appState, addSpriteToSelection, removeSpriteFromSelection, clearSelectedSprites, addAllAvailableSpritesToSelection } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { calculateRecommendedLayout } from 'spritesheet-generator';

// Cache for temporary source canvases used for previews
const previewSourceCanvasCache = new Map();

export function initExtractedSpritesController() {
    elements.availableSpritesDisplayContainer.addEventListener('click', handleAvailableSpriteClick);
    elements.selectedSpritesDisplayContainer.addEventListener('click', handleSelectedSpriteClick);

    elements.addAllAvailableButton.addEventListener('click', handleAddAllAvailable);
    elements.removeAllSelectedButton.addEventListener('click', handleRemoveAllSelected);
}

/**
 * Renders both the 'Available' and 'Selected' sprite panels.
 */
export function displayExtractedSprites() {
    // Clear cache when re-rendering previews
    previewSourceCanvasCache.clear();
    displayAvailableSprites();
    displaySelectedSprites();
    updateSelectionCounts(); // Update counts after rendering both
    updateSpriteStats(); // Update stats display
    updateButtonStates(); // Update button enable/disable states
}

/**
 * Renders sprites from appState.extractedSprites into the 'Available' panel.
 * These sprites are always from the currently loaded image.
 */
function displayAvailableSprites() {
    const container = elements.availableSpritesDisplayContainer;
    container.innerHTML = ''; // Clear previous content

    if (!appState.originalImageInfo || appState.extractedSprites.length === 0) {
        container.innerHTML = "<p>No sprites detected in the current image.</p>";
        updateSelectionCounts(); // Ensure count is updated even if empty
        updateButtonStates();
        return;
    }

    // Use the main image preview canvas as the source for available sprites
    const sourceImageData = appState.originalImageData; // Get current image data

    if (!sourceImageData) {
        console.error("Cannot display available sprites: Missing original image data in state.");
        container.innerHTML = "<p>Error: Missing source image data.</p>";
        return;
    }

    const fragment = document.createDocumentFragment();
    const selectedIds = new Set(appState.selectedSpritesForSheet.map(s => s.uniqueId)); // Cache selected IDs

    appState.extractedSprites.forEach((spriteData, index) => {
        // Pass the current image's ImageData as the source
        const itemDiv = createPreviewItemElement(spriteData, sourceImageData, index);
        itemDiv.dataset.spriteId = spriteData.uniqueId; // Store unique ID for click handling

        // Add class if this sprite is already in the selected list
        if (selectedIds.has(spriteData.uniqueId)) {
            itemDiv.classList.add('already-selected');
            itemDiv.title = "Already selected"; // Add tooltip
        } else {
            itemDiv.title = "Click to add to selection"; // Tooltip for available items
        }

        fragment.appendChild(itemDiv);
    });

    container.appendChild(fragment);
}

/**
 * Renders sprites from appState.selectedSpritesForSheet into the 'Selected' panel.
 * These sprites can be from multiple source images.
 */
function displaySelectedSprites() {
    const container = elements.selectedSpritesDisplayContainer;
    container.innerHTML = ''; // Clear previous content

    if (appState.selectedSpritesForSheet.length === 0) {
        container.innerHTML = "<p>Add sprites from the 'Available' panel.</p>";
        updateSelectionCounts(); // Ensure count is updated even if empty
        updateButtonStates();
        return;
    }

    const fragment = document.createDocumentFragment();

    appState.selectedSpritesForSheet.forEach((spriteData, index) => {
        // Pass the specific sourceImageData stored with the selected sprite
        const itemDiv = createPreviewItemElement(spriteData, spriteData.sourceImageData, spriteData.blob.id); // Use blob ID or original index if needed
        itemDiv.dataset.spriteId = spriteData.uniqueId; // Store unique ID for click handling
        itemDiv.title = `Click to remove (from ${spriteData.sourceImageId.split('-')[0]})`; // Tooltip indication source

        // Add index label based on its *current* order in the selection
        const orderLabel = itemDiv.querySelector('.sprite-index-label');
        if(orderLabel) {
            // Show sheet order and original ID/index for clarity
             orderLabel.innerHTML = `Order: ${index + 1}<br><small>(Src ID: ${spriteData.blob.id ?? 'N/A'})</small>`;
        }


        fragment.appendChild(itemDiv);
    });

    container.appendChild(fragment);
    updateSpriteStats(); // Update stats after rendering
}

/**
 * Helper function to create a single sprite preview item DOM element.
 * Uses a temporary canvas created from the provided sourceImageData.
 * @param {object} spriteData - The sprite data object { blob, uniqueId, originalBlobIndex, sourceImageId }.
 * @param {ImageData} sourceImageData - The ImageData of the source image for this sprite.
 * @param {number | string} labelId - The ID or index to display on the label.
 * @returns {HTMLDivElement} The created preview item div.
 */
function createPreviewItemElement(spriteData, sourceImageData, labelId) {
    const { blob, sourceImageId } = spriteData;

    // Basic check for valid blob data
    if (!blob?.bounds || typeof blob.bounds.width !== 'number' || typeof blob.bounds.height !== 'number') {
        console.warn(`Cannot create preview for ${spriteData.uniqueId}: Missing/invalid bounds.`);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'sprite-preview-item error';
        errorDiv.textContent = 'Error';
        errorDiv.title = `Invalid data for sprite ID ${spriteData.uniqueId}`;
        return errorDiv;
    }
    const bounds = blob.bounds;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'sprite-preview-item';

    const previewCanvas = document.createElement('canvas');
    const ctx = previewCanvas.getContext('2d');

    // Ensure width/height are at least 1
    const canvasWidth = Math.max(1, Math.round(bounds.width));
    const canvasHeight = Math.max(1, Math.round(bounds.height));
    previewCanvas.width = canvasWidth;
    previewCanvas.height = canvasHeight;

    try {
        if (!sourceImageData) throw new Error("Missing sourceImageData");

        // --- Use a temporary source canvas for drawing ---
        let tempSourceCanvas = previewSourceCanvasCache.get(sourceImageId);
        if (!tempSourceCanvas) {
            tempSourceCanvas = document.createElement('canvas');
            tempSourceCanvas.width = sourceImageData.width;
            tempSourceCanvas.height = sourceImageData.height;
            tempSourceCanvas.getContext('2d', { willReadFrequently: true }).putImageData(sourceImageData, 0, 0);
            previewSourceCanvasCache.set(sourceImageId, tempSourceCanvas);
            // console.log(`Created preview source canvas for ${sourceImageId}`);
        }
        // ---

        // Use Math.round for source coordinates as well to avoid subpixel issues
        const sourceX = Math.max(0, Math.round(bounds.minX));
        const sourceY = Math.max(0, Math.round(bounds.minY));
        // Calculate source width/height based on rounded bounds, clamped to source canvas
        const sourceWidth = Math.min(canvasWidth, tempSourceCanvas.width - sourceX);
        const sourceHeight = Math.min(canvasHeight, tempSourceCanvas.height - sourceY);

        if (sourceWidth > 0 && sourceHeight > 0) {
            // Draw image from the TEMPORARY source canvas
            ctx.drawImage(
                tempSourceCanvas,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, sourceWidth, sourceHeight // Draw at actual size onto preview canvas
            );
        } else {
            console.warn(`Skipping draw for sprite ${spriteData.uniqueId} due to zero dimensions after clamp/round.`);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; // Indicate error visually
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

    } catch (e) {
        console.error(`Error drawing preview for sprite ${spriteData.uniqueId} from source ${sourceImageId}:`, e);
        ctx.fillStyle = 'red'; // Error indicator
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = 'white';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ERR', canvasWidth / 2, canvasHeight / 2);
    }

    const indexLabel = document.createElement('span');
    indexLabel.className = 'sprite-index-label';
    // Use provided labelId (can be original index, blob ID, or selection order)
    indexLabel.textContent = `ID: ${labelId}`;

    itemDiv.appendChild(previewCanvas);
    itemDiv.appendChild(indexLabel);

    return itemDiv;
}

/**
 * Clears both the available and selected sprite display areas.
 */
export function clearExtractedSpritesDisplay() {
     previewSourceCanvasCache.clear(); // Clear preview cache
    if (elements.availableSpritesDisplayContainer) {
        elements.availableSpritesDisplayContainer.innerHTML = '<p>Click \'Detect Sprites\' after loading an image.</p>';
    }
    if (elements.selectedSpritesDisplayContainer) {
        // Only clear if there are truly no selected sprites overall
        if (appState.selectedSpritesForSheet.length === 0) {
            elements.selectedSpritesDisplayContainer.innerHTML = '<p>Add sprites from the \'Available\' panel.</p>';
        } else {
             // If sprites ARE selected, re-render them instead of showing placeholder
             displaySelectedSprites();
        }
    }
    updateSelectionCounts(); // Reset counts based on state
    updateSpriteStats(); // Update stats (will show default message)
    updateButtonStates(); // Reset buttons based on state
}

/**
 * Handles clicks within the 'Available Sprites' container.
 */
function handleAvailableSpriteClick(event) {
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
        updateSpriteStats(); // Update stats
        updateButtonStates();
        clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
    }
}

/**
 * Handles clicks within the 'Selected Sprites' container.
 */
function handleSelectedSpriteClick(event) {
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
        updateSpriteStats(); // Update stats
        updateButtonStates();
        clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
    }
}

/**
 * Handles the "Add All" button click.
 */
function handleAddAllAvailable() {
    addAllAvailableSpritesToSelection(); // Adds only from current image's available list
    // Re-render both displays
    displayAvailableSprites();
    displaySelectedSprites();
    updateSelectionCounts();
    updateSpriteStats(); // Update stats
    updateButtonStates();
    clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
}

/**
 * Handles the "Remove All" button click.
 */
function handleRemoveAllSelected() {
    clearSelectedSprites(); // Clears the entire selected list
    // Re-render both displays
    displayAvailableSprites(); // Update 'already-selected' status
    displaySelectedSprites(); // Show empty placeholder
    updateSelectionCounts();
    updateSpriteStats(); // Update stats
    updateButtonStates();
    clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
}

/**
 * Updates the sprite count displays.
 */
function updateSelectionCounts() {
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