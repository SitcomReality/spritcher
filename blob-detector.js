/**
 * Simple two-pass Connected Component Labeling (CCL) algorithm.
 * Finds connected regions of non-transparent pixels in thresholded image data.
 * Assumes input is thresholded (pixels are either 0 or 255) and uses the red channel.
 * Treats pixels with value 255 (white) as foreground and 0 (black) as background.
 *
 * @param {ImageData} thresholdedImageData - The thresholded image data (black background, white foreground).
 * @param {number} minSize - Minimum number of pixels for a blob to be considered valid.
 * @returns {Array<Object>} An array of blob objects, each with { id, pixels: number, bounds: { minX, minY, maxX, maxY } }.
 */
export function findBlobs(thresholdedImageData, minSize = 1) {
    const width = thresholdedImageData.width;
    const height = thresholdedImageData.height;
    const data = thresholdedImageData.data;
    const labels = new Array(width * height).fill(0); // Stores the label for each pixel
    let nextLabel = 1;
    const equivalences = {}; // To store label equivalences

    function getPixelIndex(x, y) {
        return (y * width + x);
    }

    function isForeground(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return false; // Out of bounds
        }
        const index = getPixelIndex(x, y) * 4;
        // Check Red channel (assuming R=G=B for thresholded) and Alpha
        return data[index] === 255 && data[index + 3] > 0; // White foreground, not fully transparent
    }

    // First pass: Assign initial labels and record equivalences
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!isForeground(x, y)) continue;

            const neighbors = [];
            // Check neighbors (4-connectivity: left and top)
            if (isForeground(x - 1, y)) neighbors.push(labels[getPixelIndex(x - 1, y)]);
            if (isForeground(x, y - 1)) neighbors.push(labels[getPixelIndex(x, y - 1)]);
            // Diagonal neighbors (optional, for 8-connectivity)
            // if (isForeground(x - 1, y - 1)) neighbors.push(labels[getPixelIndex(x - 1, y - 1)]);
            // if (isForeground(x + 1, y - 1)) neighbors.push(labels[getPixelIndex(x + 1, y - 1)]);


            const validNeighbors = neighbors.filter(label => label > 0);

            if (validNeighbors.length === 0) {
                // New component
                labels[getPixelIndex(x, y)] = nextLabel;
                equivalences[nextLabel] = new Set([nextLabel]); // Initialize equivalence set
                nextLabel++;
            } else {
                // Assign minimum neighbor label
                const minLabel = Math.min(...validNeighbors);
                labels[getPixelIndex(x, y)] = minLabel;

                // Record equivalences between neighbors
                validNeighbors.forEach(label => {
                    equivalences[minLabel].add(label);
                    if (!equivalences[label]) equivalences[label] = new Set();
                     equivalences[label].add(minLabel);
                     // Transitive closure needed later
                });
            }
        }
    }

    // Resolve equivalences (build disjoint sets using Union-Find or similar)
    const disjointSets = {};
    for (let label in equivalences) {
        label = parseInt(label);
        if (!(label in disjointSets)) {
             disjointSets[label] = label; // Root is initially itself
        }
        equivalences[label].forEach(equivLabel => {
            if (!(equivLabel in disjointSets)) {
                disjointSets[equivLabel] = equivLabel;
            }
            // Union operation (simple path compression not fully implemented here for brevity)
            let root1 = findRoot(disjointSets, label);
            let root2 = findRoot(disjointSets, equivLabel);
            if (root1 !== root2) {
                disjointSets[root2] = root1; // Merge sets
            }
        });
    }

    function findRoot(sets, label) {
        while (sets[label] !== label) {
            label = sets[label];
        }
        return label;
    }


    // Second pass: Relabel pixels with the root of their equivalence set and collect blob data
    const blobs = {}; // Store blob data keyed by root label
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = getPixelIndex(x, y);
            const initialLabel = labels[index];
            if (initialLabel > 0) {
                const rootLabel = findRoot(disjointSets, initialLabel);
                labels[index] = rootLabel; // Relabel with the root

                if (!blobs[rootLabel]) {
                    blobs[rootLabel] = {
                        id: rootLabel,
                        pixels: 0,
                        bounds: { minX: x, minY: y, maxX: x, maxY: y }
                    };
                }

                blobs[rootLabel].pixels++;
                blobs[rootLabel].bounds.minX = Math.min(blobs[rootLabel].bounds.minX, x);
                blobs[rootLabel].bounds.minY = Math.min(blobs[rootLabel].bounds.minY, y);
                blobs[rootLabel].bounds.maxX = Math.max(blobs[rootLabel].bounds.maxX, x);
                blobs[rootLabel].bounds.maxY = Math.max(blobs[rootLabel].bounds.maxY, y);
            }
        }
    }

    // Filter blobs by minimum size and convert to array
    const filteredBlobs = Object.values(blobs).filter(blob => blob.pixels >= minSize);

     // Add width and height to bounds for convenience
    filteredBlobs.forEach(blob => {
        blob.bounds.width = blob.bounds.maxX - blob.bounds.minX + 1;
        blob.bounds.height = blob.bounds.maxY - blob.bounds.minY + 1;
    });


    console.log(`Found ${Object.keys(blobs).length} raw blobs, ${filteredBlobs.length} blobs after filtering (minSize: ${minSize}).`);

    // Return the labels array as well for debugging CCL visualization
    return { blobs: filteredBlobs, labels: labels };
}

