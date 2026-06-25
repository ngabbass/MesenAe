import { getApiUrl } from './api-helper';

export async function uploadToCloudinary(
  bucket: string,
  fileName: string,
  file: File | Blob | string
): Promise<string | null> {
  try {
    let fileToUpload: File | Blob;

    if (typeof file === 'string' && file.startsWith('data:')) {
      const res = await fetch(file);
      fileToUpload = await res.blob();
    } else if (file instanceof Blob || file instanceof File) {
      fileToUpload = file;
    } else {
      return null;
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const paramsToSign = { folder: bucket };
    let signature = '';
    let timestamp = '';
    let apiKey = '';

    try {
      const signRes = await fetch(getApiUrl('/api/cloudinary-sign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign })
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error);
      signature = signData.signature;
      timestamp = signData.timestamp;
      apiKey = signData.apiKey;
    } catch (err: any) {
      console.error("Failed to get cloudinary signature:", err);
      throw new Error("Gagal mendapatkan signature upload.");
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', bucket);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error?.message || response.statusText);
    }

    return result.secure_url;
  } catch (err: any) {
    console.error('[Cloudinary] Exception during upload:', err);
    throw new Error(err.message || 'Terjadi kesalahan saat menghubungi server Cloudinary.');
  }
}

export async function deleteFromCloudinary(url: string | null | undefined): Promise<boolean> {
  if (!url || !url.includes('cloudinary.com')) return false;

  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return false;
    
    const pathAfterUpload = parts.slice(uploadIndex + 1);
    let publicIdWithExtension = pathAfterUpload.join('/');
    
    if (/^v\d+\//.test(publicIdWithExtension)) {
      publicIdWithExtension = publicIdWithExtension.replace(/^v\d+\//, '');
    }
    
    const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
    const publicId = lastDotIndex !== -1 ? publicIdWithExtension.substring(0, lastDotIndex) : publicIdWithExtension;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const paramsToSign = { public_id: publicId };
    let signature = '';
    let timestamp = '';
    let apiKey = '';

    try {
      const signRes = await fetch(getApiUrl('/api/cloudinary-sign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign })
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error);
      signature = signData.signature;
      timestamp = signData.timestamp;
      apiKey = signData.apiKey;
    } catch (err: any) {
      console.error("Failed to get cloudinary signature:", err);
      return false;
    }

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    return result.result === 'ok';
  } catch (err) {
    console.error('[Cloudinary] Exception during delete:', err);
    return false;
  }
}
