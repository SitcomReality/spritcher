import { elements } from 'dom-elements';
import { appState, setEditModeState, setSelectedBlobIndex } from 'state';
import { updateDebugOverlays } from 'debug-controller';
// Import functions from sibling editing controllers if needed for state changes
import { stopResizing } from 'resize-controller';
import { stopAddingBox } from 'add-box-controller';


export function initModeController() {
    elements.editModeButtons.forEach(button => {
        button.addEventListener('click', () => handleModeButtonClick(button.dataset.mode));
    });
    setEditModeAndClearSelection('pan'); // Initialize default mode
    updateEditModeUI(); // Set initial UI state
}

function handleModeButtonClick(newMode) {
    setEditModeAndClearSelection(newMode);
}

export function setEditModeAndClearSelection(newMode) {
    if (!newMode || typeof newMode !== 'string') {
        console.warn("Invalid mode provided:", newMode);
        return;
    }

    // Prevent switching to unimplemented modes
    if (newMode === 'split' || newMode === 'merge') {
        console.log(`Mode ${newMode} not implemented.`);
        return;
    }

    const currentMode = appState.editing.currentEditMode;

    if (currentMode !== newMode) {
        // Stop any ongoing resize or add operations before switching modes
        if (currentMode === 'edit-bounds') {
            stopResizing(false); // Cancel ongoing resize
        } else if (currentMode === 'add') {
            stopAddingBox(false); // Cancel ongoing add
        }
        // Clear selection when switching modes
        setSelectedBlobIndex(null);
    }


    setEditModeState(newMode);
    updateEditModeUI();
    updateDebugOverlays(); // Redraw overlays to reflect new mode (e.g., hide/show handles)
    updateEditingStatus();
    updateContainerCursor();
    console.log("Set edit mode to:", newMode);
}

export function updateEditModeUI() {
    const hasImage = !!appState.originalImageInfo;
    // Use detectedBlobs (current image's blobs) for enabling editing tools
    const hasBlobs = appState.detectedBlobs && appState.detectedBlobs.length > 0;
    const selectedIndex = appState.editing.selectedBlobIndex;
    const isBlobSelected = selectedIndex !== null;

    // Check if the selected blob belongs to the currently loaded image
    const isSelectedBlobFromCurrentImage = isBlobSelected &&
        appState.detectedBlobs[selectedIndex]?.sourceImageId === appState.currentSourceImageId;

    const currentMode = appState.editing.currentEditMode;

    elements.editModeButtons.forEach(button => {
        const mode = button.dataset.mode;
        let disabled = false;

        if (!hasImage) {
            disabled = true; // Disable all if no image currently loaded
        } else if ((mode === 'select' || mode === 'edit-bounds' || mode === 'add') && !hasBlobs) {
            // Select, Edit, Add require blobs detected *in the current image*
            disabled = true;
        } else if (mode === 'edit-bounds' && !isSelectedBlobFromCurrentImage) {
            // Edit requires selection OF A BLOB FROM THE CURRENT IMAGE
            disabled = true;
        } else if (mode === 'split' || mode === 'merge') {
             disabled = true; // Unimplemented
        }

        button.disabled = disabled;
        button.classList.toggle('active', mode === currentMode && !disabled);
    });

    // Special handling for delete button
    // Enable only if a blob from the CURRENT image is selected
    elements.deleteSelectedButton.disabled = !hasImage || !hasBlobs || !isSelectedBlobFromCurrentImage;

    updateContainerCursor();
}

function updateEditingStatus() {
    const { currentEditMode, selectedBlobIndex } = appState.editing;
    const isBlobSelected = selectedBlobIndex !== null;
    const isSelectedBlobFromCurrentImage = isBlobSelected &&
        appState.detectedBlobs[selectedBlobIndex]?.sourceImageId === appState.currentSourceImageId;

    let status = `Mode: ${currentEditMode.toUpperCase()}. `;

    switch (currentEditMode) {
        case 'select':
            status += isBlobSelected
                ? `Sprite Index ${selectedBlobIndex} (current image) selected. Click another box or empty space.`
                : `Click on a blue box (from current image) to select it.`;
            break;
        case 'pan':
            status += 'Click & drag to pan, use wheel or buttons to zoom.';
            break;
        case 'edit-bounds':
             if (isSelectedBlobFromCurrentImage) {
                status += `Selected Sprite ${selectedBlobIndex}. Drag handles to resize.`;
             } else if (isBlobSelected) {
                status += `Sprite ${selectedBlobIndex} selected, but not from current image. Cannot edit bounds.`;
             } else {
                status += 'Select a sprite from the current image first (use Select mode).';
             }
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
    container.style.cursor = 'default'; // Reset cursor

    // Cursors depend only on mode, not selection source
    switch (appState.editing.currentEditMode) {
        case 'pan':
            container.classList.add('pan-mode');
            // 'grabbing' class is added/removed by viewport controller during pan
            break;
        case 'select':
             // Only allow selection pointer if blobs exist in current image
             if (appState.detectedBlobs.length > 0) {
                container.classList.add('select-mode');
             } else {
                 container.style.cursor = 'default';
             }
            break;
        case 'edit-bounds':
            // Cursor is handled by the handles themselves via CSS
            container.style.cursor = 'default';
            break;
        case 'add':
             // Allow add cursor only if image is loaded
             if (appState.originalImageData) {
                 container.classList.add('add-mode');
             } else {
                  container.style.cursor = 'default';
             }
            break;
    }
     // Ensure grabbing cursor is applied if panning
     if (appState.viewport.isPanning && appState.editing.currentEditMode === 'pan') {
         container.classList.add('grabbing');
     }
}

export function resetModeControllerOnLoad() {
    setEditModeAndClearSelection('pan'); // Reset to default mode
    elements.editingStatusDiv.textContent = ''; // Clear status message
    elements.editingToolsSection.style.display = 'none'; // Hide the section
}