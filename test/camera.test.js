import { describe, it, expect } from 'vitest';
import { CameraController } from '../js/interaction/CameraController.js';

/** Minimal DOM stand-ins: CameraController only sets attributes and text. */
function makeCamera() {
    const svgStub = {
        clientWidth: 1000,
        clientHeight: 600,
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; }
    };
    const zoomDisplayStub = { textContent: '' };
    return new CameraController(svgStub, zoomDisplayStub);
}

describe('CameraController.restore', () => {
    it('keeps a valid zoom as-is', () => {
        const camera = makeCamera();
        camera.restore(10, -20, 1.5);
        expect(camera.zoom).toBe(1.5);
        expect(camera.panPositionX).toBe(10);
        expect(camera.panPositionY).toBe(-20);
    });

    it('clamps a zoom of 0 up to the minimum instead of producing an infinite viewBox', () => {
        const camera = makeCamera();
        camera.restore(0, 0, 0);
        expect(camera.zoom).toBe(CameraController.MIN_ZOOM);
        const viewBox = camera.svgElement.attributes.viewBox;
        expect(viewBox).not.toMatch(/Infinity|NaN/);
        expect(camera.zoomDisplayElement.textContent).toBe('30%');
    });

    it('clamps a negative zoom up to the minimum', () => {
        const camera = makeCamera();
        camera.restore(0, 0, -2);
        expect(camera.zoom).toBe(CameraController.MIN_ZOOM);
        const parts = camera.svgElement.attributes.viewBox.split(' ').map(Number);
        expect(parts.every(Number.isFinite)).toBe(true);
        expect(parts[2]).toBeGreaterThan(0);
        expect(parts[3]).toBeGreaterThan(0);
    });

    it('clamps a huge zoom down to the maximum', () => {
        const camera = makeCamera();
        camera.restore(0, 0, 1e9);
        expect(camera.zoom).toBe(CameraController.MAX_ZOOM);
    });
});
