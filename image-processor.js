/**
 * Converts ImageData to grayscale.
 * Modifies the ImageData in place.
 * Uses the luminosity method: gray = 0.299*R + 0.587*G + 0.114*B
 * Preserves alpha channel.
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
 * Creates a new ImageData object representing the thresholded version of a grayscale image.
 * Does not modify the input grayscale ImageData.
 * @param {ImageData} grayscaleImageData - The grayscale ImageData.
 * @param {number} threshold - The threshold value (0-255).
 * @returns {ImageData} A new ImageData object with thresholded data (black/white).
 */
export function getThresholdedImageData(grayscaleImageData, threshold) {
    // Create a copy to avoid modifying the input grayscale data
    const thresholdedImageData = new ImageData(
        new Uint8ClampedArray(grayscaleImageData.data), // Copy data buffer
        grayscaleImageData.width,
        grayscaleImageData.height
    );
    // Apply threshold *to the copy*.
    applyThreshold(thresholdedImageData, threshold);
    return thresholdedImageData;
}