/**
 * Generates an ImageData object visualizing the CCL labels.
 * Each component gets a unique color.
 * @param {number[]} labels - The array of labels generated by CCL (1D array).
 * @param {number} width - The width of the image.
 * @param {number} height - The height of the image.
 * @param {Map<number, string>} [colorMap] - Optional map of label ID to color string.
 * @returns {ImageData} An ImageData object with colored labels.
 */
export function getLabeledImageData(labels, width, height, colorMap = null) {
    const imageData = new ImageData(width, height);
    const data = imageData.data;
    const assignedColors = colorMap || new Map(); // Use provided map or create a new one
    let colorIndex = 0;
    const distinctLabels = new Set(labels.filter(l => l > 0));

    // Pre-generate colors if no map provided
    if (!colorMap) {
         distinctLabels.forEach(label => {
             if (!assignedColors.has(label)) {
                // Simple cycling colors for demonstration
                const hue = (colorIndex * 137.508) % 360; // Golden angle approximation
                assignedColors.set(label, `hsl(${hue}, 70%, 50%)`);
                colorIndex++;
            }
         });
    }


    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const dataIndex = i * 4;

        if (label > 0 && assignedColors.has(label)) {
             // Convert HSL string to RGB (basic approximation)
             // In a real app, use a color library for accuracy
             const colorStr = assignedColors.get(label);
             // Basic parsing assuming hsl(h, s%, l%) format
             const match = colorStr.match(/hsl\((\d+(\.\d+)?),\s*(\d+(\.\d+)?)%,\s*(\d+(\.\d+)?)%\)/);
             if (match) {
                 const [h, s, l] = [parseFloat(match[1]), parseFloat(match[3])/100, parseFloat(match[5])/100];
                 const { r, g, b } = hslToRgb(h, s, l);
                 data[dataIndex] = r;
                 data[dataIndex + 1] = g;
                 data[dataIndex + 2] = b;
                 data[dataIndex + 3] = 255; // Opaque
             } else {
                  // Fallback color if parsing fails
                  data[dataIndex] = 255; data[dataIndex + 1] = 0; data[dataIndex + 2] = 0; data[dataIndex + 3] = 255;
             }

        } else {
            // Background or uncolored label
            data[dataIndex] = 0;     // R
            data[dataIndex + 1] = 0; // G
            data[dataIndex + 2] = 0; // B
            data[dataIndex + 3] = 0; // Transparent background
        }
    }

    return imageData;
}


