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
let selectedBlobIndex = null; // Index in the `detectedBlobs` array


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
// Editing Elements
let editingToolsSection, editToolbar, editModeButtons, editingStatusDiv;


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

        resetZoomPan();
        updateImageDisplay();

        processingStatusDiv.textContent = 'Image loaded. Adjust settings and click "Detect Sprites".';
        disableControls(false); // Enable basic controls
        editingToolsSection.style.display = 'none'; // Hide editing tools initially
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
    clearOverlays(debugOverlaysContainer); // Clear all visual overlays
    updateDebugOverlays(); // Redraw overlays (will be empty if blobs are cleared)
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
        detectedBlobs = cclResult ? cclResult.blobs.map(b => ({ ...b, bounds: {...b.bounds} })) : [];
        selectedBlobIndex = null; // Reset selection after processing
    } catch(error) {
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

    // Show editing tools if blobs were found
    editingToolsSection.style.display = detectedBlobs.length > 0 ? 'block' : 'none';


    // --- 4. Update Debug Views/Overlays ---
    updateDebugView();
    updateDebugOverlays(); // Will now draw editable blobs if checkbox is checked
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
     clearOverlays(debugOverlaysContainer); // Clear everything inside the overlay container

     const showBBoxes = document.getElementById('show-bboxes-checkbox').checked;

     if (showBBoxes && detectedBlobs && detectedBlobs.length > 0) {
         console.log(`Drawing ${detectedBlobs.length} editable bounding boxes.`);
         drawBoundingBoxes(debugOverlaysContainer, detectedBlobs.map(b => b.bounds), {
             className: 'editable-bbox',
             color: 'blue',
             pointerEvents: 'auto', // Make them interactive
             borderWidth: 2,
             dataAttributes: {
                 // Use a function to ensure index is correct at time of drawing
                 blobIndex: (box, index) => index
             }
         });
         highlightSelectedBlob(); // Re-apply selection highlight if any blob is selected
     } else {
         console.log("Editable bounding box overlay not shown (checkbox off or no blobs).");
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

// --- Editing Mode ---

function setEditMode(newMode) {
    console.log("Setting edit mode to:", newMode);
    currentEditMode = newMode;

    // Update button active states
    editModeButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.mode === newMode);
    });

    // Update container class for cursor styling
    imagePreviewContainer.classList.remove('pan-mode', 'select-mode', 'grabbing'); // Add other modes later
    if (newMode === 'pan') {
        imagePreviewContainer.classList.add('pan-mode');
    } else if (newMode === 'select') {
        imagePreviewContainer.classList.add('select-mode');
    } // Add else if for other modes...

    // Update status message and potentially disable selection
    updateEditingStatus();
    if (newMode !== 'select') {
        // selectedBlobIndex = null; // Deselect when switching away from select mode? Optional.
        // highlightSelectedBlob();
    }
}

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

// Highlight the currently selected blob
function highlightSelectedBlob() {
    const boxes = debugOverlaysContainer.querySelectorAll('.editable-bbox');
    boxes.forEach((box, index) => {
        box.classList.toggle('selected', index === selectedBlobIndex);
    });
    updateEditModeUI(); // Update button states based on selection
    updateEditingStatus(); // Update text based on selection
}


// --- Combined Mouse Handlers for Preview Container ---

function handlePreviewMouseDown(event) {
    // Allow middle mouse button pan regardless of mode? Maybe later.
    if (event.button !== 0 || !originalImageInfo) return;

    if (currentEditMode === 'pan') {
        isPanning = true;
        startPanX = event.clientX;
        startPanY = event.clientY;
        startViewX = panX;
        startViewY = panY;
        imagePreviewContainer.classList.add('grabbing');
        event.preventDefault(); // Prevent text selection during pan
    } else if (currentEditMode === 'select') {
        // Handled by click, but prevent default browser drag behavior
        event.preventDefault();
    }
    // Add logic for other modes (e.g., start drawing box in 'add' mode)
}

