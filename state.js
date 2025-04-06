// --- State Variables ---
export let appState = {
    originalImageInfo: null, // { img, naturalWidth, naturalHeight }
    originalImageData: null,
    grayscaleImageData: null,
    thresholdedImageData: null,
    cclResult: null, // { blobs: Array<Object>, labels: Int32Array }
    detectedBlobs: [], // Holds the current list of blobs (can be modified by editing tools)
    generatedSpritesheetCanvas: null, // Store the generated canvas

    // NEW: Store detected sprites ready for selection/ordering
    extractedSprites: [], // Array of { originalBlobIndex: number, blob: Object }
    // NEW: Indices from extractedSprites array, defining order and inclusion
    selectedSpritesForSheet: [],

    currentThresholdSettings: {
        type: 'manual',
        manualValue: 128,
        adaptiveBlockSize: 11,
        adaptiveC: 2
    },

    // Viewport State
    viewport: {
        currentZoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        startPanX: 0, // Mouse position at pan start
        startPanY: 0, // Mouse position at pan start
        startViewX: 0, // panX at pan start
        startViewY: 0, // panY at pan start
    },


    // Editing State
    editing: {
        currentEditMode: 'pan', // 'pan', 'select', 'edit-bounds', 'add', 'split', 'merge', 'delete'
        selectedBlobIndex: null, // Index in the `detectedBlobs` array
    }
};

// --- State Update Functions ---

export function setOriginalImage(imgInfo, imgData) {
    appState.originalImageInfo = imgInfo;
    appState.originalImageData = imgData;
    // Reset dependent states
    appState.grayscaleImageData = null;
    appState.thresholdedImageData = null;
    appState.cclResult = null;
    appState.detectedBlobs = [];
    appState.extractedSprites = []; // Clear extracted sprites
    appState.selectedSpritesForSheet = []; // Clear selection
    appState.editing.selectedBlobIndex = null;
    appState.generatedSpritesheetCanvas = null;
}

export function setGrayscaleImage(imgData) {
    appState.grayscaleImageData = imgData;
}

export function setThresholdedImage(imgData) {
    appState.thresholdedImageData = imgData;
}

export function setCCLResult(result) {
    appState.cclResult = result;
    // IMPORTANT: Copy blobs so editing doesn't modify the raw CCL result directly
    appState.detectedBlobs = result ? result.blobs.map(b => ({ ...b, bounds: {...b.bounds} })) : [];

    // Reset extracted sprites and selection based on new detection
    appState.extractedSprites = appState.detectedBlobs.map((blob, index) => ({
         originalBlobIndex: index, // Link back to the detectedBlobs array index
         blob: { ...blob, bounds: { ...blob.bounds } } // Store a copy of the blob data
     }));
    // By default, select all detected sprites in their original order
    appState.selectedSpritesForSheet = appState.extractedSprites.map((_, index) => index);

    appState.editing.selectedBlobIndex = null; // Reset editing selection after processing
}

export function clearCCLResult() {
     appState.cclResult = null;
     appState.detectedBlobs = [];
     appState.extractedSprites = []; // Clear extracted sprites
     appState.selectedSpritesForSheet = []; // Clear selection
     appState.editing.selectedBlobIndex = null;
}

export function setGeneratedSpritesheet(canvas) {
    appState.generatedSpritesheetCanvas = canvas;
}

export function clearGeneratedSpritesheetState() {
    appState.generatedSpritesheetCanvas = null;
}

export function setThresholdSettings(settings) {
    appState.currentThresholdSettings = { ...appState.currentThresholdSettings, ...settings };
}

export function setViewport(viewportChanges) {
    appState.viewport = { ...appState.viewport, ...viewportChanges };
}

export function setEditModeState(mode) {
    appState.editing.currentEditMode = mode;
}

export function setSelectedBlobIndex(index) {
    appState.editing.selectedBlobIndex = index;
}

export function resetThresholdSettings() {
     appState.currentThresholdSettings = {
        type: 'manual',
        manualValue: 128,
        adaptiveBlockSize: 11,
        adaptiveC: 2
    };
}

export function resetViewport() {
     appState.viewport = {
        currentZoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        startPanX: 0,
        startPanY: 0,
        startViewX: 0,
        startViewY: 0,
    };
}

