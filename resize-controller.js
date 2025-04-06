import { elements } from 'dom-elements';
import { appState, updateBlobBoundsByIndex } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { invalidateProcessing } from 'processing-controller';
import { updateDebugOverlays } from 'debug-controller';
// Import updateEditingStatus from mode-controller if needed
import { updateEditModeUI } from 'editing-controller';

// --- Local State for Resizing ---
let isResizing = false;
let dragHandleType = null;
let startDragX_client = 0;
let startDragY_client = 0;
let startBounds_resize = null;
let selectedBoxElement_resize = null;

export function initResizeController() {
    // Listeners are added in editing-controller and call functions here
}

export function handleMouseDownResize(event) {
     // Called by editing-controller if mode is 'edit-bounds' and target is a handle
    if (event.button !== 0 || appState.editing.currentEditMode !== 'edit-bounds') return;

    const selectedIndex = appState.editing.selectedBlobIndex;
    if (selectedIndex === null) return; // Should not happen if UI is correct, but safety check

    const handle = event.target;
    if (!handle.classList.contains('resize-handle')) return; // Ensure it's really a handle

    event.preventDefault(); // Prevent text selection, etc.
    event.stopPropagation(); // Prevent triggering pan or select listeners

    dragHandleType = handle.dataset.handleType;
    selectedBoxElement_resize = handle.closest('.editable-bbox');

    if (!selectedBoxElement_resize || !dragHandleType) {
        console.error("Could not find handle type or parent box for resize start.");
        return;
    }

    startDragX_client = event.clientX;
    startDragY_client = event.clientY;
    const currentBounds = appState.detectedBlobs[selectedIndex].bounds;
    startBounds_resize = { ...currentBounds }; // Create a copy

    isResizing = true;
    elements.imagePreviewContainer.style.cursor = handle.style.cursor; // Set container cursor during resize
    console.log(`Start resize: handle=${dragHandleType}, startBounds=`, { ...startBounds_resize });
}


export function handleMouseMoveResize(event) {
    // Called by editing-controller's global mousemove if isResizing is true
    if (!isResizing || !startBounds_resize || !selectedBoxElement_resize) return;

    event.preventDefault();

    const currentZoom = appState.viewport.currentZoom;
    // Avoid division by zero if zoom is somehow 0
    const dx = currentZoom !== 0 ? (event.clientX - startDragX_client) / currentZoom : 0;
    const dy = currentZoom !== 0 ? (event.clientY - startDragY_client) / currentZoom : 0;

    let newBounds = { ...startBounds_resize }; // Work on a copy

    // Adjust bounds based on the handle being dragged
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

    // Prevent negative or zero dimensions visually during drag
    if (newBounds.width < 1) {
        if (dragHandleType.includes('w')) {
            // If dragging 'w' handle made width negative, lock minX
            newBounds.minX = startBounds_resize.minX + startBounds_resize.width - 1;
        }
        newBounds.width = 1; // Clamp width
    }
    if (newBounds.height < 1) {
         if (dragHandleType.includes('n')) {
            // If dragging 'n' handle made height negative, lock minY
            newBounds.minY = startBounds_resize.minY + startBounds_resize.height - 1;
        }
        newBounds.height = 1; // Clamp height
    }

    // Update the visual representation directly
    selectedBoxElement_resize.style.left = `${Math.round(newBounds.minX)}px`;
    selectedBoxElement_resize.style.top = `${Math.round(newBounds.minY)}px`;
    selectedBoxElement_resize.style.width = `${Math.round(newBounds.width)}px`;
    selectedBoxElement_resize.style.height = `${Math.round(newBounds.height)}px`;
}

export function handleMouseUpResize(event) {
     // Called by editing-controller's global mouseup if isResizing is true
    if (!isResizing) return;
    if (event.button !== 0) return; // Only react to left mouse button up

    event.stopPropagation(); // Prevent other listeners

    stopResizing(true); // Attempt to save changes
}

// Function to stop resizing, callable internally or by mode controller on mode switch
export function stopResizing(saveChanges) {
    if (!isResizing) return;

    const selectedIndex = appState.editing.selectedBlobIndex;

    isResizing = false; // Set state first
    elements.imagePreviewContainer.style.cursor = 'default'; // Reset cursor

    if (saveChanges && selectedBoxElement_resize && startBounds_resize && selectedIndex !== null) {
        // Get final bounds directly from the element style we were updating
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

            // Compare with initial bounds to see if change occurred
            if (newBounds.minX !== startBounds_resize.minX || newBounds.minY !== startBounds_resize.minY ||
                newBounds.width !== startBounds_resize.width || newBounds.height !== startBounds_resize.height)
            {
                const updated = updateBlobBoundsByIndex(selectedIndex, newBounds);

                if (updated) {
                    clearGeneratedSpritesheet(); // Invalidate generated sheet
                    invalidateProcessing(true); // Keep threshold, re-run CCL (though not strictly needed just for bounds change, safer for now)
                    elements.processingStatusDiv.textContent = `Sprite ${selectedIndex} resized. Regeneration needed.`;
                    console.log(`Resize end: Saved new bounds for blob ${selectedIndex}`, newBounds);
                } else {
                    console.error("Failed to save updated bounds to state for blob:", selectedIndex);
                    // Revert visual changes if state update failed
                    selectedBoxElement_resize.style.left = `${startBounds_resize.minX}px`;
                    selectedBoxElement_resize.style.top = `${startBounds_resize.minY}px`;
                    selectedBoxElement_resize.style.width = `${startBounds_resize.width}px`;
                    selectedBoxElement_resize.style.height = `${startBounds_resize.height}px`;
                }
            } else {
                 console.log("Resize end: No change detected in bounds.");
            }

        } else {
            console.warn("Resize ended with invalid final bounds. Reverting visual changes.");
            // Revert visual changes if final parse failed
            selectedBoxElement_resize.style.left = `${startBounds_resize.minX}px`;
            selectedBoxElement_resize.style.top = `${startBounds_resize.minY}px`;
            selectedBoxElement_resize.style.width = `${startBounds_resize.width}px`;
            selectedBoxElement_resize.style.height = `${startBounds_resize.height}px`;
        }

    } else if (!saveChanges && selectedBoxElement_resize && startBounds_resize) {
        // Explicitly cancelled (e.g., mode switch) - revert visual changes
        console.log("Resize cancelled, reverting visual changes.");
        selectedBoxElement_resize.style.left = `${startBounds_resize.minX}px`;
        selectedBoxElement_resize.style.top = `${startBounds_resize.minY}px`;
        selectedBoxElement_resize.style.width = `${startBounds_resize.width}px`;
        selectedBoxElement_resize.style.height = `${startBounds_resize.height}px`;
    }

    // Clean up local state variables
    dragHandleType = null;
    startBounds_resize = null;
    startDragX_client = 0;
    startDragY_client = 0;
    selectedBoxElement_resize = null;

    updateDebugOverlays(); // Ensure handles are drawn correctly based on selection/mode
    updateEditModeUI(); // Let editing-controller handle UI updates

}

export function getIsResizing() {
    return isResizing;
}
