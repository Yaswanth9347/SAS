const path = require("path");
const fs = require("fs").promises;

// ============================================
// FILE PROCESSING UTILITIES
// Ready for Sharp (images) and FFmpeg (videos)
// Install: npm install sharp fluent-ffmpeg
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
 * Requires: npm install sharp
 * @param {string} filePath - Path to image file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing results with metadata
 */
async function processImage(filePath, options = {}) {
  try {
    // NOTE: Install sharp to enable this feature
    // npm install sharp

    // For now, just return basic metadata without processing
    // Uncomment below code after installing sharp

    /*
        const sharp = require('sharp');
        
        const defaults = {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 85,
            format: 'jpeg'
        };
        
        const config = { ...defaults, ...options };
        
        // Get image metadata
        const metadata = await sharp(filePath).metadata();
        
        // Create optimized version if needed
        if (metadata.width > config.maxWidth || metadata.height > config.maxHeight) {
            const optimizedPath = filePath.replace(
                path.extname(filePath),
                `-optimized${path.extname(filePath)}`
            );
            
            await sharp(filePath)
                .resize(config.maxWidth, config.maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: config.quality })
                .toFile(optimizedPath);
        }
        
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            processed: true
        };
        */

    // Temporary return without sharp
    return {
      width: null,
      height: null,
      format: path.extname(filePath).substring(1),
      processed: false,
      note: "Install sharp for image processing: npm install sharp",
    };
  } catch (error) {
    console.error("Error processing image:", error);
    return {
      processed: false,
      processingError: error.message,
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
    } catch (error) {
      console.error(`Error processing ${fileType} file:`, error);
      // Still add the file with basic metadata
      processedFiles.push({
        ...extractFileMetadata(file),
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