// Helper function: HSL to RGB conversion (simplified)
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    h /= 360;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/**
 * Simple two-pass Connected Component Labeling (CCL) algorithm.
 * Finds connected regions of non-transparent pixels in thresholded image data.
 * Assumes input is thresholded (pixels are either 0 or 255) and uses the red channel.
 * Treats pixels with value 255 (white) as foreground and 0 (black) or transparent as background.
 * Uses 4-connectivity.
 *
 * @param {ImageData} thresholdedImageData - The thresholded image data (black background, white foreground).
 * @param {number} minSize - Minimum number of pixels for a blob to be considered valid.
 * @returns {{blobs: Array<Object>, labels: Int32Array}} An object containing:
 *          - blobs: An array of blob objects, each with { id, pixels: number, bounds: { minX, minY, maxX, maxY, width, height } }.
 *          - labels: A Int32Array containing the root label for each pixel (0 for background).
 */
export function findBlobs(thresholdedImageData, minSize = 1) {
    const width = thresholdedImageData.width;
    const height = thresholdedImageData.height;
    const data = thresholdedImageData.data;
    // Use Int32Array for labels, allows for potentially many labels > 255
    const labels = new Int32Array(width * height).fill(0);
    let nextLabel = 1;

    // Union-Find data structure for equivalences
    const parent = new Map(); // Store parent pointers for disjoint sets

    function findSet(label) {
        let root = label;
        while (parent.has(root) && parent.get(root) !== root) {
            root = parent.get(root);
        }
        // Path compression: update pointers along the path
        let current = label;
        while (parent.has(current) && parent.get(current) !== root) {
            const next = parent.get(current);
            parent.set(current, root);
            current = next;
        }
        if (!parent.has(label)) { // Initialize if not seen before
             parent.set(label, label);
             return label;
        }

        return root;
    }

    function unionSets(label1, label2) {
        if (!parent.has(label1)) parent.set(label1, label1);
        if (!parent.has(label2)) parent.set(label2, label2);

        const root1 = findSet(label1);
        const root2 = findSet(label2);
        if (root1 !== root2) {
            // Union by rank/size could be added for optimization, but simple merge works
             // Make the smaller root point to the larger root (arbitrarily choosing root1 as parent)
            parent.set(root2, root1);
        }
    }

    function getPixelIndex(x, y) {
        return y * width + x;
    }

    // Check if a pixel is foreground (white and not transparent)
    function isForeground(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return false; // Out of bounds
        }
        const dataIndex = (y * width + x) * 4;
        // Check Red channel (255 for foreground) and Alpha (>0 for not transparent)
        return data[dataIndex] === 255 && data[dataIndex + 3] > 0;
    }

    // --- First Pass: Assign initial labels and record equivalences ---
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!isForeground(x, y)) continue;

            const currentPixelIndex = getPixelIndex(x, y);
            const neighborLabels = [];

            // Check neighbors (4-connectivity: left and top)
            if (isForeground(x - 1, y)) {
                neighborLabels.push(labels[getPixelIndex(x - 1, y)]);
            }
            if (isForeground(x, y - 1)) {
                neighborLabels.push(labels[getPixelIndex(x, y - 1)]);
            }

            const validNeighborLabels = neighborLabels.filter(l => l > 0);

            if (validNeighborLabels.length === 0) {
                // New component: Assign nextLabel
                labels[currentPixelIndex] = nextLabel;
                parent.set(nextLabel, nextLabel); // Initialize its set
                nextLabel++;
            } else {
                // Connected to existing components
                const minLabel = Math.min(...validNeighborLabels);
                labels[currentPixelIndex] = minLabel;

                // Record equivalences using Union-Find
                validNeighborLabels.forEach(label => {
                    if (label !== minLabel) {
                        unionSets(minLabel, label);
                    }
                });
            }
        }
    }

    // --- Second Pass: Resolve labels and collect blob data ---
    const blobs = {}; // Store blob data keyed by root label

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = getPixelIndex(x, y);
            const initialLabel = labels[index];

            if (initialLabel > 0) {
                const rootLabel = findSet(initialLabel);
                labels[index] = rootLabel; // Relabel with the final root label

                if (!blobs[rootLabel]) {
                    blobs[rootLabel] = {
                        id: rootLabel,
                        pixels: 0,
                        bounds: { minX: x, minY: y, maxX: x, maxY: y }
                    };
                }

                // Update blob stats
                blobs[rootLabel].pixels++;
                blobs[rootLabel].bounds.minX = Math.min(blobs[rootLabel].bounds.minX, x);
                blobs[rootLabel].bounds.minY = Math.min(blobs[rootLabel].bounds.minY, y);
                blobs[rootLabel].bounds.maxX = Math.max(blobs[rootLabel].bounds.maxX, x);
                blobs[rootLabel].bounds.maxY = Math.max(blobs[rootLabel].bounds.maxY, y);
            }
        }
    }

    // Filter blobs by minimum size and finalize bounds
    const filteredBlobs = Object.values(blobs)
        .filter(blob => blob.pixels >= minSize)
        .map(blob => {
            // Calculate width and height after filtering
            blob.bounds.width = blob.bounds.maxX - blob.bounds.minX + 1;
            blob.bounds.height = blob.bounds.maxY - blob.bounds.minY + 1;
            return blob;
        });

    console.log(`Found ${Object.keys(blobs).length} raw blobs, ${filteredBlobs.length} blobs after filtering (minSize: ${minSize}).`);

    // Return both the filtered blobs and the final labels array
    return { blobs: filteredBlobs, labels };
}


