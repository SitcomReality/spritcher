import { elements } from 'dom-elements';
import { appState, setSelectedBlobIndex } from 'state';
import { updateDebugOverlays } from 'debug-controller';
import { updateEditModeUI } from 'editing-controller'; 

export function initSelectionController() {
    // Listener added in editing-controller which calls handlePreviewClick if mode is 'select'
}

export function handlePreviewClick(event) {
    // This function is called by editing-controller when mode is 'select'
     if (appState.editing.currentEditMode !== 'select') return; // Double check mode

     // Don't select if clicking on a resize handle (even if in select mode somehow)
     if (event.target.classList.contains('resize-handle')) return;

    const target = event.target;
    let newIndex = null;

    if (target.classList.contains('editable-bbox')) {
        const indexStr = target.dataset.blobIndex;
        const index = parseInt(indexStr, 10);

        if (!isNaN(index) && index >= 0 && index < appState.detectedBlobs.length) {
            // Toggle selection: If clicking the already selected box, deselect. Otherwise, select.
            newIndex = (appState.editing.selectedBlobIndex === index) ? null : index;
            console.log(`Selection click: Toggling blob index ${index}. New selection: ${newIndex}`);
        } else {
            console.warn("Clicked editable-bbox with invalid index:", indexStr);
            // Deselect if clicking something invalid that looks like a box
            newIndex = null;
        }
    } else {
        // Clicked on the background or canvas, deselect whatever is selected
        if (appState.editing.selectedBlobIndex !== null) {
             console.log("Selection click: Clicked background, deselecting.");
        }
        newIndex = null;
    }

    // Update state only if the selection actually changed
    if (appState.editing.selectedBlobIndex !== newIndex) {
        setSelectedBlobIndex(newIndex);
        highlightSelectedBlob(); // Update visual feedback
        updateEditModeUI(); // Update button states (e.g., enable/disable edit/delete)
    }
}


function highlightSelectedBlob() {
    // updateDebugOverlays handles applying the 'selected' class and showing/hiding handles
    updateDebugOverlays();
    // Status message update is handled by mode-controller after state change
}