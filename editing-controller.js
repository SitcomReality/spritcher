import { elements } from 'dom-elements';
import { appState, setEditModeState, setSelectedBlobIndex, deleteBlobByIndex, updateBlobBoundsByIndex, addBlob } from 'state';
import { updateDebugOverlays } from 'debug-controller';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { invalidateProcessing } from 'processing-controller';
import { updateImageDisplayTransform } from 'viewport-controller';

// --- Local State for Dragging/Adding ---
let isResizing = false;
let dragHandleType = null;
let startDragX_client = 0; 
let startDragY_client = 0;
let startBounds_resize = null; 
let selectedBoxElement_resize = null; 

let isAddingBox = false;
let startAddX_img = 0; 
let startAddY_img = 0;
let tempAddBoxElement = null; 

// --- Initialization ---
export function initEditingController() {
    elements.editModeButtons.forEach(button => {
        button.addEventListener('click', () => handleModeButtonClick(button.dataset.mode));
    });
    elements.deleteSelectedButton.addEventListener('click', handleDeleteSelected);

    elements.imagePreviewContainer.addEventListener('mousedown', handlePreviewMouseDown);
    elements.imagePreviewContainer.addEventListener('click', handlePreviewClick);

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    setEditModeAndClearSelection('pan'); 
    updateEditModeUI(); 
}

// --- Event Handlers ---

function handleModeButtonClick(newMode) {
    setEditModeAndClearSelection(newMode);
}

function handleDeleteSelected() {
    const selectedIndex = appState.editing.selectedBlobIndex;
    if (selectedIndex !== null) {
        const success = deleteBlobByIndex(selectedIndex);
        if (success) {
            console.log(`Blob ${selectedIndex} deleted.`);
            clearGeneratedSpritesheet(); 
            invalidateProcessing(true); 
            elements.processingStatusDiv.textContent = `Sprite ${selectedIndex} deleted. Regeneration needed.`; 
            updateDebugOverlays(); 
            updateEditModeUI(); 
            updateEditingStatus(); 
        }
    } else {
        console.warn("Delete button clicked but no blob selected.");
    }
}

function handlePreviewMouseDown(event) {
    if (event.button !== 0) return; 

    if (appState.editing.currentEditMode === 'edit-bounds' && event.target.classList.contains('resize-handle')) {
        event.stopPropagation(); 
        startResizing(event); 
        return;
    }

    if (appState.editing.currentEditMode === 'add') {
        event.preventDefault(); 
        event.stopPropagation();
        startAddingBox(event); 
        return;
    }
}

function handleGlobalMouseMove(event) {
    if (isResizing) {
        event.preventDefault(); 
        updateResize(event); 
    } else if (isAddingBox) {
        updateAddingBox(event); 
    }
}

function handleGlobalMouseUp(event) {
    if (event.button !== 0) return; 

    if (isResizing) {
        event.stopPropagation(); 
        stopResizing(true); 
    } else if (isAddingBox) {
        event.stopPropagation();
        stopAddingBox(true); 
    }
}

function handlePreviewClick(event) {
    if (appState.editing.currentEditMode === 'select' && !event.target.classList.contains('resize-handle')) {
        const target = event.target;
        if (target.classList.contains('editable-bbox')) {
            const indexStr = target.dataset.blobIndex;
            const index = parseInt(indexStr, 10);

            if (!isNaN(index) && index >= 0 && index < appState.detectedBlobs.length) {
                const newIndex = (appState.editing.selectedBlobIndex === index) ? null : index; 
                setSelectedBlobIndex(newIndex);
                console.log("Selected blob index:", appState.editing.selectedBlobIndex);
            } else {
                console.warn("Clicked editable-bbox with invalid index:", indexStr);
                setSelectedBlobIndex(null); 
            }
        } else {
            setSelectedBlobIndex(null);
        }
        highlightSelectedBlob();
        event.stopPropagation(); 
    }
}

// --- Mode and UI Updates ---

export function setEditModeAndClearSelection(newMode) {
    if (!newMode || typeof newMode !== 'string') {
        console.warn("Invalid mode provided:", newMode);
        return;
    }

    if (newMode === 'split' || newMode === 'merge') {
        console.log(`Mode ${newMode} not implemented.`);
        return; 
    }

    if (appState.editing.currentEditMode !== newMode) {
        setSelectedBlobIndex(null); 
    }
    if (isResizing) {
        stopResizing(false); 
    }
    if (isAddingBox) {
        stopAddingBox(false); 
    }

    setEditModeState(newMode); 
    updateEditModeUI(); 
    updateDebugOverlays(); 
    updateEditingStatus(); 
    updateContainerCursor(); 
    console.log("Set edit mode to:", newMode);
}

