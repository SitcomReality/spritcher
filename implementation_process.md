# Spritcher: Future Feature Implementation Guide

This document outlines the steps for implementing planned future features for Spritcher, building upon the initial prototype.

## 1. Advanced Image Processing Algorithms

### 1.1. Adaptive Thresholding

*   **Goal:** Improve thresholding robustness on images with varying background colors or lighting.
*   **Module:** `image-processor.js`
*   **Steps:**
    1.  Research common adaptive thresholding algorithms (e.g., mean/Gaussian adaptive thresholding, Otsu's method). Choose one suitable for sprite detection (Otsu's is often good for bi-modal histograms but might struggle with complex backgrounds; mean/Gaussian considers local neighborhoods).
    2.  Implement the chosen algorithm as a new function (e.g., `applyAdaptiveThreshold(imageData, method, blockSize, C)`).
        *   It will likely operate on the grayscale `imageData`.
        *   `blockSize` defines the local neighborhood size.
        *   `C` is a constant subtracted from the mean/weighted sum.
    3.  Create a corresponding `getAdaptiveThresholdedImageData` function similar to `getThresholdedImageData`.
    4.  **UI Integration (`ui-controller.js`, `index.html`):**
        *   Add UI controls (e.g., a dropdown to select threshold type: "Manual", "Adaptive Mean", "Adaptive Gaussian", "Otsu").
        *   Add sliders/inputs for adaptive threshold parameters (`blockSize`, `C`) that are shown/hidden based on the selected type.
        *   Modify `handleProcessImage` to call the appropriate thresholding function based on UI selection.
        *   Update `handleThresholdChange` (or rename) to handle changes in adaptive parameters and invalidate results.
    5.  **Testing:** Test with images where manual thresholding performs poorly (e.g., gradient backgrounds, shadows). Use debug overlays to compare results.

### 1.2. Edge Detection Filters (Optional)

*   **Goal:** Potentially use edge information to refine sprite boundaries or as an alternative detection method.
*   **Module:** `image-processor.js`
*   **Steps:**
    1.  Implement Sobel or Canny edge detection algorithms. These involve calculating image gradients and applying thresholding/non-maximum suppression.
    2.  Create functions `applySobel(imageData)` / `applyCanny(imageData, lowThreshold, highThreshold)` returning new `ImageData` objects representing edges.
    3.  **UI Integration:** Add checkboxes or options to visualize edge maps in the debug overlays.
    4.  **Integration with CCL:** Decide *how* edge detection aids sprite detection.
        *   Option A: Use edges as a *mask* before CCL (only consider pixels near edges).
        *   Option B: Use edge detection *instead* of thresholding (apply CCL to the edge map - might be noisy).
        *   Option C: Use edges to *refine* bounding boxes found by threshold-based CCL.
    5.  Modify `handleProcessImage` and potentially `findBlobs` based on the chosen integration strategy.

## 2. Sprite Editing Tools

