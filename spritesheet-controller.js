import { elements } from 'dom-elements';
import { appState, setGeneratedSpritesheet, clearGeneratedSpritesheetState } from 'state';
import { generateSpritesheet, downloadCanvasAsPNG } from 'spritesheet-generator';
import { disableAllControls } from 'ui-controller'; // Keep for disabling during generation

export function initSpritesheetController() {
    elements.gridColsInput.addEventListener('change', handleSpritesheetSettingsChange);
    elements.paddingInput.addEventListener('change', handleSpritesheetSettingsChange);
    elements.alignmentSelect.addEventListener('change', handleSpritesheetSettingsChange);
    elements.generateSpritesheetButton.addEventListener('click', handleGenerateSpritesheet);
    elements.downloadSpritesheetButton.addEventListener('click', handleDownloadSpritesheet);
}

// Handles changes to spritesheet layout settings
function handleSpritesheetSettingsChange() {
    clearGeneratedSpritesheet(); // Clear only the generated sheet, not selection
    elements.processingStatusDiv.textContent = "Spritesheet layout settings changed. Click 'Generate Spritesheet' to update.";
    // Re-enable generate button if sprites are selected
     elements.generateSpritesheetButton.disabled = appState.selectedSpritesForSheet.length === 0;
}

// Generates and displays the spritesheet using selected sprites
async function handleGenerateSpritesheet() {
    // Use selectedSpritesForSheet which now holds the actual sprite objects in the desired order
    const spritesToInclude = appState.selectedSpritesForSheet;

    if (spritesToInclude.length === 0) {
        alert("No sprites selected for the spritesheet. Please add sprites to the 'Selected for Sheet' panel first.");
        return;
    }
    if (!appState.originalImageData) {
        alert("Original image data is missing. Please re-upload.");
        return;
    }

    console.log(`Generating spritesheet with ${spritesToInclude.length} selected sprites...`);
    elements.processingStatusDiv.textContent = 'Generating spritesheet...';
    disableAllControls(true);

    // Extract just the blob data needed for generation
    const blobsToInclude = spritesToInclude.map(spriteData => spriteData.blob);

    const cols = parseInt(elements.gridColsInput.value, 10) || 8;
    const padding = parseInt(elements.paddingInput.value, 10) || 0;
    const alignment = elements.alignmentSelect.value;

    try {
        const resultCanvas = await generateSpritesheet(
            appState.originalImageData,
            blobsToInclude, // Pass the list of blob objects
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

        elements.processingStatusDiv.textContent = `Spritesheet generated (${blobsToInclude.length} sprites). Ready to download.`;
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
    // Keep existing filename logic...
    if (elements.imageUploadInput.files && elements.imageUploadInput.files[0]) {
        const originalName = elements.imageUploadInput.files[0].name;
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        filename = `${baseName}_spritesheet.png`;
    } else if (appState.originalImageInfo && appState.originalImageInfo.img.src) {
         try {
            const url = new URL(appState.originalImageInfo.img.src);
            const pathnameParts = url.pathname.split('/');
            const originalName = pathnameParts[pathnameParts.length - 1];
             const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
             filename = `${baseName}_spritesheet.png`;
         } catch (e) {/* Ignore error if src is not a valid URL (e.g., data URL) */}
    }


    downloadCanvasAsPNG(appState.generatedSpritesheetCanvas, filename);
}

// Clears the generated spritesheet state and UI
export function clearGeneratedSpritesheet() {
    clearGeneratedSpritesheetState(); // Clear state
    if (elements.spritesheetPreviewCanvas) {
        const ctx = elements.spritesheetPreviewCanvas.getContext('2d');
        // Ensure width/height are > 0 to avoid errors
        const w = elements.spritesheetPreviewCanvas.width || 1;
        const h = elements.spritesheetPreviewCanvas.height || 1;
        elements.spritesheetPreviewCanvas.width = w;
        elements.spritesheetPreviewCanvas.height = h;
        ctx.clearRect(0, 0, w, h);
        // Reset to small size to visually clear it if needed
        elements.spritesheetPreviewCanvas.width = 1;
        elements.spritesheetPreviewCanvas.height = 1;
    }
    if(elements.downloadSpritesheetButton) elements.downloadSpritesheetButton.disabled = true;
    console.log("Spritesheet cleared.");
}