import { supabase } from '../supabase'; // adjust the path if necessary

/**
 * Uploads a logo file to Supabase and returns a public URL.
 * @param logoFile The File representing the logo.
 * @param projectId Unique identifier for the project (or asset grouping)
 * @returns The public URL for the uploaded logo.
 */
export async function uploadLogo(logoFile: File, projectId: string): Promise<string> {
  // Log the file size to verify the logo is not empty.
  console.log('Logo file size:', logoFile.size);
  if (logoFile.size === 0) {
    throw new Error('Logo file is empty');
  }

  // Generate a unique filename using the current timestamp.
  const fileName = `${Date.now()}-logo.jpg`;
  // Define a path for this asset – for example, grouping by projectId.
  const filePath = `${projectId}/${fileName}`;

  // Upload the logo file to the 'project-assets' bucket.
  const { error } = await supabase
    .storage
    .from('project-assets')
    .upload(filePath, logoFile, {
      contentType: logoFile.type, // Ensure correct mimetype (e.g., image/jpeg)
    });

  if (error) {
    console.error('Error uploading logo:', error);
    throw error;
  }

  // Retrieve the public URL from Supabase.
  const { data } = supabase
    .storage
    .from('project-assets')
    .getPublicUrl(filePath);

  const publicUrl = data.publicUrl;
  console.log('Uploaded logo public URL:', publicUrl);
  return publicUrl;
}
