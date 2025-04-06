/**
 * Calculates spritesheet dimensions and cell layout details based on blobs and settings.
 * Does not draw anything.
 * @param {Array<Object>} blobs - Array of blob objects with { bounds: { width, height } }.
 * @param {number} cols - Number of columns in the grid.
 * @param {number} padding - Padding around each sprite within its cell.
 * @returns { { sheetWidth: number, sheetHeight: number, cellWidth: number, cellHeight: number, numRows: number, maxSpriteWidth: number, maxSpriteHeight: number } | null } Layout details or null if no blobs.
 */
export function calculateSpritesheetLayout(blobs, cols, padding) {
     if (!blobs || blobs.length === 0) {
        return null;
    }

    // Determine max sprite width and height
    let maxSpriteWidth = 0;
    let maxSpriteHeight = 0;
    blobs.forEach(blob => {
        if (blob.bounds.width > maxSpriteWidth) maxSpriteWidth = blob.bounds.width;
        if (blob.bounds.height > maxSpriteHeight) maxSpriteHeight = blob.bounds.height;
    });

    // Cell dimensions include the sprite and padding on both sides
    const cellWidth = maxSpriteWidth + padding * 2;
    const cellHeight = maxSpriteHeight + padding * 2;

    const numRows = Math.ceil(blobs.length / cols);
    const sheetWidth = cols * cellWidth;
    const sheetHeight = numRows * cellHeight;

    return {
        sheetWidth,
        sheetHeight,
        cellWidth,
        cellHeight,
        numRows,
        maxSpriteWidth,
        maxSpriteHeight
    };
}


/**
 * Generates the final spritesheet image data on a target canvas.
 * Creates a new canvas internally to draw on.
 *
 * @param {ImageData} originalImageData - The ImageData of the original uploaded image.
 * @param {Array<Object>} blobs - Array of blob objects with { id, bounds: { minX, minY, width, height } }.
 * @param {number} cols - Number of columns in the grid.
 * @param {number} padding - Padding between sprites in pixels.
 * @param {string} alignment - Sprite alignment within cells ('top-left', 'center').
 * @returns {Promise<HTMLCanvasElement>} A promise that resolves with the canvas containing the generated spritesheet.
 */
export async function generateSpritesheet(originalImageData, blobs, cols, padding, alignment) {
    return new Promise(async (resolve, reject) => {
        if (!blobs || blobs.length === 0 || !originalImageData) {
            reject(new Error("Cannot generate spritesheet: Missing blobs or original image data."));
            return;
        }

        const layout = calculateSpritesheetLayout(blobs, cols, padding);
        if (!layout) {
             reject(new Error("Cannot generate spritesheet: No blobs provided."));
            return;
        }

        const { sheetWidth, sheetHeight, cellWidth, cellHeight, maxSpriteWidth, maxSpriteHeight } = layout;

        // Create the target canvas for the spritesheet
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = sheetWidth;
        targetCanvas.height = sheetHeight;
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, sheetWidth, sheetHeight); // Clear just in case

        // Create a temporary source canvas for efficient cropping (putImageData once)
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = originalImageData.width;
        sourceCanvas.height = originalImageData.height;
        const sourceCtx = sourceCanvas.getContext('2d');
        sourceCtx.putImageData(originalImageData, 0, 0);

        console.log(`Generating ${cols}x${layout.numRows} spritesheet (${sheetWidth}x${sheetHeight}px), cell: ${cellWidth}x${cellHeight}px`);


        blobs.forEach((blob, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            // Top-left corner of the current cell
            const cellX = col * cellWidth;
            const cellY = row * cellHeight;

            // Calculate sprite's top-left position within the cell based on alignment and padding
            let spriteDestX = cellX + padding;
            let spriteDestY = cellY + padding;

            if (alignment === 'center') {
                spriteDestX += Math.floor((maxSpriteWidth - blob.bounds.width) / 2);
                spriteDestY += Math.floor((maxSpriteHeight - blob.bounds.height) / 2);
            }

            // Ensure source coordinates and dimensions are valid
            const sourceX = Math.max(0, blob.bounds.minX);
            const sourceY = Math.max(0, blob.bounds.minY);
            // Clamp width/height to prevent reading outside source image bounds
            const sourceWidth = Math.min(blob.bounds.width, originalImageData.width - sourceX);
            const sourceHeight = Math.min(blob.bounds.height, originalImageData.height - sourceY);


             if (sourceWidth <= 0 || sourceHeight <= 0) {
                 console.warn(`Skipping blob ${blob.id || index} due to invalid source dimensions after clamping: w=${sourceWidth}, h=${sourceHeight} at [${sourceX}, ${sourceY}]`);
                 return; // Skip drawing this blob if dimensions are invalid
             }

            try {
                // Draw the specific sprite region from the source canvas to the target spritesheet canvas
                ctx.drawImage(
                    sourceCanvas, // Source: temporary canvas with original image data
                    sourceX,      // Source rectangle X
                    sourceY,      // Source rectangle Y
                    sourceWidth,  // Source rectangle Width
                    sourceHeight, // Source rectangle Height
                    spriteDestX,  // Destination X on target canvas
                    spriteDestY,  // Destination Y on target canvas
                    sourceWidth,  // Destination Width (use actual sprite width)
                    sourceHeight  // Destination Height (use actual sprite height)
                );
            } catch (e) {
                 // Log detailed error information
                 console.error(`Error drawing sprite ${blob.id || index} from source [${sourceX},${sourceY} ${sourceWidth}x${sourceHeight}] to dest [${spriteDestX},${spriteDestY}]:`, e);
                 // Optionally, draw a placeholder or skip
            }
        });

         console.log("Spritesheet generation complete.");
        resolve(targetCanvas); // Resolve with the canvas element itself
    });
}


/**
 * Triggers a download of the canvas content as a PNG file.
 * @param {HTMLCanvasElement} canvas - The canvas to download.
 * @param {string} [filename='spritesheet.png'] - The desired filename for the download.
 */
export function downloadCanvasAsPNG(canvas, filename = 'spritesheet.png') {
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        console.error("Cannot download empty or invalid canvas.");
        alert("Spritesheet is empty or hasn't been generated yet.");
        return;
    }
    try {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        // Append, click, and remove the link
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
         console.log(`Download triggered for ${filename}`);
    } catch (e) {
         console.error("Error creating data URL or triggering download:", e);
         alert(`Failed to initiate download. Error: ${e.message}`);
         // This could happen if the canvas is too large (browser limits on data URL length)
         // or if the canvas is tainted (though unlikely with File API).
    }

}