export function resetEditingState() {
    appState.editing.currentEditMode = 'pan';
    appState.editing.selectedBlobIndex = null;
}

// NEW: Update the selection/order of sprites for the final sheet
export function updateSelectedSpriteIndices(newIndices) {
    if (Array.isArray(newIndices)) {
        // Ensure indices are valid relative to the current extractedSprites
        appState.selectedSpritesForSheet = newIndices.filter(index => index >= 0 && index < appState.extractedSprites.length);
    } else {
        console.warn("Attempted to update selected sprite indices with non-array value:", newIndices);
    }
}

// Clears results but keeps original image and settings
export function clearProcessingResultsState() {
    console.log("Clearing processing results state...");
    appState.grayscaleImageData = null;
    appState.thresholdedImageData = null;
    appState.cclResult = null;
    appState.detectedBlobs = [];
    appState.extractedSprites = []; // Clear extracted sprites
    appState.selectedSpritesForSheet = []; // Clear selection
    appState.editing.selectedBlobIndex = null;
    appState.generatedSpritesheetCanvas = null;
    // Keep settings, Keep original image
}

// Clears everything
export function clearFullAppState() {
     console.log("Clearing full app state.");
     appState.originalImageInfo = null;
     appState.originalImageData = null;
     appState.grayscaleImageData = null;
     appState.thresholdedImageData = null;
     appState.cclResult = null;
     appState.detectedBlobs = [];
     appState.extractedSprites = []; // Clear extracted sprites
     appState.selectedSpritesForSheet = []; // Clear selection
     appState.generatedSpritesheetCanvas = null;
     resetThresholdSettings();
     resetViewport();
     resetEditingState();
}

/**
 * Deletes a detected blob by its index in the `detectedBlobs` array.
 * Handles index validation and ensures selection is cleared if it matches the deleted index.
 * Also updates `extractedSprites` and `selectedSpritesForSheet` accordingly.
 * @param {number} index - The index of the blob to delete *in detectedBlobs*.
 * @returns {boolean} True if deletion was successful, false otherwise.
 */
export function deleteBlobByIndex(index) {
    if (index === null || index < 0 || index >= appState.detectedBlobs.length) {
        console.warn(`Attempted to delete invalid blob index: ${index}`);
        return false;
    }

    const deletedBlobInfo = appState.detectedBlobs.splice(index, 1); // Remove the blob from detectedBlobs
    console.log(`Deleted blob at detectedBlobs index ${index}:`, deletedBlobInfo[0]);

    // --- Update extractedSprites and selectedSpritesForSheet ---
    // Find the corresponding entry in extractedSprites
    const extractedIndexToDelete = appState.extractedSprites.findIndex(es => es.originalBlobIndex === index);

    if (extractedIndexToDelete !== -1) {
        // Remove from extractedSprites
        appState.extractedSprites.splice(extractedIndexToDelete, 1);

        // Update indices in selectedSpritesForSheet
        const newSelection = [];
        for (const selectedIndex of appState.selectedSpritesForSheet) {
            if (selectedIndex < extractedIndexToDelete) {
                // Indices before the deleted one remain the same
                newSelection.push(selectedIndex);
            } else if (selectedIndex > extractedIndexToDelete) {
                // Indices after the deleted one need to be decremented
                newSelection.push(selectedIndex - 1);
            }
            // If selectedIndex === extractedIndexToDelete, it's simply skipped
        }
        appState.selectedSpritesForSheet = newSelection;
    }

    // Adjust originalBlobIndex for sprites that came after the deleted one in detectedBlobs
    appState.extractedSprites.forEach(es => {
        if (es.originalBlobIndex > index) {
            es.originalBlobIndex--;
        }
    });
    // --- End update ---


    // Clear editing selection if the deleted blob was selected
    if (appState.editing.selectedBlobIndex === index) {
        appState.editing.selectedBlobIndex = null;
    }
    // Adjust editing selection index if a blob *before* the selected one was deleted
    else if (appState.editing.selectedBlobIndex !== null && index < appState.editing.selectedBlobIndex) {
         appState.editing.selectedBlobIndex--;
    }

    return true;
}

