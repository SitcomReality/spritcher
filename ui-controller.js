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
let detectedBlobs = []; // Holds the current list of blobs (can be modified by editing tools)
let generatedSpritesheetCanvas = null; // Store the generated canvas
let selectedBlobIndex = null; // Index in the `detectedBlobs` array

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

// Editing State
let currentEditMode = 'pan'; // 'pan', 'select', 'edit-bounds', 'add', 'split', 'merge', 'delete'

// --- DOM Element References ---
let imageUploadInput, imagePreviewCanvas, imagePreviewContainer, debugOverlaysContainer, editingOverlaysContainer;
let thresholdTypeSelect, manualThresholdSettingsDiv, adaptiveThresholdSettingsDiv;
let thresholdSlider, thresholdValueSpan, adaptiveBlocksizeInput, adaptiveCInput;
let minSizeSlider, minSizeValueSpan;
let debugViewCheckboxes, debugOverlayCheckboxes; // Collections of checkboxes
let processButton, processingStatusDiv;
let gridColsInput, paddingInput, alignmentSelect;
let generateSpritesheetButton, spritesheetPreviewCanvas, spritesheetPreviewContainer, downloadSpritesheetButton;
let zoomInButton, zoomOutButton;
let editingToolsSection, editToolbar, editModeButtons, editingStatusDiv;

// --- Initialization ---
export function initUI() {
    // Get DOM elements
    imageUploadInput = document.getElementById('image-upload');
    imagePreviewCanvas = document.getElementById('image-preview-canvas');
    imagePreviewContainer = document.getElementById('image-preview-container');
    debugOverlaysContainer = document.getElementById('debug-overlays');
    editingOverlaysContainer = document.getElementById('editing-overlays');
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
    // Editing Elements
    editingToolsSection = document.getElementById('editing-tools-section');
    editToolbar = document.getElementById('edit-toolbar');
    editModeButtons = document.querySelectorAll('.edit-mode-btn');
    editingStatusDiv = document.getElementById('editing-status');

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

    // Zoom and Pan/Select Listeners
    zoomInButton.addEventListener('click', () => zoomAtPoint(imagePreviewContainer.clientWidth / 2, imagePreviewContainer.clientHeight / 2, 1.2));
    zoomOutButton.addEventListener('click', () => zoomAtPoint(imagePreviewContainer.clientWidth / 2, imagePreviewContainer.clientHeight / 2, 1 / 1.2));
    imagePreviewContainer.addEventListener('mousedown', handlePreviewMouseDown);
    imagePreviewContainer.addEventListener('mousemove', handlePreviewMouseMove);
    imagePreviewContainer.addEventListener('mouseup', handlePreviewMouseUp);
    imagePreviewContainer.addEventListener('mouseleave', handlePreviewMouseLeave);
    imagePreviewContainer.addEventListener('click', handlePreviewClick);
    imagePreviewContainer.addEventListener('wheel', handleWheelZoom, { passive: false });

    // Edit Mode Button Listeners
    editModeButtons.forEach(button => {
        button.addEventListener('click', () => setEditMode(button.dataset.mode));
    });

    // Add specific listener for editing overlays container for handle dragging later
    editingOverlaysContainer.addEventListener('mousedown', handleEditingOverlayMouseDown);

    // Initial state updates
    updateThresholdSettingsUI();
    minSizeValueSpan.textContent = minSizeSlider.value;
    disableControls(true);
    setEditMode(currentEditMode); // Set initial mode ('pan') and update UI

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

        resetZoomPan(); // This calls updateImageDisplay which now also sets editing overlay size
        processingStatusDiv.textContent = 'Image loaded. Adjust settings and click "Detect Sprites".';
        disableControls(false); // Enable basic controls
        editingToolsSection.style.display = 'none'; // Hide editing tools initially
        clearGeneratedSpritesheet();
        clearEditingOverlays(); // Ensure no stale editing overlays

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
    invalidateProcessingResults(); // Clear more than just threshold
    processingStatusDiv.textContent = "Threshold type changed. Click 'Detect Sprites' to update results.";
}

