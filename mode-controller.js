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
    const hasBlobs = appState.detectedBlobs && appState.detectedBlobs.length > 0;
    const isBlobSelected = appState.editing.selectedBlobIndex !== null;
    const currentMode = appState.editing.currentEditMode;

    elements.editModeButtons.forEach(button => {
        const mode = button.dataset.mode;
        let disabled = false;

        if (!hasImage) {
            disabled = true; // Disable all if no image
        } else if ((mode === 'select' || mode === 'edit-bounds') && !hasBlobs) {
            disabled = true; // Select/Edit require blobs
        } else if (mode === 'edit-bounds' && !isBlobSelected) {
            disabled = true; // Edit requires selection
        } else if (mode === 'split' || mode === 'merge') {
             disabled = true; // Unimplemented
        }

        button.disabled = disabled;
        button.classList.toggle('active', mode === currentMode && !disabled);
    });

    // Special handling for delete button (might move to delete-controller if it grows)
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
    container.style.cursor = 'default'; // Reset cursor

    switch (appState.editing.currentEditMode) {
        case 'pan':
            container.classList.add('pan-mode');
            // 'grabbing' class is added/removed by viewport controller during pan
            break;
        case 'select':
            container.classList.add('select-mode');
            break;
        case 'edit-bounds':
            // Cursor is handled by the handles themselves via CSS
            container.style.cursor = 'default';
            break;
        case 'add':
            container.classList.add('add-mode');
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