function handlePreviewMouseMove(event) {
    if (isPanning && currentEditMode === 'pan') {
        const dx = event.clientX - startPanX;
        const dy = event.clientY - startPanY;
        panX = startViewX + dx;
        panY = startViewY + dy;
        updateImageDisplay();
    }
    // Add logic for other modes (e.g., drawing box in 'add' mode)
}

function handlePreviewMouseUp(event) {
     if (event.button !== 0) return;

    if (isPanning && currentEditMode === 'pan') {
         isPanning = false;
         imagePreviewContainer.classList.remove('grabbing');
    }
    // Add logic for other modes (e.g., finish drawing box in 'add' mode)
}

function handlePreviewMouseLeave(event) {
    // Treat leaving the container like mouse up for panning
     if (isPanning && currentEditMode === 'pan') {
         isPanning = false;
         imagePreviewContainer.classList.remove('grabbing');
    }
    // Add logic for other modes if needed
}

function handlePreviewClick(event) {
     if (currentEditMode === 'select') {
         const target = event.target;
         if (target.classList.contains('editable-bbox')) {
             const index = parseInt(target.dataset.blobIndex, 10);
             if (!isNaN(index) && index >= 0 && index < detectedBlobs.length) {
                  selectedBlobIndex = (selectedBlobIndex === index) ? null : index; // Toggle selection
                 console.log("Selected blob index:", selectedBlobIndex);
                 highlightSelectedBlob();
             } else {
                 console.warn("Clicked editable-bbox with invalid index:", target.dataset.blobIndex);
                 selectedBlobIndex = null;
                 highlightSelectedBlob();
             }
         } else {
             // Clicked outside any box, deselect
             selectedBlobIndex = null;
             highlightSelectedBlob();
         }
         event.stopPropagation(); // Prevent triggering other potential listeners on container
     }
     // Add logic for other modes (e.g., finalize add box, trigger delete)
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
    // ... (resetZoomPan logic remains the same) ...
    console.log(`Reset Zoom: ${currentZoom.toFixed(2)}, Pan: (${panX.toFixed(1)}, ${panY.toFixed(1)})`);
    updateImageDisplay(); // Apply the reset transform
}

// Applies the current zoom/pan state to the canvas and overlay container
function updateImageDisplay() {
    if (!imagePreviewCanvas || !debugOverlaysContainer || !originalImageInfo) return;

    const transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    imagePreviewCanvas.style.transform = transform;
    debugOverlaysContainer.style.transform = transform;

     // Ensure overlay container has the base dimensions of the image
     debugOverlaysContainer.style.width = `${originalImageInfo.naturalWidth}px`;
     debugOverlaysContainer.style.height = `${originalImageInfo.naturalHeight}px`;
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
    grayscaleImageData = null; // Keep grayscale maybe? No, processing implies redoing all.
    thresholdedImageData = null;
    cclResult = null;
    detectedBlobs = [];
    selectedBlobIndex = null;
    setEditMode('pan'); // Reset edit mode
    updateEditModeUI();
    editingToolsSection.style.display = 'none';
    clearGeneratedSpritesheet();
    clearOverlays(debugOverlaysContainer); // Clear visual overlays
    // Reset debug checkboxes? Optional, maybe keep user's preference.
    // debugViewCheckboxes.forEach(cb => cb.checked = false);
    // debugOverlayCheckboxes.forEach(cb => cb.checked = false);

     // Re-render the original image if available
     if (originalImageData) {
         updateDebugView(); // This should fall back to original if views are unchecked/data missing
         updateDebugOverlays(); // Should be empty now
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
     grayscaleImageData = null; // Clear grayscale too

     // Reset settings to default
     currentThresholdSettings = {
        type: 'manual',
        manualValue: 128,
        adaptiveBlockSize: 11,
        adaptiveC: 2
    };
    if (thresholdTypeSelect) thresholdTypeSelect.value = 'manual';
    // Reset other settings? Sliders have defaults in HTML.

    clearProcessingResults(); // Clear results and reset edit mode etc.

    updateThresholdSettingsUI();

    if (imagePreviewCanvas) {
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