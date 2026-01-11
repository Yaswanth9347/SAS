/**
 * File Size Enforcement Middleware
 * Enforces file size limits before processing
 */

const STORAGE_CONFIG = {
    photos: {
        maxSize: 10 * 1024 * 1024, // 10MB per photo
        maxCount: 10,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    },
    videos: {
        maxSize: 100 * 1024 * 1024, // 100MB per video
        maxCount: 5,
        allowedTypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm']
    },
    docs: {
        maxSize: 5 * 1024 * 1024, // 5MB per document
        maxCount: 5,
        allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    },
    avatar: {
        maxSize: 5 * 1024 * 1024, // 5MB
        maxCount: 1,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    }
};

/**
 * Middleware to enforce file size limits
 */
function enforceFileSizeLimits(req, res, next) {
    if (!req.files) {
        return next();
    }

    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    
    if (files.length === 0) {
        return next();
    }

    const errors = [];
    const warnings = [];

    files.forEach((file, index) => {
        const fieldName = file.fieldname;
        const config = STORAGE_CONFIG[fieldName];

        if (!config) {
            warnings.push(`Unknown field name: ${fieldName} for file ${file.originalname}`);
            return;
        }

        // Check file size
        if (file.size > config.maxSize) {
            const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(2);
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            errors.push({
                file: file.originalname,
                field: fieldName,
                error: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`
            });
        }

        // Check file type
        if (!config.allowedTypes.includes(file.mimetype)) {
            errors.push({
                file: file.originalname,
                field: fieldName,
                error: `Invalid file type: ${file.mimetype}. Allowed types: ${config.allowedTypes.join(', ')}`
            });
        }
    });

    // Check file counts by field
    const filesByField = {};
    files.forEach(file => {
        const fieldName = file.fieldname;
        filesByField[fieldName] = (filesByField[fieldName] || 0) + 1;
    });

    Object.keys(filesByField).forEach(fieldName => {
        const config = STORAGE_CONFIG[fieldName];
        if (config && filesByField[fieldName] > config.maxCount) {
            errors.push({
                field: fieldName,
                error: `Too many files for ${fieldName}. Maximum ${config.maxCount} files allowed, but ${filesByField[fieldName]} provided.`
            });
        }
    });

    // Log warnings
    if (warnings.length > 0) {
        console.warn('File validation warnings:', warnings);
    }

    // Return errors if any
    if (errors.length > 0) {
        console.error('File validation errors:', errors);
        return res.status(400).json({
            success: false,
            message: 'File validation failed',
            errors: errors
        });
    }

    next();
}

/**
 * Get file statistics from request
 */
function getFileStatistics(req) {
    if (!req.files) {
        return {
            totalFiles: 0,
            totalSize: 0,
            byType: {}
        };
    }

    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    
    const stats = {
        totalFiles: files.length,
        totalSize: 0,
        totalSizeMB: 0,
        byType: {}
    };

    files.forEach(file => {
        const fieldName = file.fieldname;
        
        stats.totalSize += file.size;
        
        if (!stats.byType[fieldName]) {
            stats.byType[fieldName] = {
                count: 0,
                size: 0,
                files: []
            };
        }
        
        stats.byType[fieldName].count++;
        stats.byType[fieldName].size += file.size;
        stats.byType[fieldName].files.push({
            name: file.originalname,
            size: file.size,
            sizeMB: (file.size / (1024 * 1024)).toFixed(2),
            type: file.mimetype
        });
    });

    stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

    // Add size in MB for each type
    Object.keys(stats.byType).forEach(type => {
        stats.byType[type].sizeMB = (stats.byType[type].size / (1024 * 1024)).toFixed(2);
    });

    return stats;
}

/**
 * Middleware to log file statistics
 */
function logFileStatistics(req, res, next) {
    const stats = getFileStatistics(req);
    
    if (stats.totalFiles > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 File Upload Statistics:');
        console.log(`   Total Files: ${stats.totalFiles}`);
        console.log(`   Total Size: ${stats.totalSizeMB}MB`);
        
        Object.keys(stats.byType).forEach(type => {
            const typeStats = stats.byType[type];
            console.log(`   ${type}: ${typeStats.count} file(s), ${typeStats.sizeMB}MB`);
        });
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    next();
}

/**
 * Check total upload size across all files
 */
function checkTotalUploadSize(maxTotalSize = 150 * 1024 * 1024) { // 150MB default
    return (req, res, next) => {
        const stats = getFileStatistics(req);
        
        if (stats.totalSize > maxTotalSize) {
            const maxSizeMB = (maxTotalSize / (1024 * 1024)).toFixed(2);
            return res.status(400).json({
                success: false,
                message: `Total upload size (${stats.totalSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`
            });
        }
        
        next();
    };
}

module.exports = {
    enforceFileSizeLimits,
    getFileStatistics,
    logFileStatistics,
    checkTotalUploadSize,
    STORAGE_CONFIG
};