// Handles changes to manual threshold slider
function handleManualThresholdChange() {
    currentThresholdSettings.manualValue = parseInt(thresholdSlider.value, 10);
    updateThresholdSettingsUI();
    invalidateProcessingResults();
    processingStatusDiv.textContent = "Manual threshold changed. Click 'Detect Sprites' to update results.";
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
    invalidateProcessingResults();
    processingStatusDiv.textContent = "Adaptive threshold params changed. Click 'Detect Sprites' to update results.";
}

// Helper to invalidate all processing results (threshold, ccl, blobs)
function invalidateProcessingResults() {
    thresholdedImageData = null;
    cclResult = null;
    detectedBlobs = [];
    selectedBlobIndex = null; // Deselect any selected blob
    clearGeneratedSpritesheet();
    clearOverlays(debugOverlaysContainer); // Clear visual overlays
    clearEditingOverlays(); // Clear editing overlays (selection, handles)
    updateDebugOverlays(); // Redraw overlays (will be empty if blobs are cleared)
    drawEditingOverlays(); // Clear/redraw editing overlays (should be empty)
    updateEditModeUI(); // Update edit button states
    editingToolsSection.style.display = 'none'; // Hide editing tools if results invalidated
    console.log("Processing results invalidated.");
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
    cclResult = null;
    detectedBlobs = [];
    selectedBlobIndex = null;
    clearGeneratedSpritesheet();
    updateDebugOverlays(); // Update overlays (will show fewer/different blobs after reprocessing)
    updateEditModeUI();
    processingStatusDiv.textContent = "Min size changed. Click 'Detect Sprites' to update results.";
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
    invalidateProcessingResults(); // Clear previous results before starting
    disableControls(true);
    setEditMode('pan'); // Switch to pan mode during processing
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
        invalidateProcessingResults();
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
        // IMPORTANT: Copy blobs so editing doesn't modify the raw CCL result directly
        detectedBlobs = cclResult ? cclResult.blobs.map(b => ({ ...b, bounds: { ...b.bounds } })) : [];
        selectedBlobIndex = null; // Reset selection after processing
    } catch (error) {
        console.error("Error during blob detection:", error);
        processingStatusDiv.textContent = `Error during blob detection: ${error.message}`;
        invalidateProcessingResults();
        disableControls(false);
        return;
    }
    const endTime = performance.now();
    console.log(`CCL completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);

    processingStatusDiv.textContent = `Processing complete. Found ${detectedBlobs.length} sprites. Ready to generate spritesheet or edit sprites.`;
    disableControls(false);
    clearGeneratedSpritesheet();
    clearEditingOverlays(); // Clear any previous editing overlays

    // Show editing tools if blobs were found
    editingToolsSection.style.display = detectedBlobs.length > 0 ? 'block' : 'none';

    // --- 4. Update Debug Views/Overlays ---
    updateDebugView(); // Redraw base canvas image
    updateDebugOverlays(); // Redraw debug boxes in their layer
    drawEditingOverlays(); // Draw selection/handles in their layer (will be empty initially)
    updateEditModeUI(); // Enable/disable edit buttons based on results

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

// Update overlays (bounding boxes) based on checkbox state and detectedBlobs
function updateDebugOverlays() {
    console.log("Updating debug overlays...");
    // Always clear previous overlays managed by this function
    clearOverlays(debugOverlaysContainer); // Clear everything inside the debug overlay container

    const showBBoxes = document.getElementById('show-bboxes-checkbox').checked;

    if (showBBoxes && detectedBlobs && detectedBlobs.length > 0) {
        console.log(`Drawing ${detectedBlobs.length} base bounding boxes.`);
        // Draw the basic blue boxes for *all* detected blobs
        drawBoundingBoxes(debugOverlaysContainer, detectedBlobs.map(b => b.bounds), {
            className: 'editable-bbox', // Keep this class for potential styling/identification
            color: 'blue', // Basic color
            pointerEvents: 'auto', // Needs to be clickable for selection mode IF selection happens here
            borderWidth: 2,
            dataAttributes: {
                blobIndex: (box, index) => index // Add index for potential selection click handling
            }
        });
    } else {
        console.log("Base bounding box overlay not shown (checkbox off or no blobs).");
    }
    console.log("Debug overlays updated.");
    // Note: Selection highlighting is now handled by drawEditingOverlays
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

// --- Editing Mode ---

function setEditMode(newMode) {
    // If switching away from 'edit-bounds', clear handles but keep selection highlight
    const oldMode = currentEditMode;
    currentEditMode = newMode;
    console.log(`Setting edit mode from ${oldMode} to: ${newMode}`);

    // Update button active states
    editModeButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.mode === newMode);
    });

    // Update container class for cursor styling
    imagePreviewContainer.classList.remove('pan-mode', 'select-mode', 'edit-bounds-mode', 'grabbing'); // Add other modes later
    if (newMode === 'pan') {
        imagePreviewContainer.classList.add('pan-mode');
    } else if (newMode === 'select') {
        imagePreviewContainer.classList.add('select-mode');
    } else if (newMode === 'edit-bounds') {
        imagePreviewContainer.classList.add('edit-bounds-mode');
    }
    // Add else if for other modes...

    // Update status message and redraw editing overlays (handles depend on mode)
    updateEditingStatus();
    drawEditingOverlays(); // Redraw selection and handles based on new mode

}

// Updates the edit mode UI based on the current state (e.g., enables edit buttons if blobs detected)
function updateEditModeUI() {
    const hasBlobs = detectedBlobs && detectedBlobs.length > 0;
    const isBlobSelected = selectedBlobIndex !== null;

    editModeButtons.forEach(button => {
        const mode = button.dataset.mode;
        let disabled = !hasBlobs; // Most modes require blobs

        if (mode === 'pan') {
            disabled = !originalImageInfo; // Pan only requires an image
        } else if (mode === 'select') {
            disabled = !hasBlobs;
        } else if (mode === 'edit-bounds' || mode === 'delete') {
            disabled = !hasBlobs || !isBlobSelected; // Require a selection
        } else if (mode === 'add') {
            disabled = !originalImageInfo; // Add only requires image context
        }
        else if (mode === 'split' || mode === 'merge') {
            disabled = true; // Not implemented yet
        }

        button.disabled = disabled;
    });

    // Ensure the 'active' class is correct after enable/disable changes
    setEditMode(currentEditMode);
}

function updateEditingStatus() {
    let status = `Mode: ${currentEditMode.toUpperCase()}. `;
    if (currentEditMode === 'select') {
        if (selectedBlobIndex !== null) {
            status += `Sprite ${selectedBlobIndex} selected.`;
        } else {
            status += `Click on a blue box to select a sprite.`;
        }
    } else if (currentEditMode === 'pan') {
        status += 'Click and drag to pan, use wheel or buttons to zoom.';
    } else if (currentEditMode === 'edit-bounds') {
        status += isBlobSelected ? `Drag handles to resize Sprite ${selectedBlobIndex}. (Not Implemented)` : 'Select a sprite first.';
    } else if (currentEditMode === 'add') {
        status += 'Click and drag to draw a new sprite box. (Not Implemented)';
    } else if (currentEditMode === 'delete') {
        status += isBlobSelected ? `Click 'Delete' button again to confirm delete Sprite ${selectedBlobIndex}. (Not Implemented)` : 'Select a sprite first.';
    }

    editingStatusDiv.textContent = status;
}

// --- Editing Overlays ---

// Clear editing overlays (selection highlight, resize handles)
function clearEditingOverlays() {
    if (editingOverlaysContainer) {
        while (editingOverlaysContainer.firstChild) {
            editingOverlaysContainer.removeChild(editingOverlaysContainer.firstChild);
        }
    }
}

// Draw the selection highlight and resize handles (if applicable)
function drawEditingOverlays() {
    clearEditingOverlays();
    if (!detectedBlobs || selectedBlobIndex === null || selectedBlobIndex >= detectedBlobs.length) {
        return; // No blob selected or invalid index
    }

    const selectedBlob = detectedBlobs[selectedBlobIndex];
    const bounds = selectedBlob.bounds;

    // 1. Draw Selection Highlight
    const highlightDiv = document.createElement('div');
    highlightDiv.className = 'selected-box-highlight';
    highlightDiv.style.left = `${bounds.minX}px`;
    highlightDiv.style.top = `${bounds.minY}px`;
    highlightDiv.style.width = `${bounds.width}px`;
    highlightDiv.style.height = `${bounds.height}px`;
    editingOverlaysContainer.appendChild(highlightDiv);

    // 2. Draw Resize Handles (only in 'edit-bounds' mode)
    if (currentEditMode === 'edit-bounds') {
        const handlePositions = [
            { x: bounds.minX, y: bounds.minY, type: 'tl' }, // Top-left
            { x: bounds.minX + bounds.width / 2, y: bounds.minY, type: 't' }, // Top-middle
            { x: bounds.maxX + 1, y: bounds.minY, type: 'tr' }, // Top-right (+1 because maxX is inclusive)
            { x: bounds.minX, y: bounds.minY + bounds.height / 2, type: 'l' }, // Middle-left
            { x: bounds.maxX + 1, y: bounds.minY + bounds.height / 2, type: 'r' }, // Middle-right
            { x: bounds.minX, y: bounds.maxY + 1, type: 'bl' }, // Bottom-left (+1 because maxY is inclusive)
            { x: bounds.minX + bounds.width / 2, y: bounds.maxY + 1, type: 'b' }, // Bottom-middle
            { x: bounds.maxX + 1, y: bounds.maxY + 1, type: 'br' }  // Bottom-right
        ];

        handlePositions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos.type}`;
            handle.style.left = `${pos.x}px`;
            handle.style.top = `${pos.y}px`;
            handle.dataset.handleType = pos.type; // Store handle type for drag logic
            handle.dataset.blobIndex = selectedBlobIndex; // Associate with the blob
            editingOverlaysContainer.appendChild(handle);
        });
        console.log(`Drew resize handles for blob ${selectedBlobIndex}`);
    }
}

