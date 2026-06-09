import imageCompression from 'browser-image-compression';

/**
 * Compress an image file using browser-image-compression and return as Base64 Data URL.
 * Target: max 300KB.
 */
export async function compressImage(
  file: File | Blob,
  maxSizeMB = 0.3
): Promise<string> {
  const options = {
    maxSizeMB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };

  try {
    const fileToCompress = file instanceof File ? file : new File([file], 'image.jpg', { type: file.type || 'image/jpeg' });
    const compressedFile = await imageCompression(fileToCompress, options);
    
    // Convert back to Base64 for UI preview compatibility and ease of transport
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}
