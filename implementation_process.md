// image-processor.js
function applyAdaptiveThreshold(imageData, method, blockSize, C) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width * 4) + (x * 4);

            // Calculate the mean of the neighborhood
            let sum = 0;
            let count = 0;
            for (let dy = -blockSize / 2; dy <= blockSize / 2; dy++) {
                for (let dx = -blockSize / 2; dx <= blockSize / 2; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        sum += pixels[(ny * width * 4) + (nx * 4)];
                        count++;
                    }
                }
            }

            const mean = sum / count;

            // Apply the threshold
            const threshold = mean - C;
            if (pixels[index] < threshold) {
                pixels[index] = 0;
                pixels[index + 1] = 0;
                pixels[index + 2] = 0;
                pixels[index + 3] = 255;
            } else {
                pixels[index] = 255;
                pixels[index + 1] = 255;
                pixels[index + 2] = 255;
                pixels[index + 3] = 255;
            }
        }
    }
}

// ui-controller.js
function handleProcessImage() {
    const thresholdType = document.getElementById('threshold-type-select').value;
    const blockSize = document.getElementById('block-size-input').value;
    const C = document.getElementById('c-input').value;

    if (thresholdType === 'manual') {
        const threshold = document.getElementById('threshold-slider').value;
        const thresholdedImageData = getThresholdedImageData(grayscaleImageData, threshold);
        // ...
    } else if (thresholdType === 'adaptive-mean') {
        const adaptiveThresholdedImageData = getAdaptiveThresholdedImageData(grayscaleImageData, 'mean', blockSize, C);
        // ...
    } else if (thresholdType === 'adaptive-gaussian') {
        // Implement adaptive gaussian thresholding
        const adaptiveThresholdedImageData = getAdaptiveThresholdedImageData(grayscaleImageData, 'gaussian', blockSize, C);
        // ...
    }
}

// color-quantizer.js
function quantizeImageData(imageData, numColors) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Implement color quantization algorithm (e.g., Median Cut)
    // ...
}

// ui-controller.js
function generateSpritesheet(blobs, enablePaletteReduction, numColors) {
    const targetCanvas = document.getElementById('target-canvas');
    const targetCtx = targetCanvas.getContext('2d');

    blobs.forEach((blob, index) => {
        const sourceX = blob.bounds.x;
        const sourceY = blob.bounds.y;
        const sourceWidth = blob.bounds.width;
        const sourceHeight = blob.bounds.height;

        const extractedSpriteData = sourceCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);

        if (enablePaletteReduction) {
            const quantizedSpriteData = quantizeImageData(extractedSpriteData, numColors);

            const temporaryCanvas = document.createElement('canvas');
            temporaryCanvas.width = sourceWidth;
            temporaryCanvas.height = sourceHeight;
            const temporaryCtx = temporaryCanvas.getContext('2d');
            temporaryCtx.putImageData(quantizedSpriteData, 0, 0);

            targetCtx.drawImage(temporaryCanvas, sourceX, sourceY);
        } else {
            targetCtx.drawImage(sourceCanvas, sourceX, sourceY, sourceWidth, sourceHeight, spriteDestX, spriteDestY, sourceWidth, sourceHeight);
        }
    });
}

// processing.worker.js
self.onmessage = (event) => {
    if (event.data.task === 'processAll') {
        const imageData = event.data.imageData;
        const thresholdSettings = event.data.thresholdSettings;
        const minSize = event.data.minSize;

        // Perform the sequence: grayscale -> threshold -> CCL
        const grayscaleImageData = convertToGrayscale(imageData);
        const thresholdedImageData = applyThreshold(grayscaleImageData, thresholdSettings);
        const cclResult = findBlobs(thresholdedImageData, minSize);

        self.postMessage({ status: 'complete', blobs: cclResult.blobs, labels: cclResult.labels });
    }
};

