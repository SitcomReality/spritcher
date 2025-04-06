import { loadImageFromFile, getImageDataFromCanvas } from 'image-loader';
import { elements, populateElements } from 'dom-elements';
import { appState, setOriginalImage, clearFullAppState, resetThresholdSettings } from 'state';
import { initSettingsController, updateThresholdSettingsUI, updateMinSizeUI, syncThresholdSettingsToState, syncNumberInputsToSliders } from 'settings-controller';
import { initProcessingController, clearProcessingOnLoad } from 'processing-controller';
import { initSpritesheetController, clearGeneratedSpritesheet } from 'spritesheet-controller';
import { initViewportController, resetZoomPanStateAndView, updateImageDisplayTransform, updateOverlayContainerDimensions, clearTransforms } from 'viewport-controller';
import { initEditingController, resetEditingOnLoad } from 'editing-controller';
import { updateEditModeUI } from 'mode-controller';
import { initDebugController, updateDebugView, updateDebugOverlays, clearOverlays } from 'debug-controller';
import { initThemeController } from 'theme-controller';
import { initExtractedSpritesController, clearExtractedSpritesDisplay, updateButtonStates as updateExtractedSpritesButtons } from 'extracted-sprites-controller';

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
    clearStateBeforeLoad();
    console.log("UI Initialized");
}

// --- Image Loading ---
async function handleImageUpload(event) {
    console.log("Handling image upload...");

    // --- Get the file FIRST ---
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) {
        console.warn("Image upload event triggered, but no file found.");
        if (elements.imageUploadInput) elements.imageUploadInput.value = '';
        return; // Exit if no file
    }

    // --- Now clear state and update UI for loading ---
    clearStateBeforeLoad(); // Clears everything, including selected sprites
    elements.processingStatusDiv.textContent = 'Loading image...';
    disableAllControls(true);

    try {
        // --- Pass the file object, not the input element ---
        const imageInfo = await loadImageFromFile(file, elements.imagePreviewCanvas);
        const imageData = getImageDataFromCanvas(elements.imagePreviewCanvas);

        if (!imageData) {
            throw new Error("Could not get image pixel data after loading.");
        }

        setOriginalImage(imageInfo, imageData); // This also clears extracted/selected state

        resetZoomPanStateAndView();
        updateOverlayContainerDimensions();
        updateDebugView();

        elements.processingStatusDiv.textContent = 'Image loaded. Adjust settings and click "Detect Sprites".';
        syncThresholdSettingsToState();
        syncNumberInputsToSliders();
        updateMinSizeUI();
        disableAllControls(false);
        elements.editingToolsSection.style.display = 'none';
        elements.extractedSpritesSection.style.display = 'none'; // Hide initially
        clearGeneratedSpritesheet();
        clearExtractedSpritesDisplay(); // Ensure displays are cleared

        console.log("Image loaded successfully.");
    } catch (error) {
        elements.processingStatusDiv.textContent = `Error: ${error.message}`;
        console.error("Image loading failed:", error);
        alert(`Error loading image: ${error.message}`);
        clearStateBeforeLoad();
    } finally {
        // --- Clear the input value AFTER processing is done (or failed) ---
        if (elements.imageUploadInput) elements.imageUploadInput.value = '';
    }
}

// --- UI State Management ---

// Disables/enables controls based on current app state
export function disableAllControls(disabled) {
    const imageLoaded = !!appState.originalImageInfo;
    // Note: selectedSprites check now refers to appState.selectedSpritesForSheet.length
    const spritesSelected = appState.selectedSpritesForSheet.length > 0;
    const processing = disabled;

    // Settings Section (individual disable logic handled in settings-controller)
    elements.thresholdTypeSelect.disabled = processing || !imageLoaded;
    elements.thresholdSlider.disabled = processing || !imageLoaded || appState.currentThresholdSettings.type !== 'manual';
    elements.thresholdNumberInput.disabled = processing || !imageLoaded || appState.currentThresholdSettings.type !== 'manual';
    elements.adaptiveBlocksizeInput.disabled = processing || !imageLoaded || !appState.currentThresholdSettings.type.startsWith('adaptive-');
    elements.adaptiveCInput.disabled = processing || !imageLoaded || !appState.currentThresholdSettings.type.startsWith('adaptive-');
    elements.minSizeSlider.disabled = processing || !imageLoaded;
    elements.minSizeNumberInput.disabled = processing || !imageLoaded;
    elements.debugViewCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);
    elements.debugOverlayCheckboxes.forEach(cb => cb.disabled = processing || !imageLoaded);

    // Processing Button
    elements.processButton.disabled = processing || !imageLoaded;

    // Editing Section Buttons are handled by updateEditModeUI based on state
    updateEditModeUI();

    // Extracted Sprites Section buttons are handled by its own controller
    updateExtractedSpritesButtons(); // Call the specific update function

    // Spritesheet Section
    // Generate/Layout controls depend on having *selected* sprites
    elements.generateSpritesheetButton.disabled = processing || !imageLoaded || !spritesSelected;
    elements.gridColsInput.disabled = processing || !imageLoaded || !spritesSelected;
    elements.paddingInput.disabled = processing || !imageLoaded || !spritesSelected;
    elements.alignmentSelect.disabled = processing || !imageLoaded || !spritesSelected;
    // Download button depends on generated canvas existing
    elements.downloadSpritesheetButton.disabled = processing || !imageLoaded || !appState.generatedSpritesheetCanvas;

    // Zoom Buttons
    elements.zoomInButton.disabled = processing || !imageLoaded;
    elements.zoomOutButton.disabled = processing || !imageLoaded;

    // Upload Input (only disable during active loading/processing)
    elements.imageUploadInput.disabled = processing;

    // Update dynamic UI states that depend on enabled/disabled status
    updateThresholdSettingsUI();
    // updateEditModeUI() is already called above
    // updateExtractedSpritesButtons() is already called above
}

// Clears everything including the loaded image and resets UI fully
function clearStateBeforeLoad() {
    console.log("Clearing full state and UI before load.");
    clearFullAppState(); // Clears state including extracted/selected

    // Reset UI elements specifically
    if (elements.imagePreviewCanvas) {
        const ctx = elements.imagePreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.imagePreviewCanvas.width, elements.imagePreviewCanvas.height);
        elements.imagePreviewCanvas.width = 1;
        elements.imagePreviewCanvas.height = 1;
    }
    clearTransforms();
    clearOverlays(elements.debugOverlaysContainer);
    clearExtractedSpritesDisplay(); // Clear both extracted sprites UI panels

    // Reset settings UI to defaults
    resetThresholdSettings();
    syncThresholdSettingsToState();
    if(elements.minSizeSlider) elements.minSizeSlider.value = 10;
    syncNumberInputsToSliders();
    updateMinSizeUI();

    // Reset other UI areas
    clearProcessingOnLoad(); // Already hides sections
    resetEditingOnLoad();
    clearGeneratedSpritesheet();

    elements.processingStatusDiv.textContent = 'Upload an image and adjust settings to start.';

    // Reset Debug Checkboxes
    elements.debugViewCheckboxes.forEach(cb => cb.checked = false);
    elements.debugOverlayCheckboxes.forEach(cb => cb.checked = false);

    // Hide sections that depend on processing results
    elements.editingToolsSection.style.display = 'none';
    elements.extractedSpritesSection.style.display = 'none';


    // Disable controls initially, except upload
    disableAllControls(true);
    elements.imageUploadInput.disabled = false;
    // Ensure extracted sprites buttons are also disabled initially
    updateExtractedSpritesButtons();
}