*   **Goal:** Allow users to manually correct detection errors (split/merge blobs, adjust boundaries).
*   **Module:** Primarily `ui-controller.js`, potentially new `sprite-editor.js`. Requires significant interaction logic.
*   **Steps:**
    1.  **Selection:** Implement clicking on a detected sprite (or its bounding box overlay) to select it. Highlight the selected sprite.
    2.  **Boundary Adjustment:**
        *   When a sprite is selected, show handles on its bounding box.
        *   Implement dragging handles to resize the box. This requires updating the corresponding `blob.bounds` in the `detectedBlobs` array.
        *   Crucially, decide how resizing affects the *pixels* included in the sprite for spritesheet generation (e.g., just use the new bounds, or attempt to re-run CCL within the new bounds?). Simplest is to just use the adjusted bounds for generation.
    3.  **Splitting:**
        *   Provide a "Split" tool/mode.
        *   Allow the user to draw a line across a selected sprite's bounding box.
        *   Logic: Find pixels belonging to the original blob that fall on either side of the line. Create two *new* blob objects, update their `bounds` and potentially re-calculate pixel counts. Remove the original blob from `detectedBlobs`. This is complex.
    4.  **Merging:**
        *   Allow selecting multiple sprites (e.g., shift-click).
        *   Provide a "Merge" button.
        *   Logic: Create a *new* blob object whose bounds encompass all selected blobs. Decide how to handle pixel data (e.g., combine pixel lists if stored, otherwise just use the encompassing bounds). Remove original blobs from `detectedBlobs`.
    5.  **Adding:**
        *   Provide an "Add Sprite" tool/mode.
        *   Allow the user to draw a new bounding box directly on the image preview.
        *   Logic: Create a new `blob` object with the drawn bounds.
    6.  **Deleting:**
        *   Allow selecting a sprite.
        *   Provide a "Delete" button or key press (e.g., Delete key).
        *   Logic: Remove the selected blob from the `detectedBlobs` array.
    7.  **State Management:** Ensure all edits correctly update the `detectedBlobs` array. Any edit should invalidate the current spritesheet preview/download readiness. Re-enable preview/download after edits are applied.
    8.  **UI:** Add buttons/tool selection for Edit, Add, Split, Merge, Delete modes. Update cursor appearance based on the active tool.

## 3. Palette Reduction (Per-Sprite)

*   **Goal:** Optimize spritesheet size by reducing the number of colors used *within each individual sprite*.
*   **Module:** `spritesheet-generator.js`, potentially a new `color-quantizer.js`.
*   **Steps:**
    1.  Research color quantization algorithms (e.g., Median Cut, K-Means clustering on colors, NeuQuant).
    2.  Implement the chosen algorithm in `color-quantizer.js`. It should take `ImageData` (for a single sprite) and a target number of colors (`k`) as input, and return a new `ImageData` with reduced colors and potentially a palette map.
    3.  **Modify `generateSpritesheet`:**
        *   Before drawing each sprite onto the target canvas, extract the `ImageData` for that individual sprite from the `originalImageData` using its `bounds`.
        *   Pass this sprite `ImageData` to the quantization function.
        *   Draw the *quantized* `ImageData` onto the spritesheet canvas instead of drawing directly from the source canvas/image.
    4.  **UI Integration:** Add a setting (e.g., input field or slider) for the target number of colors (`k`) per sprite. Pass this value to `generateSpritesheet`.
    5.  **Performance:** Quantization can be slow. Consider warnings or potentially using Web Workers if it significantly impacts generation time.

## 4. Web Worker Optimization

*   **Goal:** Move heavy computations (image processing, CCL) off the main thread to prevent UI freezing.
*   **Modules:** Affects `ui-controller.js`, `image-processor.js`, `blob-detector.js`. Requires new worker script files (e.g., `processing.worker.js`).
*   **Steps:**
    1.  Create `processing.worker.js`.
    2.  Move the core logic of `convertToGrayscale`, `applyThreshold`, `findBlobs` (and potentially adaptive thresholding/edge detection later) into functions within the worker script.
    3.  The worker needs to listen for messages (`onmessage`) containing the necessary data (e.g., `ImageData`, threshold value, min size).
    4.  The worker performs the calculations and sends the results (e.g., processed `ImageData`, `detectedBlobs` array, `cclLabels`) back to the main thread using `postMessage()`. Note: `ImageData` can be transferred efficiently if supported by the browser, otherwise it might be copied.
    5.  **Modify `ui-controller.js`:**
        *   In `handleProcessImage`, instead of calling the processing functions directly:
            *   Create a new `Worker('processing.worker.js')`.
            *   Set up an `onmessage` listener on the worker to receive results.
            *   Use `worker.postMessage({...})` to send the task and data to the worker. Transfer `ImageData.data.buffer` if possible for performance: `worker.postMessage({ task: 'process', imageDataBuffer: originalImageData.data.buffer, width: ..., height: ..., threshold: ... }, [originalImageData.data.buffer]);`
            *   Update the UI (`processingStatusDiv`) when the worker starts and when results are received.
            *   Handle worker errors (`onerror`).
            *   Remember to terminate the worker (`worker.terminate()`) when it's no longer needed or when a new process starts.
    6.  **Data Handling:** Carefully manage how data (especially large `ImageData` buffers) is passed between the main thread and the worker. Transferable Objects are key for performance. If modifying `ImageData` within the worker, ensure the main thread receives the updated buffer.

