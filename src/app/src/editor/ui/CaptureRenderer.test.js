import {describe, it, expect} from 'vitest';
import {scriptBounds} from './CaptureRenderer.js';

describe('full program image bounds', () => {
    it('includes blocks beyond both viewport edges and negative positions', () => {
        const bounds = scriptBounds([{x: -300, y: -80, width: 60, height: 70},
            {x: 1800, y: 1200, width: 100, height: 100}]);
        expect(bounds.x).toBeLessThan(-300);
        expect(bounds.y).toBeLessThan(-80);
        expect(bounds.x + bounds.width).toBeGreaterThan(1900);
        expect(bounds.y + bounds.height).toBeGreaterThan(1300);
    });
    it('scales large programs without cropping them', () => {
        const bounds = scriptBounds([{x: 0, y: 0, width: 20000, height: 30000}]);
        expect(bounds.width * bounds.scale).toBeLessThanOrEqual(4096);
        expect(bounds.height * bounds.scale).toBeLessThanOrEqual(16384);
        expect(bounds.width * bounds.height * bounds.scale ** 2).toBeLessThanOrEqual(32000001);
    });
    it('provides an explicit image for actors without blocks', () => {
        expect(scriptBounds([])).toMatchObject({width: 480, height: 120, scale: 1});
    });
});