// --- Combined Mouse Handlers for Preview Container ---

function handlePreviewMouseDown(event) {
    // Only react to left clicks (button 0)
    if (event.button !== 0 || !originalImageInfo) return;

    // Prevent default actions like text selection or image dragging
    event.preventDefault();

    if (currentEditMode === 'pan') {
        isPanning = true;
        startPanX = event.clientX;
        startPanY = event.clientY;
        startViewX = panX;
        startViewY = panY;
        imagePreviewContainer.classList.add('grabbing');
    } else if (currentEditMode === 'select') {
        // Selection is handled by click, check if clicked on a box
        const target = event.target;
        if (target.classList.contains('editable-bbox') && target.closest('#debug-overlays')) {
            // Clicked on a box in the debug layer
            const indexStr = target.dataset.blobIndex;
            if (indexStr !== undefined) {
                const index = parseInt(indexStr, 10);
                selectBlob(index);
            } else {
                selectBlob(null); // Clicked on something unexpected, deselect
            }
        } else if (event.target === imagePreviewContainer || event.target === imagePreviewCanvas) {
            // Clicked directly on container background or canvas, deselect
            selectBlob(null);
        }
        // Ignore clicks on editing overlays (like handles) in select mode
    }
    // 'edit-bounds' clicks are handled by handleEditingOverlayMouseDown
    // Add logic for other modes (e.g., start drawing box in 'add' mode)
}

