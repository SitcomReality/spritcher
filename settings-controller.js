import { elements } from 'dom-elements';
import { appState, setThresholdSettings } from 'state';
import { invalidateProcessing } from 'processing-controller';

export function initSettingsController() {
    elements.thresholdTypeSelect.addEventListener('change', handleThresholdTypeChange);
    elements.thresholdSlider.addEventListener('input', handleManualThresholdChange);
    elements.adaptiveBlocksizeInput.addEventListener('input', handleAdaptiveParamsChange);
    elements.adaptiveCInput.addEventListener('input', handleAdaptiveParamsChange);
    elements.minSizeSlider.addEventListener('input', handleMinSizeChange);
    updateThresholdSettingsUI();
    updateMinSizeUI();
}

function handleThresholdTypeChange() {
    setThresholdSettings({ type: elements.thresholdTypeSelect.value });
    updateThresholdSettingsUI();
    invalidateProcessing(); // Clear processing results
    elements.processingStatusDiv.textContent = "Threshold type changed. Click 'Detect Sprites' to update results.";
}

function handleManualThresholdChange() {
    setThresholdSettings({ manualValue: parseInt(elements.thresholdSlider.value, 10) });
    updateThresholdSettingsUI();
    invalidateProcessing();
    elements.processingStatusDiv.textContent = "Manual threshold changed. Click 'Detect Sprites' to update results.";
}

function handleAdaptiveParamsChange() {
    // Ensure block size is odd
    let blockSize = parseInt(elements.adaptiveBlocksizeInput.value, 10);
    if (blockSize % 2 === 0) {
        blockSize = Math.max(3, blockSize + 1);
        elements.adaptiveBlocksizeInput.value = blockSize;
    }
    if (blockSize < 3) {
        blockSize = 3;
        elements.adaptiveBlocksizeInput.value = 3;
    }

    setThresholdSettings({
        adaptiveBlockSize: blockSize,
        adaptiveC: parseInt(elements.adaptiveCInput.value, 10)
    });

    updateThresholdSettingsUI();
    invalidateProcessing();
    elements.processingStatusDiv.textContent = "Adaptive threshold params changed. Click 'Detect Sprites' to update results.";
}

function handleMinSizeChange() {
    updateMinSizeUI();
    // Invalidate only blob detection and downstream results
    invalidateProcessing(true); // Keep thresholded
    elements.processingStatusDiv.textContent = "Min size changed. Click 'Detect Sprites' to update results.";
}

export function updateThresholdSettingsUI() {
    const settings = appState.currentThresholdSettings;
    const imageLoaded = !!appState.originalImageInfo;

    elements.manualThresholdSettingsDiv.classList.toggle('visible', settings.type === 'manual');
    elements.adaptiveThresholdSettingsDiv.classList.toggle('visible', settings.type.startsWith('adaptive-'));

    elements.thresholdValueSpan.textContent = settings.manualValue;
    elements.thresholdSlider.value = settings.manualValue;
    elements.adaptiveBlocksizeInput.value = settings.adaptiveBlockSize;
    elements.adaptiveCInput.value = settings.adaptiveC;

    elements.thresholdSlider.disabled = (settings.type !== 'manual' || !imageLoaded);
    elements.adaptiveBlocksizeInput.disabled = (!settings.type.startsWith('adaptive-') || !imageLoaded);
    elements.adaptiveCInput.disabled = (!settings.type.startsWith('adaptive-') || !imageLoaded);
    elements.thresholdTypeSelect.disabled = !imageLoaded;
}

export function updateMinSizeUI() {
    elements.minSizeValueSpan.textContent = elements.minSizeSlider.value;
    elements.minSizeSlider.disabled = !appState.originalImageInfo;
}

// Update threshold settings from loaded defaults if needed
export function syncThresholdSettingsToState() {
     const settings = appState.currentThresholdSettings;
     elements.thresholdTypeSelect.value = settings.type;
     elements.thresholdSlider.value = settings.manualValue;
     elements.adaptiveBlocksizeInput.value = settings.adaptiveBlockSize;
     elements.adaptiveCInput.value = settings.adaptiveC;
     updateThresholdSettingsUI();
}