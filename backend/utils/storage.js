const fs = require('fs').promises;
const path = require('path');

// ============================================
// STORAGE UTILITY FUNCTIONS
// Hybrid Storage Management Tools
// ============================================

/**
 * Get the size of a directory recursively
 * @param {string} directoryPath - Path to the directory
 * @returns {Promise<number>} - Size in bytes
 */
async function getDirectorySize(directoryPath) {
    try {
        const files = await fs.readdir(directoryPath, { withFileTypes: true });
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(directoryPath, file.name);
            
            if (file.isDirectory()) {
                totalSize += await getDirectorySize(filePath);
            } else {
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
            }
        }

        return totalSize;
    } catch (error) {
        console.error(`Error getting directory size for ${directoryPath}:`, error);
        return 0;
    }
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} - Formatted string (e.g., "10.5 MB")
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get storage statistics for the uploads directory
 * @param {string} uploadsDir - Path to uploads directory
 * @returns {Promise<Object>} - Storage statistics
 */
async function getStorageStats(uploadsDir) {
    try {
        const stats = {
            totalSize: 0,
            photos: { count: 0, size: 0 },
            videos: { count: 0, size: 0 },
            docs: { count: 0, size: 0 },
            visits: { count: 0 }
        };

        // Check if directory exists
        try {
            await fs.access(uploadsDir);
        } catch (error) {
            return stats; // Return empty stats if directory doesn't exist
        }

        // Get photos stats
        const photosDir = path.join(uploadsDir, 'photos');
        try {
            await fs.access(photosDir);
            stats.photos.size = await getDirectorySize(photosDir);
            const photoVisits = await fs.readdir(photosDir);
            stats.photos.count = photoVisits.length;
        } catch (error) {
            // Photos directory doesn't exist
        }

        // Get videos stats
        const videosDir = path.join(uploadsDir, 'videos');
        try {
            await fs.access(videosDir);
            stats.videos.size = await getDirectorySize(videosDir);
            const videoVisits = await fs.readdir(videosDir);
            stats.videos.count = videoVisits.length;
        } catch (error) {
            // Videos directory doesn't exist
        }

        // Get docs stats
        const docsDir = path.join(uploadsDir, 'docs');
        try {
            await fs.access(docsDir);
            stats.docs.size = await getDirectorySize(docsDir);
            const docVisits = await fs.readdir(docsDir);
            stats.docs.count = docVisits.length;
        } catch (error) {
            // Docs directory doesn't exist
        }

        // Calculate total size
        stats.totalSize = stats.photos.size + stats.videos.size + stats.docs.size;

        // Format sizes for display
        stats.totalSizeFormatted = formatBytes(stats.totalSize);
        stats.photos.sizeFormatted = formatBytes(stats.photos.size);
        stats.videos.sizeFormatted = formatBytes(stats.videos.size);
        stats.docs.sizeFormatted = formatBytes(stats.docs.size);

        return stats;
    } catch (error) {
        console.error('Error getting storage stats:', error);
        throw error;
    }
}

/**
 * Clean up orphaned files (files not referenced in database)
 * @param {string} uploadsDir - Path to uploads directory
 * @param {Array} visitIds - Array of valid visit IDs from database
 * @returns {Promise<Object>} - Cleanup results
 */
async function cleanupOrphanedFiles(uploadsDir, visitIds) {
    try {
        const results = {
            deletedFolders: [],
            deletedSize: 0,
            errors: []
        };

        const validIds = new Set(visitIds.map(id => id.toString()));
        const fileTypes = ['photos', 'videos', 'docs'];

        for (const fileType of fileTypes) {
            const typeDir = path.join(uploadsDir, fileType);
            
            try {
                await fs.access(typeDir);
                const folders = await fs.readdir(typeDir);

                for (const folder of folders) {
                    if (!validIds.has(folder)) {
                        const folderPath = path.join(typeDir, folder);
                        const size = await getDirectorySize(folderPath);
                        
                        try {
                            await fs.rm(folderPath, { recursive: true, force: true });
                            results.deletedFolders.push({ type: fileType, id: folder, size });
                            results.deletedSize += size;
                        } catch (error) {
                            results.errors.push({ folder, error: error.message });
                        }
                    }
                }
            } catch (error) {
                // Directory doesn't exist, skip
            }
        }

        results.deletedSizeFormatted = formatBytes(results.deletedSize);
        return results;
    } catch (error) {
        console.error('Error cleaning orphaned files:', error);
        throw error;
    }
}

