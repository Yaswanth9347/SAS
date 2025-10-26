const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Image Optimization Utility
 * Uses Sharp library for high-performance image processing
 * - Resize images to optimal dimensions
 * - Compress with quality settings
 * - Generate thumbnails
 * - Convert to web-optimized formats
 */

// Configuration constants
const OPTIMIZATION_CONFIG = {
    avatar: {
        width: 320,
        height: 320,
        quality: 85,
        fit: 'cover'
    },
    photo: {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 85,
        fit: 'inside'
    },
    thumbnail: {
        width: 400,
        height: 400,
        quality: 75,
        fit: 'cover'
    }
};

/**
 * Optimize avatar image
 * Resizes to 320x320 and compresses
 * @param {string} filePath - Path to the uploaded image
 * @returns {Promise<Object>} - Optimization result with file info
 */
async function optimizeAvatar(filePath) {
    try {
        const config = OPTIMIZATION_CONFIG.avatar;
        const ext = path.extname(filePath).toLowerCase();
        const outputPath = filePath; // Overwrite original
        
        // Get original file stats
        const originalStats = await fs.stat(filePath);
        const originalSize = originalStats.size;

        // Process image
        await sharp(filePath)
            .resize(config.width, config.height, {
                fit: config.fit,
                position: 'center',
                withoutEnlargement: false
            })
            .jpeg({ quality: config.quality, progressive: true })
            .png({ quality: config.quality, compressionLevel: 9 })
            .webp({ quality: config.quality })
            .toFile(outputPath + '.tmp');

        // Replace original with optimized
        await fs.unlink(filePath);
        await fs.rename(outputPath + '.tmp', filePath);

        // Get optimized file stats
        const optimizedStats = await fs.stat(filePath);
        const optimizedSize = optimizedStats.size;
        const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

        return {
            success: true,
            originalSize,
            optimizedSize,
            reduction: `${reduction}%`,
            dimensions: `${config.width}x${config.height}`,
            path: filePath
        };
    } catch (error) {
        console.error('Avatar optimization error:', error);
        return {
            success: false,
            error: error.message,
            path: filePath
        };
    }
}

/**
 * Optimize photo for visit gallery
 * Resizes to max 1920px width/height while maintaining aspect ratio
 * @param {string} filePath - Path to the uploaded image
 * @returns {Promise<Object>} - Optimization result with file info
 */
async function optimizePhoto(filePath) {
    try {
        const config = OPTIMIZATION_CONFIG.photo;
        const outputPath = filePath;
        
        // Get original file stats and metadata
        const originalStats = await fs.stat(filePath);
        const originalSize = originalStats.size;
        const metadata = await sharp(filePath).metadata();

        // Only resize if image is larger than max dimensions
        let resizeOptions = null;
        if (metadata.width > config.maxWidth || metadata.height > config.maxHeight) {
            resizeOptions = {
                width: config.maxWidth,
                height: config.maxHeight,
                fit: config.fit,
                withoutEnlargement: true
            };
        }

        // Build sharp pipeline
        let pipeline = sharp(filePath);
        
        if (resizeOptions) {
            pipeline = pipeline.resize(resizeOptions);
        }

        // Auto-rotate based on EXIF orientation
        pipeline = pipeline.rotate();

        // Apply format-specific optimization
        if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
            pipeline = pipeline.jpeg({ quality: config.quality, progressive: true });
        } else if (metadata.format === 'png') {
            pipeline = pipeline.png({ quality: config.quality, compressionLevel: 9 });
        } else if (metadata.format === 'webp') {
            pipeline = pipeline.webp({ quality: config.quality });
        }

        // Save optimized image
        await pipeline.toFile(outputPath + '.tmp');

        // Replace original with optimized
        await fs.unlink(filePath);
        await fs.rename(outputPath + '.tmp', filePath);

        // Get optimized file stats
        const optimizedStats = await fs.stat(filePath);
        const optimizedSize = optimizedStats.size;
        const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

        // Get final dimensions
        const finalMetadata = await sharp(filePath).metadata();

        return {
            success: true,
            originalSize,
            optimizedSize,
            reduction: `${reduction}%`,
            originalDimensions: `${metadata.width}x${metadata.height}`,
            finalDimensions: `${finalMetadata.width}x${finalMetadata.height}`,
            path: filePath
        };
    } catch (error) {
        console.error('Photo optimization error:', error);
        return {
            success: false,
            error: error.message,
            path: filePath
        };
    }
}

/**
 * Generate thumbnail for a photo
 * Creates a 400x400 thumbnail with crop
 * @param {string} filePath - Path to the original image
 * @returns {Promise<Object>} - Thumbnail generation result
 */
async function generateThumbnail(filePath) {
    try {
        const config = OPTIMIZATION_CONFIG.thumbnail;
        const ext = path.extname(filePath);
        const dirname = path.dirname(filePath);
        const basename = path.basename(filePath, ext);
        const thumbnailPath = path.join(dirname, `${basename}_thumb${ext}`);

        // Generate thumbnail
        await sharp(filePath)
            .resize(config.width, config.height, {
                fit: config.fit,
                position: 'center'
            })
            .jpeg({ quality: config.quality, progressive: true })
            .png({ quality: config.quality, compressionLevel: 9 })
            .webp({ quality: config.quality })
            .toFile(thumbnailPath);

        const stats = await fs.stat(thumbnailPath);

        return {
            success: true,
            thumbnailPath,
            size: stats.size,
            dimensions: `${config.width}x${config.height}`
        };
    } catch (error) {
        console.error('Thumbnail generation error:', error);
        return {
            success: false,
            error: error.message,
            path: filePath
        };
    }
}

/**
 * Optimize multiple photos in batch
 * @param {Array<string>} filePaths - Array of file paths
 * @param {boolean} generateThumbs - Whether to generate thumbnails
 * @returns {Promise<Array>} - Array of optimization results
 */
async function optimizeBatch(filePaths, generateThumbs = false) {
    const results = [];
    
    for (const filePath of filePaths) {
        // Check if it's an image file
        const ext = path.extname(filePath).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        
        if (!imageExts.includes(ext)) {
            results.push({
                success: false,
                error: 'Not an image file',
                path: filePath
            });
            continue;
        }

        // Optimize the photo
        const optimizeResult = await optimizePhoto(filePath);
        results.push(optimizeResult);

        // Generate thumbnail if requested and optimization succeeded
        if (generateThumbs && optimizeResult.success) {
            const thumbResult = await generateThumbnail(filePath);
            results.push(thumbResult);
        }
    }

    return results;
}

/**
 * Get image metadata without optimization
 * @param {string} filePath - Path to the image
 * @returns {Promise<Object>} - Image metadata
 */
async function getImageInfo(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        const stats = await fs.stat(filePath);

        return {
            success: true,
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            size: stats.size,
            hasAlpha: metadata.hasAlpha,
            orientation: metadata.orientation
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    optimizeAvatar,
    optimizePhoto,
    generateThumbnail,
    optimizeBatch,
    getImageInfo,
    OPTIMIZATION_CONFIG
};
