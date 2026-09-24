/**
 * Owns the canvas's pan/zoom state and keeps the SVG viewBox and zoom readout
 * in sync with it.
 */
export class CameraController {
    static MIN_ZOOM = 0.3;
    static MAX_ZOOM = 3.0;
    static WORLD_CENTER_X = 500;
    static WORLD_CENTER_Y = 300;

    /**
     * @param {SVGSVGElement} svgElement
     * @param {HTMLElement} zoomDisplayElement
     */
    constructor(svgElement, zoomDisplayElement) {
        this.svgElement = svgElement;
        this.zoomDisplayElement = zoomDisplayElement;
        this.panPositionX = 0;
        this.panPositionY = 0;
        this.zoom = 1.0;
    }

    /**
     * @returns {{positionX: number, positionY: number}} The world-space point currently centered in the viewport.
     */
    getViewCenter() {
        return {
            positionX: CameraController.WORLD_CENTER_X - this.panPositionX,
            positionY: CameraController.WORLD_CENTER_Y - this.panPositionY
        };
    }

    /**
     * Recomputes the SVG viewBox from the current pan position and zoom level.
     */
    updateViewBox() {
        const canvasWidth = this.svgElement.clientWidth || 1000;
        const canvasHeight = this.svgElement.clientHeight || 600;
        if (canvasWidth === 0 || canvasHeight === 0) return;

        const viewWidth = canvasWidth / this.zoom;
        const viewHeight = canvasHeight / this.zoom;
        const center = this.getViewCenter();
        const viewX = center.positionX - viewWidth / 2;
        const viewY = center.positionY - viewHeight / 2;

        this.svgElement.setAttribute('viewBox', `${viewX} ${viewY} ${viewWidth} ${viewHeight}`);
    }

    /**
     * Sets pan and zoom so the given world-space bounds are fully visible and
     * centered in a canvas of the given pixel size, without zooming in past
     * 100% when the canvas already has room to spare. Used to keep diagrams
     * fully visible on narrow or portrait canvases that a fixed 100% zoom
     * would otherwise clip.
     * @param {{minX: number, maxX: number, minY: number, maxY: number}} bounds
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     * @param {number} [padding]
     */
    fitToContent(bounds, canvasWidth, canvasHeight, padding = 60) {
        if (canvasWidth <= 0 || canvasHeight <= 0) return;

        const contentWidth = Math.max(bounds.maxX - bounds.minX, 1) + padding * 2;
        const contentHeight = Math.max(bounds.maxY - bounds.minY, 1) + padding * 2;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        const zoomToFitWidth = canvasWidth / contentWidth;
        const zoomToFitHeight = canvasHeight / contentHeight;
        this.zoom = Math.min(CameraController.MAX_ZOOM, Math.max(CameraController.MIN_ZOOM, Math.min(zoomToFitWidth, zoomToFitHeight, 1)));

        this.panPositionX = CameraController.WORLD_CENTER_X - centerX;
        this.panPositionY = CameraController.WORLD_CENTER_Y - centerY;

        this.zoomDisplayElement.textContent = `${Math.round(this.zoom * 100)}%`;
        this.updateViewBox();
    }

    /**
     * @param {number} delta
     */
    changeZoom(delta) {
        this.zoom = Math.min(CameraController.MAX_ZOOM, Math.max(CameraController.MIN_ZOOM, this.zoom + delta));
        this.zoomDisplayElement.textContent = `${Math.round(this.zoom * 100)}%`;
        this.updateViewBox();
    }

    /**
     * Restores a previously saved camera state, such as one loaded from a project file.
     * The zoom is clamped to the supported range: a hand-edited or corrupt file can
     * carry 0, a negative value, or a huge one, which would produce an invalid viewBox
     * (e.g. infinite dimensions at zoom 0) and a blank canvas.
     * @param {number} panPositionX
     * @param {number} panPositionY
     * @param {number} zoom
     */
    restore(panPositionX, panPositionY, zoom) {
        this.panPositionX = panPositionX;
        this.panPositionY = panPositionY;
        this.zoom = Math.min(CameraController.MAX_ZOOM, Math.max(CameraController.MIN_ZOOM, zoom));
        this.zoomDisplayElement.textContent = `${Math.round(this.zoom * 100)}%`;
        this.updateViewBox();
    }
}
