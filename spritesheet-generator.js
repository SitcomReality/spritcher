/**
 * Calculates spritesheet dimensions and cell layout details based on selected sprites and settings.
 * Does not draw anything.
 * @param {Array<Object>} selectedSprites - Array of selected sprite objects { blob: { bounds: { width, height } } }.
 * @param {number} cols - Number of columns in the grid.
 * @param {number} padding - Padding around each sprite within its cell.
 * @returns { { sheetWidth: number, sheetHeight: number, cellWidth: number, cellHeight: number, numRows: number, maxSpriteWidth: number, maxSpriteHeight: number } | null } Layout details or null if no sprites.
 */
export function calculateSpritesheetLayout(selectedSprites, cols, padding) {
    if (!selectedSprites || selectedSprites.length === 0) {
        return null;
    }

    // Determine max sprite width and height from the selected sprites
    let maxSpriteWidth = 0;
    let maxSpriteHeight = 0;
    selectedSprites.forEach(spriteData => {
        const width = spriteData.blob.bounds.width;
        const height = spriteData.blob.bounds.height;
        if (width > maxSpriteWidth) maxSpriteWidth = width;
        if (height > maxSpriteHeight) maxSpriteHeight = height;
    });

    // Cell dimensions include the sprite and padding on both sides
    // Ensure minimum cell size is 1 pixel + padding
    const cellWidth = Math.max(1, maxSpriteWidth) + padding * 2;
    const cellHeight = Math.max(1, maxSpriteHeight) + padding * 2;

    const numRows = Math.ceil(selectedSprites.length / cols);
    const sheetWidth = cols * cellWidth;
    const sheetHeight = numRows * cellHeight;

    return {
        sheetWidth,
        sheetHeight,
        cellWidth, // Width of the cell including padding
        cellHeight, // Height of the cell including padding
        numRows,
        maxSpriteWidth, // Max width of the actual sprite content
        maxSpriteHeight // Max height of the actual sprite content
    };
}


/**
 * Generates the final spritesheet image data on a target canvas.
 * Creates a new canvas internally to draw on. Handles sprites from multiple source images.
 *
 * @param {Array<Object>} selectedSpritesForSheet - Array of sprite objects { uniqueId, blob, sourceImageData, sourceImageId }.
 * @param {number} cols - Number of columns in the grid.
 * @param {number} padding - Padding between sprites in pixels.
 * @param {string} alignH - Horizontal sprite alignment within cells ('left', 'center', 'right').
 * @param {string} alignV - Vertical sprite alignment within cells ('top', 'center', 'bottom').
 * @returns {Promise<HTMLCanvasElement>} A promise that resolves with the canvas containing the generated spritesheet.
 */
