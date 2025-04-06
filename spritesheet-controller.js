import { elements } from 'dom-elements';
import { appState, setGeneratedSpritesheet, clearGeneratedSpritesheetState } from 'state';
import { generateSpritesheet, downloadCanvasAsPNG } from 'spritesheet-generator';
import { disableAllControls } from 'ui-controller';

export function initSpritesheetController() {
    elements.gridColsInput.addEventListener('change', handleSpritesheetSettingsChange);
    elements.paddingInput.addEventListener('change', handleSpritesheetSettingsChange);
    elements.alignmentSelect.addEventListener('change', handleSpritesheetSettingsChange);
    elements.generateSpritesheetButton.addEventListener('click', handleGenerateSpritesheet);
    elements.downloadSpritesheetButton.addEventListener('click', handleDownloadSpritesheet);
}

// Handles changes to spritesheet layout settings
function handleSpritesheetSettingsChange() {
    clearGeneratedSpritesheet();
    elements.processingStatusDiv.textContent = "Spritesheet settings changed. Click 'Generate Spritesheet' to update.";
}

// Generates and displays the spritesheet
async function handleGenerateSpritesheet() {
    if (!appState.detectedBlobs || appState.detectedBlobs.length === 0) {
        alert("No sprites detected. Click 'Detect Sprites' first.");
        return;
    }
    if (!appState.originalImageData) {
        alert("Original image data is missing. Please re-upload.");
        return;
    }

    console.log("Generating spritesheet...");
    elements.processingStatusDiv.textContent = 'Generating spritesheet...';
    disableAllControls(true);

    const cols = parseInt(elements.gridColsInput.value, 10) || 8;
    const padding = parseInt(elements.paddingInput.value, 10) || 0;
    const alignment = elements.alignmentSelect.value;

    try {
        const resultCanvas = await generateSpritesheet(
            appState.originalImageData,
            appState.detectedBlobs,
            cols,
            padding,
            alignment
        );

        setGeneratedSpritesheet(resultCanvas); // Store in state

        // Display in preview canvas
        const previewCtx = elements.spritesheetPreviewCanvas.getContext('2d');
        elements.spritesheetPreviewCanvas.width = resultCanvas.width;
        elements.spritesheetPreviewCanvas.height = resultCanvas.height;
        previewCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
        previewCtx.drawImage(resultCanvas, 0, 0);

        elements.processingStatusDiv.textContent = `Spritesheet generated (${appState.detectedBlobs.length} sprites). Ready to download.`;
        elements.downloadSpritesheetButton.disabled = false;
        console.log("Spritesheet generation and preview complete.");

    } catch (error) {
        console.error("Spritesheet generation failed:", error);
        elements.processingStatusDiv.textContent = `Error generating spritesheet: ${error.message}`;
        alert(`Error generating spritesheet: ${error.message}`);
        clearGeneratedSpritesheet(); // Clear state and UI
    } finally {
        disableAllControls(false);
    }
}

// Prepares the spritesheet for download as a PNG
function handleDownloadSpritesheet() {
    if (!appState.generatedSpritesheetCanvas) {
        alert("Please generate the spritesheet first using the 'Generate Spritesheet' button.");
        return;
    }
    console.log("Preparing spritesheet download...");
    let filename = 'spritcher_spritesheet.png';
    if (elements.imageUploadInput.files && elements.imageUploadInput.files[0]) {
        const originalName = elements.imageUploadInput.files[0].name;
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        filename = `${baseName}_spritesheet.png`;
    }

    downloadCanvasAsPNG(appState.generatedSpritesheetCanvas, filename);
}

// Clears the generated spritesheet state and UI
export function clearGeneratedSpritesheet() {
    clearGeneratedSpritesheetState(); // Clear state
    if (elements.spritesheetPreviewCanvas) {
        const ctx = elements.spritesheetPreviewCanvas.getContext('2d');
        elements.spritesheetPreviewCanvas.width = 1;
        elements.spritesheetPreviewCanvas.height = 1;
        ctx.clearRect(0, 0, 1, 1);
    }
    if(elements.downloadSpritesheetButton) elements.downloadSpritesheetButton.disabled = true;
    console.log("Spritesheet cleared.");
}