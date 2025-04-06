import { elements } from 'dom-elements';
import { appState, setGeneratedSpritesheet, clearGeneratedSpritesheetState } from 'state';
import { generateSpritesheet, downloadCanvasAsPNG, calculateRecommendedLayout } from 'spritesheet-generator';
import { disableAllControls } from 'ui-controller';
import { updateSpriteStats } from 'extracted-sprites-controller';

export function initSpritesheetController() {
    elements.gridColsInput.addEventListener('change', handleSpritesheetSettingsChange);
    elements.paddingInput.addEventListener('change', handleSpritesheetSettingsChange);
    elements.cellWidthInput?.addEventListener('input', handleSpritesheetSettingsChange);
    elements.cellHeightInput?.addEventListener('input', handleSpritesheetSettingsChange);
    elements.useRecommendedSizeButton?.addEventListener('click', handleUseRecommendedSize);
    elements.alignHSelect.addEventListener('change', handleSpritesheetSettingsChange);
    elements.alignVSelect.addEventListener('change', handleSpritesheetSettingsChange);
    elements.generateSpritesheetButton.addEventListener('click', handleGenerateSpritesheet);
    elements.downloadSpritesheetButton.addEventListener('click', handleDownloadSpritesheet);
}

// Handles changes to spritesheet layout settings
function handleSpritesheetSettingsChange() {
    clearGeneratedSpritesheetPreview();
    elements.processingStatusDiv.textContent = "Spritesheet layout settings changed. Click 'Generate Spritesheet' to update.";
    elements.generateSpritesheetButton.disabled = appState.selectedSpritesForSheet.length === 0;
    updateSpriteStats();
}

// Handles click on "Use Recommended Size" button
function handleUseRecommendedSize() {
    const selectedSprites = appState.selectedSpritesForSheet;
    if (selectedSprites.length === 0) {
        alert("Please select some sprites first to calculate recommended size.");
        return;
    }
    const padding = parseInt(elements.paddingInput.value, 10) || 0;
    const layout = calculateRecommendedLayout(selectedSprites, padding);

    if (layout && elements.cellWidthInput && elements.cellHeightInput) {
        elements.cellWidthInput.value = layout.recommendedCellWidth;
        elements.cellHeightInput.value = layout.recommendedCellHeight;
        console.log(`Set cell size inputs to recommended: ${layout.recommendedCellWidth}x${layout.recommendedCellHeight}`);
        handleSpritesheetSettingsChange();
    } else {
        console.warn("Could not calculate or apply recommended size.");
    }
}

// Generates and displays the spritesheet using selected sprites
async function handleGenerateSpritesheet() {
    const spritesToInclude = appState.selectedSpritesForSheet;

    if (spritesToInclude.length === 0) {
        alert("No sprites selected for the spritesheet. Please add sprites to the 'Selected for Sheet' panel first.");
        return;
    }

    const missingData = spritesToInclude.some(s => !s.sourceImageData);
    if (missingData) {
        alert("Error: Some selected sprites are missing their source image data. Cannot generate spritesheet.");
        console.error("Cannot generate spritesheet: Missing sourceImageData in selectedSpritesForSheet", spritesToInclude.filter(s => !s.sourceImageData));
        return;
    }

    console.log(`Generating spritesheet with ${spritesToInclude.length} selected sprites...`);
    elements.processingStatusDiv.textContent = 'Generating spritesheet...';
    disableAllControls(true);

    const cols = parseInt(elements.gridColsInput.value, 10) || 8;
    const padding = parseInt(elements.paddingInput.value, 10) || 0;
    const alignH = elements.alignHSelect.value;
    const alignV = elements.alignVSelect.value;
    const userCellWidth = parseInt(elements.cellWidthInput?.value, 10);
    const userCellHeight = parseInt(elements.cellHeightInput?.value, 10);
    const finalUserCellWidth = (userCellWidth && userCellWidth > 0) ? userCellWidth : null;
    const finalUserCellHeight = (userCellHeight && userCellHeight > 0) ? userCellHeight : null;

    try {
        const resultCanvas = await generateSpritesheet(
            spritesToInclude,
            cols,
            padding,
            alignH,
            alignV,
            finalUserCellWidth,
            finalUserCellHeight
        );

        setGeneratedSpritesheet(resultCanvas);
        displayGeneratedSpritesheetPreview(resultCanvas);

        elements.processingStatusDiv.textContent = `Spritesheet generated (${spritesToInclude.length} sprites). Ready to download.`;
        elements.downloadSpritesheetButton.disabled = false;
        updateSpriteStats();
        console.log("Spritesheet generation and preview complete.");

    } catch (error) {
        console.error("Spritesheet generation failed:", error);
        elements.processingStatusDiv.textContent = `Error generating spritesheet: ${error.message}`;
        alert(`Error generating spritesheet: ${error.message}`);
        clearGeneratedSpritesheet();
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
    if (appState.selectedSpritesForSheet.length > 0) {
        const firstSourceId = appState.selectedSpritesForSheet[0].sourceImageId;
        const nameParts = firstSourceId.split('-');
        if (nameParts.length > 2) {
            const originalName = nameParts.slice(0, -2).join('-');
            const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
            if (baseName && baseName !== 'unknown') {
                filename = `${baseName}_spritesheet.png`;
            }
        }
    }

    downloadCanvasAsPNG(appState.generatedSpritesheetCanvas, filename);
}

// Displays the generated spritesheet canvas in the preview area
function displayGeneratedSpritesheetPreview(canvas) {
    if (elements.spritesheetPreviewCanvas && canvas) {
        const previewCtx = elements.spritesheetPreviewCanvas.getContext('2d');
        elements.spritesheetPreviewCanvas.width = canvas.width;
        elements.spritesheetPreviewCanvas.height = canvas.height;
        previewCtx.clearRect(0, 0, canvas.width, canvas.height);
        previewCtx.drawImage(canvas, 0, 0);
    }
}

// Clears only the spritesheet preview canvas and disables download button
function clearGeneratedSpritesheetPreview() {
    if (elements.spritesheetPreviewCanvas) {
        const ctx = elements.spritesheetPreviewCanvas.getContext('2d');
        const w = elements.spritesheetPreviewCanvas.width || 1;
        const h = elements.spritesheetPreviewCanvas.height || 1;
        ctx.clearRect(0, 0, w, h);
    }
    if (elements.downloadSpritesheetButton) elements.downloadSpritesheetButton.disabled = true;
}

// Clears the generated spritesheet state AND UI completely
export function clearGeneratedSpritesheet() {
    clearGeneratedSpritesheetState();
    clearGeneratedSpritesheetPreview();
    if (elements.gridColsInput) elements.gridColsInput.value = 8;
    if (elements.paddingInput) elements.paddingInput.value = 2;
    if (elements.cellWidthInput) elements.cellWidthInput.value = '';
    if (elements.cellHeightInput) elements.cellHeightInput.value = '';
    if (elements.alignHSelect) elements.alignHSelect.value = 'center';
    if (elements.alignVSelect) elements.alignVSelect.value = 'center';
    console.log("Spritesheet state and UI cleared.");
}