import type { WebsiteStyle } from '../../types/database';

export function createSystemPrompt(): string {
  return `You are an expert web developer and designer.
          You can accept and analyze images and screenshots. Your task is to analyze a screenshot of a brand website
          with a fresh perspective while maintaining brand consistency. Focus on recreating
          the layout, spacing, and visual hierarchy while using Lorem Ipsum text.`;
}

export function createStyleGuide(style?: WebsiteStyle): string {
  if (!style) return '';
  
  return `
Style Guide:
${style.fonts?.length ? `Typography (use exactly):
${style.fonts.map(font => `- ${font}`).join('\n')}` : 'Use system fonts'}

${style.logo ? `Brand Logo: ${style.logo}` : ''}

${style.images?.length ? `Visual Assets:
${style.images.map(img => `- ${img}`).join('\n')}` : ''}`;
}

export function createFullPrompt(prompt: string, style?: WebsiteStyle, screenshot?: string, palette?: number[][]): string {
  const screenshotReference = screenshot ? `
 Screenshot Reference (HIGHEST PRIORITY):
 Please carefully review the attached screenshot for its layout, colors, buttons, and border radius.
 Screenshot URL: ${screenshot}
 ` : '';

 let paletteInstructions = '';
 if (palette && palette.length > 0) {
   paletteInstructions = `
 Color Palette:
 ${palette.map(color => `- rgb(${color.join(', ')})`).join('\n')}
 `;
 } else if (style?.colors && style.colors.length > 0) {
   paletteInstructions = `
 Color Palette:
 ${style.colors.map((color: string) => `- ${color}`).join('\n')}
 `;
 }
 

  const styleGuide = createStyleGuide(style);
  const supplementaryStyle = styleGuide ? `
 Optional Supplementary Style Guide:
 ${styleGuide}` : '';

  let userDesignCriteria = '';
  if (style && (style.dominantColor || style.primaryFont)) {
    userDesignCriteria = `
 User Selected Design Criteria:
 ${style.dominantColor ? `- Dominant Color: ${style.dominantColor}` : ''}
 ${style.primaryFont ? `- Primary Font: ${style.primaryFont}` : ''}
 `;
  }

  return `Create a high-converting, single-page landing page that captures the essence and branding of the screenshot referenced website.
          Focus primarily on replicating the design elements provided in the attached screenshot and adhering to the specified
          color palette using backgrounds, border-radius, etc. seen in the screenshot. Use the supplementary style information
          below as additional guidance, but if those details are
          missing or incomplete, rely on the screenshot's design and provided color palette.
 
          ${screenshotReference}
          ${paletteInstructions}
          ${supplementaryStyle}
          ${userDesignCriteria}
          
          Requirements:
          1. Create a modern, responsive, and semantic HTML5 layout.
          2. The navigation bar should be white background or match the screenshot.
          3. Ensure accessibility compliance.
          4. Ensure there are 4 defined sections outside of the header navigation bar: hero, content, content-2, footer.
          5. Section background colors, widths, max-width, and margins should match the screenshot.
          6. Hero section should include an image provided in Visual Assets.
          7. Use Lorem Ipsum for all text content unless otherwise specified, at least 2 paragraphs.
          8. Do not include any navigation or extraneous links in the header except the logo.
          9. Button styles and colors should match the screenshot.
          10. Place the logo in the top left corner of the page unless otherwise specified or if the screenshot shows a different location.
          11. Use Google fonts in the head element for any provided fonts that require it.
          12. Update any years to the current year (${new Date().getFullYear()}).

          
          Additional Content Requirements:
          ${prompt}
          
          Respond ONLY with the complete HTML code including embedded CSS. Do not include any explanations or markdown.`;
}
