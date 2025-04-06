import { elements } from 'dom-elements';
import { appState, addSpriteToSelection, removeSpriteFromSelection, clearSelectedSprites, addAllAvailableSpritesToSelection } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';

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
    displayAvailableSprites();
    displaySelectedSprites();
    updateSelectionCounts(); // Update counts after rendering both
    updateButtonStates(); // Update button enable/disable states
}

/**
 * Renders sprites from appState.extractedSprites into the 'Available' panel.
 */
function displayAvailableSprites() {
    const container = elements.availableSpritesDisplayContainer;
    container.innerHTML = ''; // Clear previous content

    if (!appState.originalImageInfo || appState.extractedSprites.length === 0) {
        container.innerHTML = "<p>No sprites detected or image not loaded.</p>";
        return;
    }

    const sourceCanvas = elements.imagePreviewCanvas;
    const fragment = document.createDocumentFragment();
    const selectedIds = new Set(appState.selectedSpritesForSheet.map(s => s.uniqueId)); // Cache selected IDs

    appState.extractedSprites.forEach((spriteData, index) => {
        const itemDiv = createPreviewItemElement(spriteData, sourceCanvas, index);
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
 */
function displaySelectedSprites() {
    const container = elements.selectedSpritesDisplayContainer;
    container.innerHTML = ''; // Clear previous content

    if (appState.selectedSpritesForSheet.length === 0) {
        container.innerHTML = "<p>Add sprites from the 'Available' panel.</p>";
        return;
    }

    const sourceCanvas = elements.imagePreviewCanvas; // Needed if we redraw from original
    const fragment = document.createDocumentFragment();

    appState.selectedSpritesForSheet.forEach((spriteData, index) => {
        // Note: 'index' here is the index within the selectedSpritesForSheet array (order matters)
        // spriteData.originalBlobIndex refers to its original position in detectedBlobs
        const itemDiv = createPreviewItemElement(spriteData, sourceCanvas, spriteData.originalBlobIndex);
        itemDiv.dataset.spriteId = spriteData.uniqueId; // Store unique ID for click handling
        itemDiv.title = "Click to remove from selection"; // Tooltip for selected items

        // Add index label based on its *current* order in the selection
        const orderLabel = itemDiv.querySelector('.sprite-index-label');
        if(orderLabel) {
            orderLabel.textContent = `Sheet Order: ${index + 1}`;
        }

        fragment.appendChild(itemDiv);
    });

    container.appendChild(fragment);
}

/**
 * Helper function to create a single sprite preview item DOM element.
 * @param {object} spriteData - The sprite data object { blob, uniqueId, originalBlobIndex }.
 * @param {HTMLCanvasElement} sourceCanvas - The canvas containing the original image.
 * @param {number} labelIndex - The index to display on the label (usually originalBlobIndex for available, order index for selected).
 * @returns {HTMLDivElement} The created preview item div.
 */
function createPreviewItemElement(spriteData, sourceCanvas, labelIndex) {
    const { blob } = spriteData;
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
        // Use Math.round for source coordinates as well to avoid subpixel issues
        const sourceX = Math.max(0, Math.round(bounds.minX));
        const sourceY = Math.max(0, Math.round(bounds.minY));
        // Calculate source width/height based on rounded bounds, clamped to source canvas
        const sourceWidth = Math.min(canvasWidth, sourceCanvas.width - sourceX);
        const sourceHeight = Math.min(canvasHeight, sourceCanvas.height - sourceY);

        if (sourceWidth > 0 && sourceHeight > 0) {
            // Draw image from source canvas
            ctx.drawImage(
                sourceCanvas,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, sourceWidth, sourceHeight // Draw at actual size onto preview canvas
            );
        } else {
            console.warn(`Skipping draw for sprite ${spriteData.uniqueId} due to zero dimensions after clamp/round.`);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; // Indicate error visually
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

    } catch (e) {
        console.error(`Error drawing preview for sprite ${spriteData.uniqueId}:`, e);
        ctx.fillStyle = 'red'; // Error indicator
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = 'white';
        ctx.font = '10px sans-serif';
        ctx.fillText('ERR', 2, 10);
    }

    const indexLabel = document.createElement('span');
    indexLabel.className = 'sprite-index-label';
    // Use originalBlobIndex for initial label, might be overridden later for selected sprites
    indexLabel.textContent = `ID: ${spriteData.originalBlobIndex}`;

    itemDiv.appendChild(previewCanvas);
    itemDiv.appendChild(indexLabel);

    return itemDiv;
}

/**
 * Clears both the available and selected sprite display areas.
 */
export function clearExtractedSpritesDisplay() {
    if (elements.availableSpritesDisplayContainer) {
        elements.availableSpritesDisplayContainer.innerHTML = '<p>Click \'Detect Sprites\' to see individual sprites here.</p>';
    }
    if (elements.selectedSpritesDisplayContainer) {
        elements.selectedSpritesDisplayContainer.innerHTML = '<p>Add sprites from the \'Available\' panel.</p>';
    }
    updateSelectionCounts(); // Reset counts
    updateButtonStates(); // Reset buttons
}

/**
 * Handles clicks within the 'Available Sprites' container.
 */
function handleAvailableSpriteClick(event) {
    const itemDiv = event.target.closest('.sprite-preview-item');
    if (!itemDiv || itemDiv.classList.contains('already-selected')) return; // Ignore clicks on already selected items

    const spriteId = itemDiv.dataset.spriteId;
    if (!spriteId) return;

    const added = addSpriteToSelection(spriteId);

    if (added) {
        // Re-render both displays to update states (e.g., 'already-selected' class)
        displayAvailableSprites();
        displaySelectedSprites();
        updateSelectionCounts();
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
        displayAvailableSprites();
        displaySelectedSprites();
        updateSelectionCounts();
        updateButtonStates();
        clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
    }
}

/**
 * Handles the "Add All" button click.
 */
function handleAddAllAvailable() {
    addAllAvailableSpritesToSelection();
    // Re-render both displays
    displayAvailableSprites();
    displaySelectedSprites();
    updateSelectionCounts();
    updateButtonStates();
    clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
}

/**
 * Handles the "Remove All" button click.
 */
function handleRemoveAllSelected() {
    clearSelectedSprites();
    // Re-render both displays
    displayAvailableSprites();
    displaySelectedSprites();
    updateSelectionCounts();
    updateButtonStates();
    clearGeneratedSpritesheet(); // Selection changed, invalidate sheet
}

/**
 * Updates the sprite count displays.
 */
function updateSelectionCounts() {
    if (elements.availableSpritesCountSpan) {
        elements.availableSpritesCountSpan.textContent = `${appState.extractedSprites.length} sprites available.`;
    }
    if (elements.selectedSpritesCountSpan) {
        elements.selectedSpritesCountSpan.textContent = `${appState.selectedSpritesForSheet.length} sprites selected.`;
    }
}

/**
 * Updates the enabled/disabled state of buttons in the section.
 */
function updateButtonStates() {
    const availableCount = appState.extractedSprites.length;
    const selectedCount = appState.selectedSpritesForSheet.length;
    const allAvailableAreSelected = availableCount > 0 && appState.extractedSprites.every(avail =>
        appState.selectedSpritesForSheet.some(sel => sel.uniqueId === avail.uniqueId)
    );

    if (elements.addAllAvailableButton) {
        elements.addAllAvailableButton.disabled = (availableCount === 0 || allAvailableAreSelected);
    }
    if (elements.removeAllSelectedButton) {
        elements.removeAllSelectedButton.disabled = (selectedCount === 0);
    }

    // Update spritesheet generation button state based on *selected* sprites
    if(elements.generateSpritesheetButton) {
        elements.generateSpritesheetButton.disabled = (selectedCount === 0 || !appState.originalImageData);
    }
    // Also update layout controls based on selection
    if (elements.gridColsInput) elements.gridColsInput.disabled = (selectedCount === 0);
    if (elements.paddingInput) elements.paddingInput.disabled = (selectedCount === 0);
    if (elements.alignmentSelect) elements.alignmentSelect.disabled = (selectedCount === 0);
}