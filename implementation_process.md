# Spritcher Implementation Process

## Step 1: Adaptive Thresholding

The goal of this step is to improve the thresholding robustness on images with varying background colors or lighting.

### 1.1 Implement Adaptive Thresholding Algorithm

Create a new function `applyAdaptiveThreshold(imageData, method, blockSize, C)` in `image-processor.js`.

*   Input: Grayscale `ImageData`.
*   `method`: 'mean' or 'gaussian'.
*   `blockSize`: Size of the neighborhood (odd number, e.g., 11).
*   `C`: Constant subtracted from the calculated local threshold.
*   Logic: Iterate through pixels. For each pixel, calculate the mean (or weighted Gaussian average) of its `blockSize x blockSize` neighborhood in the grayscale image. The local threshold is `mean - C` (or `gaussian_avg - C`). Apply binary threshold based on this local value. Handle borders carefully (padding or skipping). Modify the *input* `imageData` in place.

```javascript
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
```

### 1.2 Create Getter Function

Implement `getAdaptiveThresholdedImageData(grayscaleImageData, method, blockSize, C)` which copies the input `grayscaleImageData` and then calls `applyAdaptiveThreshold` on the copy, returning the new thresholded `ImageData`.

```javascript
function getAdaptiveThresholdedImageData(grayscaleImageData, method, blockSize, C) {
    const thresholdedImageData = ctx.createImageData(grayscaleImageData.width, grayscaleImageData.height);
    thresholdedImageData.data.set(grayscaleImageData.data);

    applyAdaptiveThreshold(thresholdedImageData, method, blockSize, C);

    return thresholdedImageData;
}
```

### 1.3 UI Integration

Add a `<select>` element in the Settings section to choose threshold type ("Manual", "Adaptive Mean", "Adaptive Gaussian").

```html
<div class="setting">
    <label for="threshold-type-select">Threshold Type:</label>
    <select id="threshold-type-select">
        <option value="manual">Manual</option>
        <option value="adaptive-mean">Adaptive Mean</option>
        <option value="adaptive-gaussian">Adaptive Gaussian</option>
    </select>
</div>
```

Add number inputs for `blockSize` and `C`, initially hidden. Use JS to show/hide them based on the selected threshold type.

```html
<div class="setting" id="adaptive-threshold-settings" style="display: none;">
    <label for="block-size-input">Block Size:</label>
    <input type="number" id="block-size-input" min="1" value="11">
    <label for="c-input">C:</label>
    <input type="number" id="c-input" min="0" value="0">
</div>
```

Modify `handleProcessImage` to check the selected threshold type and apply the corresponding thresholding method.

```javascript
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
        // TO DO: implement adaptive gaussian thresholding
    }
}
```

## Step 2: Sprite Editing Tools

The goal of this step is to allow manual correction of detection results (split/merge blobs, add/delete, adjust boundaries).

### 2.1 Mode Selection

Add UI buttons/toolbar to switch between modes: "Select", "Edit Bounds", "Add Box", "Split", "Merge".

```html
<div id="mode-selection">
    <button id="select-mode-button">Select</button>
    <button id="edit-bounds-mode-button">Edit Bounds</button>
    <button id="add-box-mode-button">Add Box</button>
    <button id="split-mode-button">Split</button>
    <button id="merge-mode-button">Merge</button>
</div>
```

### 2.2 Selection (Select mode)

Modify `drawBoundingBoxes` to optionally add unique IDs or data attributes to the bounding box `div` elements.

```javascript
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
```

Add click listeners to the `debugOverlaysContainer`. When clicked, determine if the click hit a bounding box `div`.

```javascript
document.getElementById('debug-overlays-container').addEventListener('click', (event) => {
    if (event.target.dataset.blobIndex) {
        const blobIndex = event.target.dataset.blobIndex;
        const blob = blobs[blobIndex];
        // ...
    }
});
```

### 2.3 Boundary Adjustment (Edit Bounds mode)

