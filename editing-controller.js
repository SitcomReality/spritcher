import { elements } from 'dom-elements';
import { appState, setEditModeState, setSelectedBlobIndex, deleteBlobByIndex, updateBlobBoundsByIndex } from 'state';
import { updateDebugOverlays } from 'debug-controller'; // For highlighting and handles
import { clearGeneratedSpritesheet } from 'spritesheet-controller'; // To invalidate spritesheet on edit
import { invalidateProcessing } from 'processing-controller'; // To mark results as potentially stale
import { updateImageDisplayTransform } from 'viewport-controller'; // To get current zoom

// --- Local State for Dragging ---
let isResizing = false;
let dragHandleType = null;
let startDragX = 0; // ClientX/Y relative to viewport
let startDragY = 0;
let startBounds = null; // Original bounds { minX, minY, width, height } at drag start
let selectedBoxElement = null; // Reference to the .editable-bbox div being resized

export function initEditingController() {
    elements.editModeButtons.forEach(button => {
        button.addEventListener('click', () => setEditModeAndClearSelection(button.dataset.mode));
    });
    elements.deleteSelectedButton.addEventListener('click', handleDeleteSelected);

    // Event listeners for interactions on the preview area
    elements.imagePreviewContainer.addEventListener('mousedown', handlePreviewMouseDown);
    elements.imagePreviewContainer.addEventListener('click', handlePreviewClick);

    // Global listeners for mouse move/up during drag operations (resize/pan)
    // These are added/removed dynamically to avoid listening all the time
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    setEditModeUI(appState.editing.currentEditMode); // Set initial mode UI
    updateEditModeUI(); // Update enable/disable state
}

function handleDeleteSelected() {
    const selectedIndex = appState.editing.selectedBlobIndex;
    if (selectedIndex !== null) {
        const success = deleteBlobByIndex(selectedIndex);
        if (success) {
            console.log(`Blob ${selectedIndex} deleted.`);
            clearGeneratedSpritesheet(); // Invalidate generated spritesheet
            invalidateProcessing(true); // Mark results as stale
            elements.processingStatusDiv.textContent = `Sprite ${selectedIndex} deleted. Spritesheet needs regenerating.`;
            updateDebugOverlays(); // Redraw overlays (removes deleted box and its handles)
            updateEditModeUI(); // Update button states (delete/edit bounds become disabled)
            updateEditingStatus(); // Update status text
        }
    } else {
        console.warn("Delete button clicked but no blob selected.");
    }
}

export function setEditModeAndClearSelection(newMode) {
    if (appState.editing.currentEditMode !== newMode) {
        setSelectedBlobIndex(null); // Deselect when changing mode
    }
    // Stop any active resizing if mode changes
    if (isResizing) {
        stopResizing(false); // Don't save changes if mode changed mid-drag
    }
    setEditModeUI(newMode);
    updateDebugOverlays(); // Redraw overlays to show/hide handles based on mode
}

function setEditModeUI(newMode) {
    console.log("Setting edit mode to:", newMode);
    setEditModeState(newMode);

    elements.editModeButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.mode === newMode);
    });

    // Update container class for cursor styling
    elements.imagePreviewContainer.classList.remove('pan-mode', 'select-mode', 'grabbing'); // Add other modes later
    if (newMode === 'pan') {
        elements.imagePreviewContainer.classList.add('pan-mode');
    } else if (newMode === 'select') {
        elements.imagePreviewContainer.classList.add('select-mode');
    } else if (newMode === 'edit-bounds' && appState.editing.selectedBlobIndex !== null) {
        // Cursor is handled by the handles themselves, maybe default for container?
        elements.imagePreviewContainer.style.cursor = 'default'; // Or maybe 'crosshair'?
    } else {
         elements.imagePreviewContainer.style.cursor = 'default';
    }

    updateEditModeUI(); // Update enable/disable state based on new mode & selection
    updateEditingStatus();
    // Highlight/handles are updated via updateDebugOverlays called in setEditModeAndClearSelection
}

