// --- DOM Element References ---
export const elements = {
    appContainer: null, 
    themeToggleButton: null, 
    imageUploadInput: null,
    imageUploadLabel: null, 
    imagePreviewCanvas: null,
    imagePreviewContainer: null,
    debugOverlaysContainer: null,
    thresholdTypeSelect: null,
    manualThresholdSettingsDiv: null,
    adaptiveThresholdSettingsDiv: null,
    thresholdSlider: null,
    thresholdNumberInput: null, 
    adaptiveBlocksizeInput: null,
    adaptiveCInput: null,
    minSizeSlider: null,
    minSizeNumberInput: null, 
    debugViewCheckboxes: null, 
    debugOverlayCheckboxes: null, 
    showGrayscaleCheckbox: null,
    showThresholdCheckbox: null,
    showCCLCheckbox: null,
    showBBoxesCheckbox: null,
    processButton: null,
    processingStatusDiv: null,
    gridColsInput: null,
    paddingInput: null,
    cellWidthInput: null, 
    cellHeightInput: null, 
    useRecommendedSizeButton: null, 
    alignHSelect: null, 
    alignVSelect: null, 
    generateSpritesheetButton: null,
    spritesheetPreviewCanvas: null,
    spritesheetPreviewContainer: null,
    downloadSpritesheetButton: null,
    zoomInButton: null,
    zoomOutButton: null,
    editingToolsSection: null,
    editToolbar: null,
    editModeButtons: null, 
    deleteSelectedButton: null,
    editingStatusDiv: null,
    extractedSpritesSection: null,
    availableSpritesDisplayContainer: null,
    availableSpritesCountSpan: null,
    addAllAvailableButton: null,
    selectedSpritesDisplayContainer: null,
    selectedSpritesCountSpan: null,
    removeAllSelectedButton: null,
    selectedSpritesStatsDiv: null,
    transparencyThresholdHint: null,
    helpButton: null,
    helpDialog: null,
    helpCloseButton: null,
};

export function populateElements() {
    elements.appContainer = document.querySelector('.app-container');
    elements.themeToggleButton = document.getElementById('theme-toggle-button');
    elements.imageUploadInput = document.getElementById('image-upload');
    elements.imageUploadLabel = document.querySelector('label[for="image-upload"]');
    elements.imagePreviewCanvas = document.getElementById('image-preview-canvas');
    elements.imagePreviewContainer = document.getElementById('image-preview-container');
    elements.debugOverlaysContainer = document.getElementById('debug-overlays');
    elements.thresholdTypeSelect = document.getElementById('threshold-type-select');
    elements.manualThresholdSettingsDiv = document.getElementById('manual-threshold-settings');
    elements.adaptiveThresholdSettingsDiv = document.getElementById('adaptive-threshold-settings');
    elements.thresholdSlider = document.getElementById('threshold-slider');
    elements.thresholdNumberInput = document.getElementById('threshold-number-input');
    elements.adaptiveBlocksizeInput = document.getElementById('adaptive-blocksize-input');
    elements.adaptiveCInput = document.getElementById('adaptive-c-input');
    elements.minSizeSlider = document.getElementById('min-sprite-size-slider');
    elements.minSizeNumberInput = document.getElementById('min-sprite-size-number-input');
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
    elements.cellWidthInput = document.getElementById('cell-width-input'); 
    elements.cellHeightInput = document.getElementById('cell-height-input'); 
    elements.useRecommendedSizeButton = document.getElementById('use-recommended-size-btn'); 
    elements.alignHSelect = document.getElementById('align-h-select');
    elements.alignVSelect = document.getElementById('align-v-select');
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
    elements.extractedSpritesSection = document.getElementById('extracted-sprites-section');
    elements.availableSpritesDisplayContainer = document.getElementById('available-sprites-display');
    elements.availableSpritesCountSpan = document.getElementById('available-sprites-count');
    elements.addAllAvailableButton = document.getElementById('add-all-available-btn');
    elements.selectedSpritesDisplayContainer = document.getElementById('selected-sprites-display');
    elements.selectedSpritesCountSpan = document.getElementById('selected-sprites-count');
    elements.removeAllSelectedButton = document.getElementById('remove-all-selected-btn');
    elements.selectedSpritesStatsDiv = document.getElementById('selected-sprites-stats');
    elements.transparencyThresholdHint = document.getElementById('transparency-threshold-hint');
    elements.helpButton = document.getElementById('help-button');
    elements.helpDialog = document.getElementById('help-dialog');
    elements.helpCloseButton = document.getElementById('help-close-button');
}