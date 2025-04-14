// --- State Variables ---
export let appState = {
    originalImageInfo: null, // { img, naturalWidth, naturalHeight, hasTransparency }
    originalImageData: null,
    currentSourceImageId: null, // Identifier for the currently loaded image (e.g., filename + timestamp)
    grayscaleImageData: null,
    thresholdedImageData: null,
    cclResult: null, // { blobs: Array<Object>, labels: Int32Array }
    detectedBlobs: [], // Array of { id, pixels, bounds: {...}, sourceImageId }
    extractedSprites: [], // Array of { originalBlobIndex: number, blob: Object, uniqueId: string, sourceImageId: string }
    selectedSpritesForSheet: [], // Array of { uniqueId: string, blob: Object, sourceImageData: ImageData, sourceImageId: string }
    generatedSpritesheetCanvas: null, // Store the generated canvas
    currentThresholdSettings: {
        type: 'manual',
        manualValue: 128,
        adaptiveBlockSize: 11,
        adaptiveC: 2
    },
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
    editing: {
        currentEditMode: 'pan', // 'pan', 'select', 'edit-bounds', 'add', 'split', 'merge', 'delete'
        selectedBlobIndex: null, // Index in the `detectedBlobs` array (current image only)
    }
};

// --- Helper ---
// Generates a unique ID for a sprite instance
function generateUniqueSpriteId(sourceImageId, originalBlobIndex, blob) {
    return `sprite-${sourceImageId}-${originalBlobIndex}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Generates an ID for the source image
function generateSourceImageId(file) {
    if (!file) return `unknown-${Date.now()}`;
    return `${file.name}-${file.lastModified}-${Date.now()}`;
}

// --- State Update Functions ---
export function setOriginalImage(imgInfo, imgData, file) {
    appState.originalImageInfo = {
        img: imgInfo.img,
        naturalWidth: imgInfo.naturalWidth,
        naturalHeight: imgInfo.naturalHeight,
        hasTransparency: imgInfo.hasTransparency // Store the flag
    };
    appState.originalImageData = imgData;
    appState.currentSourceImageId = generateSourceImageId(file); 
    console.log("Current source image ID set to:", appState.currentSourceImageId);
    appState.grayscaleImageData = null;
    appState.thresholdedImageData = null;
    appState.cclResult = null;
    appState.detectedBlobs = [];
    appState.extractedSprites = []; 
    appState.editing.selectedBlobIndex = null;
}

export function setGrayscaleImage(imgData) {
    appState.grayscaleImageData = imgData;
}

export function setThresholdedImage(imgData) {
    appState.thresholdedImageData = imgData;
}

export function setCCLResult(result) {
    appState.cclResult = result;
    appState.detectedBlobs = result
        ? result.blobs.map(b => ({
            ...b,
            bounds: {...b.bounds},
            sourceImageId: appState.currentSourceImageId 
        }))
        : [];
    appState.extractedSprites = appState.detectedBlobs.map((blob, index) => ({
         originalBlobIndex: index, 
         blob: { ...blob, bounds: { ...blob.bounds } }, 
         uniqueId: generateUniqueSpriteId(appState.currentSourceImageId, index, blob), 
         sourceImageId: appState.currentSourceImageId 
     }));
    appState.editing.selectedBlobIndex = null; 
}

export function clearCCLResult() {
     appState.cclResult = null;
     appState.detectedBlobs = [];
     appState.extractedSprites = []; 
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
        manualValue: 128, // Reset to default
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
export function addSpriteToSelection(spriteIdToAdd) {
    if (appState.selectedSpritesForSheet.some(sprite => sprite.uniqueId === spriteIdToAdd)) {
        console.log(`Sprite ${spriteIdToAdd} is already selected.`);
        return false;
    }
    const spriteData = appState.extractedSprites.find(sprite => sprite.uniqueId === spriteIdToAdd);
    if (spriteData && appState.originalImageData) {
        appState.selectedSpritesForSheet.push({
            uniqueId: spriteData.uniqueId,
            blob: { ...spriteData.blob, bounds: { ...spriteData.blob.bounds } }, 
            sourceImageData: appState.originalImageData, 
            sourceImageId: spriteData.sourceImageId 
        });
        console.log(`Added sprite ${spriteIdToAdd} (from ${spriteData.sourceImageId}) to selection.`);
        return true;
    } else {
        console.warn(`Could not find available sprite with ID ${spriteIdToAdd} or missing source image data.`);
        return false;
    }
}

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

export function clearSelectedSprites() {
    appState.selectedSpritesForSheet = [];
    console.log("Cleared all selected sprites.");
}

/**
 * Reorders the selectedSpritesForSheet array based on drag-and-drop action.
 * @param {string} draggedSpriteId - The uniqueId of the sprite being dragged.
 * @param {string | null} targetSpriteId - The uniqueId of the sprite being dropped onto, or null if dropped on container.
 * @returns {boolean} - True if reordering was successful, false otherwise.
 */
export function reorderSelectedSprites(draggedSpriteId, targetSpriteId) {
    const draggedIndex = appState.selectedSpritesForSheet.findIndex(s => s.uniqueId === draggedSpriteId);

    if (draggedIndex === -1) {
        console.error("Dragged sprite not found in selection:", draggedSpriteId);
        return false;
    }

    // Remove the dragged item temporarily
    const [draggedItem] = appState.selectedSpritesForSheet.splice(draggedIndex, 1);

    let targetIndex = -1;
    if (targetSpriteId) {
         targetIndex = appState.selectedSpritesForSheet.findIndex(s => s.uniqueId === targetSpriteId);
    }

    if (targetIndex !== -1) {
        // Insert before the target item
        appState.selectedSpritesForSheet.splice(targetIndex, 0, draggedItem);
        console.log(`Reordered sprite ${draggedSpriteId} to index ${targetIndex} (before ${targetSpriteId}).`);
    } else {
        // If targetId is null or not found, add to the end
        appState.selectedSpritesForSheet.push(draggedItem);
        console.log(`Reordered sprite ${draggedSpriteId} to the end.`);
    }

    return true;
}

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

export function clearProcessingResultsState() {
    console.log("Clearing current image processing results state...");
    appState.grayscaleImageData = null;
    appState.thresholdedImageData = null;
    appState.cclResult = null;
    appState.detectedBlobs = [];
    appState.extractedSprites = []; 
    appState.editing.selectedBlobIndex = null;
    appState.generatedSpritesheetCanvas = null; 
}

export function clearFullAppState() {
     console.log("Clearing full app state.");
     appState.originalImageInfo = null; // Reset object
     appState.originalImageData = null;
     appState.currentSourceImageId = null;
     appState.grayscaleImageData = null;
     appState.thresholdedImageData = null;
     appState.cclResult = null;
     appState.detectedBlobs = [];
     appState.extractedSprites = [];
     appState.selectedSpritesForSheet = []; 
     appState.generatedSpritesheetCanvas = null;
     resetThresholdSettings();
     resetViewport();
     resetEditingState();
}

export function deleteBlobByIndex(index) {
    if (index === null || index < 0 || index >= appState.detectedBlobs.length) {
        console.warn(`Attempted to delete invalid blob index: ${index}`);
        return false;
    }
    if (appState.detectedBlobs[index].sourceImageId !== appState.currentSourceImageId) {
        console.warn(`Attempted to delete blob index ${index} which is not from the current source image.`);
        return false; 
    }
    const spriteToRemove = appState.extractedSprites.find(es => es.originalBlobIndex === index && es.sourceImageId === appState.currentSourceImageId);
    const uniqueIdToRemove = spriteToRemove ? spriteToRemove.uniqueId : null;
    const deletedBlobInfo = appState.detectedBlobs.splice(index, 1); 
    console.log(`Deleted blob at detectedBlobs index ${index}:`, deletedBlobInfo[0]);
    appState.extractedSprites = appState.extractedSprites.filter(es =>
        !(es.originalBlobIndex === index && es.sourceImageId === appState.currentSourceImageId)
    );
    appState.extractedSprites.forEach(es => {
        if (es.sourceImageId === appState.currentSourceImageId && es.originalBlobIndex > index) {
            es.originalBlobIndex--;
        }
    });
    if (uniqueIdToRemove) {
        removeSpriteFromSelection(uniqueIdToRemove); 
    } else {
        console.warn(`Could not find unique ID for deleted blob at index ${index} to remove from selection.`);
    }
    if (appState.editing.selectedBlobIndex === index) {
        appState.editing.selectedBlobIndex = null;
    }
    else if (appState.editing.selectedBlobIndex !== null && index < appState.editing.selectedBlobIndex) {
         appState.editing.selectedBlobIndex--;
    }
    return true;
}

export function updateBlobBoundsByIndex(index, newBounds) {
     if (index === null || index < 0 || index >= appState.detectedBlobs.length) {
        console.warn(`Attempted to update bounds for invalid blob index: ${index}`);
        return false;
    }
    if (appState.detectedBlobs[index].sourceImageId !== appState.currentSourceImageId) {
        console.warn(`Attempted to edit bounds for blob index ${index} which is not from the current source image.`);
        return false;
    }
     if (!newBounds || newBounds.width <= 0 || newBounds.height <= 0 ||
         newBounds.minX === undefined || newBounds.minY === undefined) {
         console.warn(`Attempted to update blob ${index} with invalid bounds:`, newBounds);
         return false;
     }
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
     const extractedSprite = appState.extractedSprites.find(es => es.originalBlobIndex === index && es.sourceImageId === appState.currentSourceImageId);
     let uniqueId = null;
     if (extractedSprite) {
         extractedSprite.blob.bounds = { ...updatedBounds }; 
         uniqueId = extractedSprite.uniqueId; 
         console.log(`Updated bounds for corresponding extractedSprite.`);
     } else {
         console.warn(`Could not find corresponding extractedSprite for detectedBlob index ${index} during bounds update.`);
     }
     if (uniqueId) {
         const selectedSprite = appState.selectedSpritesForSheet.find(ss => ss.uniqueId === uniqueId);
         if (selectedSprite) {
             selectedSprite.blob.bounds = { ...updatedBounds }; 
             console.log(`Updated bounds for corresponding selectedSprite ${uniqueId}.`);
         }
     }
     return true;
}

export function addBlob(bounds) {
     if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
         console.warn("Attempted to add blob with invalid bounds:", bounds);
         return null;
     }
     if (!appState.currentSourceImageId) {
          console.error("Cannot add blob: Current source image ID is not set.");
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
         },
         sourceImageId: appState.currentSourceImageId 
     };
     appState.detectedBlobs.push(newBlob);
     const newDetectedIndex = appState.detectedBlobs.length - 1;
     const newExtractedSprite = {
         originalBlobIndex: newDetectedIndex,
         blob: { ...newBlob, bounds: { ...newBlob.bounds } }, 
         uniqueId: generateUniqueSpriteId(appState.currentSourceImageId, newDetectedIndex, newBlob), 
         sourceImageId: appState.currentSourceImageId 
     };
     appState.extractedSprites.push(newExtractedSprite);
     console.log(`Added new blob at detectedBlobs index ${newDetectedIndex}, available as extractedSprite ${newExtractedSprite.uniqueId}`);
     return newDetectedIndex; 
}