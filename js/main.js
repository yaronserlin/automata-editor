/**
 * Initializes the default example state when the application loads.
 */
function initExample() {
    // The first objects are placed at fixed default coordinate points.
    const startNode = addNode(350, 300);
    startNode.isStart = true;

    const acceptNode = addNode(650, 300);
    acceptNode.isAccept = true;

    addEdge(startNode.id, acceptNode.id, "a");

    renderAll();
    updateViewBox();

    // To ensure UI correctness, frame the camera again after Tailwind finishes laying out the grid.
    setTimeout(updateViewBox, 100);
    window.addEventListener('resize', updateViewBox);
}

initExample();
