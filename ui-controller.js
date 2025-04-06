import { loadImage, getImageDataFromCanvas } from 'image-loader';
import { getGrayscaleImageData, getThresholdedImageData } from 'image-processor';
import { findBlobs, getLabeledImageData } from 'blob-detector';
import { previewSpritesheetLayout, generateSpritesheet, downloadCanvasAsPNG } from 'spritesheet-generator';
import { drawBoundingBoxes, clearOverlays } from 'utils'; // Assuming utils has drawing helpers

// --- State Variables ---
let originalImage = null;
let originalImageData = null;
let grayscaleImageData = null; // Store for reuse
let thresholdedImageData = null; // Store for reuse
let cclLabels = null; // Store CCL result labels
let detectedBlobs = []; // Store detected blobs
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let spritesheetDimensions = { sheetWidth: 0, sheetHeight: 0 }; // Store calculated dimensions


// --- DOM Element References ---
let imageUploadInput, imagePreviewCanvas, imagePreviewContainer, debugOverlaysContainer;
let thresholdSlider, thresholdValueSpan, minSizeSlider, minSizeValueSpan;
let showGrayscaleCheckbox, showThresholdCheckbox, showCclCheckbox, showBboxesCheckbox;
let processButton, processingStatusDiv;
let gridColsInput, paddingInput, alignmentSelect;
let previewSpritesheetButton, spritesheetPreviewCanvas, spritesheetPreviewContainer, downloadSpritesheetButton;
let zoomInButton, zoomOutButton;


// --- Initialization ---
export function initUI() {
    // Get DOM elements
    imageUploadInput = document.getElementById('image-upload');
    imagePreviewCanvas = document.getElementById('image-preview-canvas');
    imagePreviewContainer = document.getElementById('image-preview-container');
    debugOverlaysContainer = document.getElementById('debug-overlays');
    thresholdSlider = document.getElementById('threshold-slider');
    thresholdValueSpan = document.getElementById('threshold-value');
    minSizeSlider = document.getElementById('min-sprite-size-slider');
    minSizeValueSpan = document.getElementById('min-sprite-size-value');
    showGrayscaleCheckbox = document.getElementById('show-grayscale-checkbox');
    showThresholdCheckbox = document.getElementById('show-threshold-checkbox');
    showCclCheckbox = document.getElementById('show-ccl-checkbox');
    showBboxesCheckbox = document.getElementById('show-bboxes-checkbox');
    processButton = document.getElementById('process-button');
    processingStatusDiv = document.getElementById('processing-status');
    gridColsInput = document.getElementById('grid-cols-input');
    paddingInput = document.getElementById('padding-input');
    alignmentSelect = document.getElementById('alignment-select');
    previewSpritesheetButton = document.getElementById('preview-spritesheet-button');
    spritesheetPreviewCanvas = document.getElementById('spritesheet-preview-canvas');
    spritesheetPreviewContainer = document.getElementById('spritesheet-preview-container');
    downloadSpritesheetButton = document.getElementById('download-spritesheet-button');
    zoomInButton = document.getElementById('zoom-in-button');
    zoomOutButton = document.getElementById('zoom-out-button');


    // Add event listeners
    imageUploadInput.addEventListener('change', handleImageUpload);
    thresholdSlider.addEventListener('input', handleThresholdChange);
    minSizeSlider.addEventListener('input', handleMinSizeChange);
    processButton.addEventListener('click', handleProcessImage);

    showGrayscaleCheckbox.addEventListener('change', updateDebugOverlays);
    showThresholdCheckbox.addEventListener('change', updateDebugOverlays);
    showCclCheckbox.addEventListener('change', updateDebugOverlays);
    showBboxesCheckbox.addEventListener('change', updateDebugOverlays);

    previewSpritesheetButton.addEventListener('click', handlePreviewSpritesheet);
    downloadSpritesheetButton.addEventListener('click', handleDownloadSpritesheet);

    // Zoom and Pan Listeners
    zoomInButton.addEventListener('click', () => applyZoom(1.2));
    zoomOutButton.addEventListener('click', () => applyZoom(1 / 1.2));
    imagePreviewContainer.addEventListener('mousedown', startPan);
    imagePreviewContainer.addEventListener('mousemove', pan);
    imagePreviewContainer.addEventListener('mouseup', endPan);
    imagePreviewContainer.addEventListener('mouseleave', endPan);
    imagePreviewContainer.addEventListener('wheel', handleWheelZoom, { passive: false }); // Prevent page scroll


     // Initial state updates
    thresholdValueSpan.textContent = thresholdSlider.value;
    minSizeValueSpan.textContent = minSizeSlider.value;
    disableProcessingControls(true); // Disable until image loaded
    downloadSpritesheetButton.disabled = true; // Disable download initially

    console.log("UI Initialized");
}

