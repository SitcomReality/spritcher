/**
 * Calculates spritesheet layout details based ONLY on selected sprites and padding.
 * Determines the maximum sprite dimensions needed for content.
 * @param {Array<Object>} selectedSprites - Array of selected sprite objects { blob: { bounds: { width, height } } }.
 * @param {number} padding - Padding around each sprite within its cell.
 * @returns { { maxSpriteWidth: number, maxSpriteHeight: number, recommendedCellWidth: number, recommendedCellHeight: number } | null } Layout details or null if no sprites.
 */
export function calculateRecommendedLayout(selectedSprites, padding) {
    if (!selectedSprites || selectedSprites.length === 0) {
        return null;
    }

    // Determine max sprite width and height from the selected sprites
    let maxSpriteWidth = 0;
    let maxSpriteHeight = 0;
    selectedSprites.forEach(spriteData => {
        // Ensure bounds exist and are valid before accessing
        if (spriteData?.blob?.bounds) {
            const width = spriteData.blob.bounds.width;
            const height = spriteData.blob.bounds.height;
            if (typeof width === 'number' && width > maxSpriteWidth) maxSpriteWidth = width;
            if (typeof height === 'number' && height > maxSpriteHeight) maxSpriteHeight = height;
        } else {
            console.warn("Skipping sprite in layout calculation due to missing/invalid bounds:", spriteData);
        }
    });

    // Recommended cell dimensions include the max sprite size and padding on both sides
    // Ensure minimum cell size is 1 pixel + padding
    const recommendedCellWidth = Math.max(1, Math.round(maxSpriteWidth)) + padding * 2;
    const recommendedCellHeight = Math.max(1, Math.round(maxSpriteHeight)) + padding * 2;


    return {
        maxSpriteWidth, // Max width of the actual sprite content
        maxSpriteHeight, // Max height of the actual sprite content
        recommendedCellWidth,
        recommendedCellHeight,
    };
}


/**
 * Generates the final spritesheet image data on a target canvas.
 * Creates a new canvas internally to draw on. Handles sprites from multiple source images.
 * Allows overriding cell size and scales down sprites larger than the cell content area.
 *
 * @param {Array<Object>} selectedSpritesForSheet - Array of sprite objects { uniqueId, blob, sourceImageData, sourceImageId }.
 * @param {number} cols - Number of columns in the grid.
 * @param {number} padding - Padding between sprites in pixels.
 * @param {string} alignH - Horizontal sprite alignment within cells ('left', 'center', 'right').
 * @param {string} alignV - Vertical sprite alignment within cells ('top', 'center', 'bottom').
 * @param {number | null} userCellWidth - User-defined cell width (or null/0/undefined for auto).
 * @param {number | null} userCellHeight - User-defined cell height (or null/0/undefined for auto).
 * @returns {Promise<HTMLCanvasElement>} A promise that resolves with the canvas containing the generated spritesheet.
 */
