import { elements } from 'dom-elements';
import { reorderSelectedSprites } from 'state';
import { displaySelectedSprites, updateSpriteStats } from './extracted-sprites-controller';
import { clearGeneratedSpritesheet } from 'spritesheet-controller';

// Drag and Drop State
let draggedSpriteId = null;

export function initDragAndDrop() {
    const selectedContainer = elements.selectedSpritesDisplayContainer;
    
    selectedContainer.addEventListener('dragstart', handleDragStart);
    selectedContainer.addEventListener('dragover', handleDragOver);
    selectedContainer.addEventListener('dragenter', handleDragEnter);
    selectedContainer.addEventListener('dragleave', handleDragLeave);
    selectedContainer.addEventListener('drop', handleDrop);
    selectedContainer.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(event) {
    const item = event.target.closest('.sprite-preview-item');
    if (!item || !item.draggable) return;

    draggedSpriteId = item.dataset.spriteId;
    event.dataTransfer.setData('text/plain', draggedSpriteId);
    event.dataTransfer.effectAllowed = 'move';

    // Add class slightly delayed to allow the browser to capture the drag image
    setTimeout(() => {
        item.classList.add('dragging');
    }, 0);

    console.log(`Drag Start: ${draggedSpriteId}`);
}

function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    event.dataTransfer.dropEffect = 'move';

    const container = elements.selectedSpritesDisplayContainer;
    const targetItem = event.target.closest('.sprite-preview-item');

    // Reset all drag-over classes first
    container.querySelectorAll('.sprite-preview-item.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (targetItem && targetItem.dataset.spriteId !== draggedSpriteId) {
        // Add drag-over class to the item being hovered over
        targetItem.classList.add('drag-over');
    }
     // Optional: Add class to container if dragging over it
     container.classList.add('drag-over-container');
}

function handleDragEnter(event) {
    event.preventDefault();
    const targetItem = event.target.closest('.sprite-preview-item');
    if (targetItem && targetItem.dataset.spriteId !== draggedSpriteId) {
       // targetItem.classList.add('drag-over'); // Handled more robustly in dragOver
    }
    elements.selectedSpritesDisplayContainer.classList.add('drag-over-container');
}

function handleDragLeave(event) {
    const relatedTarget = event.relatedTarget;
    const container = elements.selectedSpritesDisplayContainer;

    // If leaving an item to go to another item or the container itself, dragOver handles class removal
    // Only remove container class if leaving the container entirely
    if (!container.contains(relatedTarget)) {
         container.classList.remove('drag-over-container');
         container.querySelectorAll('.sprite-preview-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
}

function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevent potential parent handlers

    const droppedOnItem = event.target.closest('.sprite-preview-item');
    const targetSpriteId = droppedOnItem ? droppedOnItem.dataset.spriteId : null;
    const idBeingDragged = event.dataTransfer.getData('text/plain');

    console.log(`Drop: dragged ${idBeingDragged}, dropped onto ${targetSpriteId}`);

    if (idBeingDragged && idBeingDragged !== targetSpriteId) {
        const success = reorderSelectedSprites(idBeingDragged, targetSpriteId);

        if (success) {
            displaySelectedSprites(); // Re-render the updated list
            updateSpriteStats(); // Stats might depend on order? (Not currently, but good practice)
            clearGeneratedSpritesheet(); // Order changed, invalidate sheet
        }
    }

    // Clean up visual drag classes
     elements.selectedSpritesDisplayContainer.classList.remove('drag-over-container');
     elements.selectedSpritesDisplayContainer.querySelectorAll('.sprite-preview-item.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragEnd(event) {
    console.log(`Drag End: ${draggedSpriteId}`);
    // Clean up visual feedback classes regardless of drop success
    const draggedItem = elements.selectedSpritesDisplayContainer.querySelector(`.sprite-preview-item[data-sprite-id="${draggedSpriteId}"]`);
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
    }
     elements.selectedSpritesDisplayContainer.classList.remove('drag-over-container');
     elements.selectedSpritesDisplayContainer.querySelectorAll('.sprite-preview-item.drag-over').forEach(el => el.classList.remove('drag-over'));

    draggedSpriteId = null; // Reset dragged item state
}