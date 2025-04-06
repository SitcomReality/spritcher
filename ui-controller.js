import { loadImage, getImageDataFromCanvas } from 'image-loader';
import { getGrayscaleImageData, getThresholdedImageData, getAdaptiveThresholdedImageData } from 'image-processor';
import { findBlobs, getLabeledImageData } from 'blob-detector';
import { generateSpritesheet, downloadCanvasAsPNG } from 'spritesheet-generator';
import { drawBoundingBoxes, clearOverlays } from 'utils';

// --- State Variables ---
let originalImageInfo = null; // { img, naturalWidth, naturalHeight }
let originalImageData = null;
let grayscaleImageData = null;
let thresholdedImageData = null;
let cclResult = null; // { blobs: Array<Object>, labels: Int32Array }
let detectedBlobs = []; // Just the blobs array for convenience
let generatedSpritesheetCanvas = null; // Store the generated canvas

let currentThresholdSettings = { 
    type: 'manual', 
    manualValue: 128,
    adaptiveBlockSize: 11,
    adaptiveC: 2
};

// Viewport State
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0; // Mouse position at pan start
let startPanY = 0; // Mouse position at pan start
let startViewX = 0; // panX at pan start
let startViewY = 0; // panY at pan start


// --- DOM Element References ---
let imageUploadInput, imagePreviewCanvas, imagePreviewContainer, debugOverlaysContainer;
let thresholdSlider, thresholdValueSpan, minSizeSlider, minSizeValueSpan;
let debugViewCheckboxes, debugOverlayCheckboxes; // Collections of checkboxes
let processButton, processingStatusDiv;
let gridColsInput, paddingInput, alignmentSelect;
let generateSpritesheetButton, spritesheetPreviewCanvas, spritesheetPreviewContainer, downloadSpritesheetButton;
let zoomInButton, zoomOutButton;
let thresholdTypeSelect;
let manualThresholdSettingsDiv, adaptiveThresholdSettingsDiv;
let adaptiveBlocksizeInput, adaptiveCInput;


