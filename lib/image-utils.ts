import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Vibrant from 'node-vibrant';

export async function generateBlurDataUrl(filePath: string, size = 32) {
  const buffer = await sharp(filePath).resize(size).png({ quality: 50 }).toBuffer();
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

export async function extractPalette(filePath: string) {
  try {
    const palette = await Vibrant.from(filePath).getPalette();
    const entries: { color: string; weight: number }[] = [];
    for (const swatchName of Object.keys(palette)) {
      const swatch = (palette as any)[swatchName];
      if (swatch) {
        entries.push({ color: swatch.getHex(), weight: swatch.getPopulation() });
      }
    }
    // normalize weights
    const total = entries.reduce((s, e) => s + e.weight, 0) || 1;
    return entries.map((e) => ({ color: e.color, weight: e.weight / total }));
  } catch (err) {
    console.warn('Palette extraction failed for', filePath, err?.message || err);
    return [{ color: '#cccccc', weight: 1 }];
  }
}
