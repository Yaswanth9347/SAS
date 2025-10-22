// ============================================
// DATA MIGRATION SCRIPT
// Migrate existing string-based file paths 
// to new metadata-based storage
// ============================================

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const Visit = require('./models/Visit');

/**
 * Migrate old string-based file paths to new metadata format
 * Run this once to upgrade existing data
 */
async function migrateFileMetadata() {
    try {
        console.log('Starting file metadata migration...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sas', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');
        
        // Find all visits with old string-based file storage
        const visits = await Visit.find({
            $or: [
                { photos: { $type: 'string' } },
                { videos: { $type: 'string' } },
                { docs: { $type: 'string' } }
            ]
        });
        
        console.log(`Found ${visits.length} visits to migrate`);
        
        let migratedCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const visit of visits) {
            try {
                let needsUpdate = false;
                
                // Migrate photos
                if (Array.isArray(visit.photos) && visit.photos.length > 0 && typeof visit.photos[0] === 'string') {
                    console.log(`Migrating photos for visit ${visit._id}`);
                    visit.photos = await migrateFileArray(visit.photos, 'photos', visit._id);
                    needsUpdate = true;
                }
                
                // Migrate videos
                if (Array.isArray(visit.videos) && visit.videos.length > 0 && typeof visit.videos[0] === 'string') {
                    console.log(`Migrating videos for visit ${visit._id}`);
                    visit.videos = await migrateFileArray(visit.videos, 'videos', visit._id);
                    needsUpdate = true;
                }
                
                // Migrate docs
                if (Array.isArray(visit.docs) && visit.docs.length > 0 && typeof visit.docs[0] === 'string') {
                    console.log(`Migrating docs for visit ${visit._id}`);
                    visit.docs = await migrateFileArray(visit.docs, 'docs', visit._id);
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    await visit.save();
                    migratedCount++;
                    console.log(`✓ Migrated visit ${visit._id}`);
                }
                
            } catch (error) {
                errorCount++;
                errors.push({ visitId: visit._id, error: error.message });
                console.error(`✗ Error migrating visit ${visit._id}:`, error.message);
            }
        }
        
        console.log('\n=== Migration Complete ===');
        console.log(`Successfully migrated: ${migratedCount}`);
        console.log(`Errors: ${errorCount}`);
        
        if (errors.length > 0) {
            console.log('\nErrors:');
            errors.forEach(err => {
                console.log(`  Visit ${err.visitId}: ${err.error}`);
            });
        }
        
        await mongoose.connection.close();
        console.log('Database connection closed');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

/**
 * Convert array of file path strings to metadata objects
 */
async function migrateFileArray(filePaths, fileType, visitId) {
    const metadataArray = [];
    
    for (const filePath of filePaths) {
        try {
            const metadata = await createMetadataFromPath(filePath, fileType, visitId);
            if (metadata) {
                metadataArray.push(metadata);
            }
        } catch (error) {
            console.warn(`  Warning: Could not migrate file ${filePath}:`, error.message);
            // Still add basic metadata even if file is missing
            metadataArray.push({
                filename: path.basename(filePath),
                originalName: path.basename(filePath),
                path: filePath,
                size: 0,
                mimetype: guessMimeType(filePath, fileType),
                uploadedAt: new Date(),
                storageType: 'local',
                processed: false,
                processingError: 'File not found during migration'
            });
        }
    }
    
    return metadataArray;
}

/**
 * Create metadata object from file path
 */
async function createMetadataFromPath(filePath, fileType, visitId) {
    // Handle both absolute and relative paths
    let absolutePath = filePath;
    
    // If path starts with /uploads, it's relative to backend directory
    if (filePath.startsWith('/uploads')) {
        absolutePath = path.join(__dirname, filePath.replace(/^\/uploads\//, 'uploads/'));
    }
    
    try {
        // Check if file exists
        const stats = await fs.stat(absolutePath);
        
        const metadata = {
            filename: path.basename(absolutePath),
            originalName: path.basename(absolutePath),
            path: absolutePath,
            size: stats.size,
            mimetype: guessMimeType(absolutePath, fileType),
            uploadedAt: stats.birthtime || stats.mtime || new Date(),
            storageType: 'local',
            processed: false
        };
        
        return metadata;
        
    } catch (error) {
        // File doesn't exist
        throw new Error(`File not found: ${absolutePath}`);
    }
}

/**
 * Guess MIME type from file extension and type
 */
function guessMimeType(filePath, fileType) {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes = {
        photos: {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        },
        videos: {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.webm': 'video/webm',
            '.mpeg': 'video/mpeg'
        },
        docs: {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
    };
    
    return mimeTypes[fileType]?.[ext] || 'application/octet-stream';
}

/**
 * Organize files by type (optional - run after migration)
 * Moves files from old structure to new organized structure
 */
async function organizeFilesByType() {
    try {
        console.log('Starting file organization...');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sas', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        const visits = await Visit.find({});
        const uploadsDir = path.join(__dirname, 'uploads');
        const photosDir = path.join(uploadsDir, 'photos');
        const videosDir = path.join(uploadsDir, 'videos');
        const docsDir = path.join(uploadsDir, 'docs');
        
        // Create new directory structure
        await fs.mkdir(photosDir, { recursive: true });
        await fs.mkdir(videosDir, { recursive: true });
        await fs.mkdir(docsDir, { recursive: true });
        
        let movedCount = 0;
        
        for (const visit of visits) {
            const visitId = visit._id.toString();
            
            // Move photos
            if (visit.photos?.length > 0) {
                const photoDir = path.join(photosDir, visitId);
                await fs.mkdir(photoDir, { recursive: true });
                
                for (const photo of visit.photos) {
                    if (photo.path) {
                        const newPath = path.join(photoDir, photo.filename);
                        try {
                            await fs.copyFile(photo.path, newPath);
                            photo.path = newPath;
                            movedCount++;
                        } catch (error) {
                            console.warn(`  Warning: Could not move ${photo.path}`);
                        }
                    }
                }
            }
            
            // Move videos
            if (visit.videos?.length > 0) {
                const videoDir = path.join(videosDir, visitId);
                await fs.mkdir(videoDir, { recursive: true });
                
                for (const video of visit.videos) {
                    if (video.path) {
                        const newPath = path.join(videoDir, video.filename);
                        try {
                            await fs.copyFile(video.path, newPath);
                            video.path = newPath;
                            movedCount++;
                        } catch (error) {
                            console.warn(`  Warning: Could not move ${video.path}`);
                        }
                    }
                }
            }
            
            // Move docs
            if (visit.docs?.length > 0) {
                const docDir = path.join(docsDir, visitId);
                await fs.mkdir(docDir, { recursive: true });
                
                for (const doc of visit.docs) {
                    if (doc.path) {
                        const newPath = path.join(docDir, doc.filename);
                        try {
                            await fs.copyFile(doc.path, newPath);
                            doc.path = newPath;
                            movedCount++;
                        } catch (error) {
                            console.warn(`  Warning: Could not move ${doc.path}`);
                        }
                    }
                }
            }
            
            await visit.save();
        }
        
        console.log(`\n✓ Organized ${movedCount} files into new structure`);
        console.log('\nOld files are still in place. To delete them:');
        console.log('  1. Verify new structure is working correctly');
        console.log('  2. Delete old files manually or run cleanup script');
        
        await mongoose.connection.close();
        
    } catch (error) {
        console.error('Organization failed:', error);
        process.exit(1);
    }
}

// Run migration
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'migrate') {
        migrateFileMetadata();
    } else if (command === 'organize') {
        organizeFilesByType();
    } else {
        console.log('Usage:');
        console.log('  node backend/scripts/migrate-storage.js migrate    - Migrate metadata');
        console.log('  node backend/scripts/migrate-storage.js organize   - Organize file structure');
        process.exit(1);
    }
}

module.exports = {
    migrateFileMetadata,
    organizeFilesByType
};
