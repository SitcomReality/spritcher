// --- DOM Element References ---
export const elements = {
    appContainer: null, // Added for main container styling access
    themeToggleButton: null, // Added
    imageUploadInput: null,
    imageUploadLabel: null, // Added potentially
    imagePreviewCanvas: null,
    imagePreviewContainer: null,
    debugOverlaysContainer: null,
    thresholdTypeSelect: null,
    manualThresholdSettingsDiv: null,
    adaptiveThresholdSettingsDiv: null,
    thresholdSlider: null,
    // thresholdValueSpan: null, // Removed, replaced by number input
    thresholdNumberInput: null, // Added
    adaptiveBlocksizeInput: null,
    adaptiveCInput: null,
    minSizeSlider: null,
    // minSizeValueSpan: null, // Removed, replaced by number input
    minSizeNumberInput: null, // Added
    debugViewCheckboxes: null, // Collection
    debugOverlayCheckboxes: null, // Collection
    showGrayscaleCheckbox: null,
    showThresholdCheckbox: null,
    showCCLCheckbox: null,
    showBBoxesCheckbox: null,
    processButton: null,
    processingStatusDiv: null,
    gridColsInput: null,
    paddingInput: null,
    alignmentSelect: null,
    generateSpritesheetButton: null,
    spritesheetPreviewCanvas: null,
    spritesheetPreviewContainer: null,
    downloadSpritesheetButton: null,
    zoomInButton: null,
    zoomOutButton: null,
    editingToolsSection: null,
    editToolbar: null,
    editModeButtons: null, // Collection
    deleteSelectedButton: null,
    editingStatusDiv: null
};

export function populateElements() {
    elements.appContainer = document.querySelector('.app-container'); // Updated selector
    elements.themeToggleButton = document.getElementById('theme-toggle-button'); // Added
    elements.imageUploadInput = document.getElementById('image-upload');
    elements.imageUploadLabel = document.querySelector('label[for="image-upload"]'); 
    elements.imagePreviewCanvas = document.getElementById('image-preview-canvas');
    elements.imagePreviewContainer = document.getElementById('image-preview-container');
    elements.debugOverlaysContainer = document.getElementById('debug-overlays');
    elements.thresholdTypeSelect = document.getElementById('threshold-type-select');
    elements.manualThresholdSettingsDiv = document.getElementById('manual-threshold-settings');
    elements.adaptiveThresholdSettingsDiv = document.getElementById('adaptive-threshold-settings');
    elements.thresholdSlider = document.getElementById('threshold-slider');
    elements.thresholdNumberInput = document.getElementById('threshold-number-input'); // Added
    elements.adaptiveBlocksizeInput = document.getElementById('adaptive-blocksize-input');
    elements.adaptiveCInput = document.getElementById('adaptive-c-input');
    elements.minSizeSlider = document.getElementById('min-sprite-size-slider');
    elements.minSizeNumberInput = document.getElementById('min-sprite-size-number-input'); // Added
    elements.debugViewCheckboxes = document.querySelectorAll('input[name="debug-view"]');
    elements.debugOverlayCheckboxes = document.querySelectorAll('input[name="debug-overlay"]');
    elements.showGrayscaleCheckbox = document.getElementById('show-grayscale-checkbox');
    elements.showThresholdCheckbox = document.getElementById('show-threshold-checkbox');
    elements.showCCLCheckbox = document.getElementById('show-ccl-checkbox');
    elements.showBBoxesCheckbox = document.getElementById('show-bboxes-checkbox');
    elements.processButton = document.getElementById('process-button');
    elements.processingStatusDiv = document.getElementById('processing-status');
    elements.gridColsInput = document.getElementById('grid-cols-input');
    elements.paddingInput = document.getElementById('padding-input');
    elements.alignmentSelect = document.getElementById('alignment-select');
    elements.generateSpritesheetButton = document.getElementById('generate-spritesheet-button');
    elements.spritesheetPreviewCanvas = document.getElementById('spritesheet-preview-canvas');
    elements.spritesheetPreviewContainer = document.getElementById('spritesheet-preview-container');
    elements.downloadSpritesheetButton = document.getElementById('download-spritesheet-button');
    elements.zoomInButton = document.getElementById('zoom-in-button');
    elements.zoomOutButton = document.getElementById('zoom-out-button');
    elements.editingToolsSection = document.getElementById('editing-tools-section');
    elements.editToolbar = document.getElementById('edit-toolbar');
    elements.editModeButtons = document.querySelectorAll('.edit-mode-btn');
    elements.deleteSelectedButton = document.getElementById('delete-selected-btn');
    elements.editingStatusDiv = document.getElementById('editing-status');

    // Validation
    for (const key in elements) {
        // Skip validation for collections that might be empty initially
        const isCollection = key.endsWith('Buttons') || key.endsWith('Checkboxes');
        if (elements[key] === null && !isCollection) {
            console.warn(`DOM element not found for key: ${key}`);
        } else if (isCollection && !(elements[key] instanceof NodeList)) {
             // Catch if a collection variable didn't get a NodeList (but allow empty NodeList)
            console.warn(`Expected NodeList but got different type for key: ${key}`);
        }
    }
    console.log("DOM elements populated.");
}