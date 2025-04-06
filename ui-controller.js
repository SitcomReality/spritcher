import { loadImage, getImageDataFromCanvas } from 'image-loader';
import { elements, populateElements } from 'dom-elements';
import { appState, setOriginalImage, clearFullAppState, resetThresholdSettings } from 'state';
import { initSettingsController, updateThresholdSettingsUI, updateMinSizeUI, syncThresholdSettingsToState } from 'settings-controller';
import { initProcessingController, clearProcessingOnLoad } from 'processing-controller';
import { initSpritesheetController, clearGeneratedSpritesheet } from 'spritesheet-controller';
import { initViewportController, resetZoomPanStateAndView, updateImageDisplayTransform, updateOverlayContainerDimensions, clearTransforms } from 'viewport-controller';
import { initEditingController, updateEditModeUI, resetEditingOnLoad } from 'editing-controller';
import { initDebugController, updateDebugView, updateDebugOverlays, clearOverlays } from 'debug-controller';

// --- Initialization ---
export function initUI() {
    populateElements(); // Find all DOM elements first

    // Initialize controllers (which add their specific event listeners)
    initSettingsController();
    initProcessingController();
    initSpritesheetController();
    initViewportController();
    initEditingController();
    initDebugController();

    // Add event listeners managed directly by ui-controller (e.g., image upload)
    elements.imageUploadInput.addEventListener('change', handleImageUpload);

    // Initial UI state setup
    clearStateBeforeLoad(); // Reset state and UI to initial defaults
    console.log("UI Initialized");
}

// --- Image Loading ---
async function handleImageUpload() {
    console.log("Handling image upload...");
    clearStateBeforeLoad(); // Clear everything before loading new image
    elements.processingStatusDiv.textContent = 'Loading image...';
    disableAllControls(true); // Disable controls during load

    try {
        const imageInfo = await loadImage(elements.imageUploadInput, elements.imagePreviewCanvas);
        const imageData = getImageDataFromCanvas(elements.imagePreviewCanvas);

        if (!imageData) {
            throw new Error("Could not get image pixel data after loading.");
        }

        setOriginalImage(imageInfo, imageData); // Update state

        resetZoomPanStateAndView(); // Reset viewport state and apply transform
        updateOverlayContainerDimensions(); // Set base dimensions for overlay container
        updateDebugView(); // Display the loaded image on the canvas

        elements.processingStatusDiv.textContent = 'Image loaded. Adjust settings and click "Detect Sprites".';
        syncThresholdSettingsToState(); // Ensure UI reflects potentially loaded settings
        updateMinSizeUI(); // Ensure min size UI reflects initial value
        disableAllControls(false); // Enable controls now that image is loaded
        elements.editingToolsSection.style.display = 'none'; // Hide editing tools initially
        clearGeneratedSpritesheet(); // Clear any old spritesheet preview

        console.log("Image loaded successfully.");
    } catch (error) {
        elements.processingStatusDiv.textContent = `Error: ${error.message}`;
        console.error("Image loading failed:", error);
        alert(`Error loading image: ${error.message}`);
        clearStateBeforeLoad(); // Reset UI fully on error
    }
}

// --- UI State Management ---

// Disables/enables controls based on current app state
export function disableAllControls(disabled) {
    const imageLoaded = !!appState.originalImageInfo;
    const processing = disabled; // Assuming 'disabled' means 'currently processing'

    // Settings Section (individual disable logic handled in settings-controller)
    elements.thresholdTypeSelect.disabled = processing || !imageLoaded;
    elements.thresholdSlider.disabled = processing || !imageLoaded || appState.currentThresholdSettings.type !== 'manual';
    elements.adaptiveBlocksizeInput.disabled = processing || !imageLoaded || !appState.currentThresholdSettings.type.startsWith('adaptive-');
    elements.adaptiveCInput.disabled = processing || !imageLoaded || !appState.currentThresholdSettings.type.startsWith('adaptive-');
    elements.minSizeSlider.disabled = processing || !imageLoaded;
    elements.debugViewCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);
    elements.debugOverlayCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);

    // Processing Button
    elements.processButton.disabled = processing || !imageLoaded;

    // Editing Section Buttons (specific states handled by editing-controller)
    // General disabling during processing or if no image
    elements.editModeButtons.forEach(button => button.disabled = processing || !imageLoaded);

    // Spritesheet Section
    elements.generateSpritesheetButton.disabled = processing || !imageLoaded;
    elements.gridColsInput.disabled = processing || !imageLoaded;
    elements.paddingInput.disabled = processing || !imageLoaded;
    elements.alignmentSelect.disabled = processing || !imageLoaded;
    // Download button disable logic is more complex (depends on generation)
    elements.downloadSpritesheetButton.disabled = processing || !imageLoaded || !appState.generatedSpritesheetCanvas;

    // Zoom Buttons
    elements.zoomInButton.disabled = processing || !imageLoaded;
    elements.zoomOutButton.disabled = processing || !imageLoaded;

    // Upload Input (only disable during processing *if* an image is already loaded)
    elements.imageUploadInput.disabled = processing && imageLoaded;

    // Update dynamic UI states that depend on enabled/disabled status
    updateThresholdSettingsUI(); // Re-check internal setting disables
    updateEditModeUI(); // Re-check editing button enables/disables and active state
}

// Clears everything including the loaded image and resets UI fully
function clearStateBeforeLoad() {
    console.log("Clearing full state and UI before load.");
    clearFullAppState(); // Reset all state variables

    // Reset UI elements specifically
    if (elements.imagePreviewCanvas) {
        const ctx = elements.imagePreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.imagePreviewCanvas.width, elements.imagePreviewCanvas.height);
        elements.imagePreviewCanvas.width = 1;
        elements.imagePreviewCanvas.height = 1;
    }
    clearTransforms(); // Remove transforms from canvas/overlay
    clearOverlays(elements.debugOverlaysContainer); // Clear any drawn overlays

    // Reset settings UI to defaults
    resetThresholdSettings(); // Reset state first
    syncThresholdSettingsToState(); // Update UI from state
    if(elements.minSizeSlider) elements.minSizeSlider.value = 10; // Default from HTML
    updateMinSizeUI();

    // Reset other UI areas
    clearProcessingOnLoad(); // Clears derived data, resets some UI visibility
    resetEditingOnLoad(); // Resets editing mode, selection, status text, visibility
    clearGeneratedSpritesheet(); // Clears spritesheet preview and disables download

    elements.processingStatusDiv.textContent = 'Upload an image to start.';
    if (elements.imageUploadInput) elements.imageUploadInput.value = ''; // Clear file input selection

    disableAllControls(true); // Disable almost everything initially
    elements.imageUploadInput.disabled = false; // Re-enable upload button
}