// ... (keep handlePreviewMouseMove, handlePreviewMouseUp, handlePreviewMouseLeave) ...

// Click handler specifically for the main preview container (background clicks)
function handlePreviewClick(event) {
    // This is now simplified, as selection logic moved to mousedown
    // We might still need this for finalizing actions in other modes (e.g., Add Box)
    if (currentEditMode === 'select') {
        // If the click didn't hit a box (handled in mousedown), it might be a deselect click
        if (!event.target.classList.contains('editable-bbox') && !event.target.classList.contains('resize-handle')) {
            // selectBlob(null); // Deselect handled in mousedown now
        }
    }
    // Add logic for other modes if needed
}

// Helper function to handle blob selection/deselection
function selectBlob(index) {
    if (index !== null && (!detectedBlobs || index < 0 || index >= detectedBlobs.length)) {
        console.warn("Attempted to select invalid blob index:", index);
        index = null; // Treat as deselection
    }

    const changed = selectedBlobIndex !== index;
    if (changed) {
        selectedBlobIndex = index;
        console.log("Selected blob index:", selectedBlobIndex);
        drawEditingOverlays(); // Redraw selection highlight and handles (if applicable)
        updateEditModeUI(); // Update button states based on selection
        updateEditingStatus(); // Update text based on selection
    }
}

