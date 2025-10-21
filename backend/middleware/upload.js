const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const visitId = req.params.id || 'temp';
        const visitDir = path.join(uploadDir, visitId);
        
        // Create visit-specific directory
        if (!fs.existsSync(visitDir)) {
            fs.mkdirSync(visitDir, { recursive: true });
        }
        
        cb(null, visitDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Allow images, videos and common document types
    if (
        file.mimetype.startsWith('image/') ||
        file.mimetype.startsWith('video/') ||
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
        cb(null, true);
    } else {
        cb(new Error('Only image, video and document files are allowed!'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 10 // Maximum 10 files
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