import { supabase } from '../supabase';
import { storeProjectAssets } from '../storage';
import { makeScrapingBeeRequest } from './api';
import { extractFonts, findImages } from './extractors';
import { resolveUrl } from './utils';
import type { ScrapingLog, ExtractedAssets } from './types';

async function logScrapingResult(projectId: string, log: ScrapingLog): Promise<void> {
  console.log('[Scraping Log] Recording scraping result:', log);
  
  try {
    const { error } = await supabase.from('scraping_logs').insert({
      project_id: projectId,
      url: log.url,
      success: log.success,
      assets_found: log.assets_found,
      errors: log.errors,
      duration_ms: log.duration_ms,
      retries: log.retries
    });
    
    if (error) {
      console.error('[Scraping Log] Failed to store log:', error);
    }
  } catch (error) {
    console.error('[Scraping Log] Error storing log:', error);
  }
}

export async function scrapeWebsite(url: string, projectId: string, brand?: string): Promise<ExtractedAssets> {
  console.log('[Website Scraper] Starting website scrape:', { url, projectId, brand });
  const startTime = Date.now();
  const retryCount = 0;
  
  try {
    // Check for required environment variables
    if (!import.meta.env.VITE_SCRAPINGBEE_API_KEY || !import.meta.env.VITE_OPENAI_API_KEY) {
      throw new Error('Please click the "Connect to Supabase" button to set up your environment variables.');
    }

    console.log('[Website Scraper] Making ScrapingBee request...');
    const scrapingResult = await makeScrapingBeeRequest(url);
    console.log('[Scraper] Raw palette from ColorThief:', scrapingResult.palette);
    
    // Transform RGB arrays to CSS color strings
    const colors = scrapingResult.palette 
      ? scrapingResult.palette.map(rgb => `rgb(${rgb.join(', ')})`)
      : [];
    console.log('[Scraper] Transformed colors:', colors);

    const parser = new DOMParser();
    const doc = parser.parseFromString(scrapingResult.html, 'text/html');
    
    // Extract only the most important assets
    console.log('[Website Scraper] Extracting critical assets...');
    const fonts = extractFonts(doc);
    const { logo: logoUrl, heroImage: heroUrl, featureImages: featureUrls } = findImages(doc, brand);

    console.log('[Website Scraper] Resolving URLs...');
    const logo = logoUrl ? resolveUrl(url, logoUrl) : undefined;
    const images = [
      heroUrl ? resolveUrl(url, heroUrl) : undefined,
      ...featureUrls.map(imgUrl => resolveUrl(url, imgUrl))
    ].filter((img): img is string => !!img);

    console.log('[Website Scraper] Processing and storing assets...');
    const processedAssets = await storeProjectAssets(projectId, {
      images,
      logo,
      screenshot: scrapingResult.screenshot
    });

    await logScrapingResult(projectId, {
      timestamp: new Date().toISOString(),
      url,
      success: true,
      assets_found: {
        colors: 0, // We're not extracting colors anymore as they're less reliable
        fonts: fonts.length,
        images: processedAssets.images.length,
        logo: !!processedAssets.logo,
        screenshot: !!processedAssets.screenshot
      },
      duration_ms: Date.now() - startTime,
      retries: retryCount
    });

    const result = {
      fonts,
      images: processedAssets.images,
      logo: processedAssets.logo,
      screenshot: processedAssets.screenshot,
      screenshot_timestamp: scrapingResult.timestamp,
      palette: scrapingResult.palette,
      colors: colors,
    };
    
    console.log('[Website Scraper] Scraping completed successfully');
    return result;

  } catch (error) {
    console.error('[Website Scraper] Error during scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logScrapingResult(projectId, {
      timestamp: new Date().toISOString(),
      url,
      success: false,
      assets_found: {
        colors: 0,
        fonts: 0,
        images: 0,
        logo: false,
        screenshot: false
      },
      errors: [errorMessage],
      duration_ms: Date.now() - startTime,
      retries: retryCount
    });

    throw error;
  }
}