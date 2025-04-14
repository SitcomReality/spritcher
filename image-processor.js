/**
 * Converts ImageData to grayscale.
 * Modifies the ImageData in place.
 * Uses the luminosity method: gray = 0.299*R + 0.587*G + 0.114*B
 * Preserves alpha channel. Transparent pixels remain transparent (and typically black).
 * @param {ImageData} imageData - The ImageData object to convert.
 */
export function convertToGrayscale(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // Skip fully transparent pixels - treating them as background
        if (data[i + 3] === 0) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Standard luminosity calculation
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        data[i] = gray;     // Red
        data[i + 1] = gray; // Green
        data[i + 2] = gray; // Blue
        // Alpha (data[i + 3]) remains unchanged
    }
}

/**
 * Applies binary thresholding to ImageData.
 * Assumes input is grayscale (R=G=B).
 * Modifies the ImageData in place. Transparent pixels remain transparent.
 * Pixels *below* the threshold become black (0), others white (255).
 * @param {ImageData} imageData - The grayscale ImageData object.
 * @param {number} threshold - The threshold value (0-255).
 */
export function applyThreshold(imageData, threshold) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // Skip fully transparent pixels
        if (data[i + 3] === 0) continue;

        const gray = data[i]; // Assuming R=G=B from grayscale conversion
        // Pixels strictly *less than* threshold are background (black)
        // Pixels *equal to or greater than* threshold are foreground (white)
        const value = gray < threshold ? 0 : 255;
        data[i] = value;     // Red
        data[i + 1] = value; // Green
        data[i + 2] = value; // Blue
        // Alpha remains unchanged (so white areas are still opaque, black areas are opaque)
    }
}

/**
 * Creates a new ImageData object representing the grayscale version of the input.
 * Does not modify the original ImageData.
 * @param {ImageData} originalImageData - The original ImageData.
 * @returns {ImageData} A new ImageData object with grayscale data.
 */
export function getGrayscaleImageData(originalImageData) {
    // Create a copy to avoid modifying the original
    const grayscaleImageData = new ImageData(
        new Uint8ClampedArray(originalImageData.data), // Copy data buffer
        originalImageData.width,
        originalImageData.height
    );
    convertToGrayscale(grayscaleImageData); // Modify the copy
    return grayscaleImageData;
}

/**
 * Creates a new ImageData object representing the thresholded version of a grayscale image,
 * ensuring originally transparent pixels remain transparent black (background).
 * Does not modify the input grayscale ImageData or original ImageData.
 * @param {ImageData} grayscaleImageData - The grayscale ImageData.
 * @param {ImageData} originalImageData - The original ImageData (used for alpha mask).
 * @param {number} threshold - The threshold value (0-255).
 * @returns {ImageData} A new ImageData object with thresholded data (black/white), respecting original transparency.
 */
export function getThresholdedImageData(grayscaleImageData, originalImageData, threshold) {
    // Create a copy to avoid modifying the input grayscale data
    const thresholdedImageData = new ImageData(
        new Uint8ClampedArray(grayscaleImageData.data), // Copy data buffer
        grayscaleImageData.width,
        grayscaleImageData.height
    );
    // Apply threshold *to the copy*.
    applyThreshold(thresholdedImageData, threshold);

    // Apply original image's transparency as a mask
    const data = thresholdedImageData.data;
    const originalData = originalImageData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (originalData[i + 3] === 0) { // If original pixel was fully transparent
            data[i] = 0;     // R = black
            data[i + 1] = 0; // G = black
            data[i + 2] = 0; // B = black
            data[i + 3] = 0; // Alpha = transparent
        }
    }

    return thresholdedImageData;
}

/**
 * Applies adaptive thresholding (Mean method) to grayscale ImageData.
 * Modifies the ImageData in place. Transparent pixels in the input remain transparent.
 * For each pixel, calculates the mean gray value of its neighborhood,
 * and thresholds based on (mean - C).
 * Pixels that were originally transparent are NOT included in mean calculations.
 * @param {ImageData} grayscaleImageData - The grayscale ImageData object (will be modified).
 * @param {number} blockSize - Size of the pixel neighborhood (must be an odd integer >= 3).
 * @param {number} C - Constant subtracted from the calculated mean.
 */
