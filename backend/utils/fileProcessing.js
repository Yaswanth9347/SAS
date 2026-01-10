const path = require('path');
const fs = require('fs').promises;
const { optimizePhoto, generateThumbnail } = require('./imageOptimizer');

// ============================================
// FILE PROCESSING UTILITIES
// Ready for Sharp (images) and FFmpeg (videos)
// Sharp is now integrated for image optimization
// ============================================

/**
 * Extract metadata from uploaded file
 * @param {Object} file - Multer file object
 * @returns {Object} - File metadata object
 */
function extractFileMetadata(file) {
  // Convert absolute file path to web-accessible relative path
  // file.path is like: C:/Users/.../backend/uploads/photos/...
  // We need: /uploads/photos/...
  let webPath = file.path;

  // Normalize path separators to forward slashes
  webPath = webPath.replace(/\\/g, "/");

  // Extract the path starting from /uploads
  const uploadsIndex = webPath.indexOf("/uploads");
  if (uploadsIndex !== -1) {
    webPath = webPath.substring(uploadsIndex);
  } else {
    // Fallback: try to find uploads without leading slash
    const uploadsIndexAlt = webPath.indexOf("uploads");
    if (uploadsIndexAlt !== -1) {
      webPath = "/" + webPath.substring(uploadsIndexAlt);
    }
  }

  return {
    filename: file.filename,
    originalName: file.originalname,
    path: webPath, // Now stores web-accessible path like /uploads/photos/...
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date(),
    storageType: "local",
    processed: false,
  };
}

/**
 * Process image file (resize, optimize, extract dimensions)
 * Now using Sharp library for image optimization
 * @param {string} filePath - Path to image file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing results with metadata
 */
async function processImage(filePath, options = {}) {
    try {
        console.log('Processing image:', filePath);
        
        // Optimize the photo using Sharp
        const optimizeResult = await optimizePhoto(filePath);
        
        if (!optimizeResult.success) {
            console.error('Image optimization failed:', optimizeResult.error);
            return {
                width: null,
                height: null,
                format: path.extname(filePath).substring(1),
                processed: false,
                processingError: optimizeResult.error
            };
        }
        
        console.log('Image optimized:', optimizeResult);
        
        // Generate thumbnail if enabled
        let thumbnailInfo = null;
        if (options.generateThumbnail !== false) {
            const thumbResult = await generateThumbnail(filePath);
            if (thumbResult.success) {
                thumbnailInfo = {
                    thumbnailPath: thumbResult.thumbnailPath,
                    thumbnailSize: thumbResult.size
                };
                console.log('Thumbnail generated:', thumbResult);
            }
        }
        
        // Extract dimensions from optimization result
        const dimensions = optimizeResult.finalDimensions.split('x');
        
        return {
            width: parseInt(dimensions[0]),
            height: parseInt(dimensions[1]),
            format: path.extname(filePath).substring(1).replace('.', ''),
            processed: true,
            originalSize: optimizeResult.originalSize,
            optimizedSize: optimizeResult.optimizedSize,
            reduction: optimizeResult.reduction,
            ...thumbnailInfo
        };
        
    } catch (error) {
        console.error('Error processing image:', error);
        return {
            processed: false,
            processingError: error.message
        };
    }
}

/**
 * Generate thumbnail for video file
 * Requires: npm install fluent-ffmpeg (and ffmpeg installed on system)
 * @param {string} videoPath - Path to video file
 * @param {Object} options - Thumbnail options
 * @returns {Promise<Object>} - Thumbnail info
 */
async function generateVideoThumbnail(videoPath, options = {}) {
  try {
    // NOTE: Install fluent-ffmpeg to enable this feature
    // npm install fluent-ffmpeg
    // Also requires ffmpeg installed on your system

    // For now, return placeholder
    // Uncomment below code after installing fluent-ffmpeg

    /*
        const ffmpeg = require('fluent-ffmpeg');
        
        const defaults = {
            timestamp: '00:00:01',
            size: '320x240',
            filename: path.basename(videoPath, path.extname(videoPath)) + '-thumb.jpg'
        };
        
        const config = { ...defaults, ...options };
        const thumbnailDir = path.dirname(videoPath);
        const thumbnailPath = path.join(thumbnailDir, config.filename);
        
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: [config.timestamp],
                    filename: config.filename,
                    folder: thumbnailDir,
                    size: config.size
                })
                .on('end', () => {
                    resolve({
                        thumbnail: thumbnailPath,
                        processed: true
                    });
                })
                .on('error', (err) => {
                    reject(err);
                });
        });
        */

    // Temporary return without ffmpeg
    return {
      thumbnail: null,
      processed: false,
      note: "Install fluent-ffmpeg for video processing: npm install fluent-ffmpeg",
    };
  } catch (error) {
    console.error("Error generating video thumbnail:", error);
    return {
      thumbnail: null,
      processed: false,
      processingError: error.message,
    };
  }
}

