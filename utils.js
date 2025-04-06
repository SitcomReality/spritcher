/**
 * Draws bounding boxes as div elements onto an overlay container.
 * Assumes the container is positioned absolutely over the main image canvas
 * and shares the same CSS transform for zoom/pan.
 *
 * @param {HTMLElement} overlayContainer - The container div (e.g., #debug-overlays).
 * @param {Array<Object>} boxes - Array of box objects { minX, minY, width, height }.
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.className='bbox'] - CSS class name for the box elements.
 * @param {string} [options.color='red'] - Color of the bounding box border.
 * @param {string} [options.pointerEvents='none'] - CSS pointer-events value.
 * @param {Object} [options.dataAttributes={}] - Key-value pairs for dataset attributes.
 * @param {number} [options.borderWidth=1] - Border width in pixels.
 */
export function drawBoundingBoxes(overlayContainer, boxes, options = {}) {
    const defaults = {
        className: 'bbox',
        color: 'red',
        pointerEvents: 'none',
        dataAttributes: {},
        borderWidth: 1
    };
    const config = { ...defaults, ...options };

    // Clear existing boxes of the same class first to prevent duplicates
    overlayContainer.querySelectorAll(`.${config.className}`).forEach(el => el.remove());

    if (!boxes || boxes.length === 0 || !overlayContainer) {
        // console.log("No boxes to draw or overlay container missing.");
        return;
    }

    // Use a DocumentFragment for performance when adding many elements
    const fragment = document.createDocumentFragment();

    boxes.forEach((box, index) => {
        // Basic validation for box properties
        if (box.minX === undefined || box.minY === undefined || box.width === undefined || box.height === undefined) {
             console.warn("Skipping invalid box object:", box);
             return;
        }
         // Ensure width/height are non-negative
        const width = Math.max(0, box.width);
        const height = Math.max(0, box.height);
         // Skip zero-size boxes
        if (width <= 0 || height <= 0) {
            console.warn(`Skipping box with zero or negative dimensions: w=${width}, h=${height}`);
            return;
        }

        const boxDiv = document.createElement('div');
        boxDiv.className = config.className; // Add the specified class
        boxDiv.style.position = 'absolute'; // Position relative to overlay container
        boxDiv.style.left = `${box.minX}px`;
        boxDiv.style.top = `${box.minY}px`;
        boxDiv.style.width = `${width}px`;
        boxDiv.style.height = `${height}px`;
        boxDiv.style.border = `${config.borderWidth}px solid ${config.color}`;
        boxDiv.style.boxSizing = 'border-box'; // Border included in width/height
        boxDiv.style.pointerEvents = config.pointerEvents;

        // Add data attributes
        for (const key in config.dataAttributes) {
            // Allow a function to generate value based on box/index
            if (typeof config.dataAttributes[key] === 'function') {
                 boxDiv.dataset[key] = config.dataAttributes[key](box, index);
            } else {
                 boxDiv.dataset[key] = config.dataAttributes[key];
            }

        }

        fragment.appendChild(boxDiv);
    });

    overlayContainer.appendChild(fragment);
}

/**
 * Removes all child elements from a container element.
 * Used to clear overlays like bounding boxes.
 * @param {HTMLElement} overlayContainer - The container element (e.g., #debug-overlays).
 */
export function clearOverlays(overlayContainer) {
    if (overlayContainer) {
        // More efficient than innerHTML = '' for removing all children
        while (overlayContainer.firstChild) {
            overlayContainer.removeChild(overlayContainer.firstChild);
        }
    }
}