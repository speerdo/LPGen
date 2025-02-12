import { supabase } from './supabase';

// Add reliable Unsplash fallback images
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=1200&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80'
];

async function ensureStorageBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketName = 'project-assets';
    
    if (!buckets?.find(b => b.name === bucketName)) {
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
      });
      
      if (error) {
        console.error('Error creating storage bucket:', error);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error ensuring storage bucket:', error);
    return false;
  }
}

function isValidImageUrl(url: string): boolean {
  try {
    // Skip blob URLs (they're valid but temporary)
    if (url.startsWith('blob:')) {
      return true;
    }

    // Skip data URLs
    if (url.startsWith('data:')) {
      return false;
    }

    // For Unsplash images, just return true
    if (url.includes('images.unsplash.com')) {
      return true;
    }

    // Check if URL has a valid image extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const urlPath = new URL(url).pathname.toLowerCase();
    return validExtensions.some(ext => urlPath.endsWith(ext));
  } catch {
    return false;
  }
}

export async function downloadAndStoreImage(
  url: string,
  projectId: string,
  type: 'image' | 'logo' | 'screenshot' = 'image'
): Promise<string | null> {
  try {
    // Handle blob URLs (screenshots)
    if (url.startsWith('blob:')) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        URL.revokeObjectURL(url); // Clean up the blob URL

        const filename = `${projectId}/${Date.now()}-screenshot.jpg`;
        const { error } = await supabase.storage
          .from('project-assets')
          .upload(filename, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (error) {
          console.error('Error uploading screenshot:', error);
          return null;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('project-assets')
          .getPublicUrl(filename);

        return publicUrl;
      } catch (error) {
        console.error('Error processing screenshot:', error);
        return null;
      }
    }

    // Handle regular URLs
    if (url.startsWith('data:')) {
      return null;
    }

    if (url.includes('images.unsplash.com')) {
      return url.includes('?') ? url : `${url}?w=1200&q=80`;
    }

    if (!isValidImageUrl(url)) {
      console.error(`Invalid image URL format: ${url}`);
      return null;
    }

    const bucketExists = await ensureStorageBucket();
    if (!bucketExists) {
      console.error('Failed to ensure storage bucket exists');
      return null;
    }

    // Store asset record
    const { error } = await supabase.from('assets').insert({
      project_id: projectId,
      type,
      url,
      local_path: null
    });

    if (error) {
      console.error('Error storing asset record:', error);
      return null;
    }

    return url;
  } catch (error) {
    console.error('Error storing image:', error);
    return null;
  }
}

export async function storeProjectAssets(
  projectId: string,
  assets: { 
    images: string[];
    logo?: string;
    screenshot?: string;
  }
): Promise<{
  images: string[];
  logo?: string;
  screenshot?: string;
}> {
  const storedAssets = {
    images: [] as string[],
    logo: undefined as string | undefined,
    screenshot: undefined as string | undefined
  };

  // Process screenshot first if exists
  if (assets.screenshot) {
    console.log('Processing screenshot...');
    const storedScreenshot = await downloadAndStoreImage(assets.screenshot, projectId, 'screenshot');
    if (storedScreenshot) {
      storedAssets.screenshot = storedScreenshot;
    }
  }

  // Process logo if exists
  if (assets.logo) {
    console.log('Processing logo...');
    const storedLogo = await downloadAndStoreImage(assets.logo, projectId, 'logo');
    if (storedLogo) {
      storedAssets.logo = storedLogo;
    }
  }

  // Process images
  console.log('Processing images...');
  const imagePromises = assets.images.map(async (url) => {
    const storedUrl = await downloadAndStoreImage(url, projectId, 'image');
    return storedUrl;
  });

  const storedUrls = await Promise.all(imagePromises);
  storedAssets.images = storedUrls.filter((url): url is string => url !== null);

  // If no images were successfully stored, use fallback images
  if (storedAssets.images.length === 0) {
    storedAssets.images = FALLBACK_IMAGES;
  }

  return storedAssets;
}