When one box is selected, display resize handles (e.g., small divs) at its corners/edges within the `debugOverlaysContainer`.

```javascript
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
```

Implement drag-and-drop for handles: on mousedown on a handle, track mousemove, calculate the new dimensions/position, update the visual box `div` styles in real-time. On mouseup, update the `bounds` property of the corresponding blob object in the `detectedBlobs` array.

```javascript
let isDragging = false;
let dragStartX, dragStartY;

document.getElementById('resize-handles-container').addEventListener('mousedown', (event) => {
    if (event.target.style.background === 'red') {
        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
    }
});

document.addEventListener('mousemove', (event) => {
    if (isDragging) {
        const newX = event.clientX;
        const newY = event.clientY;
        const delta_x = newX - dragStartX;
        const delta_y = newY - dragStartY;

        // Update the blob bounds
        const blob = blobs[0];
        blob.bounds.x += delta_x;
        blob.bounds.y += delta_y;
        blob.bounds.width += delta_x;
        blob.bounds.height += delta_y;

        // Update the visual box div styles
        const boundingBox = document.querySelector('[data-blob-index="0"]');
        boundingBox.style.left = `${blob.bounds.x}px`;
        boundingBox.style.top = `${blob.bounds.y}px`;
        boundingBox.style.width = `${blob.bounds.width}px`;
        boundingBox.style.height = `${blob.bounds.height}px`;
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});
```

## Step 3: Palette Reduction (Per-Sprite)

The goal of this step is to optimize the final spritesheet size by reducing the color count within each individual sprite before adding it to the sheet.

### 3.1 Research & Implement Quantizer

Research color quantization algorithms (e.g., Median Cut, K-Means on colors, NeuQuant). Implement one (e.g., Median Cut for simplicity or find a JS library) in `color-quantizer.js`.

```javascript
function quantizeImageData(imageData, numColors) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // ...
}
```

### 3.2 UI Integration

Add a setting (e.g., number input or checkbox "Enable Palette Reduction" + number input for `k` colors) in the Spritesheet section.

```html
<div class="setting">
    <label for="enable-palette-reduction-checkbox">Enable Palette Reduction:</label>
    <input type="checkbox" id="enable-palette-reduction-checkbox">
    <label for="num-colors-input">Number of Colors:</label>
    <input type="number" id="num-colors-input" min="1" value="16">
</div>
```

### 3.3 Modify generateSpritesheet

Inside the loop that iterates through `blobs`:

*   Before `ctx.drawImage`, check if palette reduction is enabled via a parameter passed from `ui-controller.js`.
*   If enabled:
    *   Extract the `ImageData` for the *current* sprite from the `sourceCanvas` using `sourceCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight)`.
    *   Call `quantizeImageData(extractedSpriteData, k)` to get the color-reduced version.
    *   Create a *temporary canvas* for the quantized sprite, use `putImageData` to put the quantized data onto it.
    *   Draw this *temporary canvas* onto the main `targetCanvas` at the correct `spriteDestX`, `spriteDestY`.

```javascript
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
```

## Step 4: Web Worker Optimization

The goal of this step is to move heavy computations (CCL, potentially complex image processing) off the main thread to prevent UI freezing.

### 4.1 Create Worker Script

Create `processing.worker.js`.

```javascript
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
```

### 4.2 Modify handleProcessImage

Instead of calling local processing functions directly:

*   Create `const worker = new Worker('./processing.worker.js');`.
*   Set up `worker.onmessage = (event) => { ... }` to receive results. Handle `event.data.status === 'complete'`, update state (`detectedBlobs`, `cclResult.labels`), update UI (status, overlays), re-enable controls.
*   Prepare the data to send: `const dataToSend = { task: 'processAll', imageData: originalImageData, thresholdSettings: currentThresholdSettings, minSize: minSize };`
*   Send the data and transfer the buffer: `worker.postMessage(dataToSend, [originalImageData.data.buffer]);`

```javascript
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