/**
 * Delete all files for a specific visit
 * @param {string} uploadsDir - Path to uploads directory
 * @param {string} visitId - Visit ID
 * @returns {Promise<Object>} - Deletion results
 */
async function deleteVisitFiles(uploadsDir, visitId) {
    try {
        const results = {
            deleted: [],
            deletedSize: 0,
            errors: []
        };

        const fileTypes = ['photos', 'videos', 'docs'];

        for (const fileType of fileTypes) {
            const visitDir = path.join(uploadsDir, fileType, visitId);
            
            try {
                await fs.access(visitDir);
                const size = await getDirectorySize(visitDir);
                await fs.rm(visitDir, { recursive: true, force: true });
                
                results.deleted.push({ type: fileType, path: visitDir, size });
                results.deletedSize += size;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    results.errors.push({ type: fileType, error: error.message });
                }
            }
        }

        results.deletedSizeFormatted = formatBytes(results.deletedSize);
        return results;
    } catch (error) {
        console.error(`Error deleting files for visit ${visitId}:`, error);
        throw error;
    }
}

/**
 * Check available disk space
 * @param {string} directoryPath - Path to check
 * @returns {Promise<Object>} - Disk space info
 */
async function checkDiskSpace(directoryPath) {
    try {
        const { execSync } = require('child_process');
        const output = execSync(`df -k "${directoryPath}"`, { encoding: 'utf8' });
        const lines = output.trim().split('\n');
        const data = lines[1].split(/\s+/);
        
        const totalKB = parseInt(data[1]);
        const usedKB = parseInt(data[2]);
        const availableKB = parseInt(data[3]);
        const usagePercent = parseFloat(data[4]);

        return {
            total: totalKB * 1024,
            used: usedKB * 1024,
            available: availableKB * 1024,
            usagePercent: usagePercent,
            totalFormatted: formatBytes(totalKB * 1024),
            usedFormatted: formatBytes(usedKB * 1024),
            availableFormatted: formatBytes(availableKB * 1024)
        };
    } catch (error) {
        console.error('Error checking disk space:', error);
        return null;
    }
}

/**
 * Determine if a file should be stored in cloud based on size
 * @param {number} fileSize - Size in bytes
 * @param {number} threshold - Threshold in bytes (default 10MB)
 * @returns {boolean} - True if should use cloud storage
 */
function shouldUseCloudStorage(fileSize, threshold = 10 * 1024 * 1024) {
    return fileSize > threshold;
}

/**
 * Generate thumbnail path for a video file
 * @param {string} videoPath - Path to video file
 * @returns {string} - Path for thumbnail
 */
function getThumbnailPath(videoPath) {
    const ext = path.extname(videoPath);
    const basePath = videoPath.replace(ext, '');
    return `${basePath}-thumb.jpg`;
}

/**
 * Validate file exists and is readable
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} - True if file exists and is readable
 */
async function validateFile(filePath) {
    try {
        await fs.access(filePath, fs.constants.R_OK);
        const stats = await fs.stat(filePath);
        return stats.isFile();
    } catch (error) {
        return false;
    }
}

module.exports = {
    getDirectorySize,
    formatBytes,
    getStorageStats,
    cleanupOrphanedFiles,
    deleteVisitFiles,
    checkDiskSpace,
    shouldUseCloudStorage,
    getThumbnailPath,
    validateFile
};