export async function generateSpritesheet(selectedSpritesForSheet, cols, padding, alignH, alignV) {
    return new Promise(async (resolve, reject) => {
        if (!selectedSpritesForSheet || selectedSpritesForSheet.length === 0) {
            reject(new Error("Cannot generate spritesheet: No sprites selected."));
            return;
        }

        const layout = calculateSpritesheetLayout(selectedSpritesForSheet, cols, padding);
        if (!layout) {
            reject(new Error("Cannot generate spritesheet: Layout calculation failed."));
            return;
        }

        const { sheetWidth, sheetHeight, cellWidth, cellHeight, maxSpriteWidth, maxSpriteHeight } = layout;

        // Create the target canvas for the spritesheet
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = sheetWidth;
        targetCanvas.height = sheetHeight;
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, sheetWidth, sheetHeight);

        // --- Create temporary source canvases for each unique source image ---
        const sourceCanvases = new Map();
        for (const spriteData of selectedSpritesForSheet) {
            const { sourceImageId, sourceImageData } = spriteData;
            if (!sourceCanvases.has(sourceImageId)) {
                if (!sourceImageData || !sourceImageData.width || !sourceImageData.height) {
                    console.warn(`Skipping sprites from source ${sourceImageId} due to missing or invalid ImageData.`);
                    // Optionally draw placeholders for sprites from this source later?
                    continue; // Skip creating canvas for this invalid source
                }
                try {
                    const sourceCanvas = document.createElement('canvas');
                    sourceCanvas.width = sourceImageData.width;
                    sourceCanvas.height = sourceImageData.height;
                    sourceCanvas.getContext('2d', { willReadFrequently: true }).putImageData(sourceImageData, 0, 0);
                    sourceCanvases.set(sourceImageId, sourceCanvas);
                    console.log(`Created temp source canvas for ${sourceImageId} (${sourceImageData.width}x${sourceImageData.height})`);
                } catch (e) {
                    console.error(`Failed to create temp source canvas for ${sourceImageId}:`, e);
                    // Mark this source as invalid?
                }

            }
        }
        // --- End source canvas creation ---


        console.log(`Generating ${cols}x${layout.numRows} spritesheet (${sheetWidth}x${sheetHeight}px), cell: ${cellWidth}x${cellHeight}px`);

        selectedSpritesForSheet.forEach((spriteData, index) => {
            const { blob, sourceImageId, uniqueId } = spriteData;
            const bounds = blob.bounds;

            // Get the correct source canvas for this sprite
            const sourceCanvas = sourceCanvases.get(sourceImageId);
            if (!sourceCanvas) {
                console.warn(`Skipping sprite ${uniqueId} - could not find or create source canvas for ${sourceImageId}.`);
                // Optionally draw a placeholder on the target sheet
                // drawPlaceholder(ctx, cellX, cellY, cellWidth, cellHeight, "Missing Source");
                return; // Skip this sprite
            }


            const row = Math.floor(index / cols);
            const col = index % cols;

            // Top-left corner of the current cell
            const cellX = col * cellWidth;
            const cellY = row * cellHeight;

            // Calculate sprite's top-left position within the cell based on alignment and padding
            let spriteDestX = cellX + padding; // Default to left alignment + padding
            let spriteDestY = cellY + padding; // Default to top alignment + padding

            // Apply Horizontal Alignment
            if (alignH === 'center') {
                spriteDestX += Math.floor((maxSpriteWidth - bounds.width) / 2);
            } else if (alignH === 'right') {
                spriteDestX = cellX + cellWidth - padding - bounds.width;
            }
             // Ensure X is not negative if calculation is weird
            spriteDestX = Math.max(cellX, spriteDestX);

            // Apply Vertical Alignment
            if (alignV === 'center') {
                spriteDestY += Math.floor((maxSpriteHeight - bounds.height) / 2);
            } else if (alignV === 'bottom') {
                spriteDestY = cellY + cellHeight - padding - bounds.height;
            }
            // Ensure Y is not negative
            spriteDestY = Math.max(cellY, spriteDestY);

            // Ensure source coordinates and dimensions are valid within the specific source canvas
            const sourceX = Math.max(0, Math.round(bounds.minX)); // Use rounded source coords
            const sourceY = Math.max(0, Math.round(bounds.minY));
            // Clamp width/height to prevent reading outside source image bounds
            const sourceWidth = Math.min(bounds.width, sourceCanvas.width - sourceX);
            const sourceHeight = Math.min(bounds.height, sourceCanvas.height - sourceY);


            if (sourceWidth <= 0 || sourceHeight <= 0) {
                console.warn(`Skipping sprite ${uniqueId} due to invalid source dimensions after clamping: w=${sourceWidth}, h=${sourceHeight} at [${sourceX}, ${sourceY}] on source ${sourceImageId}`);
                // drawPlaceholder(ctx, spriteDestX, spriteDestY, bounds.width, bounds.height, "Invalid Bounds");
                return; // Skip drawing this blob if dimensions are invalid
            }

            try {
                // Draw the specific sprite region from the correct source canvas to the target spritesheet canvas
                ctx.drawImage(
                    sourceCanvas, // Source: temporary canvas for this sprite's original image
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
                console.error(`Error drawing sprite ${uniqueId} from source ${sourceImageId} [${sourceX},${sourceY} ${sourceWidth}x${sourceHeight}] to dest [${Math.round(spriteDestX)},${Math.round(spriteDestY)}]:`, e);
                // Optionally, draw a placeholder
                // drawPlaceholder(ctx, spriteDestX, spriteDestY, sourceWidth, sourceHeight, "Draw Error");
            }
        });

        console.log("Spritesheet generation complete.");
        // Clean up temporary canvases? Not strictly necessary as they are local vars.
        sourceCanvases.clear();
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
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log(`Download triggered for ${filename}`);
    } catch (e) {
        console.error("Error creating data URL or triggering download:", e);
        alert(`Failed to initiate download. Error: ${e.message}`);
    }

}