// --- Initialization ---
export function initUI() {
    // Get DOM elements
    imageUploadInput = document.getElementById('image-upload');
    imagePreviewCanvas = document.getElementById('image-preview-canvas');
    imagePreviewContainer = document.getElementById('image-preview-container');
    debugOverlaysContainer = document.getElementById('debug-overlays');
    thresholdTypeSelect = document.getElementById('threshold-type-select');
    manualThresholdSettingsDiv = document.getElementById('manual-threshold-settings');
    adaptiveThresholdSettingsDiv = document.getElementById('adaptive-threshold-settings');
    thresholdSlider = document.getElementById('threshold-slider');
    thresholdValueSpan = document.getElementById('threshold-value');
    adaptiveBlocksizeInput = document.getElementById('adaptive-blocksize-input');
    adaptiveCInput = document.getElementById('adaptive-c-input');
    minSizeSlider = document.getElementById('min-sprite-size-slider');
    minSizeValueSpan = document.getElementById('min-sprite-size-value');
    // Get checkboxes by name for easier handling
    debugViewCheckboxes = document.querySelectorAll('input[name="debug-view"]');
    debugOverlayCheckboxes = document.querySelectorAll('input[name="debug-overlay"]');
    processButton = document.getElementById('process-button');
    processingStatusDiv = document.getElementById('processing-status');
    gridColsInput = document.getElementById('grid-cols-input');
    paddingInput = document.getElementById('padding-input');
    alignmentSelect = document.getElementById('alignment-select');
    generateSpritesheetButton = document.getElementById('generate-spritesheet-button'); 
    spritesheetPreviewCanvas = document.getElementById('spritesheet-preview-canvas');
    spritesheetPreviewContainer = document.getElementById('spritesheet-preview-container');
    downloadSpritesheetButton = document.getElementById('download-spritesheet-button');
    zoomInButton = document.getElementById('zoom-in-button');
    zoomOutButton = document.getElementById('zoom-out-button');


    // Add event listeners
    imageUploadInput.addEventListener('change', handleImageUpload);
    thresholdTypeSelect.addEventListener('change', handleThresholdTypeChange);
    thresholdSlider.addEventListener('input', handleManualThresholdChange); 
    adaptiveBlocksizeInput.addEventListener('input', handleAdaptiveParamsChange);
    adaptiveCInput.addEventListener('input', handleAdaptiveParamsChange);
    minSizeSlider.addEventListener('input', handleMinSizeChange);
    processButton.addEventListener('click', handleProcessImage);

    // Add listeners to all debug checkboxes
    debugViewCheckboxes.forEach(cb => cb.addEventListener('change', handleDebugViewChange));
    debugOverlayCheckboxes.forEach(cb => cb.addEventListener('change', updateDebugOverlays)); 

    // Spritesheet controls trigger clearing the generated sheet
    gridColsInput.addEventListener('change', handleSpritesheetSettingsChange);
    paddingInput.addEventListener('change', handleSpritesheetSettingsChange);
    alignmentSelect.addEventListener('change', handleSpritesheetSettingsChange);

    generateSpritesheetButton.addEventListener('click', handleGenerateSpritesheet); 
    downloadSpritesheetButton.addEventListener('click', handleDownloadSpritesheet);

    // Zoom and Pan Listeners
    zoomInButton.addEventListener('click', () => zoomAtPoint(imagePreviewContainer.clientWidth / 2, imagePreviewContainer.clientHeight / 2, 1.2));
    zoomOutButton.addEventListener('click', () => zoomAtPoint(imagePreviewContainer.clientWidth / 2, imagePreviewContainer.clientHeight / 2, 1 / 1.2));
    imagePreviewContainer.addEventListener('mousedown', startPan);
    imagePreviewContainer.addEventListener('mousemove', pan);
    imagePreviewContainer.addEventListener('mouseup', endPan);
    imagePreviewContainer.addEventListener('mouseleave', endPan); 
    imagePreviewContainer.addEventListener('wheel', handleWheelZoom, { passive: false }); 


     // Initial state updates
    updateThresholdSettingsUI(); 
    minSizeValueSpan.textContent = minSizeSlider.value;
    disableControls(true); 

    console.log("UI Initialized");
}

// --- Event Handlers ---

async function handleImageUpload() {
    console.log("Handling image upload...");
    clearStateBeforeLoad();
    processingStatusDiv.textContent = 'Loading image...';
    disableControls(true); 

    try {
        originalImageInfo = await loadImage(imageUploadInput, imagePreviewCanvas); 
        originalImageData = getImageDataFromCanvas(imagePreviewCanvas);

        if (!originalImageData) {
             throw new Error("Could not get image pixel data after loading.");
        }

        resetZoomPan(); 
        updateImageDisplay(); 

        processingStatusDiv.textContent = 'Image loaded. Adjust settings and click "Detect Sprites".';
        disableControls(false); 
         clearGeneratedSpritesheet(); 

        console.log("Image loaded successfully.");
    } catch (error) {
        processingStatusDiv.textContent = `Error: ${error.message}`;
        console.error("Image loading failed:", error);
        alert(`Error loading image: ${error.message}`);
        clearStateBeforeLoad(); 
        disableControls(true); 
    }
}

// Handles change in the threshold type dropdown
function handleThresholdTypeChange() {
    currentThresholdSettings.type = thresholdTypeSelect.value;
    updateThresholdSettingsUI(); 
    invalidateThresholdResults(); 
    processingStatusDiv.textContent = "Threshold type changed. Click 'Detect Sprites' to update results.";
}

// Handles changes to manual threshold slider
function handleManualThresholdChange() {
    currentThresholdSettings.manualValue = parseInt(thresholdSlider.value, 10);
    updateThresholdSettingsUI(); 
    invalidateThresholdResults(); 
    // Update view immediately ONLY if threshold view is active
    if (document.getElementById('show-threshold-checkbox').checked && currentThresholdSettings.type === 'manual') {
        processingStatusDiv.textContent = "Manual threshold changed. Click 'Detect Sprites' to update results.";
    }
}

