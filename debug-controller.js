import { elements } from 'dom-elements';
import { appState } from 'state';
import { getLabeledImageData } from 'blob-detector';
import { drawBoundingBoxes, clearOverlays as clearOverlaysUtil } from 'utils';
import { updateImageDisplayTransform } from 'viewport-controller'; // Needed to apply transform after redraw


export function initDebugController() {
    elements.debugViewCheckboxes.forEach(cb => cb.addEventListener('change', handleDebugViewChange));
    elements.debugOverlayCheckboxes.forEach(cb => cb.addEventListener('change', updateDebugOverlays));
}


// Handler for Debug VIEW checkboxes (Grayscale, Threshold, CCL)
function handleDebugViewChange(event) {
    // Ensure only one view checkbox is checked at a time
    if (event.target.checked) {
        elements.debugViewCheckboxes.forEach(cb => {
            if (cb !== event.target) {
                cb.checked = false;
            }
        });
    }
    updateDebugView(); // Redraw canvas with the selected view
}


// Update the main canvas based on which debug VIEW checkbox is checked
export function updateDebugView() {
    if (!elements.imagePreviewCanvas) return; // Canvas might not exist yet
    const ctx = elements.imagePreviewCanvas.getContext('2d');

    if (!appState.originalImageData) {
        // Clear canvas if no image is loaded
        ctx.clearRect(0, 0, elements.imagePreviewCanvas.width, elements.imagePreviewCanvas.height);
        elements.imagePreviewCanvas.width = 1;
        elements.imagePreviewCanvas.height = 1;
        return;
    }

    const width = appState.originalImageData.width;
    const height = appState.originalImageData.height;

    let imageDataToShow = appState.originalImageData; // Default to original
    let viewMessage = null;

    if (elements.showGrayscaleCheckbox.checked) {
        if (!appState.grayscaleImageData) {
            viewMessage = "Grayscale data not generated. Click 'Detect Sprites'.";
        } else {
            imageDataToShow = appState.grayscaleImageData;
        }
    } else if (elements.showThresholdCheckbox.checked) {
        if (!appState.thresholdedImageData) {
            viewMessage = "Thresholded data not generated. Click 'Detect Sprites'.";
        } else {
            imageDataToShow = appState.thresholdedImageData;
        }
    } else if (elements.showCCLCheckbox.checked) {
        if (!appState.cclResult || !appState.cclResult.labels) {
            viewMessage = "CCL data not generated. Click 'Detect Sprites'.";
        } else {
            // Generate colored label image on the fly
            imageDataToShow = getLabeledImageData(appState.cclResult.labels, width, height);
        }
    }
    // else: No view checkbox checked, imageDataToShow remains originalImageData

    // Display message if required data is missing for the selected view
    if (viewMessage) {
        console.warn(viewMessage);
        elements.processingStatusDiv.textContent = viewMessage;
        imageDataToShow = appState.originalImageData; // Fallback to original
    }

    // Redraw the base image on the canvas using the selected ImageData
    // Important: Ensure canvas dimensions match image data dimensions before drawing
    if (elements.imagePreviewCanvas.width !== width || elements.imagePreviewCanvas.height !== height) {
         elements.imagePreviewCanvas.width = width;
         elements.imagePreviewCanvas.height = height;
         console.log(`Resized preview canvas to ${width}x${height}`);
    }

    // Use a temporary canvas to putImageData and then drawImage for performance
    // and to avoid potential issues with direct putImageData on a transformed canvas.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageDataToShow, 0, 0);

    // Clear the main canvas (important!) and draw the temp canvas onto it
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tempCanvas, 0, 0);

    // Re-apply existing transform after redrawing the canvas content
    updateImageDisplayTransform();

    console.log("Debug view updated.");
}


// Update overlays (bounding boxes) based on checkbox state and detectedBlobs
export function updateDebugOverlays() {
    console.log("Updating debug overlays...");
    clearOverlays(elements.debugOverlaysContainer); // Clear existing overlays first

    const showBBoxes = elements.showBBoxesCheckbox.checked;

    if (showBBoxes && appState.detectedBlobs && appState.detectedBlobs.length > 0) {
        console.log(`Drawing ${appState.detectedBlobs.length} editable bounding boxes.`);
        drawBoundingBoxes(elements.debugOverlaysContainer, appState.detectedBlobs.map(b => b.bounds), {
            className: 'editable-bbox',
            color: 'blue',
            pointerEvents: 'auto', // Make them interactive for selection
            borderWidth: 2,
            dataAttributes: {
                blobIndex: (box, index) => index // Add index for click identification
            }
        });
        // Re-apply selection highlight (handled within editing-controller now)
        // Find the highlightSelectedBlob equivalent call if needed here, maybe from editing controller
        // For now, selection state is managed there, drawing happens here. Highlight applied via class.
        highlightSelectedOverlay(); // Call helper to apply class based on state
    } else {
        console.log("Editable bounding box overlay not shown (checkbox off or no blobs).");
    }
    console.log("Debug overlays updated.");
}


// Helper function to apply the 'selected' class based on current state
// This is needed because updateDebugOverlays redraws the boxes, losing the class.
function highlightSelectedOverlay() {
     const selectedIndex = appState.editing.selectedBlobIndex;
     if (selectedIndex !== null) {
         const box = elements.debugOverlaysContainer.querySelector(`.editable-bbox[data-blob-index="${selectedIndex}"]`);
         if (box) {
             box.classList.add('selected');
         }
     }
}


// Clears overlays drawn by this controller
export function clearOverlays(container) {
    if (container) {
        clearOverlaysUtil(container); // Use the utility function
    }
}