/**
 * Generates an ImageData object visualizing the CCL labels.
 * Each component gets a relatively distinct color. Background is transparent black.
 * @param {Int32Array} labels - The array of final root labels generated by CCL (1D array).
 * @param {number} width - The width of the image.
 * @param {number} height - The height of the image.
 * @returns {ImageData} An ImageData object with colored labels.
 */
export function getLabeledImageData(labels, width, height) {
    const imageData = new ImageData(width, height);
    const data = imageData.data;
    const labelColors = new Map(); // Cache colors per label ID

    // Function to generate somewhat distinct colors using HSL
    function getColorForLabel(label) {
        if (labelColors.has(label)) {
            return labelColors.get(label);
        }
        // Use golden angle approximation for hue distribution
        const hue = (label * 137.508) % 360;
        // Keep saturation and lightness constant for visibility
        const saturation = 75; // Use % symbol later if needed, but keep as number here
        const lightness = 50;
        const { r, g, b } = hslToRgb(hue, saturation / 100, lightness / 100);
        const color = { r, g, b };
        labelColors.set(label, color);
        return color;
    }

    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const dataIndex = i * 4;

        if (label > 0) {
            const color = getColorForLabel(label);
            data[dataIndex] = color.r;     // R
            data[dataIndex + 1] = color.g; // G
            data[dataIndex + 2] = color.b; // B
            data[dataIndex + 3] = 255;      // Alpha (Opaque)
        } else {
            // Background: Transparent black
            data[dataIndex] = 0;     // R
            data[dataIndex + 1] = 0; // G
            data[dataIndex + 2] = 0; // B
            data[dataIndex + 3] = 0; // Alpha (Transparent)
        }
    }

    return imageData;
}


// Helper: HSL to RGB conversion (source: CSS Tricks adaptation)
// Input h (0-360), s (0-1), l (0-1)
// Output { r, g, b } (0-255)
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hNormalized = h / 360; // Normalize hue to 0-1
    r = hue2rgb(p, q, hNormalized + 1 / 3);
    g = hue2rgb(p, q, hNormalized);
    b = hue2rgb(p, q, hNormalized - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

