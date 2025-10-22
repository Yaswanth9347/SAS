const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// HYBRID STORAGE APPROACH CONFIGURATION
// MongoDB (Metadata) + File System (Media)
// Ready for future Cloud Storage integration
// ============================================

// Create uploads directory structure if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
const photosDir = path.join(uploadDir, 'photos');
const videosDir = path.join(uploadDir, 'videos');
const docsDir = path.join(uploadDir, 'docs');

// Create necessary directories
[uploadDir, photosDir, videosDir, docsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Storage configuration constants
const STORAGE_CONFIG = {
    photos: {
        maxSize: 10 * 1024 * 1024, // 10MB per photo
        maxCount: 10,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        quality: 85
    },
    videos: {
        maxSize: 100 * 1024 * 1024, // 100MB per video
        maxCount: 5,
        allowedTypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
        duration: 300 // Max 5 minutes
    },
    docs: {
        maxSize: 5 * 1024 * 1024, // 5MB per document
        maxCount: 5,
        allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }
};

// Configure storage with visit-specific folders
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const visitId = req.params.id || 'temp';
        let typeDir;
        
        // Organize by file type and visit
        if (file.fieldname === 'photos') {
            typeDir = path.join(photosDir, visitId);
        } else if (file.fieldname === 'videos') {
            typeDir = path.join(videosDir, visitId);
        } else if (file.fieldname === 'docs') {
            typeDir = path.join(docsDir, visitId);
        } else {
            typeDir = path.join(uploadDir, visitId);
        }
        
        // Create visit-specific directory
        if (!fs.existsSync(typeDir)) {
            fs.mkdirSync(typeDir, { recursive: true });
        }
        
        cb(null, typeDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with sanitized original name
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        const randomString = Math.round(Math.random() * 1E9).toString(36);
        const extension = path.extname(sanitizedName);
        const basename = path.basename(sanitizedName, extension);
        
        // Format: fieldname-basename-timestamp-random.ext
        const filename = `${file.fieldname}-${basename}-${timestamp}-${randomString}${extension}`;
        cb(null, filename);
    }
});

// Enhanced file filter with detailed validation
const fileFilter = (req, file, cb) => {
    const fieldName = file.fieldname;
    const fileSize = parseInt(req.headers['content-length']);
    
    // Check if field is valid
    if (!STORAGE_CONFIG[fieldName]) {
        return cb(new Error(`Invalid upload field: ${fieldName}`), false);
    }
    
    const config = STORAGE_CONFIG[fieldName];
    
    // Check file type
    if (!config.allowedTypes.includes(file.mimetype)) {
        return cb(new Error(`Invalid file type for ${fieldName}: ${file.mimetype}. Allowed types: ${config.allowedTypes.join(', ')}`), false);
    }
    
    // Check file size (rough estimate from headers)
    if (fileSize && fileSize > config.maxSize) {
        const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(2);
        return cb(new Error(`File too large for ${fieldName}. Maximum size: ${maxSizeMB}MB`), false);
    }
    
    cb(null, true);
};

// Configure multer with enhanced settings
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // Global 100MB limit (for videos)
        files: 20, // Maximum 20 files per request
        fields: 10, // Maximum 10 non-file fields
        parts: 30 // Maximum 30 parts (files + fields)
    },
    fileFilter: fileFilter
});

// Middleware for handling multiple files
const uploadVisitFiles = upload.fields([
    { name: 'photos', maxCount: 8 },
    { name: 'videos', maxCount: 4 },
    { name: 'docs', maxCount: 6 }
]);

// Alternative upload handler with any() for debugging
const uploadAnyFiles = upload.any();

module.exports = { uploadVisitFiles, uploadAnyFiles };