// Handles changes to adaptive threshold parameters (Block Size, C)
function handleAdaptiveParamsChange() {
    // Ensure block size is odd
    let blockSize = parseInt(adaptiveBlocksizeInput.value, 10);
    if (blockSize % 2 === 0) {
        blockSize = Math.max(3, blockSize + 1); 
        adaptiveBlocksizeInput.value = blockSize; 
    }
     if (blockSize < 3) {
        blockSize = 3;
        adaptiveBlocksizeInput.value = 3;
     }
    currentThresholdSettings.adaptiveBlockSize = blockSize;
    currentThresholdSettings.adaptiveC = parseInt(adaptiveCInput.value, 10);

    updateThresholdSettingsUI(); 
    invalidateThresholdResults(); 
    if (document.getElementById('show-threshold-checkbox').checked && currentThresholdSettings.type !== 'manual') {
        processingStatusDiv.textContent = "Adaptive threshold params changed. Click 'Detect Sprites' to update results.";
    }
}

// Helper to invalidate threshold-dependent results
function invalidateThresholdResults() {
    thresholdedImageData = null;
    cclResult = null;
    detectedBlobs = [];
    clearGeneratedSpritesheet();
    // Clear bounding box overlays as they depend on the threshold
    if (document.getElementById('show-bboxes-checkbox').checked) {
         clearOverlays(debugOverlaysContainer);
     }
     console.log("Threshold-dependent results invalidated.");
}

// Updates the UI elements related to threshold settings based on current state
function updateThresholdSettingsUI() {
    // Update visibility
    manualThresholdSettingsDiv.classList.toggle('visible', currentThresholdSettings.type === 'manual');
    adaptiveThresholdSettingsDiv.classList.toggle('visible', currentThresholdSettings.type.startsWith('adaptive-'));

    // Update values displayed
    thresholdValueSpan.textContent = currentThresholdSettings.manualValue;
    thresholdSlider.value = currentThresholdSettings.manualValue; 
    adaptiveBlocksizeInput.value = currentThresholdSettings.adaptiveBlockSize;
    adaptiveCInput.value = currentThresholdSettings.adaptiveC;

    // Enable/disable relevant inputs based on type
    thresholdSlider.disabled = (currentThresholdSettings.type !== 'manual' || !originalImageInfo);
    adaptiveBlocksizeInput.disabled = (!currentThresholdSettings.type.startsWith('adaptive-') || !originalImageInfo);
    adaptiveCInput.disabled = (!currentThresholdSettings.type.startsWith('adaptive-') || !originalImageInfo);
}

// Handles changes to min sprite size slider
function handleMinSizeChange() {
    minSizeValueSpan.textContent = minSizeSlider.value;
    // Invalidate blob detection and downstream results
    // No need to clear thresholdedImageData
    cclResult = null;
    detectedBlobs = [];
     clearGeneratedSpritesheet();
    // Update bounding box overlay immediately if shown, requires re-running CCL
     if (document.getElementById('show-bboxes-checkbox').checked) {
         // Clear overlays and indicate reprocessing is needed
         clearOverlays(debugOverlaysContainer);
         processingStatusDiv.textContent = "Min size changed. Click 'Detect Sprites' to update results.";
     }

}

// Handles changes to spritesheet layout settings
function handleSpritesheetSettingsChange() {
     clearGeneratedSpritesheet();
     processingStatusDiv.textContent = "Spritesheet settings changed. Click 'Generate Spritesheet' to update.";
}

