import { elements } from 'dom-elements';
import { appState } from 'state';

// Import initializers and handlers from the new sub-modules
import { initModeController, resetModeControllerOnLoad } from 'mode-controller';
import { initSelectionController, handlePreviewClick } from 'selection-controller';
import { initResizeController, handleMouseDownResize, handleMouseMoveResize, handleMouseUpResize, getIsResizing } from 'resize-controller';
import { initAddBoxController, handleMouseDownAddBox, handleMouseMoveAddBox, handleMouseUpAddBox, getIsAddingBox } from 'add-box-controller';
import { initDeleteController } from 'delete-controller';

// --- Initialization ---
export function initEditingController() {
    // Initialize all the sub-controllers
    initModeController();
    initSelectionController();
    initResizeController();
    initAddBoxController();
    initDeleteController();

    // Add primary event listeners that will delegate to sub-controllers
    elements.imagePreviewContainer.addEventListener('mousedown', handlePreviewMouseDown);
    elements.imagePreviewContainer.addEventListener('click', handlePreviewClickDelegate); // Use a delegate for click

    // Use global listeners on document for mouse move/up to handle drags
    // that might leave the container bounds
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    console.log("Editing Controller Initialized (Coordinator)");
}

// --- Event Handlers (Delegation) ---

function handlePreviewMouseDown(event) {
    if (event.button !== 0) return; // Only handle left clicks

    const mode = appState.editing.currentEditMode;

    // Delegate based on mode and event target
    if (mode === 'edit-bounds' && event.target.classList.contains('resize-handle')) {
        handleMouseDownResize(event);
    } else if (mode === 'add') {
        // Allow starting add only on the container background, not existing boxes/handles
        if (!event.target.classList.contains('editable-bbox') && !event.target.classList.contains('resize-handle')) {
             handleMouseDownAddBox(event);
        }
    }
    // Note: Pan mode mousedown is handled by viewport-controller
    // Note: Select mode uses 'click' event, not mousedown
}

function handlePreviewClickDelegate(event) {
    // Delegate click events ONLY if in 'select' mode
    if (appState.editing.currentEditMode === 'select') {
        handlePreviewClick(event); // Call selection controller's handler
    }
    // Click events on buttons (like mode switch) are handled by their respective controllers
}


function handleGlobalMouseMove(event) {
    // Delegate mouse move events ONLY if an action (resizing/adding) is in progress
    if (getIsResizing()) {
        handleMouseMoveResize(event);
    } else if (getIsAddingBox()) {
        handleMouseMoveAddBox(event);
    }
    // Note: Pan mode mousemove is handled by viewport-controller
}

function handleGlobalMouseUp(event) {
    if (event.button !== 0) return; // Only handle left button up

    // Delegate mouse up events ONLY if an action was in progress
    if (getIsResizing()) {
        handleMouseUpResize(event);
    } else if (getIsAddingBox()) {
        handleMouseUpAddBox(event);
    }
    // Note: Pan mode mouseup is handled by viewport-controller
}


// --- Reset Function ---
export function resetEditingOnLoad() {
    // Call the reset function for the mode controller which handles sub-states too
    resetModeControllerOnLoad();
}