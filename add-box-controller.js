import { elements } from 'dom-elements';
import { appState, addBlob, setSelectedBlobIndex } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { updateDebugOverlays } from 'debug-controller';
import { setEditModeAndClearSelection, updateEditModeUI } from 'mode-controller';
import { displayExtractedSprites } from 'extracted-sprites-controller'; // Keep this to update available sprites

// --- Local State for Adding Box ---
let isAddingBox = false;
let startAddX_img = 0;
let startAddY_img = 0;
let tempAddBoxElement = null;

export function initAddBoxController() {
    // Listeners are added in mode-controller and call functions here
}

export function handleMouseDownAddBox(event) {
    // Called by mode-controller if mode is 'add'
    if (event.button !== 0 || appState.editing.currentEditMode !== 'add') return;

    // Don't start adding if clicking on an existing box or handle
    if (event.target.classList.contains('editable-bbox') || event.target.classList.contains('resize-handle')) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const { currentZoom, panX, panY } = appState.viewport;
    const rect = elements.imagePreviewContainer.getBoundingClientRect();

    // Calculate starting point in image coordinates
    const mouseX_container = event.clientX - rect.left;
    const mouseY_container = event.clientY - rect.top;
    startAddX_img = currentZoom !== 0 ? (mouseX_container - panX) / currentZoom : mouseX_container - panX;
    startAddY_img = currentZoom !== 0 ? (mouseY_container - panY) / currentZoom : mouseY_container - panY;

    isAddingBox = true;

    // Create the temporary visual feedback element
    tempAddBoxElement = document.createElement('div');
    tempAddBoxElement.className = 'adding-bbox-temp'; // Use CSS class for styling
    tempAddBoxElement.style.position = 'absolute'; // Position within the overlay container
    tempAddBoxElement.style.left = `${startAddX_img}px`;
    tempAddBoxElement.style.top = `${startAddY_img}px`;
    tempAddBoxElement.style.width = '0px';
    tempAddBoxElement.style.height = '0px';
    tempAddBoxElement.style.pointerEvents = 'none'; // Don't interfere with mouse events

    elements.debugOverlaysContainer.appendChild(tempAddBoxElement);

    console.log(`Start adding box at image coords: (${startAddX_img.toFixed(1)}, ${startAddY_img.toFixed(1)})`);
}

export function handleMouseMoveAddBox(event) {
    // Called by mode-controller's global mousemove if isAddingBox is true
    if (!isAddingBox || !tempAddBoxElement) return;

    const { currentZoom, panX, panY } = appState.viewport;
    const rect = elements.imagePreviewContainer.getBoundingClientRect();

    // Calculate current mouse position in image coordinates
    const mouseX_container = event.clientX - rect.left;
    const mouseY_container = event.clientY - rect.top;
    const currentX_img = currentZoom !== 0 ? (mouseX_container - panX) / currentZoom : mouseX_container - panX;
    const currentY_img = currentZoom !== 0 ? (mouseY_container - panY) / currentZoom : mouseY_container - panY;

    // Determine top-left corner and dimensions
    const minX = Math.min(startAddX_img, currentX_img);
    const minY = Math.min(startAddY_img, currentY_img);
    const width = Math.abs(currentX_img - startAddX_img);
    const height = Math.abs(currentY_img - startAddY_img);

    // Update the temporary box's style
    tempAddBoxElement.style.left = `${minX}px`;
    tempAddBoxElement.style.top = `${minY}px`;
    tempAddBoxElement.style.width = `${width}px`;
    tempAddBoxElement.style.height = `${height}px`;
}

export function handleMouseUpAddBox(event) {
    // Called by mode-controller's global mouseup if isAddingBox is true
    if (!isAddingBox) return;
    if (event.button !== 0) return; // Only react to left mouse button up

    event.stopPropagation();
    stopAddingBox(true); // Attempt to save the new box
}

// Function to stop adding a box, callable internally or by mode controller
export function stopAddingBox(saveChanges) {
    if (!isAddingBox) return;
    isAddingBox = false; // Set state first

    if (tempAddBoxElement) {
        if (saveChanges) {
            // Get final bounds from the temporary element
            const finalMinX = parseFloat(tempAddBoxElement.style.left);
            const finalMinY = parseFloat(tempAddBoxElement.style.top);
            const finalWidth = parseFloat(tempAddBoxElement.style.width);
            const finalHeight = parseFloat(tempAddBoxElement.style.height);

            // Validate the bounds (must have positive width and height)
            if (!isNaN(finalMinX) && !isNaN(finalMinY) && finalWidth >= 1 && finalHeight >= 1) {
                const newBounds = {
                    minX: finalMinX,
                    minY: finalMinY,
                    width: finalWidth,
                    height: finalHeight
                };
                // addBlob now only adds to detectedBlobs and extractedSprites (available)
                const newDetectedIndex = addBlob(newBounds);

                if (newDetectedIndex !== null) {
                    console.log("Added new blob:", newBounds);
                    clearGeneratedSpritesheet(); // Invalidate generated sheet if settings change

                    elements.processingStatusDiv.textContent = `New sprite added (${appState.detectedBlobs.length} total). It is now in the 'Available' list.`;

                    updateDebugOverlays(); // Redraw overlays to include the new box
                    displayExtractedSprites(); // Update the available sprites view AND selected view
                    updateEditModeUI(); // Update button states

                    // Optionally select the newly added blob (in editing view) and switch to select mode?
                    // Let's keep it in Add mode for now, user can switch if needed.
                    setSelectedBlobIndex(newDetectedIndex); // Select in editing view
                    // setEditModeAndClearSelection('select'); // Switch mode after adding

                } else {
                     console.error("Failed to add blob to state.");
                }


            } else {
                console.log("Add box cancelled: Final box too small or invalid.");
            }
        } else {
            console.log("Add box cancelled by user (e.g., mode switch).");
        }
        // Remove the temporary visual element regardless of saving
        tempAddBoxElement.remove();
    }

    // Clean up local state variables
    tempAddBoxElement = null;
    startAddX_img = 0;
    startAddY_img = 0;
}

export function getIsAddingBox() {
    return isAddingBox;
}