export function updateEditModeUI() {
    const hasImage = !!appState.originalImageInfo;
    const hasBlobs = appState.detectedBlobs && appState.detectedBlobs.length > 0;
    const isBlobSelected = appState.editing.selectedBlobIndex !== null;

    elements.editModeButtons.forEach(button => {
        const mode = button.dataset.mode;
        let disabled = false;

        switch (mode) {
            case 'pan':
                disabled = !hasImage;
                break;
            case 'select':
                disabled = !hasBlobs;
                break;
            case 'edit-bounds':
                disabled = !hasBlobs || !isBlobSelected;
                break;
            case 'add':
                disabled = !hasImage; // Future: Implement
                break;
            case 'split':
            case 'merge':
                disabled = true; // Not implemented
                break;
            default:
                disabled = !hasImage;
                break;
        }
        button.disabled = disabled;
    });

    elements.deleteSelectedButton.disabled = !isBlobSelected || !hasBlobs;

    elements.editModeButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.mode === appState.editing.currentEditMode && !button.disabled);
    });

    updateEditingStatus();
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
            status += isBlobSelected ? `Drag handles to resize Sprite ${selectedBlobIndex}.` : 'Select a sprite first.';
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

function handlePreviewMouseDown(event) {
     if (event.button !== 0) return; // Only left clicks

    // Handle Resize Start
    if (appState.editing.currentEditMode === 'edit-bounds' && event.target.classList.contains('resize-handle')) {
        event.stopPropagation(); // Prevent pan or select logic
        startResizing(event);
    }
    // Pan logic is handled in viewport-controller
    // Select logic is handled in handlePreviewClick
}

function handleGlobalMouseMove(event) {
    if (isResizing) {
        event.preventDefault(); // Prevent text selection etc.
        updateResize(event);
    }
    // Pan logic is handled in viewport-controller
}

function handleGlobalMouseUp(event) {
     if (event.button !== 0) return; // Only left clicks

    if (isResizing) {
        event.stopPropagation(); // Prevent potential click handlers
        stopResizing(true); // Save the changes
    }
    // Pan logic is handled in viewport-controller
}

// --- Resizing Logic ---

function startResizing(event) {
    const selectedIndex = appState.editing.selectedBlobIndex;
    if (selectedIndex === null) return;

    const handle = event.target;
    dragHandleType = handle.dataset.handleType;
    selectedBoxElement = handle.closest('.editable-bbox'); // Find the parent box element

    if (!selectedBoxElement || !dragHandleType) {
        console.error("Could not find handle type or parent box for resize start.");
        return;
    }

    startDragX = event.clientX;
    startDragY = event.clientY;
    // Get the *current* bounds from the state as the starting point
    const currentBounds = appState.detectedBlobs[selectedIndex].bounds;
    startBounds = { ...currentBounds }; // Clone

    isResizing = true;
    elements.imagePreviewContainer.classList.add('resizing'); // Add class for potential global cursor changes
    console.log(`Start resize: handle=${dragHandleType}, startBounds=`, startBounds);
}

function updateResize(event) {
    if (!isResizing || !startBounds || !selectedBoxElement) return;

    const currentZoom = appState.viewport.currentZoom;
    const dx = (event.clientX - startDragX) / currentZoom; // Delta in image pixels
    const dy = (event.clientY - startDragY) / currentZoom;

    let { minX, minY, width, height } = startBounds;

    // Calculate new dimensions based on handle type
    if (dragHandleType.includes('n')) {
        minY += dy;
        height -= dy;
    }
    if (dragHandleType.includes('s')) {
        height += dy;
    }
    if (dragHandleType.includes('w')) {
        minX += dx;
        width -= dx;
    }
    if (dragHandleType.includes('e')) {
        width += dx;
    }

    // Ensure minimum size (e.g., 1x1 pixel)
    width = Math.max(1, width);
    height = Math.max(1, height);
    // Adjust position if size change flipped the box (e.g., dragged top handle below bottom)
    if (width < 1) { /* Handle negative width if necessary */ }
    if (height < 1) { /* Handle negative height if necessary */ }

    // Update the visual representation directly for responsiveness
    selectedBoxElement.style.left = `${minX}px`;
    selectedBoxElement.style.top = `${minY}px`;
    selectedBoxElement.style.width = `${width}px`;
    selectedBoxElement.style.height = `${height}px`;

    // Note: Handles reposition automatically via CSS percentages inside the box
}