## 5. Server-Side Integration (Optional)

*   **Goal:** Offload demanding tasks or store user data/results.
*   **Architecture:** Requires a backend (Node.js, Python/Flask, etc.) and API design.
*   **Steps:**
    1.  **Backend Setup:** Choose a backend language/framework. Set up a basic server.
    2.  **API Design:** Define API endpoints:
        *   `POST /process`: Accepts image data (e.g., multipart/form-data or base64), settings (threshold, minSize). Returns detected blobs or spritesheet URL.
        *   `GET /spritesheet/{id}`: Retrieves a previously generated spritesheet.
        *   (Optional) User accounts, storage endpoints.
    3.  **Backend Implementation:** Implement the image processing logic on the server using libraries like OpenCV (Python), Sharp (Node.js), etc. Implement data storage if needed.
    4.  **Frontend Modification (`ui-controller.js`):**
        *   Replace client-side processing calls with `fetch` requests to the backend API.
        *   Handle sending image data and settings.
        *   Handle receiving processing results (blob data or image URLs).
        *   Update UI based on API responses.
    5.  **Considerations:** Adds complexity (deployment, maintenance, cost), but enables more powerful processing and data persistence. Loses the "pure client-side" benefit.

## General Refinement

*   **Code Quality:** Refactor code for clarity, efficiency, and maintainability as new features are added. Add comments where necessary.
*   **Error Handling:** Improve robustness by adding more specific error handling and user feedback for edge cases (invalid inputs, processing failures).
*   **Performance Profiling:** Use browser developer tools to profile performance bottlenecks (especially in CCL and drawing loops) and optimize accordingly.
*   **Accessibility (A11y):** Continuously review and improve accessibility (keyboard navigation, ARIA attributes, color contrast).
````````` index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spritcher</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Spritcher</h1>

        <section id="upload-section">
            <h2>1. Upload Image</h2>
            <input type="file" id="image-upload" accept="image/*">
            <div id="image-preview-container">
                <canvas id="image-preview-canvas"></canvas>
                <div id="debug-overlays"></div> 
            </div>
             <div class="zoom-controls">
                <button id="zoom-in-button">+</button>
                <button id="zoom-out-button">-</button>
            </div>
        </section>

        <section id="settings-section">
            <h2>2. Settings</h2>
            <div class="setting">
                <label for="threshold-slider">Threshold:</label>
                <input type="range" id="threshold-slider" min="0" max="255" value="128">
                <span id="threshold-value">128</span>
            </div>
             <div class="setting">
                <label for="min-sprite-size-slider">Min Sprite Size (pixels):</label>
                <input type="range" id="min-sprite-size-slider" min="1" max="500" value="10">
                <span id="min-sprite-size-value">10</span>
            </div>
            <fieldset>
                <legend>Debug Overlays / Views</legend>
                 <label><input type="checkbox" id="show-grayscale-checkbox" name="debug-view"> Show Grayscale</label>
                 <label><input type="checkbox" id="show-threshold-checkbox" name="debug-view"> Show Thresholded</label>
                 <label><input type="checkbox" id="show-ccl-checkbox" name="debug-view"> Show CCL IDs</label>
                 <label><input type="checkbox" id="show-bboxes-checkbox" name="debug-overlay"> Show Detected BBoxes</label>
            </fieldset>
        </section>

        <section id="processing-section">
            <h2>3. Process Image</h2>
            <button id="process-button">Detect Sprites</button>
            <div id="processing-status">Upload an image to start.</div>
        </section>

        <section id="spritesheet-section">
            <h2>4. Spritesheet Preview & Generation</h2>
             <div class="setting">
                <label for="grid-cols-input">Columns:</label>
                <input type="number" id="grid-cols-input" min="1" value="8">
            </div>
             <div class="setting">
                <label for="padding-input">Padding (px):</label>
                <input type="number" id="padding-input" min="0" value="2">
            </div>
             <div class="setting">
                 <label for="alignment-select">Alignment:</label>
                 <select id="alignment-select">
                     <option value="top-left">Top Left</option>
                     <option value="center">Center</option>
                 </select>
             </div>
            <button id="preview-spritesheet-button">Generate Spritesheet</button>
            <div id="spritesheet-preview-container">
                 <canvas id="spritesheet-preview-canvas"></canvas>
            </div>
            <button id="download-spritesheet-button" disabled>Download Spritesheet</button>
        </section>

    </div>

    <script type="importmap">
    {
        "imports": {
            "image-loader": "./image-loader.js",
            "image-processor": "./image-processor.js",
            "blob-detector": "./blob-detector.js",
            "spritesheet-generator": "./spritesheet-generator.js",
            "ui-controller": "./ui-controller.js",
            "utils": "./utils.js"
        }
    }
    </script>
    <script type="module" src="main.js"></script>
</body>
</html>

# Spritcher: Future Feature Implementation Guide

This document outlines the steps for implementing planned future features for Spritcher, building upon the initial prototype.

## 1. Advanced Image Processing Algorithms

### 1.1. Adaptive Thresholding

*   **Goal:** Improve thresholding robustness on images with varying background colors or lighting.
*   **Module:** `image-processor.js`
*   **Steps:**
    1.  **Research & Choose:** Research common adaptive thresholding algorithms (e.g., Mean (Box Filter), Gaussian Weighted Mean, Otsu's Method applied locally). Consider trade-offs: Mean is fast, Gaussian is smoother, Otsu adapts locally but can be slower. Start with Mean or Gaussian.
    2.  **Implement Algorithm:** Create a new function `applyAdaptiveThreshold(imageData, method, blockSize, C)` in `image-processor.js`.
        *   Input: Grayscale `ImageData`.
        *   `method`: 'mean' or 'gaussian'.
        *   `blockSize`: Size of the neighborhood (odd number, e.g., 11).
        *   `C`: Constant subtracted from the calculated local threshold.
        *   Logic: Iterate through pixels. For each pixel, calculate the mean (or weighted Gaussian average) of its `blockSize x blockSize` neighborhood in the grayscale image. The local threshold is `mean - C` (or `gaussian_avg - C`). Apply binary threshold based on this local value. Handle borders carefully (padding or skipping). Modify the *input* `imageData` in place.
    3.  **Create Getter:** Implement `getAdaptiveThresholdedImageData(grayscaleImageData, method, blockSize, C)` which copies the input `grayscaleImageData` and then calls `applyAdaptiveThreshold` on the copy, returning the new thresholded `ImageData`.
    4.  **UI Integration (`ui-controller.js`, `index.html`):**
        *   Add a `<select>` element in the Settings section to choose threshold type ("Manual", "Adaptive Mean", "Adaptive Gaussian").
        *   Add number inputs for `blockSize` and `C`, initially hidden. Use JS to show/hide them based on the selected threshold type.
        *   Modify `handleProcessImage`: Check the selected threshold type. If 'Manual', call `getThresholdedImageData` as before. If 'Adaptive', get `blockSize` and `C` from the UI and call `getAdaptiveThresholdedImageData`.
        *   Modify `handleThresholdChange` (and potentially add handlers for `blockSize`/`C` inputs) to invalidate `thresholdedImageData`, `cclResult`, etc., when relevant parameters change. Ensure the "Show Thresholded" debug view updates correctly if active.
    5.  **Testing:** Test with images where manual thresholding fails (gradients, shadows, complex backgrounds). Use the "Show Thresholded" debug view to compare results visually. Tune `blockSize` and `C`.

### 1.2. Edge Detection Filters (Optional Enhancement)

*   **Goal:** Use edge information potentially to refine sprite boundaries or as an alternative visualization. Less likely to replace threshold/CCL entirely for sprite *extraction*.
*   **Module:** `image-processor.js`
*   **Steps:**
    1.  **Implement Filter:** Implement a Sobel edge detection filter (`applySobel(imageData)`).
        *   Input: Grayscale `ImageData`.
        *   Logic: Calculate horizontal (Gx) and vertical (Gy) gradients using Sobel kernels. Compute gradient magnitude `sqrt(Gx^2 + Gy^2)`. Normalize magnitudes to 0-255. Create and return a *new* `ImageData` object representing the edge magnitude map.
    2.  **UI Integration (`ui-controller.js`, `index.html`):** Add a new "Show Edges (Sobel)" checkbox to the Debug Views.
    3.  **Modify `updateDebugView` (`ui-controller.js`):** If the "Show Edges" checkbox is ticked, call `applySobel` (on the grayscale data) and display the resulting edge map on the main canvas. Ensure it handles cases where grayscale data hasn't been generated yet.
    4.  **(Advanced) Integration with CCL:** Consider how edges might *aid* detection (not replace):
        *   *Post-processing:* After finding blobs with threshold/CCL, check if blob boundaries align well with strong edges from the Sobel map. Potentially adjust/refine blob `bounds` based on nearby edges. This is complex.
        *   *Masking:* Use the edge map (perhaps thresholded) as a mask – only perform CCL on pixels that are both above the primary threshold *and* near an edge. This might help separate touching sprites if the edge between them is detected. Requires modifying `findBlobs`.

## 2. Sprite Editing Tools

*   **Goal:** Allow manual correction of detection results (split/merge blobs, add/delete, adjust boundaries). This is a significant UI/interaction task.
*   **Module:** Primarily `ui-controller.js`, potentially new `sprite-editor.js`. Needs careful state management of `detectedBlobs`.
*   **Steps:**
    1.  **Mode Selection:** Add UI buttons/toolbar to switch between modes: "Select", "Edit Bounds", "Add Box", "Split", "Merge". Update cursor style based on mode.
    2.  **Selection (`Select` mode):**
        *   Modify `drawBoundingBoxes` in `utils.js` to optionally add unique IDs or data attributes to the bounding box `div` elements.
        *   Add click listeners to the `debugOverlaysContainer`. When clicked, determine if the click hit a bounding box `div`.
        *   Visually highlight the selected box(es) (e.g., change border color/thickness). Store the selected blob object(s) in `ui-controller.js` state. Allow multi-select (e.g., Shift+click).
    3.  **Boundary Adjustment (`Edit Bounds` mode):**
        *   When one box is selected, display resize handles (e.g., small divs) at its corners/edges within the `debugOverlaysContainer`.
        *   Implement drag-and-drop for handles: on mousedown on a handle, track mousemove, calculate the new dimensions/position, update the visual box `div` styles in real-time. On mouseup, update the `bounds` property of the corresponding blob object in the `detectedBlobs` array.
        *   **Crucial:** Editing bounds invalidates the generated spritesheet. Update UI state accordingly.
    4.  **Adding (`Add Box` mode):**
        *   On mousedown in the `imagePreviewContainer`, start drawing a rectangle. Track mousemove to resize. On mouseup, create a *new* blob object with the calculated `bounds` (minX, minY, width, height). Assign a temporary unique ID. Add this new blob to the `detectedBlobs` array. Redraw overlays to show the new box. Invalidate spritesheet.
    5.  **Deleting (`Select` mode + Action):** Add a "Delete Selected" button or use the Delete key. Remove the selected blob(s) from the `detectedBlobs` array. Update overlays. Invalidate spritesheet.
    6.  **Merging (`Select` mode + Action):** Select multiple boxes. Add a "Merge Selected" button. Calculate the encompassing bounding box of all selected blobs. Create a *new* blob object with these combined bounds. Remove the original selected blobs from `detectedBlobs` and add the new merged blob. Update overlays. Invalidate spritesheet.
    7.  **Splitting (Complex - Optional):** (`Select` mode + Action) Select one box. Add a "Split Tool" button/mode. Allow user to draw a line across the selected box. Logic: Find original blob pixels. Determine which pixels fall on which side of the line. Create two *new* blob objects, calculate their new bounds based on the split pixels. Remove original blob, add new ones. This requires pixel-level access and geometric calculations, potentially re-running CCL within the original bounds. Might be deferred.
    8.  **State Management:** Ensure all operations correctly modify the `detectedBlobs` array and trigger necessary UI updates (overlay redraw, enable/disable buttons, invalidate spritesheet). Consider adding undo/redo functionality later.

## 3. Palette Reduction (Per-Sprite)

*   **Goal:** Optimize final spritesheet size by reducing color count within each individual sprite before adding it to the sheet.
*   **Module:** `spritesheet-generator.js`, new `color-quantizer.js`.
*   **Steps:**
    1.  **Research & Implement Quantizer:** Research color quantization algorithms (e.g., Median Cut, K-Means on colors, NeuQuant). Implement one (e.g., Median Cut for simplicity or find a JS library) in `color-quantizer.js`.
        *   Function signature: `quantizeImageData(spriteImageData, numColors)`
        *   Input: `ImageData` of a single sprite, target number of colors (`k`).
        *   Output: A *new* `ImageData` object with colors mapped to the reduced palette.
    2.  **UI Integration (`index.html`, `ui-controller.js`):** Add a setting (e.g., number input or checkbox "Enable Palette Reduction" + number input for `k` colors) in the Spritesheet section.
    3.  **Modify `generateSpritesheet` (`spritesheet-generator.js`):**
        *   Inside the loop that iterates through `blobs`:
        *   Before `ctx.drawImage`, check if palette reduction is enabled via a parameter passed from `ui-controller.js`.
        *   If enabled:
            *   Extract the `ImageData` for the *current* sprite from the `sourceCanvas` using `sourceCtx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight)`.
            *   Call `quantizeImageData(extractedSpriteData, k)` to get the color-reduced version.
            *   Create a *temporary canvas* for the quantized sprite, use `putImageData` to put the quantized data onto it.
            *   Draw this *temporary canvas* onto the main `targetCanvas` at the correct `spriteDestX`, `spriteDestY`.
        *   If not enabled, proceed with the original `ctx.drawImage` from `sourceCanvas`.
    4.  **Performance Consideration:** Quantization can be slow. Update `processingStatusDiv` to indicate progress. If very slow, consider disabling the UI during this step or exploring Web Workers later.

## 4. Web Worker Optimization

*   **Goal:** Move heavy computations (CCL, potentially complex image processing) off the main thread to prevent UI freezing.
*   **Modules:** Affects `ui-controller.js`, `image-processor.js`, `blob-detector.js`. Requires new worker script (`processing.worker.js`).
*   **Steps:**
    1.  **Create Worker Script (`processing.worker.js`):**
        *   Import necessary functions (or copy their logic) for grayscale, thresholding, CCL (`convertToGrayscale`, `applyThreshold`, `findBlobs`, etc.) into this file.
        *   Set up the worker's `onmessage` handler. It should expect an object like `{ task: 'processAll', imageData: ImageData, threshold: number, minSize: number }`.
    2.  **Worker Logic:**
        *   Inside `onmessage`, perform the sequence: grayscale -> threshold -> CCL based on the received data.
        *   Crucially, `ImageData` objects themselves are not directly transferable in all browsers without losing the underlying buffer. Transfer the `imageData.data.buffer` (an `ArrayBuffer`). Reconstruct `ImageData` inside the worker if needed, or work directly on the buffer.
        *   Once processing is complete, send the results back using `postMessage({ status: 'complete', blobs: detectedBlobs, labels: cclLabelsBuffer, /* other data */ })`. Transfer the `labels` buffer back if it's large. `blobs` array (containing bounds etc.) is usually small enough to copy.
    3.  **Modify `ui-controller.js` - `handleProcessImage`:**
        *   Instead of calling local processing functions directly:
            *   Create `const worker = new Worker('./processing.worker.js');`.
            *   Set up `worker.onmessage = (event) => { ... }` to receive results. Handle `event.data.status === 'complete'`, update state (`detectedBlobs`, `cclResult.labels`), update UI (status, overlays), re-enable controls. Remember to reconstruct `ImageData` from buffers if necessary.
            *   Set up `worker.onerror = (error) => { ... }` to handle errors in the worker.
            *   Prepare the data to send: `const dataToSend = { task: 'processAll', imageDataBuffer: originalImageData.data.buffer, width: originalImageData.width, height: originalImageData.height, threshold: threshold, minSize: minSize };`
            *   Send the data and transfer the buffer: `worker.postMessage(dataToSend, [originalImageData.data.buffer]);` (Note: `originalImageData` on the main thread becomes unusable after transfer). You might need to work with a *copy* of the `ImageData` buffer if you need to keep the original accessible on the main thread.
            *   Update `processingStatusDiv` to indicate work is happening off-thread.
            *   Ensure the worker is terminated (`worker.terminate()`) when done or if a new process starts/image is loaded, to free up resources.
    4.  **Data Handling:** Pay close attention to `ArrayBuffer` transfers. If you need the original `ImageData` on the main thread *while* the worker runs (e.g., for display), you must `slice()` the buffer to send a copy instead of transferring ownership.

## 5. Server-Side Integration (Optional - Major Shift)

*   **Goal:** Offload processing entirely, potentially store results, handle very large images. Changes the nature of the application.
*   **Architecture:** Requires a backend server (Node.js, Python/Flask, etc.) and an API.
*   **Steps:**
    1.  **Backend Setup:** Choose technology stack. Set up a basic web server. Install image processing libraries (e.g., Sharp for Node.js, Pillow/OpenCV for Python).
    2.  **API Design:** Define RESTful endpoints:
        *   `POST /api/process`: Accepts image file upload (e.g., `multipart/form-data`), processing parameters (threshold, minSize). Performs processing. Returns JSON with blob data (`{ blobs: [...] }`). Could also return IDs for fetching results later.
        *   `POST /api/generate_spritesheet`: Accepts image file OR previously processed blob data ID, layout parameters (cols, padding, align). Returns the generated spritesheet image file directly or a URL to it.
    3.  **Backend Implementation:** Implement the API endpoints. Replicate the image processing logic (grayscale, threshold, CCL) using server-side libraries. Handle file storage/retrieval if needed.
    4.  **Frontend Modification (`ui-controller.js`):**
        *   Replace calls to local processing functions (`getGrayscaleImageData`, `findBlobs`, `generateSpritesheet`) with `fetch` calls to the backend API endpoints.
        *   In `handleImageUpload`, maybe just store the file reference or display preview, actual upload happens on "Process".
        *   In `handleProcessImage`: Create a `FormData` object, append the image file and parameters. Send using `fetch('/api/process', { method: 'POST', body: formData })`. Handle the JSON response containing blob data.
        *   In `handleGenerateSpritesheet`: Send blob data (or ID) and layout parameters to `/api/generate_spritesheet`. Handle the response, which might be the image file itself (display using `URL.createObjectURL(response.blob())`) or a JSON with a URL.
    5.  **Considerations:** Adds significant complexity (deployment, server maintenance, CORS, security, scaling). Loses the client-only advantage but gains power and potentially better performance for heavy tasks.

## General Refinement Priorities

*   **Robust Error Handling:** Add more `try...catch` blocks, validate inputs, provide clearer user feedback on errors.
*   **Performance Profiling:** Use browser dev tools to identify bottlenecks (especially CCL, drawing loops, frequent DOM manipulation) as complexity grows. Optimize critical paths.
*   **Code Clarity:** Refactor large functions, add comments, ensure consistent naming conventions.
*   **Accessibility (A11y):** Regularly review keyboard navigation, focus management, ARIA attributes (especially for custom controls/modes), color contrast.

