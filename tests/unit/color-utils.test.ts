import { describe, it, expect } from 'vitest';
import { hexToRgb, colorDistanceHex } from '../../lib/color-utils';

describe('color utils', () => {
  it('parses hex to rgb', () => {
    const rgb = hexToRgb('#ff0000');
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it('calculates distance between same colors as 0', () => {
    const d = colorDistanceHex('#ffffff', '#ffffff');
    expect(d).toBeCloseTo(0, 5);
  });

  it('distance between black and white is close to 1', () => {
    const d = colorDistanceHex('#000000', '#ffffff');
    expect(d).toBeGreaterThan(0.9);
  });
});