function stopResizing(saveChanges) {
    if (!isResizing) return;
    isResizing = false;
    elements.imagePreviewContainer.classList.remove('resizing');

    if (saveChanges && selectedBoxElement && startBounds) {
        const selectedIndex = appState.editing.selectedBlobIndex;

        // Read final bounds from the styled element
        const finalMinX = parseFloat(selectedBoxElement.style.left);
        const finalMinY = parseFloat(selectedBoxElement.style.top);
        const finalWidth = parseFloat(selectedBoxElement.style.width);
        const finalHeight = parseFloat(selectedBoxElement.style.height);

        if (!isNaN(finalMinX) && !isNaN(finalMinY) && !isNaN(finalWidth) && finalWidth > 0 && !isNaN(finalHeight) && finalHeight > 0 && selectedIndex !== null) {

            const newBounds = {
                minX: finalMinX,
                minY: finalMinY,
                width: finalWidth,
                height: finalHeight
            };

            const updated = updateBlobBoundsByIndex(selectedIndex, newBounds);

            if (updated) {
                clearGeneratedSpritesheet(); // Invalidate spritesheet
                invalidateProcessing(true); // Mark CCL/Blobs as stale
                elements.processingStatusDiv.textContent = `Sprite ${selectedIndex} resized. Spritesheet needs regenerating.`;
                console.log(`Resize end: Saved new bounds for blob ${selectedIndex}`, newBounds);
            } else {
                 console.error("Failed to save updated bounds to state.");
                 // Optionally revert visual changes here
            }

        } else {
            console.warn("Resize ended with invalid final bounds or no selection. Reverting visual changes.");
             // Revert visual change if saving failed or bounds were invalid
            selectedBoxElement.style.left = `${startBounds.minX}px`;
            selectedBoxElement.style.top = `${startBounds.minY}px`;
            selectedBoxElement.style.width = `${startBounds.width}px`;
            selectedBoxElement.style.height = `${startBounds.height}px`;
        }

    } else if (!saveChanges && selectedBoxElement && startBounds) {
         // Resizing cancelled (e.g., mode change), revert visual changes
         console.log("Resize cancelled, reverting visual changes.");
         selectedBoxElement.style.left = `${startBounds.minX}px`;
         selectedBoxElement.style.top = `${startBounds.minY}px`;
         selectedBoxElement.style.width = `${startBounds.width}px`;
         selectedBoxElement.style.height = `${startBounds.height}px`;
    }

    // Reset drag state
    dragHandleType = null;
    startBounds = null;
    startDragX = 0;
    startDragY = 0;
    selectedBoxElement = null;

    // Redraw overlays to ensure consistency with state and correct handles
    updateDebugOverlays();
    updateEditingStatus(); // Update status message
}

// --- Selection Logic ---

// Highlight the currently selected blob's div (Handles are drawn in debug-controller)
function highlightSelectedBlob() {
    updateDebugOverlays(); // This now handles selection class and handles drawing
    updateEditModeUI(); // Update button states based on selection
    updateEditingStatus(); // Update text based on selection
}

function handlePreviewClick(event) {
    // Only handle clicks in select mode that aren't resize handles
    if (appState.editing.currentEditMode === 'select' && !event.target.classList.contains('resize-handle')) {
        const target = event.target;
        if (target.classList.contains('editable-bbox')) {
            const indexStr = target.dataset.blobIndex;
            const index = parseInt(indexStr, 10);

            if (!isNaN(index) && index >= 0 && index < appState.detectedBlobs.length) {
                const newIndex = (appState.editing.selectedBlobIndex === index) ? null : index;
                setSelectedBlobIndex(newIndex);
                console.log("Selected blob index:", appState.editing.selectedBlobIndex);
                highlightSelectedBlob();
            } else {
                console.warn("Clicked editable-bbox with invalid index:", indexStr);
                setSelectedBlobIndex(null);
                highlightSelectedBlob();
            }
        } else {
            // Clicked outside any box, deselect
            if (appState.editing.selectedBlobIndex !== null) {
                setSelectedBlobIndex(null);
                highlightSelectedBlob();
            }
        }
        event.stopPropagation(); // Prevent triggering other potential listeners
    }
     // Clicks on handles are ignored here, handled by mousedown
     // Clicks in pan mode are ignored here
     // Clicks in edit-bounds mode outside handles might deselect? (Currently do nothing)
}

export function resetEditingOnLoad() {
    if (isResizing) {
        stopResizing(false); // Cancel any ongoing resize
    }
    appState.editing.currentEditMode = 'pan';
    appState.editing.selectedBlobIndex = null;
    setEditModeUI('pan'); // This calls updateEditModeUI internally
    elements.editingStatusDiv.textContent = '';
    elements.editingToolsSection.style.display = 'none';
}