export function updateEditModeUI() {
    const hasImage = !!appState.originalImageInfo;
    const hasBlobs = appState.detectedBlobs && appState.detectedBlobs.length > 0;
    const isBlobSelected = appState.editing.selectedBlobIndex !== null;
    const currentMode = appState.editing.currentEditMode;

    elements.editModeButtons.forEach(button => {
        const mode = button.dataset.mode;
        let disabled = false;

        if (!hasImage) {
            disabled = true; 
        } else if ((mode === 'select' || mode === 'edit-bounds' || mode === 'delete') && !hasBlobs) {
            disabled = true; 
        } else if ((mode === 'edit-bounds' || mode === 'delete') && !isBlobSelected) {
        } else if (mode === 'split' || mode === 'merge') {
             disabled = true; 
        }

        button.disabled = disabled;
        button.classList.toggle('active', mode === currentMode && !disabled);
    });

    const editBoundsButton = document.getElementById('edit-bounds-mode-btn');
    if (editBoundsButton) {
        editBoundsButton.disabled = !hasImage || !hasBlobs || !isBlobSelected;
        editBoundsButton.classList.toggle('active', currentMode === 'edit-bounds' && !editBoundsButton.disabled);
    }

    elements.deleteSelectedButton.disabled = !hasImage || !hasBlobs || !isBlobSelected;

    updateContainerCursor(); 
}

function updateEditingStatus() {
    const { currentEditMode, selectedBlobIndex } = appState.editing;
    const isBlobSelected = selectedBlobIndex !== null;
    let status = `Mode: ${currentEditMode.toUpperCase()}. `;

    switch (currentEditMode) {
        case 'select':
            status += isBlobSelected
                ? `Sprite ${selectedBlobIndex} selected. Click another box or empty space.`
                : `Click on a blue box to select a sprite.`;
            break;
        case 'pan':
            status += 'Click & drag to pan, use wheel or buttons to zoom.';
            break;
        case 'edit-bounds':
            status += isBlobSelected
                ? `Selected Sprite ${selectedBlobIndex}. Drag handles to resize.`
                : 'Select a sprite first (use Select mode).';
            break;
        case 'add':
            status += 'Click and drag on the image to draw a new sprite box.';
            break;
        case 'split':
        case 'merge':
            status += '(Not Implemented)';
            break;
        default:
             status = `Current mode: ${currentEditMode || 'None'}`;
             break;
    }

    elements.editingStatusDiv.textContent = status;
}

function updateContainerCursor() {
    const container = elements.imagePreviewContainer;
    if (!container) return;

    container.classList.remove('pan-mode', 'select-mode', 'add-mode', 'grabbing'); 
    container.style.cursor = 'default'; 

    switch (appState.editing.currentEditMode) {
        case 'pan':
            container.classList.add('pan-mode'); 
            break;
        case 'select':
            container.classList.add('select-mode'); 
            break;
        case 'edit-bounds':
            break;
        case 'add':
            container.classList.add('add-mode'); 
            break;
    }
    if (appState.viewport.isPanning && appState.editing.currentEditMode === 'pan') {
         container.classList.add('grabbing');
    }
}

function highlightSelectedBlob() {
    updateDebugOverlays(); 
    updateEditModeUI(); 
    updateEditingStatus(); 
}

export function resetEditingOnLoad() {
    if (isResizing) {
        stopResizing(false); 
    }
    if (isAddingBox) {
        stopAddingBox(false); 
    }
    setEditModeAndClearSelection('pan'); 
    elements.editingStatusDiv.textContent = ''; 
    elements.editingToolsSection.style.display = 'none'; 
}

// --- Resizing Logic (Helper Functions) ---

