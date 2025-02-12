export function extractColors(doc: Document): string[] {
  console.log('[Color Extractor] Starting color extraction');
  const colors = new Set<string>();
  
  const isValidColor = (color: string): boolean => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$|^rgb\(.*\)$|^rgba\(.*\)$|^hsl\(.*\)$|^hsla\(.*\)$/.test(color);
  };

  // Extract from inline styles
  const elementsWithStyle = doc.querySelectorAll('[style]');
  console.log('[Color Extractor] Found elements with inline styles:', elementsWithStyle.length);
  
  elementsWithStyle.forEach(element => {
    const style = element.getAttribute('style') || '';
    const colorProps = ['color:', 'background-color:', 'border-color:', 'background:'];
    colorProps.forEach(prop => {
      const regex = new RegExp(`${prop}\\s*([^;]+)`, 'gi');
      const matches = style.match(regex);
      if (matches) {
        matches.forEach(match => {
          const color = match.split(':')[1].trim();
          if (isValidColor(color)) {
            colors.add(color);
          }
        });
      }
    });
  });

  // Extract from style tags
  const styleSheets = doc.querySelectorAll('style');
  console.log('[Color Extractor] Found style tags:', styleSheets.length);
  
  styleSheets.forEach(sheet => {
    const cssText = sheet.textContent || '';
    
    // Match different color formats
    [
      /#[0-9A-Fa-f]{3,6}\b/g,
      /rgb\([^)]+\)|rgba\([^)]+\)/g,
      /hsl\([^)]+\)|hsla\([^)]+\)/g
    ].forEach(pattern => {
      const matches = cssText.match(pattern) || [];
      matches.forEach(color => {
        if (isValidColor(color)) {
          colors.add(color);
        }
      });
    });
  });

  const extractedColors = Array.from(colors);
  console.log('[Color Extractor] Found colors:', extractedColors);
  return extractedColors;
}