// --- Event Handlers ---

async function handleImageUpload() {
    console.log("Handling image upload...");
    clearState(); // Clear previous results
    disableProcessingControls(true);
    processingStatusDiv.textContent = 'Loading image...';

    try {
        originalImage = await loadImage(imageUploadInput, imagePreviewCanvas);
        originalImageData = getImageDataFromCanvas(imagePreviewCanvas);
        resetZoomPan(); // Reset zoom/pan for new image
        updateImageDisplay(); // Apply initial zoom/pan
        processingStatusDiv.textContent = 'Image loaded. Adjust settings and click "Detect Sprites".';
        disableProcessingControls(false); // Enable processing button
        console.log("Image loaded successfully.");
    } catch (error) {
        processingStatusDiv.textContent = `Error: ${error.message}`;
        console.error("Image loading failed:", error);
        alert(`Error loading image: ${error.message}`);
        clearState(); // Clear potentially inconsistent state
    }
}

function handleThresholdChange() {
    thresholdValueSpan.textContent = thresholdSlider.value;
    // Invalidate previous threshold/CCL results if they exist
    thresholdedImageData = null;
    cclLabels = null;
    detectedBlobs = [];
    // Update overlays immediately if threshold checkbox is active
    if (showThresholdCheckbox.checked) {
        updateDebugOverlays();
    }
     clearSpritesheetPreview(); // Settings changed, clear preview
}

function handleMinSizeChange() {
    minSizeValueSpan.textContent = minSizeSlider.value;
     // Invalidate previous CCL results if they exist (blobs need refiltering)
     detectedBlobs = []; // Blobs need recalculating based on new min size
     // Update overlays immediately if bbox checkbox is active
     if (showBboxesCheckbox.checked) {
         updateDebugOverlays();
     }
      clearSpritesheetPreview(); // Settings changed, clear preview
}