function startResizing(event) {
    const selectedIndex = appState.editing.selectedBlobIndex;
    if (selectedIndex === null) return;

    const handle = event.target;
    dragHandleType = handle.dataset.handleType;
    selectedBoxElement_resize = handle.closest('.editable-bbox');

    if (!selectedBoxElement_resize || !dragHandleType) {
        console.error("Could not find handle type or parent box for resize start.");
        return;
    }

    startDragX_client = event.clientX;
    startDragY_client = event.clientY;
    const currentBounds = appState.detectedBlobs[selectedIndex].bounds;
    startBounds_resize = { ...currentBounds }; 

    isResizing = true;
    console.log(`Start resize: handle=${dragHandleType}, startBounds=`, { ...startBounds_resize });
}

function updateResize(event) {
    if (!isResizing || !startBounds_resize || !selectedBoxElement_resize) return;

    const currentZoom = appState.viewport.currentZoom;
    const dx = currentZoom !== 0 ? (event.clientX - startDragX_client) / currentZoom : 0;
    const dy = currentZoom !== 0 ? (event.clientY - startDragY_client) / currentZoom : 0;

    let newBounds = { ...startBounds_resize };

    if (dragHandleType.includes('n')) {
        newBounds.minY += dy;
        newBounds.height -= dy;
    }
    if (dragHandleType.includes('s')) {
        newBounds.height += dy;
    }
    if (dragHandleType.includes('w')) {
        newBounds.minX += dx;
        newBounds.width -= dx;
    }
    if (dragHandleType.includes('e')) {
        newBounds.width += dx;
    }

    if (newBounds.width < 1) {
        if (dragHandleType.includes('w')) { 
            newBounds.minX = startBounds_resize.minX + startBounds_resize.width - 1; 
        }
        newBounds.width = 1; 
    }
    if (newBounds.height < 1) {
         if (dragHandleType.includes('n')) { 
            newBounds.minY = startBounds_resize.minY + startBounds_resize.height - 1; 
        }
        newBounds.height = 1; 
    }

    selectedBoxElement_resize.style.left = `${newBounds.minX}px`;
    selectedBoxElement_resize.style.top = `${newBounds.minY}px`;
    selectedBoxElement_resize.style.width = `${newBounds.width}px`;
    selectedBoxElement_resize.style.height = `${newBounds.height}px`;
}

function stopResizing(saveChanges) {
    if (!isResizing) return;

    const selectedIndex = appState.editing.selectedBlobIndex; 

    isResizing = false;

    if (saveChanges && selectedBoxElement_resize && startBounds_resize && selectedIndex !== null) {
        const finalMinX = parseFloat(selectedBoxElement_resize.style.left);
        const finalMinY = parseFloat(selectedBoxElement_resize.style.top);
        const finalWidth = parseFloat(selectedBoxElement_resize.style.width);
        const finalHeight = parseFloat(selectedBoxElement_resize.style.height);

        if (!isNaN(finalMinX) && !isNaN(finalMinY) && !isNaN(finalWidth) && finalWidth >= 1 && !isNaN(finalHeight) && finalHeight >= 1) {
            const newBounds = {
                minX: finalMinX,
                minY: finalMinY,
                width: finalWidth,
                height: finalHeight
            };

            const updated = updateBlobBoundsByIndex(selectedIndex, newBounds);

            if (updated) {
                clearGeneratedSpritesheet();
                invalidateProcessing(true); 
                elements.processingStatusDiv.textContent = `Sprite ${selectedIndex} resized. Regeneration needed.`;
                console.log(`Resize end: Saved new bounds for blob ${selectedIndex}`, newBounds);
            } else {
                console.error("Failed to save updated bounds to state for blob:", selectedIndex);
                selectedBoxElement_resize.style.left = `${startBounds_resize.minX}px`;
                selectedBoxElement_resize.style.top = `${startBounds_resize.minY}px`;
                selectedBoxElement_resize.style.width = `${startBounds_resize.width}px`;
                selectedBoxElement_resize.style.height = `${startBounds_resize.height}px`;
            }
        } else {
            console.warn("Resize ended with invalid final bounds. Reverting visual changes.");
            selectedBoxElement_resize.style.left = `${startBounds_resize.minX}px`;
            selectedBoxElement_resize.style.top = `${startBounds_resize.minY}px`;
            selectedBoxElement_resize.style.width = `${startBounds_resize.width}px`;
            selectedBoxElement_resize.style.height = `${startBounds_resize.height}px`;
        }

    } else if (!saveChanges && selectedBoxElement_resize && startBounds_resize) {
        console.log("Resize cancelled, reverting visual changes.");
        selectedBoxElement_resize.style.left = `${startBounds_resize.minX}px`;
        selectedBoxElement_resize.style.top = `${startBounds_resize.minY}px`;
        selectedBoxElement_resize.style.width = `${startBounds_resize.width}px`;
        selectedBoxElement_resize.style.height = `${startBounds_resize.height}px`;
    }

    dragHandleType = null;
    startBounds_resize = null;
    startDragX_client = 0;
    startDragY_client = 0;
    selectedBoxElement_resize = null;

    updateDebugOverlays();
    updateEditingStatus(); 
}

