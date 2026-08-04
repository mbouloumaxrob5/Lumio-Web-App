export function hexToRgb(hex: string) {
  const h = (hex || '#000000').replace('#', '');
  const bigint = parseInt(h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

export function colorDistanceHex(a: string, b: string) {
  try {
    const A = hexToRgb(a || '#000000');
    const B = hexToRgb(b || '#000000');
    const d = Math.sqrt((A.r - B.r) ** 2 + (A.g - B.g) ** 2 + (A.b - B.b) ** 2);
    return d / Math.sqrt(255 * 255 * 3);
  } catch (e) {
    return 1;
  }
}
