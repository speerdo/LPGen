import { validateUrl } from './utils';
import type { ScrapingResult } from './types';
import { uploadScreenshot } from '../storage/uploadScreenshot';
import ColorThief from 'colorthief';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export async function makeScrapingBeeRequest(
  url: string,
  withJs: boolean = true,
  retryCount: number = 0
): Promise<ScrapingResult> {
  console.log('[ScrapingBee] Starting request:', { url, withJs, retryCount });
  
  const apiKey = import.meta.env.VITE_SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.error('[ScrapingBee] API key not configured');
    throw new Error('ScrapingBee API key is not configured');
  }

  const cleanUrl = url.trim();
  if (!validateUrl(cleanUrl)) {
    console.error('[ScrapingBee] Invalid URL format:', cleanUrl);
    throw new Error('Invalid URL format. Please use http:// or https://');
  }

  const baseUrl = 'https://app.scrapingbee.com/api/v1/';
  const params = new URLSearchParams({
    'api_key': apiKey,
    'url': cleanUrl,
    'render_js': withJs.toString(),
    'premium_proxy': 'true',
    'block_ads': 'true',
    'country_code': 'us',
    'device': 'desktop',
    'timeout': '30000',
    'stealth_proxy': 'true'
  });

  try {
    // First request to get HTML content
    console.log('[ScrapingBee] Making HTML request...');
    const htmlResponse = await fetch(`${baseUrl}?${params.toString()}`);
    
    if (!htmlResponse.ok) {
      const errorText = await htmlResponse.text();
      console.error('[ScrapingBee] HTML request failed:', {
        status: htmlResponse.status,
        error: errorText
      });
      
      if (htmlResponse.status === 401 && errorText.includes('API calls limit reached')) {
        throw new Error('API_LIMIT_REACHED');
      }

      if (htmlResponse.status === 500 && retryCount < MAX_RETRIES) {
        console.log(`[ScrapingBee] Server error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return makeScrapingBeeRequest(url, withJs, retryCount + 1);
      }

      throw new Error(`Failed to scrape website: ${errorText}`);
    }

    const html = await htmlResponse.text();
    const timestamp = new Date().toISOString();

    // Second request to get screenshot
    console.log('[ScrapingBee] Making screenshot request...');
    const screenshotParams = new URLSearchParams({
      ...Object.fromEntries(params),
      'screenshot': 'true',
      'window_width': '1920',
      'window_height': '1080',
      'screenshot_full_page': 'true',
      'wait': '5000',
      'wait_browser': 'load',
      'js_scenario': JSON.stringify({
         "instructions": [
           { "wait": 3000 },
           { "wait_for_and_click": "//*[contains(text(), 'Accept')]" },
           { "wait": 2000 }
         ]
      })
    });

    const screenshotResponse = await fetch(`${baseUrl}?${screenshotParams.toString()}`);
    
    if (screenshotResponse.ok) {
      const screenshotBlob = await screenshotResponse.blob();
      if (screenshotBlob.size > 0) {
        const isValid = await validateImage(screenshotBlob);
        if (!isValid) {
          console.error('[ScrapingBee] Screenshot is invalid (blank or corrupted image detected)');
          // Fallback attempt: wait longer to let page load and then re-request the screenshot.
          const fallbackScreenshotParams = new URLSearchParams({
              ...Object.fromEntries(params),
              'screenshot': 'true',
              'window_width': '1920',
              'window_height': '1080',
              'screenshot_full_page': 'true',
              'wait': '10000',
              'wait_browser': 'load'
          });
          console.log('[ScrapingBee] Retrying screenshot with longer wait...');
          const fallbackResponse = await fetch(`${baseUrl}?${fallbackScreenshotParams.toString()}`);
          if (fallbackResponse.ok) {
            const fallbackBlob = await fallbackResponse.blob();
            if (fallbackBlob.size > 0 && await validateImage(fallbackBlob)) {
              const projectId = 'default-project-id';
              const screenshotUrl = await uploadScreenshot(fallbackBlob, projectId);
              return { html, screenshot: screenshotUrl, timestamp };
            }
          }
        } else {
          const projectId = 'default-project-id';
          const screenshotUrl = await uploadScreenshot(screenshotBlob, projectId);
          // Extract site color palette using ColorThief.
          let palette: number[][] = [];
          try {
            palette = await extractSitePalette(screenshotUrl);
            console.log('[ScrapingBee] Got palette from ColorThief:', palette);
            const dominantColor = palette.length > 0 ? palette[0] : [];
            console.log('[ScrapingBee] Dominant color:', dominantColor);
            return { html, screenshot: screenshotUrl, timestamp, palette };
          } catch (err) {
            console.error('Failed to extract color palette:', err);
            return { html, screenshot: screenshotUrl, timestamp };
          }
        }
      } else {
        console.log('[ScrapingBee] Screenshot blob size is zero');
      }
    } else {
      console.error('[ScrapingBee] Screenshot request failed:', await screenshotResponse.text());
    }

    // Return HTML only if screenshot fails
    console.log('[ScrapingBee] Continuing with HTML only');
    return { html, timestamp };

  } catch (error) {
    console.error('[ScrapingBee] Request failed:', error);
    
    if (error instanceof Error && error.message === 'API_LIMIT_REACHED') {
      throw error;
    }

    if (retryCount < MAX_RETRIES && (
      error instanceof Error && (
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('failed to fetch')
      )
    )) {
      console.log(`[ScrapingBee] Network error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return makeScrapingBeeRequest(url, withJs, retryCount + 1);
    }
    
    throw new Error('Failed to scrape website. Please check the URL and try again.');
  }
}

// Helper function to validate that the blob contains a valid image with a timeout.
async function validateImage(blob: Blob): Promise<boolean> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(url);
        resolve(false);
      }
    }, 5000); // Timeout after 5000 ms (5 seconds)

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(true);
      }
    };

    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(false);
      }
    };

    img.src = url;
  });
}

// Helper function to extract a color palette from the screenshot using ColorThief,
// with a timeout to prevent hanging.
async function extractSitePalette(screenshotUrl: string): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error('[ColorThief] Timeout while extracting palette');
        reject(new Error('extractSitePalette: timeout'));
      }
    }, 5000);

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        try {
          const colorThief = new ColorThief();
          const palette = colorThief.getPalette(img, 6);
          console.log('[ColorThief] Successfully extracted palette:', palette);
          resolve(palette);
        } catch (error) {
          console.error('[ColorThief] Error extracting palette:', error);
          reject(error);
        }
      }
    };

    img.onerror = (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        console.error('[ScrapingBee] extractSitePalette error:', err);
        reject(err);
      }
    };

    img.src = screenshotUrl;
  });
}
