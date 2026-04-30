import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadPhoto(base64Data, folder = 'campboss') {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 1200, crop: 'limit' },
      ],
    });
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (err) {
    console.error('[Cloudinary] Upload failed:', err.message);
    return { success: false, error: err.message };
  }
}