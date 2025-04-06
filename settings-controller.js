import { elements } from 'dom-elements';
import { appState, setThresholdSettings } from 'state';
import { invalidateProcessing } from 'processing-controller';

export function initSettingsController() {
    elements.thresholdTypeSelect.addEventListener('change', handleThresholdTypeChange);
    elements.thresholdSlider.addEventListener('input', handleManualThresholdSliderChange);
    elements.thresholdNumberInput.addEventListener('change', handleManualThresholdNumberChange); 
    elements.adaptiveBlocksizeInput.addEventListener('input', handleAdaptiveParamsChange);
    elements.adaptiveCInput.addEventListener('input', handleAdaptiveParamsChange);
    elements.minSizeSlider.addEventListener('input', handleMinSizeSliderChange);
    elements.minSizeNumberInput.addEventListener('change', handleMinSizeNumberChange); 

    syncNumberInputsToSliders(); 
    updateThresholdSettingsUI();
    updateMinSizeUI();
}

export function syncNumberInputsToSliders() {
    if(elements.thresholdSlider && elements.thresholdNumberInput) {
        elements.thresholdNumberInput.value = elements.thresholdSlider.value;
    }
    if(elements.minSizeSlider && elements.minSizeNumberInput) {
        elements.minSizeNumberInput.value = elements.minSizeSlider.value;
    }
}

function handleThresholdTypeChange() {
    setThresholdSettings({ type: elements.thresholdTypeSelect.value });
    updateThresholdSettingsUI();
    invalidateProcessing(); 
    elements.processingStatusDiv.textContent = "Background removal method changed. Click 'Detect Sprites' to update results.";
}

function handleManualThresholdSliderChange() {
    const value = parseInt(elements.thresholdSlider.value, 10);
    elements.thresholdNumberInput.value = value; 
    setThresholdSettings({ manualValue: value });
    invalidateProcessing();
    elements.processingStatusDiv.textContent = "Manual threshold changed. Click 'Detect Sprites' to update results.";
}

function handleManualThresholdNumberChange() {
    let value = parseInt(elements.thresholdNumberInput.value, 10);
    value = Math.max(0, Math.min(255, value || 0));
    elements.thresholdNumberInput.value = value; 
    elements.thresholdSlider.value = value; 
    setThresholdSettings({ manualValue: value });
    invalidateProcessing();
    elements.processingStatusDiv.textContent = "Manual threshold changed. Click 'Detect Sprites' to update results.";
}


function handleAdaptiveParamsChange() {
    let blockSize = parseInt(elements.adaptiveBlocksizeInput.value, 10);
    if(isNaN(blockSize)) blockSize = 3; 
    if (blockSize % 2 === 0 && blockSize > 0) {
        blockSize = blockSize + 1; 
    }
     blockSize = Math.max(3, blockSize); 
    elements.adaptiveBlocksizeInput.value = blockSize; 

    let cValue = parseInt(elements.adaptiveCInput.value, 10);
    if(isNaN(cValue)) cValue = 0; 
    elements.adaptiveCInput.value = cValue; 

    setThresholdSettings({
        adaptiveBlockSize: blockSize,
        adaptiveC: cValue
    });

    updateThresholdSettingsUI(); 
    invalidateProcessing();
    elements.processingStatusDiv.textContent = "Adaptive threshold params changed. Click 'Detect Sprites' to update results.";
}

function handleMinSizeSliderChange() {
    const value = parseInt(elements.minSizeSlider.value, 10);
    elements.minSizeNumberInput.value = value; 
    updateMinSizeUI(); 
    invalidateProcessing(true); 
    elements.processingStatusDiv.textContent = "Min size changed. Click 'Detect Sprites' to update results.";
}

function handleMinSizeNumberChange() {
    let value = parseInt(elements.minSizeNumberInput.value, 10);
    const maxVal = parseInt(elements.minSizeSlider.max, 10);
    value = Math.max(1, Math.min(maxVal, value || 1));
    elements.minSizeNumberInput.value = value; 
    elements.minSizeSlider.value = value; 
    updateMinSizeUI();
    invalidateProcessing(true); 
    elements.processingStatusDiv.textContent = "Min size changed. Click 'Detect Sprites' to update results.";
}


export function updateThresholdSettingsUI() {
    const settings = appState.currentThresholdSettings;
    const imageLoaded = !!appState.originalImageInfo;

    elements.manualThresholdSettingsDiv.classList.toggle('visible', settings.type === 'manual');
    elements.adaptiveThresholdSettingsDiv.classList.toggle('visible', settings.type.startsWith('adaptive-'));

    elements.thresholdSlider.value = settings.manualValue;
    elements.thresholdNumberInput.value = settings.manualValue;
    elements.adaptiveBlocksizeInput.value = settings.adaptiveBlockSize;
    elements.adaptiveCInput.value = settings.adaptiveC;

    elements.thresholdSlider.disabled = (settings.type !== 'manual' || !imageLoaded);
    elements.thresholdNumberInput.disabled = (settings.type !== 'manual' || !imageLoaded);
    elements.adaptiveBlocksizeInput.disabled = (!settings.type.startsWith('adaptive-') || !imageLoaded);
    elements.adaptiveCInput.disabled = (!settings.type.startsWith('adaptive-') || !imageLoaded);
    elements.thresholdTypeSelect.disabled = !imageLoaded;
}

export function updateMinSizeUI() {
    elements.minSizeSlider.disabled = !appState.originalImageInfo;
    elements.minSizeNumberInput.disabled = !appState.originalImageInfo;
}

export function syncThresholdSettingsToState() {
     const settings = appState.currentThresholdSettings;
     elements.thresholdTypeSelect.value = settings.type;
     elements.thresholdSlider.value = settings.manualValue;
     elements.thresholdNumberInput.value = settings.manualValue; 
     elements.adaptiveBlocksizeInput.value = settings.adaptiveBlockSize;
     elements.adaptiveCInput.value = settings.adaptiveC;
     updateThresholdSettingsUI();
}