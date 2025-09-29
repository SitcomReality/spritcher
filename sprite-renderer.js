import { elements } from 'dom-elements';
import { appState } from 'state';

// Cache for temporary source canvases used for previews
export const previewSourceCanvasCache = new Map();

/**
 * Creates a single sprite preview item DOM element.
 * Uses a temporary canvas created from the provided sourceImageData.
 */
export function createPreviewItemElement(spriteData, sourceImageData, labelId) {
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

        // Use a temporary source canvas for drawing
        let tempSourceCanvas = previewSourceCanvasCache.get(sourceImageId);
        if (!tempSourceCanvas) {
            tempSourceCanvas = document.createElement('canvas');
            tempSourceCanvas.width = sourceImageData.width;
            tempSourceCanvas.height = sourceImageData.height;
            tempSourceCanvas.getContext('2d', { willReadFrequently: true }).putImageData(sourceImageData, 0, 0);
            previewSourceCanvasCache.set(sourceImageId, tempSourceCanvas);
        }

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
 * Renders sprites from appState.extractedSprites into the 'Available' panel.
 * These sprites are always from the currently loaded image.
 */
export function displayAvailableSprites() {
    const container = elements.availableSpritesDisplayContainer;
    container.innerHTML = ''; // Clear previous content

    if (!appState.originalImageInfo || appState.extractedSprites.length === 0) {
        container.innerHTML = "<p>No sprites detected in the current image.</p>";
        return;
    }

    // Use the main image preview canvas as the source for available sprites
    const sourceImageData = appState.originalImageData;

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
            itemDiv.title = "Already selected";
        } else {
            itemDiv.title = "Click to add to selection";
        }

        fragment.appendChild(itemDiv);
    });

    container.appendChild(fragment);
}

/**
 * Renders sprites from appState.selectedSpritesForSheet into the 'Selected' panel.
 * These sprites can be from multiple source images.
 */
export function displaySelectedSprites() {
    const container = elements.selectedSpritesDisplayContainer;
    container.innerHTML = ''; // Clear previous content

    if (appState.selectedSpritesForSheet.length === 0) {
        container.innerHTML = "<p>Add sprites from the 'Available' panel.</p>";
        return;
    }

    const fragment = document.createDocumentFragment();

    appState.selectedSpritesForSheet.forEach((spriteData, index) => {
        // Pass the specific sourceImageData stored with the selected sprite
        const itemDiv = createPreviewItemElement(spriteData, spriteData.sourceImageData, spriteData.blob.id);
        itemDiv.dataset.spriteId = spriteData.uniqueId; // Store unique ID for click handling
        itemDiv.title = `Click to remove (from ${spriteData.sourceImageId.split('-')[0]})`; // Tooltip indication source

        // Make selected sprites draggable
        itemDiv.draggable = true;

        // Add index label based on its *current* order in the selection
        const orderLabel = itemDiv.querySelector('.sprite-index-label');
        if(orderLabel) {
            // Show sheet order and original ID/index for clarity
             orderLabel.innerHTML = `Order: ${index + 1}<br><small>(Src ID: ${spriteData.blob.id ?? 'N/A'})</small>`;
        }

        fragment.appendChild(itemDiv);
    });

    container.appendChild(fragment);
}