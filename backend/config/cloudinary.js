const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// ============================================
// CLOUDINARY CONFIGURATION
// Cloud-based file storage for production
// ============================================

// Configure Cloudinary with environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Storage configuration constants (same as local storage for consistency)
const STORAGE_CONFIG = {
    photos: {
        maxSize: 10 * 1024 * 1024, // 10MB per photo
        maxCount: 10,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        quality: 85,
        folder: 'sas/visits/photos'
    },
    videos: {
        maxSize: 100 * 1024 * 1024, // 100MB per video
        maxCount: 5,
        allowedTypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
        duration: 300, // Max 5 minutes
        folder: 'sas/visits/videos'
    },
    docs: {
        maxSize: 5 * 1024 * 1024, // 5MB per document
        maxCount: 5,
        allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        folder: 'sas/visits/docs'
    },
    avatar: {
        maxSize: 5 * 1024 * 1024, // 5MB
        maxCount: 1,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        folder: 'sas/avatars'
    }
};

// ============================================
// CLOUDINARY STORAGE CONFIGURATION
// ============================================

/**
 * Create Cloudinary storage for different file types
 * @param {string} fieldName - Field name (photos, videos, docs, avatar)
 * @returns {CloudinaryStorage} Configured storage instance
 */
function createCloudinaryStorage(fieldName) {
    const config = STORAGE_CONFIG[fieldName];
    
    if (!config) {
        throw new Error(`Invalid field name: ${fieldName}`);
    }

    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            // Get visit ID or user ID from request
            const resourceId = req.params.id || (req.user && (req.user.id || req.user._id)) || 'temp';
            
            // Sanitize resource ID (same as local storage)
            const sanitizedId = String(resourceId).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) || 'temp';
            
            // Determine folder based on file type
            const folder = `${config.folder}/${sanitizedId}`;
            
            // Determine resource type
            let resourceType = 'auto';
            if (fieldName === 'videos') {
                resourceType = 'video';
            } else if (fieldName === 'photos' || fieldName === 'avatar') {
                resourceType = 'image';
            } else if (fieldName === 'docs') {
                resourceType = 'raw';
            }
            
            // Generate unique public ID
            const timestamp = Date.now();
            const randomString = Math.round(Math.random() * 1E9).toString(36);
            const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            const basename = sanitizedName.split('.')[0];
            const publicId = `${fieldName}-${basename}-${timestamp}-${randomString}`;
            
            return {
                folder: folder,
                public_id: publicId,
                resource_type: resourceType,
                allowed_formats: getAllowedFormats(fieldName),
                // Image-specific transformations
                ...(resourceType === 'image' && {
                    transformation: [
                        { quality: 'auto:good' },
                        { fetch_format: 'auto' }
                    ]
                }),
                // Video-specific settings
                ...(resourceType === 'video' && {
                    eager: [
                        { width: 400, height: 300, crop: 'pad', audio_codec: 'none', format: 'jpg' }
                    ],
                    eager_async: true
                })
            };
        }
    });
}

/**
 * Get allowed formats for Cloudinary from MIME types
 */
function getAllowedFormats(fieldName) {
    const config = STORAGE_CONFIG[fieldName];
    if (!config || !config.allowedTypes) return null;
    
    const formatMap = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/mpeg': 'mpeg',
        'video/quicktime': 'mov',
        'video/x-msvideo': 'avi',
        'video/webm': 'webm',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    
    return config.allowedTypes.map(type => formatMap[type]).filter(Boolean);
}

// ============================================
// FILE FILTER FOR CLOUDINARY
// ============================================

const cloudinaryFileFilter = (req, file, cb) => {
    const fieldName = file.fieldname;
    
    // Check if field is valid
    if (!STORAGE_CONFIG[fieldName]) {
        return cb(new Error(`Invalid upload field: ${fieldName}`), false);
    }
    
    const config = STORAGE_CONFIG[fieldName];
    
    // Check file type
    if (!config.allowedTypes.includes(file.mimetype)) {
        return cb(new Error(`Invalid file type for ${fieldName}: ${file.mimetype}. Allowed types: ${config.allowedTypes.join(', ')}`), false);
    }
    
    cb(null, true);
};

// ============================================
// MULTER CONFIGURATION FOR CLOUDINARY
// ============================================