async function handleProcessImage() {
    if (!originalImageData) {
        alert("Please upload an image first.");
        return;
    }

    console.log("Starting image processing...");
    disableProcessingControls(true);
    processingStatusDiv.textContent = 'Processing: Grayscale...';
    await wait(10); // Allow UI update

    // 1. Grayscale (only if needed or checkbox is checked)
    if (!grayscaleImageData) {
        grayscaleImageData = getGrayscaleImageData(originalImageData);
         console.log("Generated grayscale data.");
    } else {
        console.log("Using cached grayscale data.");
    }

    processingStatusDiv.textContent = 'Processing: Thresholding...';
    await wait(10);

    // 2. Thresholding (always recalculate based on current slider value)
    const threshold = parseInt(thresholdSlider.value, 10);
    // Create a *copy* of grayscale for thresholding, preserving grayscaleImageData
     const grayscaleCopyForThreshold = new ImageData(
        new Uint8ClampedArray(grayscaleImageData.data),
        grayscaleImageData.width,
        grayscaleImageData.height
    );
    thresholdedImageData = getThresholdedImageData(grayscaleCopyForThreshold, threshold); // Creates a new ImageData
    console.log(`Generated thresholded data with threshold ${threshold}.`);


    processingStatusDiv.textContent = 'Processing: Finding Blobs (CCL)...';
    await wait(10);

    // 3. Blob Detection (CCL)
    const minSize = parseInt(minSizeSlider.value, 10);
    const startTime = performance.now();
    const cclResult = findBlobs(thresholdedImageData, minSize); // findBlobs now filters by minSize
    const endTime = performance.now();
    detectedBlobs = cclResult.blobs;
    cclLabels = cclResult.labels; // Store labels for visualization
    console.log(`Found ${detectedBlobs.length} blobs (minSize: ${minSize}) in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);


    processingStatusDiv.textContent = `Processing complete. Found ${detectedBlobs.length} sprites. Update Spritesheet Preview.`;
    disableProcessingControls(false);
    clearSpritesheetPreview(); // Clear old preview, require new click
    downloadSpritesheetButton.disabled = true; // Require preview before download


    // 4. Update Debug Overlays (automatically displays results based on checkboxes)
    updateDebugOverlays();
     console.log("Processing finished.");

}

function handlePreviewSpritesheet() {
     if (!detectedBlobs || detectedBlobs.length === 0) {
        alert("No sprites detected or processed yet. Click 'Detect Sprites' first.");
        return;
    }
    if (!originalImageData) {
         alert("Original image data is missing.");
         return;
    }

    console.log("Generating spritesheet preview...");
    processingStatusDiv.textContent = 'Generating spritesheet preview...';


    const cols = parseInt(gridColsInput.value, 10) || 8; // Default to 8 if invalid
    const padding = parseInt(paddingInput.value, 10) || 0; // Default to 0 if invalid
    const alignment = alignmentSelect.value;

    // Use the preview function first to calculate dimensions and draw placeholders
    spritesheetDimensions = previewSpritesheetLayout(
        spritesheetPreviewCanvas,
        detectedBlobs,
        cols,
        padding,
        alignment
    );

    // Now, optionally, generate the *actual* spritesheet onto the same canvas
    // If performance is an issue, we could keep preview and generation separate.
    // For simplicity now, we'll overwrite the preview canvas with the real one.
     generateSpritesheet(
        spritesheetPreviewCanvas, // Draw onto the preview canvas
        originalImageData,
        detectedBlobs,
        cols,
        padding,
        alignment,
        spritesheetDimensions.sheetWidth,
        spritesheetDimensions.sheetHeight
    ).then(() => {
        processingStatusDiv.textContent = `Spritesheet preview generated (${detectedBlobs.length} sprites). Ready to download.`;
        downloadSpritesheetButton.disabled = false; // Enable download
        console.log("Spritesheet preview generation complete.");
    }).catch(error => {
        processingStatusDiv.textContent = 'Error generating spritesheet preview.';
        console.error("Spritesheet preview generation failed:", error);
        alert("Error generating spritesheet preview.");
         downloadSpritesheetButton.disabled = true;
    });

}


function handleDownloadSpritesheet() {
    if (spritesheetPreviewCanvas.width <= 1 || spritesheetPreviewCanvas.height <= 1) {
         alert("Please generate or preview the spritesheet first.");
        return;
    }
     console.log("Preparing spritesheet download...");
    downloadCanvasAsPNG(spritesheetPreviewCanvas, 'spritcher_spritesheet.png');
}


// --- Zoom and Pan ---

function applyZoom(factor) {
    const newZoom = Math.max(0.1, Math.min(10, currentZoom * factor)); // Clamp zoom level
     // Calculate zoom point relative to container center
    const rect = imagePreviewContainer.getBoundingClientRect();
    const containerCenterX = rect.width / 2;
    const containerCenterY = rect.height / 2;

    // Calculate image coordinates under container center BEFORE zoom
    const imageXBefore = (containerCenterX - panX) / currentZoom;
    const imageYBefore = (containerCenterY - panY) / currentZoom;

     currentZoom = newZoom;

     // Calculate where the image point should be AFTER zoom to stay centered
    panX = containerCenterX - imageXBefore * currentZoom;
    panY = containerCenterY - imageYBefore * currentZoom;


    // panX *= factor; // Scale existing pan
    // panY *= factor; // Scale existing pan
    updateImageDisplay();
}

function handleWheelZoom(event) {
    event.preventDefault(); // Prevent default page scrolling
    const delta = event.deltaY > 0 ? 1 / 1.1 : 1.1; // Zoom out for scroll down, in for scroll up

     const rect = imagePreviewContainer.getBoundingClientRect();
    // Calculate mouse position relative to container
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

     // Calculate image coordinates under mouse BEFORE zoom
    const imageXBefore = (mouseX - panX) / currentZoom;
    const imageYBefore = (mouseY - panY) / currentZoom;

    const newZoom = Math.max(0.1, Math.min(10, currentZoom * delta));
    currentZoom = newZoom;


     // Calculate new panX/panY to keep the image point under the mouse stationary
    panX = mouseX - imageXBefore * currentZoom;
    panY = mouseY - imageYBefore * currentZoom;

    updateImageDisplay();
}


function startPan(event) {
     // Only pan with left mouse button
     if (event.button !== 0) return;
    isPanning = true;
    startPanX = event.clientX - panX;
    startPanY = event.clientY - panY;
    imagePreviewContainer.style.cursor = 'grabbing';
}

function pan(event) {
    if (!isPanning) return;
    panX = event.clientX - startPanX;
    panY = event.clientY - startPanY;
    updateImageDisplay();
}

function endPan() {
    if (isPanning) {
         isPanning = false;
         imagePreviewContainer.style.cursor = 'grab';
    }
}

function resetZoomPan() {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    // Fit image initially - find scale to fit within container bounds
     if (originalImage && imagePreviewContainer) {
        const containerWidth = imagePreviewContainer.clientWidth;
        const containerHeight = imagePreviewContainer.clientHeight;
        const imageWidth = originalImage.naturalWidth;
        const imageHeight = originalImage.naturalHeight;

         if (imageWidth > 0 && imageHeight > 0) {
            const scaleX = containerWidth / imageWidth;
            const scaleY = containerHeight / imageHeight;
            currentZoom = Math.min(scaleX, scaleY, 1); // Fit within bounds, max zoom 1 initially

             // Center the image
            panX = (containerWidth - imageWidth * currentZoom) / 2;
            panY = (containerHeight - imageHeight * currentZoom) / 2;

         }
    }
    updateImageDisplay();
}


function updateImageDisplay() {
    if (!imagePreviewCanvas) return;
    imagePreviewCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    // Also update debug overlays transform
     debugOverlaysContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
     // Adjust overlay container size to match scaled canvas (needed for absolute positioning)
     if (originalImage) {
        debugOverlaysContainer.style.width = `${originalImage.naturalWidth}px`;
        debugOverlaysContainer.style.height = `${originalImage.naturalHeight}px`;
     }

}

// --- Debugging ---

function updateDebugOverlays() {
    if (!originalImageData) return; // Need original image dimensions

    clearOverlays(debugOverlaysContainer); // Clear existing overlays first

    const ctx = imagePreviewCanvas.getContext('2d');
    const width = originalImageData.width;
    const height = originalImageData.height;

    // Determine which image data to show on the main canvas
    let baseImageDataToShow = originalImageData; // Default to original
    if (showGrayscaleCheckbox.checked && grayscaleImageData) {
        baseImageDataToShow = grayscaleImageData;
    }
    if (showThresholdCheckbox.checked && thresholdedImageData) {
        // Threshold takes precedence if both are checked
        baseImageDataToShow = thresholdedImageData;
    }
    if (showCclCheckbox.checked && cclLabels) {
         // If CCL is checked, show the labeled image instead of grayscale/threshold
        const labeledImageData = getLabeledImageData(cclLabels, width, height);
        baseImageDataToShow = labeledImageData;
    }

    // Redraw the base image on the canvas
    // Create a temporary canvas to put the ImageData, then drawImage onto the main one
    // This is often faster than putImageData directly onto the potentially transformed canvas.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(baseImageDataToShow, 0, 0);

     // Clear main canvas before drawing potentially new base image
    imagePreviewCanvas.width = width; // Ensure canvas size matches image data
    imagePreviewCanvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tempCanvas, 0, 0);


    // Add bounding box overlays if checked AND blobs exist
    if (showBboxesCheckbox.checked && detectedBlobs.length > 0) {
        console.log(`Drawing ${detectedBlobs.length} bounding boxes.`);
         // Draw bounding boxes in the separate overlay container
         drawBoundingBoxes(debugOverlaysContainer, detectedBlobs.map(b => b.bounds), 'red');
    }

     console.log("Debug overlays updated.");
}


// --- Helper Functions ---

function disableProcessingControls(disabled) {
    thresholdSlider.disabled = disabled;
    minSizeSlider.disabled = disabled;
    processButton.disabled = disabled;
    previewSpritesheetButton.disabled = disabled;
     // Keep sprite sheet controls enabled unless specifically processing
    // gridColsInput.disabled = disabled;
    // paddingInput.disabled = disabled;
    // alignmentSelect.disabled = disabled;

     // Don't disable download button here, its state depends on preview generation
     // downloadSpritesheetButton.disabled = disabled;
}

function clearState() {
    console.log("Clearing state.");
    originalImage = null;
    originalImageData = null;
    grayscaleImageData = null;
    thresholdedImageData = null;
    cclLabels = null;
    detectedBlobs = [];
    spritesheetDimensions = { sheetWidth: 0, sheetHeight: 0 };


     // Clear canvas and overlays
    if (imagePreviewCanvas) {
        const ctx = imagePreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, imagePreviewCanvas.width, imagePreviewCanvas.height);
        imagePreviewCanvas.width = 1; // Reset size
        imagePreviewCanvas.height = 1;
    }
     clearOverlays(debugOverlaysContainer);
    resetZoomPan(); // Reset zoom/pan as well
    updateImageDisplay(); // Apply reset

     clearSpritesheetPreview();

     // Reset UI elements
    imageUploadInput.value = ''; // Clear file input
    processingStatusDiv.textContent = 'Upload an image to start.';
    downloadSpritesheetButton.disabled = true;

}

function clearSpritesheetPreview() {
    if (spritesheetPreviewCanvas) {
        const ctx = spritesheetPreviewCanvas.getContext('2d');
         spritesheetPreviewCanvas.width = 1; // Reset size to avoid showing old large canvas
        spritesheetPreviewCanvas.height = 1;
        ctx.clearRect(0, 0, 1, 1);
    }
    downloadSpritesheetButton.disabled = true; // Disable download if preview is cleared
     console.log("Spritesheet preview cleared.");
}


// Utility to pause execution slightly to allow UI updates
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

import { loadImage, getImageDataFromCanvas } from 'image-loader';
import { getGrayscaleImageData, getThresholdedImageData } from 'image-processor';
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
let previewSpritesheetButton, spritesheetPreviewCanvas, spritesheetPreviewContainer, downloadSpritesheetButton;
let zoomInButton, zoomOutButton;


// --- Initialization ---
export function initUI() {
    // Get DOM elements
    imageUploadInput = document.getElementById('image-upload');
    imagePreviewCanvas = document.getElementById('image-preview-canvas');
    imagePreviewContainer = document.getElementById('image-preview-container');
    debugOverlaysContainer = document.getElementById('debug-overlays');
    thresholdSlider = document.getElementById('threshold-slider');
    thresholdValueSpan = document.getElementById('threshold-value');
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
    // Renamed preview button to generate button
    previewSpritesheetButton = document.getElementById('preview-spritesheet-button');
    spritesheetPreviewCanvas = document.getElementById('spritesheet-preview-canvas');
    spritesheetPreviewContainer = document.getElementById('spritesheet-preview-container');
    downloadSpritesheetButton = document.getElementById('download-spritesheet-button');
    zoomInButton = document.getElementById('zoom-in-button');
    zoomOutButton = document.getElementById('zoom-out-button');


    // Add event listeners
    imageUploadInput.addEventListener('change', handleImageUpload);
    thresholdSlider.addEventListener('input', handleThresholdChange);
    minSizeSlider.addEventListener('input', handleMinSizeChange);
    processButton.addEventListener('click', handleProcessImage);

    // Add listeners to all debug checkboxes
    debugViewCheckboxes.forEach(cb => cb.addEventListener('change', handleDebugViewChange));
    debugOverlayCheckboxes.forEach(cb => cb.addEventListener('change', updateDebugOverlays)); // Overlays update independently

    // Spritesheet controls trigger clearing the generated sheet
    gridColsInput.addEventListener('change', handleSpritesheetSettingsChange);
    paddingInput.addEventListener('change', handleSpritesheetSettingsChange);
    alignmentSelect.addEventListener('change', handleSpritesheetSettingsChange);

    previewSpritesheetButton.addEventListener('click', handleGenerateSpritesheet); // Changed name
    downloadSpritesheetButton.addEventListener('click', handleDownloadSpritesheet);

    // Zoom and Pan Listeners
    zoomInButton.addEventListener('click', () => zoomAtPoint(imagePreviewContainer.clientWidth / 2, imagePreviewContainer.clientHeight / 2, 1.2));
    zoomOutButton.addEventListener('click', () => zoomAtPoint(imagePreviewContainer.clientWidth / 2, imagePreviewContainer.clientHeight / 2, 1 / 1.2));
    imagePreviewContainer.addEventListener('mousedown', startPan);
    imagePreviewContainer.addEventListener('mousemove', pan);
    imagePreviewContainer.addEventListener('mouseup', endPan);
    imagePreviewContainer.addEventListener('mouseleave', endPan); // Important to end pan if mouse leaves container
    imagePreviewContainer.addEventListener('wheel', handleWheelZoom, { passive: false }); // Prevent page scroll


     // Initial state updates
    thresholdValueSpan.textContent = thresholdSlider.value;
    minSizeValueSpan.textContent = minSizeSlider.value;
    disableControls(true); // Disable most controls until image loaded

    console.log("UI Initialized");
}

// --- Event Handlers ---

async function handleImageUpload() {
    console.log("Handling image upload...");
    clearStateBeforeLoad();
    processingStatusDiv.textContent = 'Loading image...';
    disableControls(true); // Keep disabled during load

    try {
        originalImageInfo = await loadImage(imageUploadInput, imagePreviewCanvas); // returns { img, naturalWidth, naturalHeight }
        originalImageData = getImageDataFromCanvas(imagePreviewCanvas);

        if (!originalImageData) {
             throw new Error("Could not get image pixel data after loading.");
        }

        resetZoomPan(); // Fit and center the new image
        updateImageDisplay(); // Apply initial zoom/pan transform

        processingStatusDiv.textContent = 'Image loaded. Adjust settings and click "Detect Sprites".';
        disableControls(false); // Enable controls now
         clearGeneratedSpritesheet(); // Ensure previous sheet is gone

        console.log("Image loaded successfully.");
    } catch (error) {
        processingStatusDiv.textContent = `Error: ${error.message}`;
        console.error("Image loading failed:", error);
        alert(`Error loading image: ${error.message}`);
        clearStateBeforeLoad(); // Ensure clean state on failure
        disableControls(true); // Remain disabled
    }
}

// Handles changes to threshold slider
function handleThresholdChange() {
    thresholdValueSpan.textContent = thresholdSlider.value;
    // Invalidate subsequent processing steps
    thresholdedImageData = null;
    cclResult = null;
    detectedBlobs = [];
    clearGeneratedSpritesheet();
    // Update view immediately ONLY if threshold view is active
    if (document.getElementById('show-threshold-checkbox').checked) {
        updateDebugView(); // Regenerate thresholded view if needed
    }
     // BBoxes depend on threshold, so clear them if shown
    if (document.getElementById('show-bboxes-checkbox').checked) {
         clearOverlays(debugOverlaysContainer); // Clear bounding box overlays
     }

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
         // Ideally, we'd just refilter blobs, but for simplicity now,
         // indicate processing is needed again or clear overlays.
         clearOverlays(debugOverlaysContainer); // Clear bounding box overlays
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
    disableControls(true); // Disable UI during processing
    processingStatusDiv.textContent = 'Processing: Grayscale...';
    await wait(10); // Allow UI update

    // --- 1. Grayscale ---
    // Always generate from original if not cached or if original exists
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
    // Always recalculate based on current slider value using the grayscale version
    const threshold = parseInt(thresholdSlider.value, 10);
    thresholdedImageData = getThresholdedImageData(grayscaleImageData, threshold); // Creates a new ImageData
    console.log(`Generated thresholded data with threshold ${threshold}.`);


    processingStatusDiv.textContent = 'Processing: Finding Blobs (CCL)...';
    await wait(10);

    // --- 3. Blob Detection (CCL) ---
    const minSize = parseInt(minSizeSlider.value, 10);
    const startTime = performance.now();
    try {
        cclResult = findBlobs(thresholdedImageData, minSize); // Returns { blobs, labels }
        detectedBlobs = cclResult ? cclResult.blobs : []; // Store blobs separately
    } catch(error) {
        console.error("Error during blob detection:", error);
        processingStatusDiv.textContent = `Error during blob detection: ${error.message}`;
        cclResult = null;
        detectedBlobs = [];
        disableControls(false); // Re-enable controls on error
        return; // Stop processing
    }
    const endTime = performance.now();
    console.log(`CCL completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);


    processingStatusDiv.textContent = `Processing complete. Found ${detectedBlobs.length} sprites. Ready to generate spritesheet.`;
    disableControls(false); // Re-enable UI
    clearGeneratedSpritesheet(); // Clear old spritesheet, require new generation

    // --- 4. Update Debug Views/Overlays ---
    // Update the main canvas view based on checkboxes first
    updateDebugView();
    // Then update the overlays (like bounding boxes)
    updateDebugOverlays();

    console.log("Processing pipeline finished.");
}

