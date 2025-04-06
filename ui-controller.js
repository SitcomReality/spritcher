import { loadImage, getImageDataFromCanvas } from 'image-loader';
import { getGrayscaleImageData, getThresholdedImageData } from 'image-processor';
import { findBlobs, getLabeledImageData } from 'blob-detector';
import { generateSpritesheet, downloadCanvasAsPNG } from 'spritesheet-generator';
import { drawBoundingBoxes, clearOverlays } from 'utils';

// --- State Variables ---
let originalImageInfo = null; 
let originalImageData = null;
let grayscaleImageData = null; 
let thresholdedImageData = null; 
let cclResult = null; 
let detectedBlobs = []; 
let generatedSpritesheetCanvas = null; 

// Viewport State
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0; 
let startPanY = 0; 
let startViewX = 0; 
let startViewY = 0; 


// --- DOM Element References ---
let imageUploadInput, imagePreviewCanvas, imagePreviewContainer, debugOverlaysContainer;
let thresholdSlider, thresholdValueSpan, minSizeSlider, minSizeValueSpan;
let debugViewCheckboxes, debugOverlayCheckboxes; 
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
    debugViewCheckboxes = document.querySelectorAll('input[name="debug-view"]');
    debugOverlayCheckboxes = document.querySelectorAll('input[name="debug-overlay"]');
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

    debugViewCheckboxes.forEach(cb => cb.addEventListener('change', handleDebugViewChange));
    debugOverlayCheckboxes.forEach(cb => cb.addEventListener('change', updateDebugOverlays)); 

    gridColsInput.addEventListener('change', handleSpritesheetSettingsChange);
    paddingInput.addEventListener('change', handleSpritesheetSettingsChange);
    alignmentSelect.addEventListener('change', handleSpritesheetSettingsChange);

    previewSpritesheetButton.addEventListener('click', handleGenerateSpritesheet); 
    downloadSpritesheetButton.addEventListener('click', handleDownloadSpritesheet);

    zoomInButton.addEventListener('click', () => zoomAtPoint(imagePreviewContainer.clientWidth / 2, imagePreviewContainer.clientHeight / 2, 1.2));
    zoomOutButton.addEventListener('click', () => zoomAtPoint(imagePreviewContainer.clientWidth / 2, imagePreviewContainer.clientHeight / 2, 1 / 1.2));
    imagePreviewContainer.addEventListener('mousedown', startPan);
    imagePreviewContainer.addEventListener('mousemove', pan);
    imagePreviewContainer.addEventListener('mouseup', endPan);
    imagePreviewContainer.addEventListener('mouseleave', endPan); 
    imagePreviewContainer.addEventListener('wheel', handleWheelZoom, { passive: false }); 


    thresholdValueSpan.textContent = thresholdSlider.value;
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

function handleThresholdChange() {
    thresholdValueSpan.textContent = thresholdSlider.value;
    thresholdedImageData = null;
    cclResult = null;
    detectedBlobs = [];
    clearGeneratedSpritesheet();
    if (document.getElementById('show-threshold-checkbox').checked) {
        updateDebugView(); 
    }
     if (document.getElementById('show-bboxes-checkbox').checked) {
         clearOverlays(debugOverlaysContainer); 
     }

}

function handleMinSizeChange() {
    minSizeValueSpan.textContent = minSizeSlider.value;
    cclResult = null;
    detectedBlobs = [];
     clearGeneratedSpritesheet();
     if (document.getElementById('show-bboxes-checkbox').checked) {
         clearOverlays(debugOverlaysContainer); 
         processingStatusDiv.textContent = "Min size changed. Click 'Detect Sprites' to update results.";
     }

}

function handleSpritesheetSettingsChange() {
     clearGeneratedSpritesheet();
     processingStatusDiv.textContent = "Spritesheet settings changed. Click 'Generate Spritesheet' to update.";
}


