import type { WebsiteStyle } from '../../types/database';

export type AssetPriority = 'high' | 'medium' | 'low';

export interface ScrapingLog {
  timestamp: string;
  url: string;
  success: boolean;
  assets_found: {
    colors: number;
    fonts: number;
    images: number;
    logo: boolean;
    screenshot: boolean;
  };
  errors?: string[];
  duration_ms: number;
  retries: number;
}

export interface ScrapingResult {
  html: string;
  screenshot?: string;
  logo?: string;
  timestamp?: string;
  palette?: number[][];
}

export interface ExtractedAssets extends WebsiteStyle {
  screenshot?: string;
  screenshot_timestamp?: string;
  palette?: number[][];
  colors?: string[];
}
