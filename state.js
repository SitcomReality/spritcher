// --- State Variables ---
export let appState = {
    originalImageInfo: null, // { img, naturalWidth, naturalHeight }
    originalImageData: null,
    grayscaleImageData: null,
    thresholdedImageData: null,
    cclResult: null, // { blobs: Array<Object>, labels: Int32Array }
    detectedBlobs: [], // Holds the current list of blobs (can be modified by editing tools)
    generatedSpritesheetCanvas: null, // Store the generated canvas

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
    appState.editing.selectedBlobIndex = null; // Reset selection after processing
}

export function clearCCLResult() {
     appState.cclResult = null;
     appState.detectedBlobs = [];
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

// Clears results but keeps original image and settings
export function clearProcessingResultsState() {
    console.log("Clearing processing results state...");
    appState.grayscaleImageData = null;
    appState.thresholdedImageData = null;
    appState.cclResult = null;
    appState.detectedBlobs = [];
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
     appState.generatedSpritesheetCanvas = null;
     resetThresholdSettings();
     resetViewport();
     resetEditingState();
}

/**
 * Deletes a detected blob by its index in the `detectedBlobs` array.
 * Handles index validation and ensures selection is cleared if it matches the deleted index.
 * @param {number} index - The index of the blob to delete.
 * @returns {boolean} True if deletion was successful, false otherwise.
 */
export function deleteBlobByIndex(index) {
    if (index === null || index < 0 || index >= appState.detectedBlobs.length) {
        console.warn(`Attempted to delete invalid blob index: ${index}`);
        return false;
    }

    const deletedBlob = appState.detectedBlobs.splice(index, 1); // Remove the blob
    console.log(`Deleted blob at index ${index}:`, deletedBlob[0]);

    // Clear selection if the deleted blob was selected
    if (appState.editing.selectedBlobIndex === index) {
        appState.editing.selectedBlobIndex = null;
    }
    // Adjust selection index if a blob *before* the selected one was deleted
    else if (appState.editing.selectedBlobIndex !== null && index < appState.editing.selectedBlobIndex) {
         appState.editing.selectedBlobIndex--;
    }

    return true;
}