export function applyAdaptiveThreshold(grayscaleImageData, blockSize, C) {
    if (blockSize % 2 === 0 || blockSize < 3) {
        throw new Error("Block size must be an odd integer >= 3.");
    }

    const width = grayscaleImageData.width;
    const height = grayscaleImageData.height;
    const data = grayscaleImageData.data;
    const halfBlock = Math.floor(blockSize / 2);

    // Create a copy of the original grayscale data to read from,
    // because we'll be modifying the input 'data' array in place.
    const sourceData = new Uint8ClampedArray(data);

    // Helper to get grayscale value (from source) handling boundaries (mirroring)
    function getGrayValue(x, y) {
        // Clamp coordinates to be within bounds (simple mirroring)
        const clampedX = Math.max(0, Math.min(width - 1, x));
        const clampedY = Math.max(0, Math.min(height - 1, y));
        const index = (clampedY * width + clampedX) * 4;
        // Return gray value, or 0 if transparent (treat transparent as background)
        return sourceData[index + 3] > 0 ? sourceData[index] : 0;
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const centerIndex = (y * width + x) * 4;

            // Skip fully transparent pixels in the original image
            if (sourceData[centerIndex + 3] === 0) {
                 // Ensure output is also fully transparent black for these pixels
                 data[centerIndex] = 0;
                 data[centerIndex + 1] = 0;
                 data[centerIndex + 2] = 0;
                 data[centerIndex + 3] = 0;
                continue;
            }

            let sum = 0;
            let count = 0; // Use count in case neighborhood goes out of bounds

            // Calculate mean of the blockSize x blockSize neighborhood
            for (let j = -halfBlock; j <= halfBlock; j++) {
                for (let i = -halfBlock; i <= halfBlock; i++) {
                    sum += getGrayValue(x + i, y + j);
                    count++; // Always square block, boundaries handled by getGrayValue
                }
            }

            const mean = sum / count;
            const localThreshold = mean - C;
            const centerGray = sourceData[centerIndex]; // Gray value of the current pixel

            // Apply threshold: > localThreshold = foreground (white), <= = background (black)
            const value = centerGray > localThreshold ? 255 : 0;

            data[centerIndex] = value;     // R
            data[centerIndex + 1] = value; // G
            data[centerIndex + 2] = value; // B
            // Alpha remains unchanged (should be 255 unless original was transparent)
            data[centerIndex + 3] = sourceData[centerIndex + 3];
        }
    }
    console.log(`Applied adaptive threshold: blockSize=${blockSize}, C=${C}`);
}

/**
 * Creates a new ImageData object representing the adaptive thresholded version of a grayscale image,
 * ensuring originally transparent pixels remain transparent black (background).
 * Does not modify the input grayscale ImageData or original ImageData. Uses the Mean method.
 * @param {ImageData} grayscaleImageData - The grayscale ImageData.
 * @param {ImageData} originalImageData - The original ImageData (used for alpha mask).
 * @param {number} blockSize - Size of the pixel neighborhood (odd integer >= 3).
 * @param {number} C - Constant subtracted from the mean.
 * @returns {ImageData} A new ImageData object with adaptive thresholded data (black/white), respecting original transparency.
 */
export function getAdaptiveThresholdedImageData(grayscaleImageData, originalImageData, blockSize, C) {
    // Create a copy to avoid modifying the input grayscale data
    const thresholdedImageData = new ImageData(
        new Uint8ClampedArray(grayscaleImageData.data),
        grayscaleImageData.width,
        grayscaleImageData.height
    );
    // Apply adaptive threshold *to the copy*.
    applyAdaptiveThreshold(thresholdedImageData, blockSize, C);

    // Apply original image's transparency as a mask
    const data = thresholdedImageData.data;
    const originalData = originalImageData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (originalData[i + 3] === 0) { // If original pixel was fully transparent
            data[i] = 0;     // R = black
            data[i + 1] = 0; // G = black
            data[i + 2] = 0; // B = black
            data[i + 3] = 0; // Alpha = transparent
        }
    }

    return thresholdedImageData;
}