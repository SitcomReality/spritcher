/**
 * Handles image loading from a File object.
 * @param {File} file - The image file object selected by the user.
 * @param {HTMLCanvasElement} canvas - The canvas element to draw the preview on.
 * @returns {Promise<{img: HTMLImageElement, naturalWidth: number, naturalHeight: number, hasTransparency: boolean}>} A promise that resolves with image info including transparency flag.
 */
export async function loadImageFromFile(file, canvas) {
    return new Promise((resolve, reject) => {
        // File object is now passed directly
        if (!file) {
            reject(new Error("No file provided to loadImageFromFile."));
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

                // Now get ImageData and transparency info
                const imageDataResult = getImageDataFromCanvas(canvas);
                if (!imageDataResult) {
                    reject(new Error("Could not get image pixel data after loading."));
                    return;
                }
                resolve({ img, naturalWidth, naturalHeight, hasTransparency: imageDataResult.hasTransparency });
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
        reader.readAsDataURL(file); // Read the File object directly
    });
}

/**
 * Gets the pixel data for the entire image from a canvas.
 * Also checks if any transparency is present.
 * @param {HTMLCanvasElement} canvas - The canvas element containing the image.
 * @returns {{imageData: ImageData, hasTransparency: boolean} | null} An object with ImageData and transparency flag, or null on error.
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
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Check for transparency
        let hasTransparency = false;
        const data = imageData.data;
        for (let i = 3; i < data.length; i += 4) { // Start at first alpha, step by 4
            if (data[i] < 255) {
                hasTransparency = true;
                break; // Found transparency, no need to check further
            }
        }
        console.log(`Transparency check complete. Has transparency: ${hasTransparency}`);

        return { imageData, hasTransparency };

    } catch (e) {
        console.error("Error getting ImageData:", e);
        // This can happen due to CORS issues if the image source is external
        // and the canvas is "tainted", but shouldn't be an issue with File API uploads.
        // It might also happen if the canvas dimensions are excessively large.
        alert(`Could not read pixel data from the canvas. Error: ${e.message}`);
        return null;
    }
}