export function extractFonts(doc: Document): string[] {
  console.log('[Font Extractor] Starting font extraction');
  const fonts = new Set<string>();
  const genericFonts = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
    'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Liberation Sans',
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'
  ]);

  // Extract from inline styles
  const elementsWithStyle = doc.querySelectorAll('[style]');
  console.log('[Font Extractor] Found elements with inline styles:', elementsWithStyle.length);
  
  elementsWithStyle.forEach(element => {
    const style = element.getAttribute('style') || '';
    const fontMatch = style.match(/font-family:\s*([^;]+)/i);
    if (fontMatch) {
      fontMatch[1].split(',')
        .map(font => font.trim().replace(/['"]/g, ''))
        .forEach(font => fonts.add(font));
    }
  });

  // Extract from style tags
  const styleSheets = doc.querySelectorAll('style');
  console.log('[Font Extractor] Found style tags:', styleSheets.length);
  
  styleSheets.forEach(sheet => {
    const cssText = sheet.textContent || '';
    const fontMatches = cssText.match(/font-family:\s*([^;}]+)/g) || [];
    fontMatches.forEach(match => {
      match.replace('font-family:', '')
        .split(',')
        .map(font => font.trim().replace(/['"]/g, ''))
        .forEach(font => fonts.add(font));
    });
  });

  // Extract from Google Fonts
  const googleFontsLinks = doc.querySelectorAll('link[href*="fonts.googleapis.com"]');
  console.log('[Font Extractor] Found Google Fonts links:', googleFontsLinks.length);
  
  googleFontsLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const fontFamilies = href.match(/family=([^&]+)/);
      if (fontFamilies) {
        decodeURIComponent(fontFamilies[1])
          .split('|')
          .map(family => family.split(':')[0].replace(/\+/g, ' '))
          .forEach(font => fonts.add(font));
      }
    }
  });

  const extractedFonts = Array.from(fonts).filter(font => !genericFonts.has(font.toLowerCase()));
  console.log('[Font Extractor] Found fonts:', extractedFonts);
  return extractedFonts;
}

export function findImages(doc: Document, brand?: string) {
  console.log('[Image Finder] Starting image search', { brand });
  
  // Improved logic to find the logo
  const findLogo = (): string | undefined => {
    console.log('[Image Finder] Searching for logo...');
    // Search in header or navigation containers including additional selectors.
    const header = doc.querySelector('header, nav, .navbar, .logo');
    if (!header) {
      console.log('[Image Finder] No header or navigation element found');
      return undefined;
    }

    // 1. Check for <img> elements whose src, alt, or class contain "logo", "brand", or the brand name.
    const imgCandidates = Array.from(header.querySelectorAll('img')).filter(img => {
      const src = (img.getAttribute('src') || '').toLowerCase();
      const alt = (img.getAttribute('alt') || '').toLowerCase();
      const className = (img.className || '').toLowerCase();
      const terms = ['logo', 'brand', ...(brand ? [brand.toLowerCase()] : [])];
      return terms.some(term => src.includes(term) || alt.includes(term) || className.includes(term));
    });
    if (imgCandidates.length > 0) {
      const logoImg = imgCandidates[0];
      const logoSrc = logoImg.getAttribute('src') || logoImg.getAttribute('data-src') || undefined;
      console.log('[Image Finder] Found logo from <img>:', logoSrc);
      return logoSrc;
    }

    // 2. Look for inline SVG elements that might represent a logo.
    const svgCandidates = Array.from(header.querySelectorAll('svg')).filter(svg => {
      const ariaLabel = svg.getAttribute('aria-label')?.toLowerCase() || '';
      const title = svg.querySelector('title')?.textContent?.toLowerCase() || '';
      const className = (svg.getAttribute('class') || '').toLowerCase();
      const terms = ['logo', 'brand', ...(brand ? [brand.toLowerCase()] : [])];
      return terms.some(term => ariaLabel.includes(term) || title.includes(term) || className.includes(term));
    });
    if (svgCandidates.length > 0) {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgCandidates[0]);
      const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(svgString);
      console.log('[Image Finder] Found logo from <svg>: Data URL generated.');
      return svgDataUrl;
    }

    // 3. As fallback, if a logo is embedded inside an anchor element.
    const anchorCandidates = Array.from(header.querySelectorAll('a')).filter(a => {
      const text = (a.textContent || '').toLowerCase();
      return text.includes('logo') || text.includes('brand') || (brand ? text.includes(brand.toLowerCase()) : false);
    });
    if (anchorCandidates.length > 0) {
      const imgInAnchor = anchorCandidates[0].querySelector('img');
      if (imgInAnchor) {
        const logoSrc = imgInAnchor.getAttribute('src') || imgInAnchor.getAttribute('data-src') || undefined;
        console.log('[Image Finder] Found logo from anchor:', logoSrc);
        return logoSrc;
      }
    }

    console.log('[Image Finder] No logo found');
    return undefined;
  };

  // Find hero image
  const findHeroImage = (): string | undefined => {
    console.log('[Image Finder] Searching for hero image...');
    const heroSection = doc.querySelector('.hero, [class*="hero"], #hero, [id*="hero"]');
    if (heroSection) {
      const heroImg = heroSection.querySelector('img');
      if (heroImg) {
        const heroSrc = heroImg.getAttribute('src') || heroImg.getAttribute('data-src') || undefined;
        console.log('[Image Finder] Found hero image:', heroSrc);
        return heroSrc;
      }
    }
    console.log('[Image Finder] No hero image found');
    return undefined;
  };

  // Find feature images
  const findFeatureImages = (): string[] => {
    console.log('[Image Finder] Searching for feature images...');
    const images = Array.from(doc.querySelectorAll('.features, [class*="feature"], .cards, [class*="card"]'))
      .flatMap(section => Array.from(section.querySelectorAll('img')))
      .map(img => img.getAttribute('src') || img.getAttribute('data-src'))
      .filter((src): src is string => !!src)
      .filter(src => /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(src))
      .slice(0, 3);
    
    console.log('[Image Finder] Found feature images:', images);
    return images;
  };

  const results = {
    logo: findLogo(),
    heroImage: findHeroImage(),
    featureImages: findFeatureImages()
  };

  console.log('[Image Finder] Final results:', results);
  return results;
}