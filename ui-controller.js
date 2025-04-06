import { loadImageFromFile, getImageDataFromCanvas } from 'image-loader';
import { elements, populateElements } from 'dom-elements';
import { appState, setOriginalImage, clearFullAppState, resetThresholdSettings, clearProcessingResultsState } from 'state';
import { initSettingsController, updateThresholdSettingsUI, updateMinSizeUI, syncThresholdSettingsToState, syncNumberInputsToSliders } from 'settings-controller';
import { initProcessingController, clearProcessingOnLoad } from 'processing-controller';
import { initSpritesheetController, clearGeneratedSpritesheet } from 'spritesheet-controller';
import { initViewportController, resetZoomPanStateAndView, updateImageDisplayTransform, updateOverlayContainerDimensions, clearTransforms } from 'viewport-controller';
import { initEditingController, resetEditingOnLoad } from 'editing-controller';
import { updateEditModeUI } from 'mode-controller';
import { initDebugController, updateDebugView, updateDebugOverlays, clearOverlays } from 'debug-controller';
import { initThemeController } from 'theme-controller';
import { initExtractedSpritesController, clearExtractedSpritesDisplay, displayExtractedSprites, updateButtonStates as updateExtractedSpritesButtons } from 'extracted-sprites-controller';

// --- Initialization ---
export function initUI() {
    populateElements();
    initThemeController();

    // Initialize controllers (which add their specific event listeners)
    initSettingsController();
    initProcessingController();
    initSpritesheetController();
    initViewportController();
    initEditingController();
    initDebugController();
    initExtractedSpritesController();

    // Add event listeners managed directly by ui-controller (e.g., image upload)
    elements.imageUploadInput.addEventListener('change', handleImageUpload);

    // Initial UI state setup
    clearUIBeforeFirstLoad(); 
    console.log("UI Initialized");
}

// --- Image Loading ---
async function handleImageUpload(event) {
    console.log("Handling image upload...");

    const file = event.target.files ? event.target.files[0] : null;
    if (!file) {
        console.warn("Image upload event triggered, but no file found.");
        if (elements.imageUploadInput) elements.imageUploadInput.value = '';
        return;
    }

    // --- Clear state related to the *previous* image, but preserve selections ---
    clearStateForNewImageLoad();
    elements.processingStatusDiv.textContent = 'Loading image...';
    disableAllControls(true); 

    try {
        const imageInfo = await loadImageFromFile(file, elements.imagePreviewCanvas);
        const imageData = getImageDataFromCanvas(elements.imagePreviewCanvas);

        if (!imageData) {
            throw new Error("Could not get image pixel data after loading.");
        }

        // Set state for the new image, this preserves selectedSpritesForSheet
        setOriginalImage(imageInfo, imageData, file);

        resetZoomPanStateAndView();
        updateOverlayContainerDimensions();
        updateDebugView(); 

        elements.processingStatusDiv.textContent = 'Image loaded. Adjust settings and click "Detect Sprites".';
        syncThresholdSettingsToState();
        syncNumberInputsToSliders();
        updateMinSizeUI();
        disableAllControls(false); 
        elements.editingToolsSection.style.display = 'none'; 
        elements.extractedSpritesSection.style.display = 'none'; 

        // Don't clear generated spritesheet here, allow generating with mixed sprites
        // Clear and potentially re-render extracted sprites panels
        clearExtractedSpritesDisplay(); 

        console.log("Image loaded successfully.");
    } catch (error) {
        elements.processingStatusDiv.textContent = `Error: ${error.message}`;
        console.error("Image loading failed:", error);
        alert(`Error loading image: ${error.message}`);
        disableAllControls(false); 
        // Maybe call clearStateForNewImageLoad again to ensure clean state?
    } finally {
        if (elements.imageUploadInput) elements.imageUploadInput.value = '';
    }
}

// --- UI State Management ---