// Configure multer with Cloudinary storage
const uploadToCloudinary = multer({
    storage: new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            // Get visit ID or user ID from request
            const resourceId = req.params.id || (req.user && (req.user.id || req.user._id)) || 'temp';
            const sanitizedId = String(resourceId).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) || 'temp';
            
            // Determine folder and resource type based on fieldname
            const fieldName = file.fieldname;
            const config = STORAGE_CONFIG[fieldName] || STORAGE_CONFIG.photos;
            
            let resourceType = 'auto';
            if (fieldName === 'videos') {
                resourceType = 'video';
            } else if (fieldName === 'photos' || fieldName === 'avatar' || fieldName === 'avatars') {
                resourceType = 'image';
            } else if (fieldName === 'docs') {
                resourceType = 'raw';
            }
            
            const folder = `${config.folder}/${sanitizedId}`;
            
            // Generate unique public ID
            const timestamp = Date.now();
            const randomString = Math.round(Math.random() * 1E9).toString(36);
            const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            const basename = sanitizedName.split('.')[0];
            const publicId = `${fieldName}-${basename}-${timestamp}-${randomString}`;
            
            return {
                folder: folder,
                public_id: publicId,
                resource_type: resourceType,
                allowed_formats: getAllowedFormats(fieldName),
                // Image-specific transformations
                ...(resourceType === 'image' && {
                    transformation: [
                        { quality: 'auto:good' },
                        { fetch_format: 'auto' }
                    ]
                }),
                // Video-specific settings with thumbnail generation
                ...(resourceType === 'video' && {
                    eager: [
                        { width: 400, height: 300, crop: 'pad', audio_codec: 'none', format: 'jpg' }
                    ],
                    eager_async: true
                })
            };
        }
    }),
    limits: {
        fileSize: 100 * 1024 * 1024, // Global 100MB limit (for videos)
        files: 20, // Maximum 20 files per request
        fields: 10, // Maximum 10 non-file fields
        parts: 30 // Maximum 30 parts (files + fields)
    },
    fileFilter: cloudinaryFileFilter
});

// Middleware for handling multiple file types
const uploadVisitFilesCloudinary = uploadToCloudinary.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'docs', maxCount: 5 }
]);

// Alternative upload handler for any files
const uploadAnyFilesCloudinary = uploadToCloudinary.any();

// Avatar upload
const uploadAvatarCloudinary = uploadToCloudinary.single('avatar');

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - 'image', 'video', or 'raw'
 */
async function deleteFromCloudinary(publicId, resourceType = 'image') {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        return result;
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        throw error;
    }
}

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} Public ID
 */
function extractPublicId(url) {
    if (!url) return null;
    
    // Extract public ID from Cloudinary URL
    // Format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
    const regex = /\/v\d+\/(.+)\.[^.]+$/;
    const match = url.match(regex);
    
    if (match && match[1]) {
        return match[1];
    }
    
    // Alternative pattern: just get everything between upload/ and the extension
    const altRegex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
    const altMatch = url.match(altRegex);
    
    if (altMatch && altMatch[1]) {
        return altMatch[1];
    }
    
    return null;
}

/**
 * Get resource type from file path or URL
 * @param {string} pathOrUrl - File path or URL
 * @returns {string} Resource type: 'image', 'video', or 'raw'
 */
function getResourceType(pathOrUrl) {
    if (!pathOrUrl) return 'image';
    
    const lower = pathOrUrl.toLowerCase();
    
    if (lower.includes('/video/') || lower.includes('videos/') || 
        lower.match(/\.(mp4|mpeg|mov|avi|webm)$/)) {
        return 'video';
    }
    
    if (lower.includes('/raw/') || lower.includes('docs/') || 
        lower.match(/\.(pdf|doc|docx)$/)) {
        return 'raw';
    }
    
    return 'image';
}

/**
 * Check if Cloudinary is configured
 * @returns {boolean}
 */
function isCloudinaryConfigured() {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

/**
 * Get optimized image URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Transformation options
 * @returns {string} Transformed URL
 */
function getOptimizedImageUrl(publicId, options = {}) {
    const {
        width = 800,
        height = 600,
        crop = 'fill',
        quality = 'auto',
        format = 'auto'
    } = options;
    
    return cloudinary.url(publicId, {
        transformation: [
            { width, height, crop },
            { quality, fetch_format: format }
        ],
        secure: true
    });
}

/**
 * Get video thumbnail URL
 * @param {string} publicId - Cloudinary public ID (video)
 * @returns {string} Thumbnail URL
 */
function getVideoThumbnailUrl(publicId) {
    return cloudinary.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
            { width: 400, height: 300, crop: 'pad' }
        ],
        secure: true
    });
}

module.exports = {
    cloudinary,
    uploadVisitFilesCloudinary,
    uploadAnyFilesCloudinary,
    uploadAvatarCloudinary,
    deleteFromCloudinary,
    extractPublicId,
    getResourceType,
    isCloudinaryConfigured,
    getOptimizedImageUrl,
    getVideoThumbnailUrl,
    STORAGE_CONFIG
};
