import { validateUrl } from './utils';
import type { ScrapingResult } from './types';
import { uploadScreenshot } from '../storage/uploadScreenshot';
import ColorThief from 'colorthief';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export async function makeScrapingBeeRequest(
  url: string,
  withJs: boolean = true,
  retryCount: number = 0,
  projectId: string = 'default-project-id'
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
        return makeScrapingBeeRequest(url, withJs, retryCount + 1, projectId);
      }

      throw new Error(`Failed to scrape website: ${errorText}`);
    }

    const html = await htmlResponse.text();
    const timestamp = new Date().toISOString();

    // Second request to get screenshot
    console.log('[ScrapingBee] Making screenshot request...');
    
    const screenshotParams = new URLSearchParams({
      'api_key': apiKey,
      'url': cleanUrl,
      'screenshot': 'true',
      'window_width': '1920',
      'window_height': '1080',
      'screenshot_full_page': 'true',
      'premium_proxy': 'true',
      'block_ads': 'true',
      'country_code': 'us',
      'render_js': 'true',
      'wait': '5000',
      'wait_for': '.header, header, #header, nav, .navbar, .logo, h1, .hero, .main',
      'wait_browser': 'networkidle0'
    });

    console.log('[ScrapingBee] Screenshot params:', {
      url: cleanUrl,
      screenshot: 'true',
      window_width: '1920',
      window_height: '1080',
      screenshot_full_page: 'true',
      premium_proxy: 'true',
      block_ads: 'true',
      country_code: 'us',
      render_js: 'true',
      wait: '5000',
      wait_for: '.header, header, #header, nav, .navbar, .logo, h1, .hero, .main',
      wait_browser: 'networkidle0'
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
            'api_key': apiKey,
            'url': cleanUrl,
            'screenshot': 'true',
            'window_width': '1920',
            'window_height': '1080',
            'screenshot_full_page': 'true',
            'premium_proxy': 'true',
            'block_ads': 'true',
            'wait': '10000',
            'wait_browser': 'load',
            'js_scenario': JSON.stringify({
              "instructions": [
                { "wait": 5000 },
                { "scroll_y": 100 },
                { "wait": 1000 },
                { "scroll_y": 200 },
                { "wait": 1000 },
                { "scroll_y": 0 },
                { "wait": 2000 }
              ]
            })
          });
          console.log('[ScrapingBee] Retry params:', {
            url: cleanUrl,
            screenshot: 'true',
            window_width: '1920',
            window_height: '1080',
            screenshot_full_page: 'true',
            premium_proxy: 'true',
            block_ads: 'true',
            wait: '10000',
            wait_browser: 'load',
          });
          console.log('[ScrapingBee] Retrying screenshot with longer wait and scrolling...');
          const fallbackResponse = await fetch(`${baseUrl}?${fallbackScreenshotParams.toString()}`);
          if (fallbackResponse.ok) {
            const fallbackBlob = await fallbackResponse.blob();
            if (fallbackBlob.size > 0 && await validateImage(fallbackBlob)) {
              const screenshotUrl = await uploadScreenshot(fallbackBlob, projectId);
              return { html, screenshot: screenshotUrl, timestamp, palette: [] };
            } else {
              console.log('[ScrapingBee] Second fallback also failed, trying DOM-based screenshot...');
              
              // Third attempt - Use DOM screenshot with different rendering parameters
              const domScreenshotParams = new URLSearchParams({
                'api_key': apiKey,
                'url': cleanUrl,
                'screenshot': 'true',
                'window_width': '1280',  // Use different dimensions
                'window_height': '800',
                'screenshot_full_page': 'false', // Only capture viewport
                'premium_proxy': 'true',
                'block_resource': '.svg,.woff,.woff2', // Block some resources to make page lighter
                'wait': '8000',
                'render_js': 'true',
                'js_scenario': JSON.stringify({
                  "instructions": [
                    { "wait": 3000 },
                    { "evaluate": "document.querySelectorAll('a[href*=\"cookie\"], .cookie, #cookie, .gdpr, #gdpr').forEach(el => el.remove())" }, // Remove cookie banners
                    { "evaluate": "document.querySelectorAll('.modal, #modal, .popup, #popup').forEach(el => el.remove())" }, // Remove modals
                    { "wait": 1000 },
                    { "scroll_y": 100 },
                    { "wait": 500 }
                  ]
                })
              });
              
              console.log('[ScrapingBee] DOM screenshot params:', {
                url: cleanUrl,
                screenshot: 'true',
                window_width: '1280',
                window_height: '800',
                screenshot_full_page: 'false',
                premium_proxy: 'true',
                block_resource: '.svg,.woff,.woff2',
                wait: '8000',
                render_js: 'true',
                js_scenario: 'Dynamic scroll and cleanup scenario'
              });
              const domResponse = await fetch(`${baseUrl}?${domScreenshotParams.toString()}`);
              
              if (domResponse.ok) {
                const domBlob = await domResponse.blob();
                if (domBlob.size > 0 && await validateImage(domBlob)) {
                  const screenshotUrl = await uploadScreenshot(domBlob, projectId);
                  return { html, screenshot: screenshotUrl, timestamp, palette: [] };
                }
              }
            }
          }
        } else {
          const screenshotUrl = await uploadScreenshot(screenshotBlob, projectId);
          // Extract site color palette using ColorThief.
          try {
            const palette = await extractSitePalette(screenshotUrl);
            console.log('[ScrapingBee] Got palette from ColorThief:', palette);
            return { html, screenshot: screenshotUrl, timestamp, palette };
          } catch (err) {
            console.error('Failed to extract color palette:', err);
            return { html, screenshot: screenshotUrl, timestamp, palette: [] };
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
    return { html, timestamp, palette: [] };

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
      return makeScrapingBeeRequest(url, withJs, retryCount + 1, projectId);
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
        console.log('[ValidateImage] Timeout - image validation failed');
        resolve(false);
      }
    }, 5000); // Timeout after 5000 ms (5 seconds)

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        
        // Check if image is valid (not just loaded but has actual content)
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (!context || img.width === 0 || img.height === 0) {
          console.log('[ValidateImage] Invalid image dimensions:', { width: img.width, height: img.height });
          URL.revokeObjectURL(url);
          resolve(false);
          return;
        }
        
        context.drawImage(img, 0, 0);
        
        // Check if image is just white/blank by sampling pixel data
        try {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Calculate average brightness and check if it's very bright (close to white)
          let totalBrightness = 0;
          let totalPixels = 0;
          
          // Sample at most 1000 pixels for performance
          const pixelStep = Math.max(1, Math.floor(data.length / 4000));
          
          for (let i = 0; i < data.length; i += pixelStep * 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate brightness 
            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;
            totalPixels++;
          }
          
          const avgBrightness = totalBrightness / totalPixels;
          const isBlank = avgBrightness > 240; // Very close to white
          
          console.log('[ValidateImage] Image analysis:', { 
            avgBrightness,
            isBlank,
            width: img.width,
            height: img.height,
            sampledPixels: totalPixels
          });
          
          URL.revokeObjectURL(url);
          resolve(!isBlank);
        } catch (error) {
          console.error('[ValidateImage] Error analyzing image:', error);
          URL.revokeObjectURL(url);
          resolve(false);
        }
      }
    };

    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        console.log('[ValidateImage] Error loading image');
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
  return new Promise<number[][]>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error('[ColorThief] Timeout while extracting palette');
        resolve([]); // Return empty array instead of rejecting
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
          // If palette is null or undefined, return an empty array
          if (!palette) {
            console.log('[ColorThief] Palette returned null, using empty array');
            resolve([]);
            return;
          }
          resolve(palette);
        } catch (error) {
          console.error('[ColorThief] Error extracting palette:', error);
          resolve([]); // Return empty array instead of rejecting
        }
      }
    };

    img.onerror = (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        console.error('[ScrapingBee] extractSitePalette error:', err);
        resolve([]); // Return empty array instead of rejecting
      }
    };

    img.src = screenshotUrl;
  });
}