// ui-controller.js
function handleProcessImage() {
    const worker = new Worker('./processing.worker.js');
    worker.onmessage = (event) => {
        if (event.data.status === 'complete') {
            const blobs = event.data.blobs;
            const labels = event.data.labels;

            // Update state and UI
            detectedBlobs = blobs;
            cclResult.labels = labels;
            updateUI();
        }
    };

    const dataToSend = {
        task: 'processAll',
        imageData: originalImageData,
        thresholdSettings: currentThresholdSettings,
        minSize: minSize
    };

    worker.postMessage(dataToSend, [originalImageData.data.buffer]);
}

// utils.js
function drawBoundingBoxes(blobs) {
    const boundingBoxesContainer = document.getElementById('bounding-boxes-container');
    boundingBoxesContainer.innerHTML = '';

    blobs.forEach((blob, index) => {
        const boundingBox = document.createElement('div');
        boundingBox.style.position = 'absolute';
        boundingBox.style.left = `${blob.bounds.x}px`;
        boundingBox.style.top = `${blob.bounds.y}px`;
        boundingBox.style.width = `${blob.bounds.width}px`;
        boundingBox.style.height = `${blob.bounds.height}px`;
        boundingBox.style.border = '1px solid red';
        boundingBox.dataset.blobIndex = index;
        boundingBoxesContainer.appendChild(boundingBox);
    });
}

// ui-controller.js
document.getElementById('debug-overlays-container').addEventListener('click', (event) => {
    if (event.target.dataset.blobIndex) {
        const blobIndex = event.target.dataset.blobIndex;
        const blob = blobs[blobIndex];
        // ...
    }
});

// ui-controller.js
function drawResizeHandles(blob) {
    const resizeHandlesContainer = document.getElementById('resize-handles-container');
    resizeHandlesContainer.innerHTML = '';

    const resizeHandleTopLeft = document.createElement('div');
    resizeHandleTopLeft.style.position = 'absolute';
    resizeHandleTopLeft.style.left = `${blob.bounds.x}px`;
    resizeHandleTopLeft.style.top = `${blob.bounds.y}px`;
    resizeHandleTopLeft.style.width = '10px';
    resizeHandleTopLeft.style.height = '10px';
    resizeHandleTopLeft.style.background = 'red';
    resizeHandlesContainer.appendChild(resizeHandleTopLeft);

    // ...
}

// ui-controller.js
let isDraggingHandle = false;
let currentDragHandleType = null;
let dragStartX, dragStartY;
let initialDragBounds = null;

document.getElementById('resize-handles-container').addEventListener('mousedown', (event) => {
    if (event.target.style.background === 'red') {
        isDraggingHandle = true;
        currentDragHandleType = event.target.dataset.handleType;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        initialDragBounds = JSON.parse(JSON.stringify(detectedBlobs[selectedBlobIndex].bounds));
    }
});

document.addEventListener('mousemove', (event) => {
    if (isDraggingHandle) {
        const newX = event.clientX;
        const newY = event.clientY;
        const delta_x = newX - dragStartX;
        const delta_y = newY - dragStartY;

        // Update the blob bounds
        const blob = detectedBlobs[selectedBlobIndex];
        if (currentDragHandleType === 'top-left') {
            blob.bounds.x += delta_x;
            blob.bounds.y += delta_y;
            blob.bounds.width -= delta_x;
            blob.bounds.height -= delta_y;
        } else if (currentDragHandleType === 'top-right') {
            blob.bounds.y += delta_y;
            blob.bounds.width += delta_x;
            blob.bounds.height -= delta_y;
        } else if (currentDragHandleType === 'bottom-left') {
            blob.bounds.x += delta_x;
            blob.bounds.width -= delta_x;
            blob.bounds.height += delta_y;
        } else if (currentDragHandleType === 'bottom-right') {
            blob.bounds.width += delta_x;
            blob.bounds.height += delta_y;
        }

        // Update the visual box div styles
        const boundingBox = document.querySelector('[data-blob-index="0"]');
        boundingBox.style.left = `${blob.bounds.x}px`;
        boundingBox.style.top = `${blob.bounds.y}px`;
        boundingBox.style.width = `${blob.bounds.width}px`;
        boundingBox.style.height = `${blob.bounds.height}px`;

        drawEditingOverlays();
    }
});

