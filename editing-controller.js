import { elements } from 'dom-elements';
import { appState, setEditModeState, setSelectedBlobIndex, deleteBlobByIndex } from 'state';
import { updateDebugOverlays } from 'debug-controller'; // For highlighting
import { clearGeneratedSpritesheet } from 'spritesheet-controller'; // To invalidate spritesheet on delete
import { invalidateProcessing } from 'processing-controller'; // To mark results as potentially stale

export function initEditingController() {
    elements.editModeButtons.forEach(button => {
        button.addEventListener('click', () => setEditModeAndClearSelection(button.dataset.mode));
    });
    elements.deleteSelectedButton.addEventListener('click', handleDeleteSelected);
    elements.imagePreviewContainer.addEventListener('click', handlePreviewClick);
    setEditModeUI(appState.editing.currentEditMode); // Set initial mode UI
    updateEditModeUI(); // Update enable/disable state
}

function handleDeleteSelected() {
    const selectedIndex = appState.editing.selectedBlobIndex;
    if (selectedIndex !== null) {
        const success = deleteBlobByIndex(selectedIndex);
        if (success) {
            // State automatically clears selection if it matches deleted index
            console.log(`Blob ${selectedIndex} deleted.`);
            clearGeneratedSpritesheet(); // Invalidate generated spritesheet
            invalidateProcessing(true); // Keep thresholded, but mark CCL/Blobs as needing update if re-run
            elements.processingStatusDiv.textContent = `Sprite ${selectedIndex} deleted. Spritesheet needs regenerating.`;
            updateDebugOverlays(); // Redraw overlays without the deleted box
            updateEditModeUI(); // Update button states (delete button should become disabled)
            updateEditingStatus(); // Update status text
        }
    } else {
        console.warn("Delete button clicked but no blob selected.");
    }
}

function setEditModeAndClearSelection(newMode) {
    if (appState.editing.currentEditMode !== newMode) {
        setSelectedBlobIndex(null); // Deselect when changing mode
    }
    setEditModeUI(newMode);
}

// Sets the current edit mode state and updates UI appearance
function setEditModeUI(newMode) {
    console.log("Setting edit mode to:", newMode);
    setEditModeState(newMode);

    // Update button active states
    elements.editModeButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.mode === newMode);
    });

    // Update container class for cursor styling
    elements.imagePreviewContainer.classList.remove('pan-mode', 'select-mode', 'grabbing'); // Add other modes later
    if (newMode === 'pan') {
        elements.imagePreviewContainer.classList.add('pan-mode');
    } else if (newMode === 'select') {
        elements.imagePreviewContainer.classList.add('select-mode');
    } // Add else if for other modes...

    updateEditingStatus();
    highlightSelectedBlob(); // Ensure selection highlight is correct (e.g., cleared if mode changed)
}

// Updates the enable/disable state of edit buttons based on app state
export function updateEditModeUI() {
    const hasImage = !!appState.originalImageInfo;
    const hasBlobs = appState.detectedBlobs && appState.detectedBlobs.length > 0;
    const isBlobSelected = appState.editing.selectedBlobIndex !== null;

    elements.editModeButtons.forEach(button => {
        const mode = button.dataset.mode;
        let disabled = false; // Default to enabled, then disable based on conditions

        switch (mode) {
            case 'pan':
                disabled = !hasImage; // Pan only requires an image
                break;
            case 'select':
                disabled = !hasBlobs;
                break;
            case 'edit-bounds':
            case 'delete':
                disabled = !hasBlobs || !isBlobSelected; // Require a selection
                break;
            case 'add':
                disabled = !hasImage; // Add only requires image context
                break;
            case 'split':
            case 'merge':
                disabled = true; // Not implemented yet
                break;
            default:
                disabled = !hasImage; // Default for unknown modes? Or true?
                break;
        }

        button.disabled = disabled;
    });

    // Handle the separate delete button
    elements.deleteSelectedButton.disabled = !isBlobSelected || !hasBlobs;

    // Re-apply active class to the current mode button, as disable might affect appearance
    elements.editModeButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.mode === appState.editing.currentEditMode && !button.disabled);
    });

    updateEditingStatus(); // Status text might depend on enabled state too
}

function updateEditingStatus() {
    const { currentEditMode, selectedBlobIndex } = appState.editing;
    const isBlobSelected = selectedBlobIndex !== null;
    let status = `Mode: ${currentEditMode.toUpperCase()}. `;

    switch (currentEditMode) {
        case 'select':
            status += isBlobSelected ? `Sprite ${selectedBlobIndex} selected.` : `Click on a blue box to select a sprite.`;
            break;
        case 'pan':
            status += 'Click and drag to pan, use wheel or buttons to zoom.';
            break;
        case 'edit-bounds':
            status += isBlobSelected ? `Drag handles to resize Sprite ${selectedBlobIndex}. (Not Implemented)` : 'Select a sprite first.';
            break;
        case 'add':
            status += 'Click and drag to draw a new sprite box. (Not Implemented)';
            break;
        default:
            status += '(Not Implemented)';
            break;
    }

    elements.editingStatusDiv.textContent = status;
}

// Highlight the currently selected blob's div
function highlightSelectedBlob() {
    const boxes = elements.debugOverlaysContainer.querySelectorAll('.editable-bbox');
    boxes.forEach((box, index) => {
        // Use current state for selection index
        box.classList.toggle('selected', index === appState.editing.selectedBlobIndex);
    });
    updateEditModeUI(); // Update button states based on selection
    updateEditingStatus(); // Update text based on selection
}

function handlePreviewClick(event) {
    if (appState.editing.currentEditMode === 'select') {
        const target = event.target;
        if (target.classList.contains('editable-bbox')) {
            const indexStr = target.dataset.blobIndex;
            const index = parseInt(indexStr, 10);

            if (!isNaN(index) && index >= 0 && index < appState.detectedBlobs.length) {
                // Toggle selection: if clicking the selected one, deselect; otherwise select the new one.
                const newIndex = (appState.editing.selectedBlobIndex === index) ? null : index;
                setSelectedBlobIndex(newIndex);
                console.log("Selected blob index:", appState.editing.selectedBlobIndex);
                highlightSelectedBlob(); // Update visual highlight immediately
            } else {
                console.warn("Clicked editable-bbox with invalid index:", indexStr);
                setSelectedBlobIndex(null); // Deselect if index is bad
                highlightSelectedBlob();
            }
        } else {
            // Clicked outside any box (on the container itself), deselect
            if (appState.editing.selectedBlobIndex !== null) {
                setSelectedBlobIndex(null);
                highlightSelectedBlob();
            }
        }
        event.stopPropagation(); // Prevent triggering other potential listeners on container
    }
    // Add logic for other modes (e.g., finalize add box, trigger delete)
}

export function resetEditingOnLoad() {
    appState.editing.currentEditMode = 'pan';
    appState.editing.selectedBlobIndex = null;
    setEditModeUI('pan');
    updateEditModeUI();
    elements.editingStatusDiv.textContent = '';
    elements.editingToolsSection.style.display = 'none';
}