// --- Add Box Logic (Helper Functions) ---

function startAddingBox(event) {
    const { currentZoom, panX, panY } = appState.viewport;
    const rect = elements.imagePreviewContainer.getBoundingClientRect();

    const mouseX_container = event.clientX - rect.left;
    const mouseY_container = event.clientY - rect.top;
    startAddX_img = currentZoom !== 0 ? (mouseX_container - panX) / currentZoom : mouseX_container - panX;
    startAddY_img = currentZoom !== 0 ? (mouseY_container - panY) / currentZoom : mouseY_container - panY;

    isAddingBox = true;

    tempAddBoxElement = document.createElement('div');
    tempAddBoxElement.className = 'adding-bbox-temp'; 
    tempAddBoxElement.style.position = 'absolute'; 
    tempAddBoxElement.style.left = `${startAddX_img}px`;
    tempAddBoxElement.style.top = `${startAddY_img}px`;
    tempAddBoxElement.style.width = '0px';
    tempAddBoxElement.style.height = '0px';
    tempAddBoxElement.style.pointerEvents = 'none'; 

    elements.debugOverlaysContainer.appendChild(tempAddBoxElement);

    console.log(`Start adding box at image coords: (${startAddX_img.toFixed(1)}, ${startAddY_img.toFixed(1)})`);
}

function updateAddingBox(event) {
    if (!isAddingBox || !tempAddBoxElement) return;

    const { currentZoom, panX, panY } = appState.viewport;
    const rect = elements.imagePreviewContainer.getBoundingClientRect();

    const mouseX_container = event.clientX - rect.left;
    const mouseY_container = event.clientY - rect.top;
    const currentX_img = currentZoom !== 0 ? (mouseX_container - panX) / currentZoom : mouseX_container - panX;
    const currentY_img = currentZoom !== 0 ? (mouseY_container - panY) / currentZoom : mouseY_container - panY;

    const minX = Math.min(startAddX_img, currentX_img);
    const minY = Math.min(startAddY_img, currentY_img);
    const width = Math.abs(currentX_img - startAddX_img);
    const height = Math.abs(currentY_img - startAddY_img);

    tempAddBoxElement.style.left = `${minX}px`;
    tempAddBoxElement.style.top = `${minY}px`;
    tempAddBoxElement.style.width = `${width}px`;
    tempAddBoxElement.style.height = `${height}px`;
}

function stopAddingBox(saveChanges) {
    if (!isAddingBox) return;
    isAddingBox = false; 

    if (tempAddBoxElement) {
        if (saveChanges) {
            const finalMinX = parseFloat(tempAddBoxElement.style.left);
            const finalMinY = parseFloat(tempAddBoxElement.style.top);
            const finalWidth = parseFloat(tempAddBoxElement.style.width);
            const finalHeight = parseFloat(tempAddBoxElement.style.height);

            if (!isNaN(finalMinX) && !isNaN(finalMinY) && finalWidth >= 1 && finalHeight >= 1) {
                const newBounds = {
                    minX: finalMinX,
                    minY: finalMinY,
                    width: finalWidth,
                    height: finalHeight
                };
                addBlob(newBounds); 

                console.log("Added new blob:", newBounds);
                clearGeneratedSpritesheet(); 
                invalidateProcessing(true); 
                elements.processingStatusDiv.textContent = `New sprite added. Regeneration needed.`;
                updateDebugOverlays(); 
                updateEditModeUI(); 
                updateEditingStatus(); 
                setSelectedBlobIndex(appState.detectedBlobs.length - 1); 
                setEditModeAndClearSelection('select'); 
            } else {
                console.log("Add box cancelled: Final box too small or invalid.");
            }
        } else {
            console.log("Add box cancelled by user.");
        }
        tempAddBoxElement.remove();
    }

    tempAddBoxElement = null;
    startAddX_img = 0;
    startAddY_img = 0;
}