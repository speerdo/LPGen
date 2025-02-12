import { supabase } from '../supabase'; // adjust path as needed

/**
 * Uploads a screenshot file to Supabase and returns a public URL.
 * @param screenshotBlob The Blob representing the screenshot.
 * @param projectId Unique identifier for the project (or asset grouping)
 * @returns The public URL for the uploaded screenshot.
 */
export async function uploadScreenshot(screenshotBlob: Blob, projectId: string): Promise<string> {
  // Debug: log the blob size to verify the screenshot is not empty.
  console.log('Screenshot file size:', screenshotBlob.size);
  if (screenshotBlob.size === 0) {
    throw new Error('Screenshot file is empty');
  }

  // Generate a unique filename (using the current timestamp).
  const fileName = `${Date.now()}-screenshot.jpg`;
  // Define a path for this asset – for example, grouping by projectId.
  const filePath = `${projectId}/${fileName}`;

  // Upload the screenshot blob to the 'project-assets' bucket.
  const { error } = await supabase
    .storage
    .from('project-assets')
    .upload(filePath, screenshotBlob, {
      contentType: screenshotBlob.type, // Ensure the correct mimetype (e.g., image/jpeg)
    });

  if (error) {
    console.error('Error uploading screenshot:', error);
    throw error;
  }

  // Retrieve the public URL from Supabase.
  const { data } = supabase
    .storage
    .from('project-assets')
    .getPublicUrl(filePath);

  const publicUrl = data.publicUrl;
  console.log('Uploaded screenshot public URL:', publicUrl);
  return publicUrl;
} 
