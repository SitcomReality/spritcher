import { elements } from 'dom-elements';
import { appState, setGrayscaleImage, setThresholdedImage, setCCLResult, clearProcessingResultsState, clearCCLResult } from 'state';
import { getGrayscaleImageData, getThresholdedImageData, getAdaptiveThresholdedImageData } from 'image-processor';
import { findBlobs } from 'blob-detector';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { clearOverlays, updateDebugView, updateDebugOverlays } from 'debug-controller';
import { updateEditModeUI, setEditModeAndClearSelection } from 'mode-controller';
import { disableAllControls } from 'ui-controller';
import { displayExtractedSprites, clearExtractedSpritesDisplay } from 'extracted-sprites-controller'; // Import controller

// Utility to pause execution slightly to allow UI updates
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function initProcessingController() {
    elements.processButton.addEventListener('click', handleProcessImage);
}

// Main processing pipeline triggered by button
export async function handleProcessImage() {
    if (!appState.originalImageData) {
        alert("Please upload an image first.");
        return;
    }

    console.log("Starting image processing pipeline...");
    invalidateProcessing(); // Clear previous results before starting
    disableAllControls(true);
    setEditModeAndClearSelection('pan'); // Switch to pan mode during processing
    elements.processingStatusDiv.textContent = 'Processing: Grayscale...';
    await wait(10);

    // --- 1. Grayscale ---
    if (!appState.grayscaleImageData && appState.originalImageData) {
        const grayData = getGrayscaleImageData(appState.originalImageData);
        setGrayscaleImage(grayData);
        console.log("Generated grayscale data.");
    } else if (appState.grayscaleImageData) {
        console.log("Using cached grayscale data.");
    } else {
        elements.processingStatusDiv.textContent = 'Error: Cannot process without original image data.';
        disableAllControls(false);
        return;
    }

    elements.processingStatusDiv.textContent = 'Processing: Thresholding...';
    await wait(10);

    // --- 2. Thresholding ---
    try {
        let thresholdedData;
        switch (appState.currentThresholdSettings.type) {
            case 'manual':
                thresholdedData = getThresholdedImageData(
                    appState.grayscaleImageData,
                    appState.currentThresholdSettings.manualValue
                );
                console.log(`Generated manual thresholded data (T=${appState.currentThresholdSettings.manualValue}).`);
                break;
            case 'adaptive-mean':
                thresholdedData = getAdaptiveThresholdedImageData(
                    appState.grayscaleImageData,
                    appState.currentThresholdSettings.adaptiveBlockSize,
                    appState.currentThresholdSettings.adaptiveC
                );
                console.log(`Generated adaptive mean thresholded data (Block=${appState.currentThresholdSettings.adaptiveBlockSize}, C=${appState.currentThresholdSettings.adaptiveC}).`);
                break;
            default:
                throw new Error(`Unknown threshold type: ${appState.currentThresholdSettings.type}`);
        }
        setThresholdedImage(thresholdedData);
    } catch (error) {
        console.error("Error during thresholding:", error);
        elements.processingStatusDiv.textContent = `Error during thresholding: ${error.message}`;
        invalidateProcessing();
        disableAllControls(false);
        return;
    }

    elements.processingStatusDiv.textContent = 'Processing: Finding Blobs (CCL)...';
    await wait(10);

    // --- 3. Blob Detection (CCL) ---
    const minSize = parseInt(elements.minSizeSlider.value, 10);
    const startTime = performance.now();
    try {
        if (!appState.thresholdedImageData) {
            throw new Error("Thresholding step failed, cannot perform CCL.");
        }
        const result = findBlobs(appState.thresholdedImageData, minSize);
        setCCLResult(result); // This populates detectedBlobs, extractedSprites, and CLEARS selectedSpritesForSheet
    } catch (error) {
        console.error("Error during blob detection:", error);
        elements.processingStatusDiv.textContent = `Error during blob detection: ${error.message}`;
        invalidateProcessing(); // Maybe just invalidate CCL?
        disableAllControls(false);
        return;
    }
    const endTime = performance.now();
    console.log(`CCL completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);

    // --- Display Extracted Sprites (Available and Selected Panels) ---
    displayExtractedSprites(); // Populate the new section panels
    elements.extractedSpritesSection.style.display = appState.extractedSprites.length > 0 ? 'block' : 'none';

    elements.processingStatusDiv.textContent = `Processing complete. Found ${appState.detectedBlobs.length} sprites. Add desired sprites to the selection panel.`;
    disableAllControls(false);
    clearGeneratedSpritesheet();

    // Show editing tools if blobs were found
    elements.editingToolsSection.style.display = appState.detectedBlobs.length > 0 ? 'block' : 'none';

    // --- 4. Update Debug Views/Overlays ---
    updateDebugView();
    updateDebugOverlays(); // Will now draw editable blobs if checkbox is checked
    updateEditModeUI(); // Enable/disable edit buttons based on results

    console.log("Processing pipeline finished.");
}

/**
 * Invalidates processing results (threshold, ccl, blobs) based on the cause.
 * Also clears the extracted/selected sprites UI.
 * @param {boolean} [keepThresholded=false] - If true, only invalidate CCL/Blobs (e.g., minSize changed).
 */
export function invalidateProcessing(keepThresholded = false) {
    clearCCLResult(); // Clears CCL, detectedBlobs, extractedSprites, selectedSpritesForSheet
    clearGeneratedSpritesheet(); // Clear spritesheet result
    clearOverlays(elements.debugOverlaysContainer); // Clear visual overlays
    clearExtractedSpritesDisplay(); // Clear BOTH UI panels

    if (!keepThresholded) {
        appState.thresholdedImageData = null; // Clear threshold result as well
    }

    // Redraw overlays (will be empty if blobs are cleared)
    updateDebugOverlays();
    // Update relevant UI states
    updateEditModeUI();
    elements.editingToolsSection.style.display = 'none';
    elements.extractedSpritesSection.style.display = 'none'; // Hide entire section

    console.log(`Processing results invalidated ${keepThresholded ? '(keeping thresholded)' : '(full)'}.`);
}

export function clearProcessingOnLoad() {
    clearProcessingResultsState(); // Clears state including extracted/selected
    clearExtractedSpritesDisplay(); // Clear UI panels
    updateDebugView(); // Re-render the original image if available, else clear canvas
    updateDebugOverlays(); // Should be empty now
    updateEditModeUI();
    elements.editingToolsSection.style.display = 'none';
    elements.extractedSpritesSection.style.display = 'none'; // Hide section
}