document.addEventListener('mouseup', () => {
    isDraggingHandle = false;
    currentDragHandleType = null;
    dragStartX = null;
    dragStartY = null;
    initialDragBounds = null;
});

// ui-controller.js
function handleEditingOverlayMouseDown(event) {
    if (event.target.style.background === 'red') {
        isDraggingHandle = true;
        currentDragHandleType = event.target.dataset.handleType;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        initialDragBounds = JSON.parse(JSON.stringify(detectedBlobs[selectedBlobIndex].bounds));
    }
}

// ui-controller.js
function drawEditingOverlays() {
    const editingOverlaysContainer = document.getElementById('editing-overlays');
    editingOverlaysContainer.innerHTML = '';

    const blob = detectedBlobs[selectedBlobIndex];
    const boundingBox = document.createElement('div');
    boundingBox.style.position = 'absolute';
    boundingBox.style.left = `${blob.bounds.x}px`;
    boundingBox.style.top = `${blob.bounds.y}px`;
    boundingBox.style.width = `${blob.bounds.width}px`;
    boundingBox.style.height = `${blob.bounds.height}px`;
    boundingBox.style.border = '1px solid red';
    editingOverlaysContainer.appendChild(boundingBox);

    drawResizeHandles(blob);
}

// ui-controller.js
function addBoxModeMouseDown(event) {
    const newX = event.clientX;
    const newY = event.clientY;
    const startDragX = newX;
    const startDragY = newY;

    document.addEventListener('mousemove', (event) => {
        const currentX = event.clientX;
        const currentY = event.clientY;
        const width = currentX - startDragX;
        const height = currentY - startDragY;

        const box = document.createElement('div');
        box.style.position = 'absolute';
        box.style.left = `${startDragX}px`;
        box.style.top = `${startDragY}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
        box.style.border = '1px solid red';

        document.getElementById('editing-overlays').appendChild(box);
    });

    document.addEventListener('mouseup', () => {
        const box = document.querySelector('#editing-overlays > div:last-child');
        const bounds = {
            x: parseInt(box.style.left),
            y: parseInt(box.style.top),
            width: parseInt(box.style.width),
            height: parseInt(box.style.height)
        };

        detectedBlobs.push({ bounds: bounds });
        drawEditingOverlays();
    });
}

// ui-controller.js
function deleteModeClick() {
    if (selectedBlobIndex !== null) {
        detectedBlobs.splice(selectedBlobIndex, 1);
        selectedBlobIndex = null;
        drawEditingOverlays();
    }
}

// spritesheet-generator.js
function generateSpritesheet(blobs, enablePaletteReduction, numColors) {
    const targetCanvas = document.getElementById('target-canvas');
    const targetCtx = targetCanvas.getContext('2d');

    blobs.forEach((blob, index) => {
        const sourceX = blob.bounds.x;
        const sourceY = blob.bounds.y;
        const sourceWidth = blob.bounds.width;
        const sourceHeight = blob.bounds.height;

        const extractedSpriteData = sourceCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);

        if (enablePaletteReduction) {
            const quantizedSpriteData = quantizeImageData(extractedSpriteData, numColors);

            const temporaryCanvas = document.createElement('canvas');
            temporaryCanvas.width = sourceWidth;
            temporaryCanvas.height = sourceHeight;
            const temporaryCtx = temporaryCanvas.getContext('2d');
            temporaryCtx.putImageData(quantizedSpriteData, 0, 0);

            targetCtx.drawImage(temporaryCanvas, sourceX, sourceY);
        } else {
            targetCtx.drawImage(sourceCanvas, sourceX, sourceY, sourceWidth, sourceHeight, spriteDestX, spriteDestY, sourceWidth, sourceHeight);
        }
    });
}