// Handler for Debug VIEW checkboxes (Grayscale, Threshold, CCL)
function handleDebugViewChange(event) {
    // Uncheck other view checkboxes if one is checked
    if (event.target.checked) {
        debugViewCheckboxes.forEach(cb => {
            if (cb !== event.target) {
                cb.checked = false;
            }
        });
    }
    updateDebugView(); // Update the main canvas display
}

// Update the main canvas based on which debug VIEW checkbox is checked
function updateDebugView() {
    if (!originalImageData) return; // Nothing to show if no image

    const ctx = imagePreviewCanvas.getContext('2d');
    const width = originalImageData.width;
    const height = originalImageData.height;

    let imageDataToShow = originalImageData; // Default to original

    if (document.getElementById('show-grayscale-checkbox').checked) {
        if (!grayscaleImageData) {
            console.warn("Grayscale data requested but not generated. Run 'Detect Sprites' first.");
             processingStatusDiv.textContent = "Grayscale view requires 'Detect Sprites'.";
             // Optionally fall back to original or do nothing
        } else {
            imageDataToShow = grayscaleImageData;
        }
    } else if (document.getElementById('show-threshold-checkbox').checked) {
         if (!thresholdedImageData) {
            console.warn("Thresholded data requested but not generated. Run 'Detect Sprites' first.");
             processingStatusDiv.textContent = "Threshold view requires 'Detect Sprites'.";
        } else {
            imageDataToShow = thresholdedImageData;
        }
    } else if (document.getElementById('show-ccl-checkbox').checked) {
         if (!cclResult || !cclResult.labels) {
            console.warn("CCL data requested but not generated. Run 'Detect Sprites' first.");
            processingStatusDiv.textContent = "CCL view requires 'Detect Sprites'.";
        } else {
            // Generate colored label image on demand
             imageDataToShow = getLabeledImageData(cclResult.labels, width, height);
        }
    }
     // else: No view checkbox checked, imageDataToShow remains originalImageData

    // Redraw the base image on the canvas using the selected ImageData
    // Ensure canvas size matches image data dimensions before drawing
    imagePreviewCanvas.width = width;
    imagePreviewCanvas.height = height;

    // Use a temporary canvas for putImageData, then drawImage (can be more performant)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageDataToShow, 0, 0);

    ctx.clearRect(0, 0, width, height); // Clear previous content
    ctx.drawImage(tempCanvas, 0, 0);

    console.log("Debug view updated.");
     // Note: This redraws the canvas, zoom/pan transform needs to be reapplied by updateImageDisplay if called separately
     // Or ensure updateImageDisplay is called after this if needed. Currently called on zoom/pan actions.
}


