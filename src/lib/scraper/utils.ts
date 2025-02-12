export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function resolveUrl(baseUrl: string, url: string): string {
  try {
    if (!url) return '';
    if (url.startsWith('data:')) return '';
    
    if (url.includes('local-credentialless.webcontainer-api.io')) {
      const urlParts = url.split('/');
      const assetPath = urlParts.slice(urlParts.indexOf('assets')).join('/');
      return new URL(assetPath, baseUrl).href;
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    return new URL(url, baseUrl).href;
  } catch (error) {
    console.error('Error resolving URL:', error);
    return '';
  }
}