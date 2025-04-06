import { elements } from 'dom-elements';
import { appState, setViewport, resetViewport } from 'state';

export function initViewportController() {
    elements.zoomInButton.addEventListener('click', () => zoomAtPoint(elements.imagePreviewContainer.clientWidth / 2, elements.imagePreviewContainer.clientHeight / 2, 1.2));
    elements.zoomOutButton.addEventListener('click', () => zoomAtPoint(elements.imagePreviewContainer.clientWidth / 2, elements.imagePreviewContainer.clientHeight / 2, 1 / 1.2));
    elements.imagePreviewContainer.addEventListener('mousedown', handlePreviewMouseDown);
    elements.imagePreviewContainer.addEventListener('mousemove', handlePreviewMouseMove);
    elements.imagePreviewContainer.addEventListener('mouseup', handlePreviewMouseUp);
    elements.imagePreviewContainer.addEventListener('mouseleave', handlePreviewMouseLeave);
    // Click handled by editing controller
    elements.imagePreviewContainer.addEventListener('wheel', handleWheelZoom, { passive: false });
}

function handlePreviewMouseDown(event) {
    if (event.button !== 0 || !appState.originalImageInfo) return;

    if (appState.editing.currentEditMode === 'pan') {
        setViewport({
            isPanning: true,
            startPanX: event.clientX,
            startPanY: event.clientY,
            startViewX: appState.viewport.startViewX,
            startViewY: appState.viewport.startViewY
        });
        elements.imagePreviewContainer.classList.add('grabbing');
        event.preventDefault(); // Prevent text selection during pan
    }
    // Allow other modes to prevent default if needed (handled in their respective controllers)
}

function handlePreviewMouseMove(event) {
    if (appState.viewport.isPanning && appState.editing.currentEditMode === 'pan') {
        const dx = event.clientX - appState.viewport.startPanX;
        const dy = event.clientY - appState.viewport.startPanY;
        setViewport({
            panX: appState.viewport.startViewX + dx,
            panY: appState.viewport.startViewY + dy
        });
        updateImageDisplayTransform(); // Apply transform immediately
    }
}

function handlePreviewMouseUp(event) {
    if (event.button !== 0) return;
    if (appState.viewport.isPanning && appState.editing.currentEditMode === 'pan') {
        setViewport({ isPanning: false });
        elements.imagePreviewContainer.classList.remove('grabbing');
    }
}

function handlePreviewMouseLeave(event) {
    // Treat leaving the container like mouse up for panning
    if (appState.viewport.isPanning && appState.editing.currentEditMode === 'pan') {
        setViewport({ isPanning: false });
        elements.imagePreviewContainer.classList.remove('grabbing');
    }
}

function handleWheelZoom(event) {
    if (!appState.originalImageInfo) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? 1 / 1.1 : 1.1;

    const rect = elements.imagePreviewContainer.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    zoomAtPoint(mouseX, mouseY, delta);
}

// Zooms the image view, attempting to keep the point (cx, cy) in container coordinates stationary
function zoomAtPoint(containerX, containerY, factor) {
    if (!appState.originalImageInfo) return;

    const { currentZoom, panX, panY } = appState.viewport;
    const newZoom = Math.max(0.1, Math.min(10, currentZoom * factor));

    // Calculate image coordinates under the mouse before zoom
    const imageXBefore = (containerX - panX) / currentZoom;
    const imageYBefore = (containerY - panY) / currentZoom;

    // Calculate new panX/panY to keep image coordinates stationary under mouse
    const newPanX = containerX - imageXBefore * newZoom;
    const newPanY = containerY - imageYBefore * newZoom;

    setViewport({
        currentZoom: newZoom,
        panX: newPanX,
        panY: newPanY
    });

    updateImageDisplayTransform();
}

// Resets zoom to fit image and centers it (if needed, currently handled in ui-controller on load)
export function resetZoomPanStateAndView() {
    resetViewport(); // Reset state
    console.log(`Reset Zoom: ${appState.viewport.currentZoom.toFixed(2)}, Pan: (${appState.viewport.panX.toFixed(1)}, ${appState.viewport.panY.toFixed(1)})`);
    updateImageDisplayTransform(); // Apply the reset transform
}

// Applies the current zoom/pan state transform to the canvas and overlay container
export function updateImageDisplayTransform() {
    if (!elements.imagePreviewCanvas || !elements.debugOverlaysContainer || !appState.originalImageInfo) return;

    const { panX, panY, currentZoom } = appState.viewport;
    const transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    elements.imagePreviewCanvas.style.transform = transform;
    elements.debugOverlaysContainer.style.transform = transform;

    // Ensure overlay container has the base dimensions of the image when transforms are applied
    elements.debugOverlaysContainer.style.width = `${appState.originalImageInfo.naturalWidth}px`;
    elements.debugOverlaysContainer.style.height = `${appState.originalImageInfo.naturalHeight}px`;
}

// Function to update dimensions without transform (e.g., after initial load)
export function updateOverlayContainerDimensions() {
    if (!elements.debugOverlaysContainer || !appState.originalImageInfo) return;
     elements.debugOverlaysContainer.style.width = `${appState.originalImageInfo.naturalWidth}px`;
     elements.debugOverlaysContainer.style.height = `${appState.originalImageInfo.naturalHeight}px`;
}

export function clearTransforms() {
     if(elements.imagePreviewCanvas) elements.imagePreviewCanvas.style.transform = '';
     if(elements.debugOverlaysContainer) {
        elements.debugOverlaysContainer.style.transform = '';
        elements.debugOverlaysContainer.style.width = '0px';
        elements.debugOverlaysContainer.style.height = '0px';
     }
}