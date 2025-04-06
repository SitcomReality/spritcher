import { elements } from 'dom-elements';
import { appState, setGeneratedSpritesheet, clearGeneratedSpritesheetState } from 'state';
import { generateSpritesheet, downloadCanvasAsPNG } from 'spritesheet-generator';
import { disableAllControls } from 'ui-controller';
import { updateSpriteStats } from 'extracted-sprites-controller'; 

export function initSpritesheetController() {
    elements.gridColsInput.addEventListener('change', handleSpritesheetSettingsChange);
    elements.paddingInput.addEventListener('change', handleSpritesheetSettingsChange);
    elements.alignHSelect.addEventListener('change', handleSpritesheetSettingsChange); 
    elements.alignVSelect.addEventListener('change', handleSpritesheetSettingsChange); 
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
    const spritesToInclude = appState.selectedSpritesForSheet;

    if (spritesToInclude.length === 0) {
        alert("No sprites selected for the spritesheet. Please add sprites to the 'Selected for Sheet' panel first.");
        return;
    }

    // Check if all selected sprites have valid sourceImageData
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

    try {
        // Pass the list of selected sprite objects, including their source data
        const resultCanvas = await generateSpritesheet(
            spritesToInclude,
            cols,
            padding,
            alignH, 
            alignV 
        );

        setGeneratedSpritesheet(resultCanvas); // Store in state

        // Display in preview canvas
        const previewCtx = elements.spritesheetPreviewCanvas.getContext('2d');
        elements.spritesheetPreviewCanvas.width = resultCanvas.width;
        elements.spritesheetPreviewCanvas.height = resultCanvas.height;
        previewCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
        previewCtx.drawImage(resultCanvas, 0, 0);

        elements.processingStatusDiv.textContent = `Spritesheet generated (${spritesToInclude.length} sprites). Ready to download.`;
        elements.downloadSpritesheetButton.disabled = false;
        // Ensure stats are up-to-date (though they shouldn't change on generate)
        updateSpriteStats();
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
    // Try to derive name from the first selected sprite's source ID?
    if (appState.selectedSpritesForSheet.length > 0) {
         const firstSourceId = appState.selectedSpritesForSheet[0].sourceImageId;
         // Attempt to extract original filename part
         const nameParts = firstSourceId.split('-');
         if (nameParts.length > 2) { // Check if it looks like our generated ID format
             const originalName = nameParts.slice(0, -2).join('-'); // Rejoin potentially hyphenated names
             const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
             if (baseName && baseName !== 'unknown') {
                 filename = `${baseName}_spritesheet.png`;
             }
         }
    }


    downloadCanvasAsPNG(appState.generatedSpritesheetCanvas, filename);
}

// Clears the generated spritesheet state and UI
export function clearGeneratedSpritesheet() {
    clearGeneratedSpritesheetState(); // Clear state
    if (elements.spritesheetPreviewCanvas) {
        const ctx = elements.spritesheetPreviewCanvas.getContext('2d');
        const w = elements.spritesheetPreviewCanvas.width || 1;
        const h = elements.spritesheetPreviewCanvas.height || 1;
        elements.spritesheetPreviewCanvas.width = w;
        elements.spritesheetPreviewCanvas.height = h;
        ctx.clearRect(0, 0, w, h);
        elements.spritesheetPreviewCanvas.width = 1;
        elements.spritesheetPreviewCanvas.height = 1;
    }
    if(elements.downloadSpritesheetButton) elements.downloadSpritesheetButton.disabled = true;
    // Reset spritesheet settings UI
    if (elements.gridColsInput) elements.gridColsInput.value = 8;
    if (elements.paddingInput) elements.paddingInput.value = 2;
    if (elements.alignHSelect) elements.alignHSelect.value = 'center';
    if (elements.alignVSelect) elements.alignVSelect.value = 'center';
    console.log("Spritesheet cleared.");
}