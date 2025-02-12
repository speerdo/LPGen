declare module 'colorthief' {
  export default class ColorThief {
    /**
     * Extract a single dominant color.
     * @param img HTML image element.
     */
    getColor(img: HTMLImageElement): number[];

    /**
     * Extract a palette of colors.
     * @param img HTML image element.
     * @param colorCount Number of colors to extract (default is 6).
     */
    getPalette(img: HTMLImageElement, colorCount?: number): number[][];
  }
} 