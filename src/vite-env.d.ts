/// <reference types="vite/client" />

declare module 'gifenc' {
  type PaletteColor = number[];

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      clearAlpha?: boolean;
      clearAlphaColor?: number;
      clearAlphaThreshold?: number;
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      oneBitAlpha?: boolean | number;
    },
  ): PaletteColor[];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: PaletteColor[],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): {
    bytes(): Uint8Array;
    finish(): void;
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        delay?: number;
        dispose?: number;
        first?: boolean;
        palette?: PaletteColor[];
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
      },
    ): void;
  };
}
