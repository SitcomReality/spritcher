import { elements } from 'dom-elements';
import { appState, updateSelectedSpriteIndices } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { disableAllControls } from 'ui-controller'; 

export function initExtractedSpritesController() {
    elements.extractedSpritesDisplayContainer.addEventListener('click', handleSpritePreviewClick);
    elements.selectAllSpritesButton.addEventListener('click', handleSelectAll);
    elements.deselectAllSpritesButton.addEventListener('click', handleDeselectAll);
}

export function displayExtractedSprites() {
    const container = elements.extractedSpritesDisplayContainer;
    container.innerHTML = ''; 

    if (!appState.originalImageInfo || appState.extractedSprites.length === 0) {
        container.innerHTML = "<p>No sprites detected or image not loaded.</p>";
        elements.extractedSpritesCountSpan.textContent = '0 sprites detected.';
        return;
    }

    elements.extractedSpritesCountSpan.textContent = `${appState.extractedSprites.length} sprites detected.`;

    const sourceCanvas = elements.imagePreviewCanvas; 
    const fragment = document.createDocumentFragment();

    appState.extractedSprites.forEach((spriteData, index) => {
        const { blob } = spriteData;
        const bounds = blob.bounds;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'sprite-preview-item';
        itemDiv.dataset.extractedIndex = index; 

        const previewCanvas = document.createElement('canvas');
        const ctx = previewCanvas.getContext('2d');

        previewCanvas.width = bounds.width;
        previewCanvas.height = bounds.height;

        try {
            const sourceX = Math.max(0, Math.floor(bounds.minX));
            const sourceY = Math.max(0, Math.floor(bounds.minY));
            const sourceWidth = Math.min(Math.max(1, Math.floor(bounds.width)), sourceCanvas.width - sourceX);
            const sourceHeight = Math.min(Math.max(1, Math.floor(bounds.height)), sourceCanvas.height - sourceY);

            if (sourceWidth > 0 && sourceHeight > 0) {
                ctx.drawImage(
                    sourceCanvas,
                    sourceX, sourceY, sourceWidth, sourceHeight, 
                    0, 0, sourceWidth, sourceHeight             
                );
            } else {
                console.warn(`Skipping draw for extracted sprite index ${index} due to zero dimensions after clamp/floor.`);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                ctx.fillRect(0, 0, bounds.width || 10, bounds.height || 10);
            }

        } catch (e) {
            console.error(`Error drawing preview for extracted sprite index ${index}:`, e);
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, bounds.width, bounds.height);
            ctx.fillStyle = 'white';
            ctx.fillText('ERR', 2, 10);
        }


        const indexLabel = document.createElement('span');
        indexLabel.className = 'sprite-index-label';
        indexLabel.textContent = `Sprite ${index}`; 

        itemDiv.appendChild(previewCanvas);
        itemDiv.appendChild(indexLabel);

        if (appState.selectedSpritesForSheet.includes(index)) {
            itemDiv.classList.add('selected');
        }

        fragment.appendChild(itemDiv);
    });

    container.appendChild(fragment);

    updateSelectionControlsState();
}

export function clearExtractedSpritesDisplay() {
    const container = elements.extractedSpritesDisplayContainer;
    container.innerHTML = '<p>Click \'Detect Sprites\' to see individual sprites here.</p>';
    if (elements.extractedSpritesCountSpan) {
        elements.extractedSpritesCountSpan.textContent = '0 sprites detected.';
    }
}

function handleSpritePreviewClick(event) {
    const itemDiv = event.target.closest('.sprite-preview-item');
    if (!itemDiv) return; 

    const indexStr = itemDiv.dataset.extractedIndex;
    if (indexStr === undefined) return;

    const index = parseInt(indexStr, 10);
    if (isNaN(index)) return;

    const currentSelection = [...appState.selectedSpritesForSheet]; 
    const selectionIndex = currentSelection.indexOf(index);

    if (selectionIndex > -1) {
        currentSelection.splice(selectionIndex, 1);
        itemDiv.classList.remove('selected');
        console.log(`Deselected sprite ${index} for sheet.`);
    } else {
        currentSelection.push(index);
        itemDiv.classList.add('selected');
        console.log(`Selected sprite ${index} for sheet.`);
    }

    updateSelectedSpriteIndices(currentSelection);

    updateSelectionControlsState();
    clearGeneratedSpritesheet(); 
}

function handleSelectAll() {
    const allIndices = appState.extractedSprites.map((_, index) => index);
    updateSelectedSpriteIndices(allIndices);
    displayExtractedSprites();
    updateSelectionControlsState();
    clearGeneratedSpritesheet();
    console.log("Selected all sprites for sheet.");
}

function handleDeselectAll() {
    updateSelectedSpriteIndices([]); 
    displayExtractedSprites();
    updateSelectionControlsState();
    clearGeneratedSpritesheet();
    console.log("Deselected all sprites for sheet.");
}


function updateSelectionControlsState() {
    const totalSprites = appState.extractedSprites.length;
    const selectedCount = appState.selectedSpritesForSheet.length;

    elements.selectAllSpritesButton.disabled = (totalSprites === 0 || selectedCount === totalSprites);
    elements.deselectAllSpritesButton.disabled = (totalSprites === 0 || selectedCount === 0);

    elements.generateSpritesheetButton.disabled = (selectedCount === 0);
    elements.gridColsInput.disabled = (selectedCount === 0);
    elements.paddingInput.disabled = (selectedCount === 0);
    elements.alignmentSelect.disabled = (selectedCount === 0);
}