// Mouse Down handler specifically for the editing overlays layer (handles)
function handleEditingOverlayMouseDown(event) {
    if (event.button !== 0) return; // Only left clicks

    const target = event.target;

    if (currentEditMode === 'edit-bounds' && target.classList.contains('resize-handle')) {
        event.stopPropagation(); // Prevent preview container pan/select handlers
        console.log("Clicked resize handle:", target.dataset.handleType);
        // TODO: Implement drag start logic here
        // isDraggingHandle = true;
        // currentDragHandleType = target.dataset.handleType;
        // dragStartX = event.clientX;
        // dragStartY = event.clientY;
        // // Store initial blob bounds for relative calculation
        // initialDragBounds = { ...detectedBlobs[selectedBlobIndex].bounds };
    }
}

// --- Zoom and Pan Implementation ---

// Zooms the image view, attempting to keep the point (cx, cy) in container coordinates stationary
function zoomAtPoint(containerX, containerY, factor) {
    if (!originalImageInfo) return;

    const newZoom = Math.max(0.1, Math.min(10, currentZoom * factor));

    // Calculate image coordinates under the mouse before zoom
    const imageXBefore = (containerX - panX) / currentZoom;
    const imageYBefore = (containerY - panY) / currentZoom;

    // Calculate new panX/panY to keep image coordinates stationary under mouse
    const newPanX = containerX - imageXBefore * newZoom;
    const newPanY = containerY - imageYBefore * newZoom;

    currentZoom = newZoom;
    panX = newPanX;
    panY = newPanY;

    updateImageDisplay();
}

function handleWheelZoom(event) {
    // Allow zoom in any mode? Yes.
    event.preventDefault();
    const delta = event.deltaY > 0 ? 1 / 1.1 : 1.1;

    const rect = imagePreviewContainer.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    zoomAtPoint(mouseX, mouseY, delta);
}

// Resets zoom to fit image and centers it
function resetZoomPan() {
    if (!originalImageInfo || !imagePreviewContainer) {
        currentZoom = 1;
        panX = 0;
        panY = 0;
    } else {
        const containerWidth = imagePreviewContainer.clientWidth;
        const containerHeight = imagePreviewContainer.clientHeight;
        const imageWidth = originalImageInfo.naturalWidth;
        const imageHeight = originalImageInfo.naturalHeight;

        const scaleX = containerWidth / imageWidth;
        const scaleY = containerHeight / imageHeight;
        currentZoom = Math.min(scaleX, scaleY) * 0.95; // Fit with a small margin

        // Center the image
        panX = (containerWidth - imageWidth * currentZoom) / 2;
        panY = (containerHeight - imageHeight * currentZoom) / 2;
    }
    console.log(`Reset Zoom: ${currentZoom.toFixed(2)}, Pan: (${panX.toFixed(1)}, ${panY.toFixed(1)})`);
    updateImageDisplay(); // Apply the reset transform
}

// Applies the current zoom/pan state to the canvas and overlay containers
function updateImageDisplay() {
    if (!imagePreviewCanvas || !debugOverlaysContainer || !editingOverlaysContainer || !originalImageInfo) return;

    const transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    imagePreviewCanvas.style.transform = transform;
    debugOverlaysContainer.style.transform = transform;
    editingOverlaysContainer.style.transform = transform; // Apply to editing overlays too

    // Ensure overlay containers have the base dimensions of the image
    const widthPx = `${originalImageInfo.naturalWidth}px`;
    const heightPx = `${originalImageInfo.naturalHeight}px`;
    debugOverlaysContainer.style.width = widthPx;
    debugOverlaysContainer.style.height = heightPx;
    editingOverlaysContainer.style.width = widthPx; // Set size for editing overlays
    editingOverlaysContainer.style.height = heightPx;

    // Redraw editing overlays as zoom/pan might affect handle positions visually if not redrawn
    // Optional: only redraw if needed, but safer to redraw for now
    drawEditingOverlays();
}

// --- Helper Functions ---