async function handleProcessImage() {
    if (!originalImageData) {
        alert("Please upload an image first.");
        return;
    }

    console.log("Starting image processing pipeline...");
    disableControls(true); 
    processingStatusDiv.textContent = 'Processing: Grayscale...';
    await wait(10); 

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

    const threshold = parseInt(thresholdSlider.value, 10);
    thresholdedImageData = getThresholdedImageData(grayscaleImageData, threshold); 
    console.log(`Generated thresholded data with threshold ${threshold}.`);


    processingStatusDiv.textContent = 'Processing: Finding Blobs (CCL)...';
    await wait(10);

    const minSize = parseInt(minSizeSlider.value, 10);
    const startTime = performance.now();
    try {
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

    updateDebugView();
    updateDebugOverlays();

    console.log("Processing pipeline finished.");
}

function handleDebugViewChange(event) {
    debugViewCheckboxes.forEach(cb => {
            if (cb !== event.target) {
                cb.checked = false;
            }
        });
    updateDebugView(); 
}

function updateDebugView() {
    if (!originalImageData) return; 

    const ctx = imagePreviewCanvas.getContext('2d');
    const width = originalImageData.width;
    const height = originalImageData.height;

    let imageDataToShow = originalImageData; 

    if (document.getElementById('show-grayscale-checkbox').checked) {
        if (!grayscaleImageData) {
            console.warn("Grayscale data requested but not generated. Run 'Detect Sprites' first.");
             processingStatusDiv.textContent = "Grayscale view requires 'Detect Sprites'.";
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
             imageDataToShow = getLabeledImageData(cclResult.labels, width, height);
        }
    }
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


function updateDebugOverlays() {
     clearOverlays(debugOverlaysContainer); 

     if (document.getElementById('show-bboxes-checkbox').checked) {
        if (detectedBlobs && detectedBlobs.length > 0) {
             console.log(`Drawing ${detectedBlobs.length} bounding boxes.`);
             drawBoundingBoxes(debugOverlaysContainer, detectedBlobs.map(b => b.bounds), 'red');
        } else {
             console.log("Bounding box overlay enabled, but no blobs detected or processed yet.");
              processingStatusDiv.textContent = "Bounding box view requires 'Detect Sprites'.";
        }
     }
     console.log("Debug overlays updated.");
}


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
        generatedSpritesheetCanvas = await generateSpritesheet(
            originalImageData,
            detectedBlobs,
            cols,
            padding,
            alignment
        );

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

function updateImageDisplay() {
    if (!imagePreviewCanvas || !debugOverlaysContainer) return;

    const transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    imagePreviewCanvas.style.transform = transform;
    debugOverlaysContainer.style.transform = transform;

     if (originalImageInfo) {
        debugOverlaysContainer.style.width = `${originalImageInfo.naturalWidth}px`;
        debugOverlaysContainer.style.height = `${originalImageInfo.naturalHeight}px`;
     } else {
         debugOverlaysContainer.style.width = `0px`;
        debugOverlaysContainer.style.height = `0px`;
     }
}


function disableControls(disabled) {
    thresholdSlider.disabled = disabled;
    minSizeSlider.disabled = disabled;
    processButton.disabled = disabled;
    previewSpritesheetButton.disabled = disabled; 
    if (disabled) {
         downloadSpritesheetButton.disabled = true;
     } else {
         downloadSpritesheetButton.disabled = !generatedSpritesheetCanvas;
     }
     zoomInButton.disabled = disabled || !originalImageInfo;
    zoomOutButton.disabled = disabled || !originalImageInfo;
}

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
     }
}

function clearStateBeforeLoad() {
     console.log("Clearing full state.");
     originalImageInfo = null;
     originalImageData = null;
     clearProcessingResults(); 

    const ctx = imagePreviewCanvas.getContext('2d');
    ctx.clearRect(0, 0, imagePreviewCanvas.width, imagePreviewCanvas.height);
    imagePreviewCanvas.width = 1;
    imagePreviewCanvas.height = 1;
    imagePreviewCanvas.style.transform = ''; 
    debugOverlaysContainer.style.transform = ''; 
    debugOverlaysContainer.style.width = '0px';
    debugOverlaysContainer.style.height = '0px';

     resetZoomPan(); 

     processingStatusDiv.textContent = 'Upload an image to start.';
}


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


function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}