// Update overlays (bounding boxes) based on checkbox state
function updateDebugOverlays() {
     clearOverlays(debugOverlaysContainer); // Clear existing overlays first

     if (document.getElementById('show-bboxes-checkbox').checked) {
        if (detectedBlobs && detectedBlobs.length > 0) {
             console.log(`Drawing ${detectedBlobs.length} bounding boxes.`);
             // Draw bounding boxes in the separate overlay container
             drawBoundingBoxes(debugOverlaysContainer, detectedBlobs.map(b => b.bounds), 'red');
        } else {
             console.log("Bounding box overlay enabled, but no blobs detected or processed yet.");
              processingStatusDiv.textContent = "Bounding box view requires 'Detect Sprites'.";
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
    disableControls(true); // Disable UI during generation

    const cols = parseInt(gridColsInput.value, 10) || 8;
    const padding = parseInt(paddingInput.value, 10) || 0;
    const alignment = alignmentSelect.value;

    try {
        // generateSpritesheet now returns the canvas element
        generatedSpritesheetCanvas = await generateSpritesheet(
            originalImageData,
            detectedBlobs,
            cols,
            padding,
            alignment
        );

        // Display the generated canvas in the preview area
        const previewCtx = spritesheetPreviewCanvas.getContext('2d');
        spritesheetPreviewCanvas.width = generatedSpritesheetCanvas.width;
        spritesheetPreviewCanvas.height = generatedSpritesheetCanvas.height;
        previewCtx.clearRect(0, 0, generatedSpritesheetCanvas.width, generatedSpritesheetCanvas.height); // Clear previous preview
        previewCtx.drawImage(generatedSpritesheetCanvas, 0, 0);

        processingStatusDiv.textContent = `Spritesheet generated (${detectedBlobs.length} sprites). Ready to download.`;
        downloadSpritesheetButton.disabled = false; // Enable download
        console.log("Spritesheet generation and preview complete.");

    } catch (error) {
        console.error("Spritesheet generation failed:", error);
        processingStatusDiv.textContent = `Error generating spritesheet: ${error.message}`;
        alert(`Error generating spritesheet: ${error.message}`);
        clearGeneratedSpritesheet(); // Clear potentially broken state
    } finally {
        disableControls(false); // Re-enable UI
    }
}


function handleDownloadSpritesheet() {
    if (!generatedSpritesheetCanvas) {
         alert("Please generate the spritesheet first using the 'Generate Spritesheet' button.");
        return;
    }
     console.log("Preparing spritesheet download...");
    // Suggest a filename based on the original image name if possible
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
    if (!originalImageInfo) return; // Cannot zoom without an image

    const newZoom = Math.max(0.1, Math.min(10, currentZoom * factor)); // Clamp zoom level

    // Calculate image coordinates under the zoom point BEFORE zoom
    const imageXBefore = (containerX - panX) / currentZoom;
    const imageYBefore = (containerY - panY) / currentZoom;

    // Calculate the new panX/panY to keep the image point under the container point
    const newPanX = containerX - imageXBefore * newZoom;
    const newPanY = containerY - imageYBefore * newZoom;

    // Apply the new zoom and pan
    currentZoom = newZoom;
    panX = newPanX;
    panY = newPanY;

    updateImageDisplay();
}

function handleWheelZoom(event) {
    event.preventDefault(); // Prevent default page scrolling
    const delta = event.deltaY > 0 ? 1 / 1.1 : 1.1; // Zoom out for scroll down, in for scroll up

    const rect = imagePreviewContainer.getBoundingClientRect();
    // Calculate mouse position relative to container
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    zoomAtPoint(mouseX, mouseY, delta); // Zoom centered on mouse pointer
}

function startPan(event) {
     // Only pan with left mouse button (button 0)
     if (event.button !== 0 || !originalImageInfo) return;
    isPanning = true;
    startPanX = event.clientX; // Store mouse position at start
    startPanY = event.clientY;
    startViewX = panX; // Store pan position at start
    startViewY = panY;
    imagePreviewContainer.style.cursor = 'grabbing';
    // Prevent text selection during drag
    event.preventDefault();
}

function pan(event) {
    if (!isPanning) return;
    // Calculate mouse movement since start
    const dx = event.clientX - startPanX;
    const dy = event.clientY - startPanY;
    // Update pan based on initial pan + mouse movement
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
            // Calculate scale to fit while preserving aspect ratio
            const scaleX = containerWidth / imageWidth;
            const scaleY = containerHeight / imageHeight;
            currentZoom = Math.min(scaleX, scaleY, 1); // Fit within bounds, max initial zoom 1

            // Center the scaled image
            panX = (containerWidth - imageWidth * currentZoom) / 2;
            panY = (containerHeight - imageHeight * currentZoom) / 2;
         }
    } else {
        // Default if no image or container size
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

     // Adjust overlay container size to match the natural image size
     // This ensures overlay elements (like bboxes) are positioned correctly relative to the image pixels
     if (originalImageInfo) {
        debugOverlaysContainer.style.width = `${originalImageInfo.naturalWidth}px`;
        debugOverlaysContainer.style.height = `${originalImageInfo.naturalHeight}px`;
     } else {
         debugOverlaysContainer.style.width = `0px`;
        debugOverlaysContainer.style.height = `0px`;
     }
}


// --- Helper Functions ---

// Disables/enables controls that shouldn't be active without an image or during processing
function disableControls(disabled) {
    // Settings
    thresholdSlider.disabled = disabled;
    minSizeSlider.disabled = disabled;
    // Debug toggles (allow toggling even if processing needed again)
    // debugViewCheckboxes.forEach(cb => cb.disabled = disabled);
    // debugOverlayCheckboxes.forEach(cb => cb.disabled = disabled);

    // Actions
    processButton.disabled = disabled;
    previewSpritesheetButton.disabled = disabled; // Generate button

    // Spritesheet Generation Settings (allow changing anytime, effect requires regenerate)
    // gridColsInput.disabled = disabled;
    // paddingInput.disabled = disabled;
    // alignmentSelect.disabled = disabled;

    // Download button state is managed separately based on generation success
     if (disabled) {
         downloadSpritesheetButton.disabled = true;
     } else {
         // Only re-enable download if a spritesheet actually exists
         downloadSpritesheetButton.disabled = !generatedSpritesheetCanvas;
     }


     // Zoom controls only active if image loaded
     const imageLoaded = !!originalImageInfo;
    zoomInButton.disabled = disabled || !imageLoaded;
    zoomOutButton.disabled = disabled || !imageLoaded;
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
     // Reset debug view checkboxes to unchecked
    debugViewCheckboxes.forEach(cb => cb.checked = false);
    debugOverlayCheckboxes.forEach(cb => cb.checked = false);
     // Restore main canvas view to original image if available
     if (originalImageData) {
         const ctx = imagePreviewCanvas.getContext('2d');
         imagePreviewCanvas.width = originalImageData.width;
         imagePreviewCanvas.height = originalImageData.height;
         ctx.putImageData(originalImageData, 0, 0);
     }
}

// Clears everything including the loaded image and resets UI fully
function clearStateBeforeLoad() {
     console.log("Clearing full state.");
     originalImageInfo = null;
     originalImageData = null;
     clearProcessingResults(); // Clear derived data

    // Clear canvas
    if (imagePreviewCanvas) {
        const ctx = imagePreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, imagePreviewCanvas.width, imagePreviewCanvas.height);
         // Reset dimensions to avoid showing old scaled canvas visually
        imagePreviewCanvas.width = 1;
        imagePreviewCanvas.height = 1;
         imagePreviewCanvas.style.transform = ''; // Reset transform
    }
    if (debugOverlaysContainer) {
        debugOverlaysContainer.style.transform = ''; // Reset transform
        debugOverlaysContainer.style.width = '0px';
        debugOverlaysContainer.style.height = '0px';
    }

     resetZoomPan(); // Reset zoom/pan values

     // Reset UI elements
    // imageUploadInput.value = ''; // Don't clear this, user might retry same file
    processingStatusDiv.textContent = 'Upload an image to start.';
}


function clearGeneratedSpritesheet() {
    generatedSpritesheetCanvas = null; // Clear the stored canvas object
    if (spritesheetPreviewCanvas) {
        const ctx = spritesheetPreviewCanvas.getContext('2d');
         // Reset size to avoid showing old large canvas visually
        spritesheetPreviewCanvas.width = 1;
        spritesheetPreviewCanvas.height = 1;
        ctx.clearRect(0, 0, 1, 1);
    }
    downloadSpritesheetButton.disabled = true; // Disable download
     console.log("Spritesheet cleared.");
}


// Utility to pause execution slightly to allow UI updates (use sparingly)
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