// Disables/enables controls that shouldn't be active without an image or during processing
function disableControls(disabled) {
    const imageLoaded = !!originalImageInfo;
    const processing = disabled;

    // Settings Section
    thresholdTypeSelect.disabled = processing || !imageLoaded;
    thresholdSlider.disabled = processing || !imageLoaded || currentThresholdSettings.type !== 'manual';
    adaptiveBlocksizeInput.disabled = processing || !imageLoaded || !currentThresholdSettings.type.startsWith('adaptive-');
    adaptiveCInput.disabled = processing || !imageLoaded || !currentThresholdSettings.type.startsWith('adaptive-');
    minSizeSlider.disabled = processing || !imageLoaded;
    debugViewCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);
    debugOverlayCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);

    // Processing Button
    processButton.disabled = processing || !imageLoaded;

    // Editing Section Buttons (initial state, specific states handled by updateEditModeUI)
    editModeButtons.forEach(button => button.disabled = processing || !imageLoaded);

    // Spritesheet Section
    generateSpritesheetButton.disabled = processing || !imageLoaded;
    gridColsInput.disabled = processing || !imageLoaded;
    paddingInput.disabled = processing || !imageLoaded;
    alignmentSelect.disabled = processing || !imageLoaded;
    downloadSpritesheetButton.disabled = processing || !imageLoaded || !generatedSpritesheetCanvas;

    // Zoom Buttons
    zoomInButton.disabled = processing || !imageLoaded;
    zoomOutButton.disabled = processing || !imageLoaded;

    // Upload Input (only disable during processing if an image is already loaded)
    imageUploadInput.disabled = processing && imageLoaded;

    // Update dynamic UI states
    updateThresholdSettingsUI();
    updateEditModeUI(); // Call this to set correct initial enable/disable state for edit buttons
}

// Clears only processing results, keeps original image and settings
function clearProcessingResults() {
    console.log("Clearing processing results...");
    grayscaleImageData = null;
    thresholdedImageData = null;
    cclResult = null;
    detectedBlobs = [];
    selectedBlobIndex = null;
    setEditMode('pan'); // Reset edit mode
    updateEditModeUI();
    editingToolsSection.style.display = 'none';
    clearGeneratedSpritesheet();
    clearOverlays(debugOverlaysContainer); // Clear visual overlays
    clearEditingOverlays(); // Clear editing visual overlays

    // Reset debug checkboxes? Optional.

    // Re-render the original image if available
    if (originalImageData) {
        updateDebugView();
        updateDebugOverlays(); // Should be empty now
        drawEditingOverlays(); // Should be empty now
    } else {
        // ... clear canvas ...
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
    grayscaleImageData = null; // Clear grayscale too

    // Reset settings to default
    currentThresholdSettings = {
        type: 'manual',
        manualValue: 128,
        adaptiveBlockSize: 11,
        adaptiveC: 2
    };

    clearProcessingResults(); // Clear results and reset edit mode etc.

    updateThresholdSettingsUI();

    if (imagePreviewCanvas) {
        // ... clear canvas ...
        const ctx = imagePreviewCanvas.getContext('2d');
        imagePreviewCanvas.style.transform = '';
        ctx.clearRect(0, 0, imagePreviewCanvas.width, imagePreviewCanvas.height);
        imagePreviewCanvas.width = 1;
        imagePreviewCanvas.height = 1;
    }
    if (debugOverlaysContainer) {
        // clearOverlays is called by clearProcessingResults
        debugOverlaysContainer.style.transform = '';
        debugOverlaysContainer.style.width = '0px';
        debugOverlaysContainer.style.height = '0px';
    }
    if (editingOverlaysContainer) { // Clear editing overlays container too
        clearEditingOverlays();
        editingOverlaysContainer.style.transform = '';
        editingOverlaysContainer.style.width = '0px';
        editingOverlaysContainer.style.height = '0px';
    }

    resetZoomPan(); // Reset zoom/pan state

    processingStatusDiv.textContent = 'Upload an image to start.';
    editingStatusDiv.textContent = ''; // Clear editing status
    disableControls(true); // Disable almost everything
    imageUploadInput.disabled = false; // Re-enable upload
    imageUploadInput.value = ''; // Clear file input selection
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