// Disables/enables controls based on current app state
export function disableAllControls(disabled) {
    const imageLoaded = !!appState.originalImageInfo;
    const spritesSelected = appState.selectedSpritesForSheet.length > 0;
    const processing = disabled; 

    // Settings Section (depends on having an image loaded)
    elements.thresholdTypeSelect.disabled = processing || !imageLoaded;
    elements.thresholdSlider.disabled = processing || !imageLoaded || appState.currentThresholdSettings.type !== 'manual';
    elements.thresholdNumberInput.disabled = processing || !imageLoaded || appState.currentThresholdSettings.type !== 'manual';
    elements.adaptiveBlocksizeInput.disabled = processing || !imageLoaded || !appState.currentThresholdSettings.type.startsWith('adaptive-');
    elements.adaptiveCInput.disabled = processing || !imageLoaded || !appState.currentThresholdSettings.type.startsWith('adaptive-');
    elements.minSizeSlider.disabled = processing || !imageLoaded;
    elements.minSizeNumberInput.disabled = processing || !imageLoaded;
    elements.debugViewCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);
    elements.debugOverlayCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);

    // Processing Button (depends on having an image loaded)
    elements.processButton.disabled = processing || !imageLoaded;

    // Editing Section Buttons are handled by updateEditModeUI (depends on image, detection, selection, current image source)
    updateEditModeUI();

    // Extracted Sprites Section buttons are handled by its own controller (depends on available/selected counts)
    updateExtractedSpritesButtons();

    // Spritesheet Section (depends on having sprites *selected*)
    elements.generateSpritesheetButton.disabled = processing || !spritesSelected;
    elements.gridColsInput.disabled = processing || !spritesSelected;
    elements.paddingInput.disabled = processing || !spritesSelected;
    elements.alignHSelect.disabled = processing || !spritesSelected;
    elements.alignVSelect.disabled = processing || !spritesSelected;
    // Download button depends on generated canvas existing
    elements.downloadSpritesheetButton.disabled = processing || !appState.generatedSpritesheetCanvas;

    // Zoom Buttons (depends on having an image loaded)
    elements.zoomInButton.disabled = processing || !imageLoaded;
    elements.zoomOutButton.disabled = processing || !imageLoaded;

    // Upload Input (only disable during active loading/processing)
    elements.imageUploadInput.disabled = processing;

    // Update dynamic UI states that depend on enabled/disabled status
    updateThresholdSettingsUI(); 
    // updateEditModeUI() is called above
    // updateExtractedSpritesButtons() is called above
}

// Clears UI and state related to the *current* image, preserving selections.
// Used when a *new* image is chosen.
function clearStateForNewImageLoad() {
    console.log("Clearing state for new image load (preserving selection)...");
    // Clear processing results (keeps selectedSpritesForSheet)
    clearProcessingResultsState();

    // Reset UI elements specifically tied to the image display/processing
    if (elements.imagePreviewCanvas) {
        const ctx = elements.imagePreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.imagePreviewCanvas.width, elements.imagePreviewCanvas.height);
        elements.imagePreviewCanvas.width = 1;
        elements.imagePreviewCanvas.height = 1;
    }
    clearTransforms();
    clearOverlays(elements.debugOverlaysContainer);
    // Clear extracted sprites panels (available will be empty, selected will persist if populated)
    clearExtractedSpritesDisplay();

    // Reset settings UI to defaults (user might want different settings for new image)
    // Optionally keep settings? For now, reset.
    resetThresholdSettings();
    syncThresholdSettingsToState();
    if(elements.minSizeSlider) elements.minSizeSlider.value = 10; 
    syncNumberInputsToSliders();
    updateMinSizeUI();

    // Reset other UI areas
    resetEditingOnLoad(); 
    clearGeneratedSpritesheet(); // Also clears spritesheet settings UI state
    if (elements.selectedSpritesStatsDiv) { 
        elements.selectedSpritesStatsDiv.innerHTML = "<p>Select sprites to see size information.</p>";
    }

    elements.processingStatusDiv.textContent = 'Loading new image...';

    // Reset Debug Checkboxes
    elements.debugViewCheckboxes.forEach(cb => cb.checked = false);
    elements.debugOverlayCheckboxes.forEach(cb => cb.checked = false);

    // Hide sections that depend on processing results for the *new* image
    elements.editingToolsSection.style.display = 'none';
    elements.extractedSpritesSection.style.display = 'none';

    // Controls will be disabled/enabled by handleImageUpload
}


// Clears absolutely everything - for the very first page load.
function clearUIBeforeFirstLoad() {
    console.log("Clearing full state and UI before first load.");
    clearFullAppState(); 

    // Reset UI elements specifically
    if (elements.imagePreviewCanvas) {
        const ctx = elements.imagePreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.imagePreviewCanvas.width, elements.imagePreviewCanvas.height);
        elements.imagePreviewCanvas.width = 1;
        elements.imagePreviewCanvas.height = 1;
    }
    clearTransforms();
    clearOverlays(elements.debugOverlaysContainer);
    clearExtractedSpritesDisplay(); 

    // Reset settings UI to defaults
    resetThresholdSettings();
    syncThresholdSettingsToState();
    if(elements.minSizeSlider) elements.minSizeSlider.value = 10;
    syncNumberInputsToSliders();
    updateMinSizeUI();

    // Reset other UI areas
    clearProcessingOnLoad();
    resetEditingOnLoad();
    clearGeneratedSpritesheet(); // Also clears spritesheet settings UI state
    if (elements.selectedSpritesStatsDiv) { 
        elements.selectedSpritesStatsDiv.innerHTML = "<p>Upload an image and select sprites to see size information.</p>";
    }

    elements.processingStatusDiv.textContent = 'Upload an image to start.';

    // Reset Debug Checkboxes
    elements.debugViewCheckboxes.forEach(cb => cb.checked = false);
    elements.debugOverlayCheckboxes.forEach(cb => cb.checked = false);

    // Hide sections that depend on processing results
    elements.editingToolsSection.style.display = 'none';
    elements.extractedSpritesSection.style.display = 'none';

    // Disable controls initially, except upload
    disableAllControls(true);
    elements.imageUploadInput.disabled = false;
    updateExtractedSpritesButtons(); 
}