/**
 * Updates the bounds of a detected blob by its index.
 * Performs basic validation on the new bounds.
 * Also updates the corresponding blob bounds in `extractedSprites`.
 * @param {number} index - The index of the blob to update *in detectedBlobs*.
 * @param {{ minX: number, minY: number, width: number, height: number }} newBounds - The new bounds.
 * @returns {boolean} True if the update was successful, false otherwise.
 */
export function updateBlobBoundsByIndex(index, newBounds) {
     if (index === null || index < 0 || index >= appState.detectedBlobs.length) {
        console.warn(`Attempted to update bounds for invalid blob index: ${index}`);
        return false;
    }
     if (!newBounds || newBounds.width <= 0 || newBounds.height <= 0 ||
         newBounds.minX === undefined || newBounds.minY === undefined) {
         console.warn(`Attempted to update blob ${index} with invalid bounds:`, newBounds);
         return false;
     }

     // Update the specific blob's bounds object in detectedBlobs
     const blobToUpdate = appState.detectedBlobs[index];
     blobToUpdate.bounds.minX = Math.round(newBounds.minX); // Store as integers
     blobToUpdate.bounds.minY = Math.round(newBounds.minY);
     blobToUpdate.bounds.width = Math.round(newBounds.width);
     blobToUpdate.bounds.height = Math.round(newBounds.height);
     blobToUpdate.bounds.maxX = blobToUpdate.bounds.minX + blobToUpdate.bounds.width - 1; // Update derived maxX/maxY
     blobToUpdate.bounds.maxY = blobToUpdate.bounds.minY + blobToUpdate.bounds.height - 1;

     console.log(`Updated bounds for blob ${index} in detectedBlobs:`, blobToUpdate.bounds);

     // --- Also update the corresponding blob in extractedSprites ---
     const extractedSprite = appState.extractedSprites.find(es => es.originalBlobIndex === index);
     if (extractedSprite) {
         // Update the bounds of the *copy* stored in extractedSprites
         extractedSprite.blob.bounds = { ...blobToUpdate.bounds };
         console.log(`Updated bounds for corresponding extractedSprite.`);
     } else {
         console.warn(`Could not find corresponding extractedSprite for detectedBlob index ${index} during bounds update.`);
     }
     // --- End update ---

     return true;
}

/**
 * Adds a new blob to the `detectedBlobs` array.
 * Creates a unique ID for the new blob.
 * Also adds a corresponding entry to `extractedSprites` and selects it by default.
 * @param {{ minX: number, minY: number, width: number, height: number }} bounds - The bounds of the new blob.
 * @returns {number | null} The index of the newly added blob in `detectedBlobs`, or null on failure.
 */
export function addBlob(bounds) {
     if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
         console.warn("Attempted to add blob with invalid bounds:", bounds);
         return null;
     }

     // Generate a simple unique ID (negative to distinguish from CCL-generated IDs, if needed)
     // Or use a more robust method like finding the max existing ID + 1
     const existingIds = new Set(appState.detectedBlobs.map(b => b.id).filter(id => typeof id === 'number'));
     let newId = -1;
     while (existingIds.has(newId)) {
         newId--;
     }

     const newBlob = {
         id: newId, // Or Date.now(), or uuid later
         pixels: bounds.width * bounds.height, // Estimate or leave as 0? Use area for now.
         bounds: { ...bounds, maxX: bounds.minX + bounds.width - 1, maxY: bounds.minY + bounds.height - 1 } // Ensure maxX/maxY are calculated
     };

     appState.detectedBlobs.push(newBlob);
     const newDetectedIndex = appState.detectedBlobs.length - 1;

     // --- Add corresponding entry to extractedSprites ---
     const newExtractedSprite = {
         originalBlobIndex: newDetectedIndex,
         blob: { ...newBlob, bounds: { ...newBlob.bounds } } // Store a copy
     };
     appState.extractedSprites.push(newExtractedSprite);
     const newExtractedIndex = appState.extractedSprites.length - 1;
     // --- End add ---

     // --- Select the newly added sprite by default ---
     appState.selectedSpritesForSheet.push(newExtractedIndex);
     // --- End selection ---

     console.log(`Added new blob at detectedBlobs index ${newDetectedIndex}, extractedSprites index ${newExtractedIndex}`);
     return newDetectedIndex; // Return the index in detectedBlobs
}