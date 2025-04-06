/**
 * Handles image loading from user input.
 * @param {HTMLInputElement} fileInput - The file input element.
 * @param {HTMLCanvasElement} canvas - The canvas element to draw the preview on.
 * @returns {Promise<{img: HTMLImageElement, naturalWidth: number, naturalHeight: number}>} A promise that resolves with the loaded image element and its natural dimensions.
 */
export async function loadImage(fileInput, canvas) {
    return new Promise((resolve, reject) => {
        const file = fileInput.files[0];
        if (!file) {
            reject(new Error("No file selected."));
            return;
        }
        // Basic type check
        if (!file.type.startsWith('image/')) {
             reject(new Error("Selected file is not an image."));
             return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const naturalWidth = img.naturalWidth;
                const naturalHeight = img.naturalHeight;

                 if (naturalWidth === 0 || naturalHeight === 0) {
                    reject(new Error("Image has zero dimensions. Is it a valid image file?"));
                    return;
                 }

                // Draw initial preview on the canvas
                const ctx = canvas.getContext('2d');
                canvas.width = naturalWidth;
                canvas.height = naturalHeight;
                ctx.drawImage(img, 0, 0);
                console.log(`Image loaded: ${naturalWidth}x${naturalHeight}`);
                resolve({ img, naturalWidth, naturalHeight });
            };
            img.onerror = (err) => {
                console.error("Image loading error:", err);
                reject(new Error("Failed to load image data. The file might be corrupted or in an unsupported format."));
            };
            img.src = e.target.result;
        };
        reader.onerror = (err) => {
            console.error("File reader error:", err);
            reject(new Error("Failed to read the selected file."));
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Gets the pixel data for the entire image from a canvas.
 * @param {HTMLCanvasElement} canvas - The canvas element containing the image.
 * @returns {ImageData | null} The ImageData object or null if canvas is empty or inaccessible.
 */
export function getImageDataFromCanvas(canvas) {
    if (!canvas.width || !canvas.height) {
        console.warn("Canvas has no dimensions, cannot get ImageData.");
        return null;
    }
    // Add willReadFrequently for potential performance gain
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    try {
        // Ensure coordinates are within canvas bounds, although using 0,0,width,height should be safe
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
        console.error("Error getting ImageData:", e);
        // This can happen due to CORS issues if the image source is external
        // and the canvas is "tainted", but shouldn't be an issue with File API uploads.
        // It might also happen if the canvas dimensions are excessively large.
        alert(`Could not read pixel data from the canvas. Error: ${e.message}`);
        return null;
    }
}