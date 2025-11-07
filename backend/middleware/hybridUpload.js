const { isCloudinaryConfigured, uploadAnyFilesCloudinary } = require('../config/cloudinary');
const { uploadAnyFiles: uploadAnyFilesLocal, validateMimeType } = require('./upload');

// ============================================
// HYBRID UPLOAD MIDDLEWARE
// Automatically switches between local and Cloudinary
// based on environment configuration
// ============================================

/**
 * Smart upload middleware that chooses storage backend automatically
 * Priority: Cloudinary (if configured) > Local File System
 */
function hybridUploadAny(req, res, next) {
    const useCloudinary = isCloudinaryConfigured();
    
    console.log(`📦 Upload Mode: ${useCloudinary ? 'CLOUDINARY (Cloud)' : 'LOCAL (File System)'}`);
    
    if (useCloudinary) {
        // Use Cloudinary storage
        return uploadAnyFilesCloudinary(req, res, (err) => {
            if (err) {
                console.error('Cloudinary upload error:', err);
                return res.status(400).json({
                    success: false,
                    message: err.message || 'File upload failed'
                });
            }
            
            // Cloudinary handles file type validation, so skip validateMimeType
            next();
        });
    } else {
        // Use local file system storage with MIME validation
        return uploadAnyFilesLocal(req, res, (err) => {
            if (err) {
                console.error('Local upload error:', err);
                return res.status(400).json({
                    success: false,
                    message: err.message || 'File upload failed'
                });
            }
            
            // Apply MIME type validation for local storage
            validateMimeType(req, res, next);
        });
    }
}

/**
 * Process uploaded files and normalize to consistent format
 * Works with both Cloudinary and local storage
 * @param {object} req - Express request object
 * @returns {object} Normalized file data
 */
function normalizeUploadedFiles(req) {
    const useCloudinary = isCloudinaryConfigured();
    const fileData = {
        photos: [],
        videos: [],
        docs: []
    };
    
    if (!req.files) {
        return fileData;
    }
    
    // Handle array of files (from multer.any())
    const filesList = Array.isArray(req.files) 
        ? req.files 
        : Object.values(req.files).flat();
    
    filesList.forEach(file => {
        const fieldName = file.fieldname;
        
        if (useCloudinary) {
            // Cloudinary file format
            const fileMetadata = {
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
                processed: true
            };
            
            // Add Cloudinary-specific metadata
            if (file.resource_type === 'image') {
                fileMetadata.width = file.width;
                fileMetadata.height = file.height;
            } else if (file.resource_type === 'video') {
                fileMetadata.duration = file.duration;
                // Get thumbnail URL if eager transformation was applied
                if (file.eager && file.eager.length > 0) {
                    fileMetadata.thumbnail = file.eager[0].secure_url;
                }
            }
            
            // Add to appropriate array
            if (fieldName === 'photos') {
                fileData.photos.push(fileMetadata);
            } else if (fieldName === 'videos') {
                fileData.videos.push(fileMetadata);
            } else if (fieldName === 'docs') {
                fileData.docs.push(fileMetadata);
            }
        } else {
            // Local file system format
            const fileMetadata = {
                filename: file.filename,
                originalName: file.originalname,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype,
                storageType: 'local',
                uploadedAt: new Date(),
                processed: false // Will be processed by image optimizer
            };
            
            // Add to appropriate array
            if (fieldName === 'photos') {
                fileData.photos.push(fileMetadata);
            } else if (fieldName === 'videos') {
                fileData.videos.push(fileMetadata);
            } else if (fieldName === 'docs') {
                fileData.docs.push(fileMetadata);
            }
        }
    });
    
    return fileData;
}

/**
 * Delete uploaded file (works with both local and Cloudinary)
 * @param {object} fileMetadata - File metadata object
 */
async function deleteUploadedFile(fileMetadata) {
    if (!fileMetadata) return;
    
    const useCloudinary = isCloudinaryConfigured();
    
    if (useCloudinary && fileMetadata.storageType === 'cloud' && fileMetadata.cloudinaryPublicId) {
        // Delete from Cloudinary
        const { deleteFromCloudinary, getResourceType } = require('../config/cloudinary');
        const resourceType = getResourceType(fileMetadata.path);
        
        try {
            await deleteFromCloudinary(fileMetadata.cloudinaryPublicId, resourceType);
            console.log(`✅ Deleted from Cloudinary: ${fileMetadata.cloudinaryPublicId}`);
        } catch (error) {
            console.error('Error deleting from Cloudinary:', error);
        }
    } else if (fileMetadata.storageType === 'local' || !fileMetadata.storageType) {
        // Delete from local file system
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            // Handle both full paths and URL paths
            let filePath = fileMetadata.path;
            
            // If it's a URL path, convert to file system path
            if (filePath.startsWith('/uploads/')) {
                filePath = path.join(__dirname, '..', filePath);
            }
            
            await fs.unlink(filePath);
            console.log(`✅ Deleted from local storage: ${filePath}`);
        } catch (error) {
            console.error('Error deleting from local storage:', error);
        }
    }
}

/**
 * Get file URL for client consumption
 * @param {object} fileMetadata - File metadata object
 * @returns {string} File URL
 */
function getFileUrl(fileMetadata) {
    if (!fileMetadata) return null;
    
    // If it's a Cloudinary file, return the cloudUrl or path
    if (fileMetadata.storageType === 'cloud' || fileMetadata.cloudUrl) {
        return fileMetadata.cloudUrl || fileMetadata.path;
    }
    
    // For local files, ensure proper URL format
    if (fileMetadata.path) {
        let urlPath = fileMetadata.path;
        
        // Convert Windows backslashes to forward slashes
        urlPath = urlPath.replace(/\\/g, '/');
        
        // If already starts with /uploads/, return as-is
        if (urlPath.startsWith('/uploads/')) {
            return urlPath;
        }
        
        // Extract from uploads/ onwards
        const uploadsIndex = urlPath.indexOf('/uploads/');
        if (uploadsIndex !== -1) {
            return urlPath.substring(uploadsIndex);
        }
        
        const uploadsIndex2 = urlPath.indexOf('uploads/');
        if (uploadsIndex2 !== -1) {
            return '/' + urlPath.substring(uploadsIndex2);
        }
        
        // Last resort: return as-is
        return urlPath;
    }
    
    return null;
}

module.exports = {
    hybridUploadAny,
    normalizeUploadedFiles,
    deleteUploadedFile,
    getFileUrl
};