export async function generateSpritesheet(selectedSpritesForSheet, cols, padding, alignH, alignV, userCellWidth, userCellHeight) {
    return new Promise(async (resolve, reject) => {
        if (!selectedSpritesForSheet || selectedSpritesForSheet.length === 0) {
            reject(new Error("Cannot generate spritesheet: No sprites selected."));
            return;
        }

        // 1. Calculate Recommended Layout (based on actual sprites)
        const recommendedLayout = calculateRecommendedLayout(selectedSpritesForSheet, padding);
        if (!recommendedLayout) {
            reject(new Error("Cannot generate spritesheet: Layout calculation failed."));
            return;
        }

        // 2. Determine Final Cell Size (Use user input if valid, otherwise use recommended)
        const finalCellWidth = (userCellWidth && userCellWidth > 0) ? userCellWidth : recommendedLayout.recommendedCellWidth;
        const finalCellHeight = (userCellHeight && userCellHeight > 0) ? userCellHeight : recommendedLayout.recommendedCellHeight;

        // 3. Calculate Final Sheet Dimensions
        const numRows = Math.ceil(selectedSpritesForSheet.length / cols);
        const finalSheetWidth = cols * finalCellWidth;
        const finalSheetHeight = numRows * finalCellHeight;

        // Create the target canvas for the spritesheet
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = finalSheetWidth;
        targetCanvas.height = finalSheetHeight;
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, finalSheetWidth, finalSheetHeight);

        // --- Create temporary source canvases for each unique source image ---
        const sourceCanvases = new Map();
        for (const spriteData of selectedSpritesForSheet) {
            const { sourceImageId, sourceImageData } = spriteData;
            if (!sourceCanvases.has(sourceImageId)) {
                if (!sourceImageData || !sourceImageData.width || !sourceImageData.height) {
                    console.warn(`Skipping sprites from source ${sourceImageId} due to missing or invalid ImageData.`);
                    continue; // Skip creating canvas for this invalid source
                }
                try {
                    const sourceCanvas = document.createElement('canvas');
                    sourceCanvas.width = sourceImageData.width;
                    sourceCanvas.height = sourceImageData.height;
                    sourceCanvas.getContext('2d', { willReadFrequently: true }).putImageData(sourceImageData, 0, 0);
                    sourceCanvases.set(sourceImageId, sourceCanvas);
                } catch (e) {
                    console.error(`Failed to create temp source canvas for ${sourceImageId}:`, e);
                }
            }
        }
        // --- End source canvas creation ---

        console.log(`Generating ${cols}x${numRows} spritesheet (${finalSheetWidth}x${finalSheetHeight}px), Cell: ${finalCellWidth}x${finalCellHeight}px, Padding: ${padding}px`);

        selectedSpritesForSheet.forEach((spriteData, index) => {
            const { blob, sourceImageId, uniqueId } = spriteData;

             // Basic check for valid blob data
            if (!blob?.bounds || typeof blob.bounds.width !== 'number' || typeof blob.bounds.height !== 'number') {
                console.warn(`Skipping sprite ${uniqueId} due to missing or invalid blob/bounds data.`);
                return;
            }
            const bounds = blob.bounds;


            // Get the correct source canvas for this sprite
            const sourceCanvas = sourceCanvases.get(sourceImageId);
            if (!sourceCanvas) {
                console.warn(`Skipping sprite ${uniqueId} - could not find or create source canvas for ${sourceImageId}.`);
                return; // Skip this sprite
            }

            const row = Math.floor(index / cols);
            const col = index % cols;

            // Calculate cell's top-left corner
            const cellX = col * finalCellWidth;
            const cellY = row * finalCellHeight;

            // Calculate available content area within the cell
            const contentWidth = Math.max(1, finalCellWidth - padding * 2);
            const contentHeight = Math.max(1, finalCellHeight - padding * 2);

            // Determine drawing dimensions (scale down if needed)
            let drawWidth = Math.max(1, Math.round(bounds.width)); // Start with actual sprite size (rounded)
            let drawHeight = Math.max(1, Math.round(bounds.height));
            let scale = 1;

            if (drawWidth > contentWidth || drawHeight > contentHeight) {
                const scaleX = contentWidth / drawWidth;
                const scaleY = contentHeight / drawHeight;
                scale = Math.min(scaleX, scaleY); // Use the smaller scale factor to fit both dims
                drawWidth = Math.max(1, Math.floor(drawWidth * scale)); // Use floor to ensure it fits
                drawHeight = Math.max(1, Math.floor(drawHeight * scale));
                // console.log(`Scaled sprite ${uniqueId} by ${scale.toFixed(2)} -> ${drawWidth}x${drawHeight}`);
            }

             // Ensure source coordinates and dimensions are valid within the specific source canvas
             const sourceX = Math.max(0, Math.round(bounds.minX));
             const sourceY = Math.max(0, Math.round(bounds.minY));
             // Clamp source width/height to prevent reading outside source image bounds
             // Use the *original* sprite bounds width/height for source reading
             const sourceReadWidth = Math.min(Math.round(bounds.width), sourceCanvas.width - sourceX);
             const sourceReadHeight = Math.min(Math.round(bounds.height), sourceCanvas.height - sourceY);

            if (sourceReadWidth <= 0 || sourceReadHeight <= 0) {
                 console.warn(`Skipping sprite ${uniqueId} due to invalid source dimensions after clamping: w=${sourceReadWidth}, h=${sourceReadHeight} at [${sourceX}, ${sourceY}] on source ${sourceImageId}`);
                 return; // Skip drawing this blob if dimensions are invalid
            }


            // Calculate destination position within the cell's CONTENT area, based on drawWidth/drawHeight
            let destX = cellX + padding; // Start at content area top-left
            let destY = cellY + padding;

            // Horizontal alignment within content area
            if (alignH === 'center') {
                destX += Math.floor((contentWidth - drawWidth) / 2);
            } else if (alignH === 'right') {
                destX += (contentWidth - drawWidth);
            }

            // Vertical alignment within content area
            if (alignV === 'center') {
                destY += Math.floor((contentHeight - drawHeight) / 2);
            } else if (alignV === 'bottom') {
                destY += (contentHeight - drawHeight);
            }

            // Ensure destination is within padding bounds (should be guaranteed by logic above, but double check)
            destX = Math.max(cellX + padding, destX);
            destY = Math.max(cellY + padding, destY);

            try {
                // Draw the specific sprite region from the source canvas to the target spritesheet canvas
                // Use the calculated potentially scaled drawWidth/Height for destination size
                ctx.drawImage(
                    sourceCanvas,       // Source: temporary canvas for this sprite's original image
                    sourceX,            // Source rectangle X
                    sourceY,            // Source rectangle Y
                    sourceReadWidth,    // Source rectangle Width (original sprite size, clamped)
                    sourceReadHeight,   // Source rectangle Height (original sprite size, clamped)
                    Math.round(destX),  // Destination X on target canvas
                    Math.round(destY),  // Destination Y on target canvas
                    drawWidth,          // Destination Width (potentially scaled)
                    drawHeight          // Destination Height (potentially scaled)
                );
            } catch (e) {
                console.error(`Error drawing sprite ${uniqueId} from source ${sourceImageId} [${sourceX},${sourceY} ${sourceReadWidth}x${sourceReadHeight}] to dest [${Math.round(destX)},${Math.round(destY)} ${drawWidth}x${drawHeight}]:`, e);
            }
        });

        console.log("Spritesheet generation complete.");
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