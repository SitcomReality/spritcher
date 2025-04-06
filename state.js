// --- State Variables ---
export let appState = {
    originalImageInfo: null, // { img, naturalWidth, naturalHeight }
    originalImageData: null,
    grayscaleImageData: null,
    thresholdedImageData: null,
    cclResult: null, // { blobs: Array<Object>, labels: Int32Array }
    detectedBlobs: [], // Holds the current list of blobs (can be modified by editing tools)
    generatedSpritesheetCanvas: null, // Store the generated canvas

    // Represents sprites found in the *last* detection/processing run
    extractedSprites: [], // Array of { originalBlobIndex: number, blob: Object, uniqueId: string }

    // Sprites actively selected BY THE USER for inclusion in the final sheet.
    // Stores copies of the sprite data, allowing for reordering and multi-image sources later.
    selectedSpritesForSheet: [], // Array of { originalBlobIndex: number, blob: Object, uniqueId: string }

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

// --- Helper ---
// Generates a unique ID for a sprite instance (can be used for stable referencing)
function generateUniqueSpriteId(originalBlobIndex, blob) {
    // Simple ID for now, could be more robust (e.g., hash of initial bounds/position)
    return `sprite-${originalBlobIndex}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


// --- State Update Functions ---

export function setOriginalImage(imgInfo, imgData) {
    appState.originalImageInfo = imgInfo;
    appState.originalImageData = imgData;
    // Reset dependent states
    appState.grayscaleImageData = null;
    appState.thresholdedImageData = null;
    appState.cclResult = null;
    appState.detectedBlobs = [];
    appState.extractedSprites = []; // Clear available sprites from previous image
    appState.selectedSpritesForSheet = []; // Clear selected sprites from previous image/session
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

    // Populate the 'Available' sprites list from the new detection run
    appState.extractedSprites = appState.detectedBlobs.map((blob, index) => ({
         originalBlobIndex: index, // Link back to the detectedBlobs array index
         blob: { ...blob, bounds: { ...blob.bounds } }, // Store a copy of the blob data
         uniqueId: generateUniqueSpriteId(index, blob) // Generate unique ID
     }));

    // CRITICAL: Reset selected sprites when new blobs are detected.
    // The user needs to explicitly select from the new set.
    appState.selectedSpritesForSheet = [];

    appState.editing.selectedBlobIndex = null; // Reset editing selection after processing
}

export function clearCCLResult() {
     appState.cclResult = null;
     appState.detectedBlobs = [];
     appState.extractedSprites = []; // Clear available sprites
     appState.selectedSpritesForSheet = []; // Clear selected sprites
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

// --- NEW --- Managing Selected Sprites for Sheet ---

/**
 * Adds a sprite (identified by its uniqueId from the available list)
 * to the selected sprites list, avoiding duplicates.
 * @param {string} spriteIdToAdd - The uniqueId of the sprite from appState.extractedSprites.
 * @returns {boolean} True if the sprite was added, false if it was already selected or not found.
 */
export function addSpriteToSelection(spriteIdToAdd) {
    // Check if already selected
    if (appState.selectedSpritesForSheet.some(sprite => sprite.uniqueId === spriteIdToAdd)) {
        console.log(`Sprite ${spriteIdToAdd} is already selected.`);
        return false;
    }

    // Find the sprite data in the available list
    const spriteData = appState.extractedSprites.find(sprite => sprite.uniqueId === spriteIdToAdd);

    if (spriteData) {
        // Add a *copy* to the selected list
        appState.selectedSpritesForSheet.push({ ...spriteData, blob: { ...spriteData.blob, bounds: { ...spriteData.blob.bounds } } });
        console.log(`Added sprite ${spriteIdToAdd} to selection.`);
        return true;
    } else {
        console.warn(`Could not find available sprite with ID ${spriteIdToAdd} to add.`);
        return false;
    }
}

/**
 * Removes a sprite from the selected sprites list using its uniqueId.
 * @param {string} spriteIdToRemove - The uniqueId of the sprite to remove.
 * @returns {boolean} True if the sprite was removed, false if it was not found.
 */
export function removeSpriteFromSelection(spriteIdToRemove) {
    const initialLength = appState.selectedSpritesForSheet.length;
    appState.selectedSpritesForSheet = appState.selectedSpritesForSheet.filter(
        sprite => sprite.uniqueId !== spriteIdToRemove
    );
    const removed = appState.selectedSpritesForSheet.length < initialLength;
    if (removed) {
        console.log(`Removed sprite ${spriteIdToRemove} from selection.`);
    } else {
        console.log(`Sprite ${spriteIdToRemove} not found in selection.`);
    }
    return removed;
}

/**
 * Clears all sprites from the selected list.
 */
export function clearSelectedSprites() {
    appState.selectedSpritesForSheet = [];
    console.log("Cleared all selected sprites.");
}

/**
 * Adds all currently available sprites to the selected list (if not already present).
 */
export function addAllAvailableSpritesToSelection() {
    let addedCount = 0;
    appState.extractedSprites.forEach(availableSprite => {
        if (addSpriteToSelection(availableSprite.uniqueId)) {
             addedCount++;
        }
    });
    console.log(`Added ${addedCount} available sprites to selection.`);
}
// --- END NEW ---

// Clears results but keeps original image and settings
export function clearProcessingResultsState() {
    console.log("Clearing processing results state...");
    appState.grayscaleImageData = null;
    appState.thresholdedImageData = null;
    appState.cclResult = null;
    appState.detectedBlobs = [];
    appState.extractedSprites = []; // Clear available sprites
    appState.selectedSpritesForSheet = []; // Clear selected sprites
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
     appState.extractedSprites = []; // Clear available sprites
     appState.selectedSpritesForSheet = []; // Clear selected sprites
     appState.generatedSpritesheetCanvas = null;
     resetThresholdSettings();
     resetViewport();
     resetEditingState();
}

/**
 * Deletes a detected blob by its index in the `detectedBlobs` array.
 * Also removes the corresponding sprite from `extractedSprites` AND `selectedSpritesForSheet`.
 * @param {number} index - The index of the blob to delete *in detectedBlobs*.
 * @returns {boolean} True if deletion was successful, false otherwise.
 */
export function deleteBlobByIndex(index) {
    if (index === null || index < 0 || index >= appState.detectedBlobs.length) {
        console.warn(`Attempted to delete invalid blob index: ${index}`);
        return false;
    }

    // --- Find the unique ID before removing from extractedSprites ---
    const spriteToRemove = appState.extractedSprites.find(es => es.originalBlobIndex === index);
    const uniqueIdToRemove = spriteToRemove ? spriteToRemove.uniqueId : null;
    // ---

    const deletedBlobInfo = appState.detectedBlobs.splice(index, 1); // Remove the blob from detectedBlobs
    console.log(`Deleted blob at detectedBlobs index ${index}:`, deletedBlobInfo[0]);

    // --- Update extractedSprites ---
    const initialExtractedLength = appState.extractedSprites.length;
    appState.extractedSprites = appState.extractedSprites.filter(es => es.originalBlobIndex !== index);
    if (appState.extractedSprites.length === initialExtractedLength) {
         console.warn(`Could not find extracted sprite with originalBlobIndex ${index} to remove.`);
    }

    // Adjust originalBlobIndex for sprites that came *after* the deleted one in detectedBlobs
    appState.extractedSprites.forEach(es => {
        if (es.originalBlobIndex > index) {
            es.originalBlobIndex--;
        }
    });
    // --- End update extractedSprites ---

    // --- Remove from selectedSpritesForSheet using the unique ID ---
    if (uniqueIdToRemove) {
        removeSpriteFromSelection(uniqueIdToRemove);
    } else {
        console.warn(`Could not find unique ID for deleted blob at index ${index} to remove from selection.`);
    }
    // --- End remove from selected ---


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
 * Also updates the bounds in `extractedSprites` AND `selectedSpritesForSheet`.
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

     // 1. Update the specific blob's bounds object in detectedBlobs
     const blobToUpdate = appState.detectedBlobs[index];
     const updatedBounds = {
         minX: Math.round(newBounds.minX),
         minY: Math.round(newBounds.minY),
         width: Math.round(newBounds.width),
         height: Math.round(newBounds.height),
         maxX: Math.round(newBounds.minX) + Math.round(newBounds.width) - 1,
         maxY: Math.round(newBounds.minY) + Math.round(newBounds.height) - 1
     };
     blobToUpdate.bounds = updatedBounds;
     console.log(`Updated bounds for blob ${index} in detectedBlobs:`, blobToUpdate.bounds);

     // 2. Find the corresponding extractedSprite and update its bounds
     const extractedSprite = appState.extractedSprites.find(es => es.originalBlobIndex === index);
     let uniqueId = null;
     if (extractedSprite) {
         extractedSprite.blob.bounds = { ...updatedBounds }; // Update the copy
         uniqueId = extractedSprite.uniqueId; // Get the ID for the next step
         console.log(`Updated bounds for corresponding extractedSprite.`);
     } else {
         console.warn(`Could not find corresponding extractedSprite for detectedBlob index ${index} during bounds update.`);
     }

     // 3. If the sprite was selected, find it by ID and update its bounds there too
     if (uniqueId) {
         const selectedSprite = appState.selectedSpritesForSheet.find(ss => ss.uniqueId === uniqueId);
         if (selectedSprite) {
             selectedSprite.blob.bounds = { ...updatedBounds }; // Update the copy in selection
             console.log(`Updated bounds for corresponding selectedSprite ${uniqueId}.`);
         }
     }

     return true;
}

/**
 * Adds a new blob to the `detectedBlobs` array and the `extractedSprites` array.
 * The new sprite is *not* automatically added to `selectedSpritesForSheet`.
 * @param {{ minX: number, minY: number, width: number, height: number }} bounds - The bounds of the new blob.
 * @returns {number | null} The index of the newly added blob in `detectedBlobs`, or null on failure.
 */
export function addBlob(bounds) {
     if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
         console.warn("Attempted to add blob with invalid bounds:", bounds);
         return null;
     }

     const existingIds = new Set(appState.detectedBlobs.map(b => b.id).filter(id => typeof id === 'number'));
     let newId = -1;
     while (existingIds.has(newId)) {
         newId--;
     }

     const newBlob = {
         id: newId,
         pixels: bounds.width * bounds.height,
         bounds: {
             minX: Math.round(bounds.minX),
             minY: Math.round(bounds.minY),
             width: Math.round(bounds.width),
             height: Math.round(bounds.height),
             maxX: Math.round(bounds.minX) + Math.round(bounds.width) - 1,
             maxY: Math.round(bounds.minY) + Math.round(bounds.height) - 1
         }
     };

     // Add to detectedBlobs
     appState.detectedBlobs.push(newBlob);
     const newDetectedIndex = appState.detectedBlobs.length - 1;

     // Add corresponding entry to extractedSprites (available)
     const newExtractedSprite = {
         originalBlobIndex: newDetectedIndex,
         blob: { ...newBlob, bounds: { ...newBlob.bounds } }, // Store a copy
         uniqueId: generateUniqueSpriteId(newDetectedIndex, newBlob) // Assign unique ID
     };
     appState.extractedSprites.push(newExtractedSprite);

     // DO NOT automatically add to selectedSpritesForSheet

     console.log(`Added new blob at detectedBlobs index ${newDetectedIndex}, available as extractedSprite ${newExtractedSprite.uniqueId}`);
     return newDetectedIndex; // Return the index in detectedBlobs
}