/**
 * Get video duration
 * Requires: npm install fluent-ffmpeg
 * @param {string} videoPath - Path to video file
 * @returns {Promise<number>} - Duration in seconds
 */
async function getVideoDuration(videoPath) {
  try {
    // NOTE: Install fluent-ffmpeg to enable this feature
    // npm install fluent-ffmpeg

    /*
        const ffmpeg = require('fluent-ffmpeg');
        
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metadata.format.duration);
                }
            });
        });
        */

    // Temporary return
    return null;
  } catch (error) {
    console.error("Error getting video duration:", error);
    return null;
  }
}

/**
 * Process uploaded files with metadata extraction
 * @param {Array} files - Array of multer file objects
 * @param {string} fileType - Type of files (photos, videos, docs)
 * @returns {Promise<Array>} - Array of processed file metadata
 */
async function processUploadedFiles(files, fileType) {
  if (!files || files.length === 0) {
    return [];
  }

  const processedFiles = [];

  for (const file of files) {
    try {
      // Check if file is from Cloudinary (has cloudinary-specific properties)
      const isCloudinary = file.public_id || file.cloudinaryPublicId || (file.path && file.path.includes('cloudinary.com'));
      
      if (isCloudinary) {
        // Cloudinary file - use metadata from Cloudinary
        const metadata = {
          filename: file.filename || file.public_id,
          originalName: file.originalname,
          path: file.path, // Cloudinary URL
          cloudUrl: file.path,
          size: file.size,
          mimetype: file.mimetype,
          storageType: 'cloud',
          cloudinaryPublicId: file.public_id,
          cloudinaryFormat: file.format,
          uploadedAt: new Date(),
          processed: true // Cloudinary handles optimization
        };
        
        // Add Cloudinary-specific metadata
        if (file.resource_type === 'image' || fileType === 'photos') {
          metadata.width = file.width;
          metadata.height = file.height;
        } else if (file.resource_type === 'video' || fileType === 'videos') {
          metadata.duration = file.duration;
          // Get thumbnail URL if eager transformation was applied
          if (file.eager && file.eager.length > 0) {
            metadata.thumbnail = file.eager[0].secure_url;
          }
        }
        
        processedFiles.push(metadata);
      } else {
        // Local file - process as before
        const metadata = extractFileMetadata(file);

        // Process based on file type
        if (fileType === "photos") {
          const imageData = await processImage(file.path);
          Object.assign(metadata, imageData);
        } else if (fileType === "videos") {
          const thumbnailData = await generateVideoThumbnail(file.path);
          const duration = await getVideoDuration(file.path);
          Object.assign(metadata, thumbnailData, { duration });
        }

        processedFiles.push(metadata);
      }
    } catch (error) {
      console.error(`Error processing ${fileType} file:`, error);
      // Still add the file with basic metadata
      const isCloudinary = file.public_id || (file.path && file.path.includes('cloudinary.com'));
      processedFiles.push({
        filename: file.filename || file.public_id,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        storageType: isCloudinary ? 'cloud' : 'local',
        uploadedAt: new Date(),
        processingError: error.message,
      });
    }
  }

  return processedFiles;
}

/**
 * Validate image file
 * @param {string} filePath - Path to image file
 * @returns {Promise<boolean>} - True if valid image
 */
async function validateImage(filePath) {
  try {
    // Basic validation: check if file exists and has image extension
    await fs.access(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    return validExtensions.includes(ext);
  } catch (error) {
    return false;
  }
}

/**
 * Validate video file
 * @param {string} filePath - Path to video file
 * @returns {Promise<boolean>} - True if valid video
 */
async function validateVideo(filePath) {
  try {
    // Basic validation: check if file exists and has video extension
    await fs.access(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = [".mp4", ".mov", ".avi", ".webm", ".mpeg"];
    return validExtensions.includes(ext);
  } catch (error) {
    return false;
  }
}

module.exports = {
  extractFileMetadata,
  processImage,
  generateVideoThumbnail,
  getVideoDuration,
  processUploadedFiles,
  validateImage,
  validateVideo,
};
