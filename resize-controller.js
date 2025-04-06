import { elements } from 'dom-elements';
import { appState, updateBlobBoundsByIndex, setSelectedBlobIndex } from 'state';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';
import { updateDebugOverlays } from 'debug-controller';
import { updateEditModeUI } from 'mode-controller';
import { displayExtractedSprites, updateSpriteStats } from 'extracted-sprites-controller';

let startDragX_client = 0;
let startDragY_client = 0;
let startBounds_resize = null; 
let selectedBoxElement_resize = null;

let isResizing = false;

export function initResizeController() {