// Main processing pipeline triggered by button
async function handleProcessImage() {
    if (!originalImageData) {
        alert("Please upload an image first.");
        return;
    }

    console.log("Starting image processing pipeline...");
    disableControls(true); 
    processingStatusDiv.textContent = 'Processing: Grayscale...';
    await wait(10); 

    // --- 1. Grayscale ---
    if (!grayscaleImageData && originalImageData) {
        grayscaleImageData = getGrayscaleImageData(originalImageData);
         console.log("Generated grayscale data.");
    } else if (grayscaleImageData) {
        console.log("Using cached grayscale data.");
    } else {
        processingStatusDiv.textContent = 'Error: Cannot process without original image data.';
        disableControls(false);
        return;
    }

    processingStatusDiv.textContent = 'Processing: Thresholding...';
    await wait(10);

    // --- 2. Thresholding ---
    try {
        switch (currentThresholdSettings.type) {
            case 'manual':
                thresholdedImageData = getThresholdedImageData(
                    grayscaleImageData,
                    currentThresholdSettings.manualValue
                );
                console.log(`Generated manual thresholded data (T=${currentThresholdSettings.manualValue}).`);
                break;
            case 'adaptive-mean':
                thresholdedImageData = getAdaptiveThresholdedImageData(
                    grayscaleImageData,
                    currentThresholdSettings.adaptiveBlockSize,
                    currentThresholdSettings.adaptiveC
                );
                console.log(`Generated adaptive mean thresholded data (Block=${currentThresholdSettings.adaptiveBlockSize}, C=${currentThresholdSettings.adaptiveC}).`);
                break;
            default:
                throw new Error(`Unknown threshold type: ${currentThresholdSettings.type}`);
        }
    } catch (error) {
         console.error("Error during thresholding:", error);
         processingStatusDiv.textContent = `Error during thresholding: ${error.message}`;
         thresholdedImageData = null; 
         cclResult = null;
         detectedBlobs = [];
         disableControls(false); 
         return; 
    }

    processingStatusDiv.textContent = 'Processing: Finding Blobs (CCL)...';
    await wait(10);

    // --- 3. Blob Detection (CCL) ---
    const minSize = parseInt(minSizeSlider.value, 10);
    const startTime = performance.now();
    try {
        if (!thresholdedImageData) {
             throw new Error("Thresholding step failed, cannot perform CCL.");
        }
        cclResult = findBlobs(thresholdedImageData, minSize); 
        detectedBlobs = cclResult ? cclResult.blobs : []; 
    } catch(error) {
        console.error("Error during blob detection:", error);
        processingStatusDiv.textContent = `Error during blob detection: ${error.message}`;
        cclResult = null;
        detectedBlobs = [];
        disableControls(false); 
        return; 
    }
    const endTime = performance.now();
    console.log(`CCL completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);

    processingStatusDiv.textContent = `Processing complete. Found ${detectedBlobs.length} sprites. Ready to generate spritesheet.`;
    disableControls(false); 
    clearGeneratedSpritesheet(); 

    // --- 4. Update Debug Views/Overlays ---
    updateDebugView();
    updateDebugOverlays();

    console.log("Processing pipeline finished.");
}

// Handler for Debug VIEW checkboxes (Grayscale, Threshold, CCL)
function handleDebugViewChange(event) {
    if (event.target.checked) {
        debugViewCheckboxes.forEach(cb => {
            if (cb !== event.target) {
                cb.checked = false;
            }
        });
    }
    updateDebugView(); 
}

// Update the main canvas based on which debug VIEW checkbox is checked
function updateDebugView() {
    if (!originalImageData) return; 

    const ctx = imagePreviewCanvas.getContext('2d');
    const width = originalImageData.width;
    const height = originalImageData.height;

    let imageDataToShow = originalImageData; 
    let viewMessage = null; 

    if (document.getElementById('show-grayscale-checkbox').checked) {
        if (!grayscaleImageData) {
            viewMessage = "Grayscale data not generated. Click 'Detect Sprites'.";
        } else {
            imageDataToShow = grayscaleImageData;
        }
    } else if (document.getElementById('show-threshold-checkbox').checked) {
         if (!thresholdedImageData) {
            viewMessage = "Thresholded data not generated. Click 'Detect Sprites'.";
        } else {
            imageDataToShow = thresholdedImageData;
        }
    } else if (document.getElementById('show-ccl-checkbox').checked) {
         if (!cclResult || !cclResult.labels) {
            viewMessage = "CCL data not generated. Click 'Detect Sprites'.";
        } else {
            imageDataToShow = getLabeledImageData(cclResult.labels, width, height);
        }
    }
     // else: No view checkbox checked, imageDataToShow remains originalImageData

    // Display message if required data is missing for the selected view
    if (viewMessage) {
        console.warn(viewMessage);
        processingStatusDiv.textContent = viewMessage;
        imageDataToShow = originalImageData;
    }

    // Redraw the base image on the canvas using the selected ImageData
    imagePreviewCanvas.width = width;
    imagePreviewCanvas.height = height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageDataToShow, 0, 0);

    ctx.clearRect(0, 0, width, height); 
    ctx.drawImage(tempCanvas, 0, 0);

    console.log("Debug view updated.");
}

// Update overlays (bounding boxes) based on checkbox state
function updateDebugOverlays() {
     clearOverlays(debugOverlaysContainer); 

     if (document.getElementById('show-bboxes-checkbox').checked) {
        if (detectedBlobs && detectedBlobs.length > 0) {
             console.log(`Drawing ${detectedBlobs.length} bounding boxes.`);
             drawBoundingBoxes(debugOverlaysContainer, detectedBlobs.map(b => b.bounds), 'red');
        } else {
             console.log("Bounding box overlay enabled, but no blobs detected or processed yet.");
             if (cclResult) { 
                processingStatusDiv.textContent = "No sprites found meeting current criteria.";
             } else {
                processingStatusDiv.textContent = "Bounding box view requires 'Detect Sprites'.";
             }
        }
     }
     console.log("Debug overlays updated.");
}

// Generates and displays the spritesheet 
async function handleGenerateSpritesheet() {
     if (!detectedBlobs || detectedBlobs.length === 0) {
        alert("No sprites detected. Click 'Detect Sprites' first.");
        return;
    }
    if (!originalImageData) {
         alert("Original image data is missing. Please re-upload.");
         return;
    }

    console.log("Generating spritesheet...");
    processingStatusDiv.textContent = 'Generating spritesheet...';
    disableControls(true); 

    const cols = parseInt(gridColsInput.value, 10) || 8;
    const padding = parseInt(paddingInput.value, 10) || 0;
    const alignment = alignmentSelect.value;

    try {
        const resultCanvas = await generateSpritesheet(
            originalImageData,
            detectedBlobs,
            cols,
            padding,
            alignment
        );

        generatedSpritesheetCanvas = resultCanvas;

        const previewCtx = spritesheetPreviewCanvas.getContext('2d');
        spritesheetPreviewCanvas.width = generatedSpritesheetCanvas.width;
        spritesheetPreviewCanvas.height = generatedSpritesheetCanvas.height;
        previewCtx.clearRect(0, 0, generatedSpritesheetCanvas.width, generatedSpritesheetCanvas.height); 
        previewCtx.drawImage(generatedSpritesheetCanvas, 0, 0);

        processingStatusDiv.textContent = `Spritesheet generated (${detectedBlobs.length} sprites). Ready to download.`;
        downloadSpritesheetButton.disabled = false; 
        console.log("Spritesheet generation and preview complete.");

    } catch (error) {
        console.error("Spritesheet generation failed:", error);
        processingStatusDiv.textContent = `Error generating spritesheet: ${error.message}`;
        alert(`Error generating spritesheet: ${error.message}`);
        clearGeneratedSpritesheet(); 
    } finally {
        disableControls(false); 
    }
}

// Prepares the spritesheet for download as a PNG
function handleDownloadSpritesheet() {
    if (!generatedSpritesheetCanvas) {
         alert("Please generate the spritesheet first using the 'Generate Spritesheet' button.");
        return;
    }
     console.log("Preparing spritesheet download...");
    let filename = 'spritcher_spritesheet.png';
    if (imageUploadInput.files && imageUploadInput.files[0]) {
         const originalName = imageUploadInput.files[0].name;
         const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
         filename = `${baseName}_spritesheet.png`;
     }

    downloadCanvasAsPNG(generatedSpritesheetCanvas, filename);
}

// --- Zoom and Pan Implementation ---

// Zooms the image view, attempting to keep the point (cx, cy) in container coordinates stationary
function zoomAtPoint(containerX, containerY, factor) {
    if (!originalImageInfo) return; 

    const newZoom = Math.max(0.1, Math.min(10, currentZoom * factor)); 

    const imageXBefore = (containerX - panX) / currentZoom;
    const imageYBefore = (containerY - panY) / currentZoom;

    const newPanX = containerX - imageXBefore * newZoom;
    const newPanY = containerY - imageYBefore * newZoom;

    currentZoom = newZoom;
    panX = newPanX;
    panY = newPanY;

    updateImageDisplay();
}

function handleWheelZoom(event) {
    event.preventDefault(); 
    const delta = event.deltaY > 0 ? 1 / 1.1 : 1.1; 

    const rect = imagePreviewContainer.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    zoomAtPoint(mouseX, mouseY, delta); 
}

function startPan(event) {
     if (event.button !== 0 || !originalImageInfo) return;
    isPanning = true;
    startPanX = event.clientX; 
    startPanY = event.clientY;
    startViewX = panX; 
    startViewY = panY;
    imagePreviewContainer.style.cursor = 'grabbing';
    event.preventDefault();
}

function pan(event) {
    if (!isPanning) return;
    const dx = event.clientX - startPanX;
    const dy = event.clientY - startPanY;
    panX = startViewX + dx;
    panY = startViewY + dy;
    updateImageDisplay();
}

function endPan() {
    if (isPanning) {
         isPanning = false;
         imagePreviewContainer.style.cursor = 'grab';
    }
}

// Resets zoom to fit image and centers it
function resetZoomPan() {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    if (originalImageInfo && imagePreviewContainer && imagePreviewContainer.clientWidth > 0) {
        const containerWidth = imagePreviewContainer.clientWidth;
        const containerHeight = imagePreviewContainer.clientHeight;
        const imageWidth = originalImageInfo.naturalWidth;
        const imageHeight = originalImageInfo.naturalHeight;

         if (imageWidth > 0 && imageHeight > 0) {
            const scaleX = containerWidth / imageWidth;
            const scaleY = containerHeight / imageHeight;
            currentZoom = Math.min(scaleX, scaleY, 1); 

            panX = (containerWidth - imageWidth * currentZoom) / 2;
            panY = (containerHeight - imageHeight * currentZoom) / 2;
         }
    } else {
        currentZoom = 1;
        panX = 0;
        panY = 0;
    }
    console.log(`Reset Zoom: ${currentZoom.toFixed(2)}, Pan: (${panX.toFixed(1)}, ${panY.toFixed(1)})`);
}

// Applies the current zoom/pan state to the canvas and overlay container
function updateImageDisplay() {
    if (!imagePreviewCanvas || !debugOverlaysContainer) return;

    const transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    imagePreviewCanvas.style.transform = transform;
    debugOverlaysContainer.style.transform = transform;

     debugOverlaysContainer.style.width = `${originalImageInfo.naturalWidth}px`;
     debugOverlaysContainer.style.height = `${originalImageInfo.naturalHeight}px`;
}

// --- Helper Functions ---

// Disables/enables controls that shouldn't be active without an image or during processing
function disableControls(disabled) {
    const imageLoaded = !!originalImageInfo;
    const processing = disabled; 

    thresholdTypeSelect.disabled = processing || !imageLoaded;

    thresholdSlider.disabled = processing || !imageLoaded || currentThresholdSettings.type !== 'manual';

    adaptiveBlocksizeInput.disabled = processing || !imageLoaded || !currentThresholdSettings.type.startsWith('adaptive-');
    adaptiveCInput.disabled = processing || !imageLoaded || !currentThresholdSettings.type.startsWith('adaptive-');

    minSizeSlider.disabled = processing || !imageLoaded;

    debugViewCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);
    debugOverlayCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);

    processButton.disabled = processing || !imageLoaded;
    generateSpritesheetButton.disabled = processing || !imageLoaded;

    gridColsInput.disabled = processing || !imageLoaded;
    paddingInput.disabled = processing || !imageLoaded;
    alignmentSelect.disabled = processing || !imageLoaded;

    if (processing || !generatedSpritesheetCanvas) {
         downloadSpritesheetButton.disabled = true;
     } else {
         downloadSpritesheetButton.disabled = false;
     }

    zoomInButton.disabled = processing || !imageLoaded;
    zoomOutButton.disabled = processing || !imageLoaded;

    imageUploadInput.disabled = processing && imageLoaded;

    updateThresholdSettingsUI();
}

// Clears all processing results and generated data, keeps original image if loaded
function clearProcessingResults() {
    console.log("Clearing processing results...");
    grayscaleImageData = null;
    thresholdedImageData = null; 
    cclResult = null;
    detectedBlobs = [];
    clearGeneratedSpritesheet();
    clearOverlays(debugOverlaysContainer);
    debugViewCheckboxes.forEach(cb => cb.checked = false);
    debugOverlayCheckboxes.forEach(cb => cb.checked = false);
     if (originalImageData) {
         const ctx = imagePreviewCanvas.getContext('2d');
         imagePreviewCanvas.width = originalImageData.width;
         imagePreviewCanvas.height = originalImageData.height;
         ctx.putImageData(originalImageData, 0, 0);
         updateImageDisplay();
     } else {
         const ctx = imagePreviewCanvas.getContext('2d');
         ctx.clearRect(0, 0, imagePreviewCanvas.width, imagePreviewCanvas.height);
         imagePreviewCanvas.width = 1;
         imagePreviewCanvas.height = 1;
     }
}

// Clears everything including the loaded image and resets UI fully
function clearStateBeforeLoad() {
     console.log("Clearing full state.");
     originalImageInfo = null;
     originalImageData = null;
     clearProcessingResults(); 

     currentThresholdSettings = {
        type: 'manual',
        manualValue: 128,
        adaptiveBlockSize: 11,
        adaptiveC: 2
    };
    if (thresholdTypeSelect) thresholdTypeSelect.value = 'manual'; 
    updateThresholdSettingsUI();

    if (imagePreviewCanvas) {
        const ctx = imagePreviewCanvas.getContext('2d');
        imagePreviewCanvas.style.transform = ''; 
        ctx.clearRect(0, 0, imagePreviewCanvas.width, imagePreviewCanvas.height);
        imagePreviewCanvas.width = 1;
        imagePreviewCanvas.height = 1;
    }
    if (debugOverlaysContainer) {
        clearOverlays(debugOverlaysContainer); 
        debugOverlaysContainer.style.transform = ''; 
        debugOverlaysContainer.style.width = '0px';
        debugOverlaysContainer.style.height = '0px';
    }

     resetZoomPan(); 

     processingStatusDiv.textContent = 'Upload an image to start.';
}

// Clears the generated spritesheet
function clearGeneratedSpritesheet() {
    generatedSpritesheetCanvas = null; 
    if (spritesheetPreviewCanvas) {
        const ctx = spritesheetPreviewCanvas.getContext('2d');
        spritesheetPreviewCanvas.width = 1;
        spritesheetPreviewCanvas.height = 1;
        ctx.clearRect(0, 0, 1, 1);
    }
    downloadSpritesheetButton.disabled = true; 
     console.log("Spritesheet cleared.");
}

// Utility to pause execution slightly to allow UI updates 
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}