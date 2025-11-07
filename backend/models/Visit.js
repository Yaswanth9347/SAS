const mongoose = require("mongoose");

// ============================================
// HYBRID STORAGE APPROACH - FILE METADATA SCHEMA
// Stores file information in MongoDB while
// actual media files stored in File System
// Ready for Cloud Storage migration
// ============================================

const fileMetadataSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    storageType: {
      type: String,
      enum: ["local", "cloud"],
      default: "local",
    },
    cloudUrl: {
      type: String,
    }, // For future S3/Cloudinary

    // Photo-specific metadata
    width: { type: Number },
    height: { type: Number },

    // Video-specific metadata
    duration: { type: Number }, // in seconds
    thumbnail: { type: String }, // thumbnail path

    // Document-specific metadata
    pageCount: { type: Number },

    // Processing status for thumbnails/optimization
    processed: {
      type: Boolean,
      default: false,
    },
    processingError: {
      type: String,
    },
  },
  { _id: true }
);

const visitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      required: true,
    },
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    assignedClass: {
      type: String,
      required: true,
    },
    // optional list of individual members (names or ids) who attended
    members: [
      {
        type: String,
      },
    ],
    topicsCovered: [String],
    teachingMethods: [String],
    childrenCount: {
      type: Number,
      required: true,
    },
    childrenResponse: {
      type: String,
      enum: ["excellent", "good", "average", "poor"],
      required: false,
    },
    challengesFaced: String,
    suggestions: String,

  // Upload window control (UTC instants computed from IST local noon)
  uploadWindowStartUtc: { type: Date },
  uploadWindowEndUtc: { type: Date },
  timezone: { type: String, default: 'Asia/Kolkata' },
  uploadVisibility: { type: String, enum: ['public', 'private'], default: 'public' },
  // Notification flags to avoid duplicate worker sends
  windowOpenNotified: { type: Boolean, default: false },
  windowClosingNotified: { type: Boolean, default: false },
  windowClosedNotified: { type: Boolean, default: false },

    // Enhanced file storage with full metadata (Hybrid Approach)
    photos: {
      type: [fileMetadataSchema],
      default: [],
    },
    videos: {
      type: [fileMetadataSchema],
      default: [],
    },
    docs: {
      type: [fileMetadataSchema],
      default: [],
    },
    // total classes planned for the visit and how many were actually visited
    totalClasses: {
      type: Number,
      default: 0,
    },
    classesVisited: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["scheduled", "visited", "completed", "cancelled"],
      default: "scheduled",
    },
    // Track when visit was marked as visited (for 48-hour completion rule)
    visitedAt: {
      type: Date,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    submissionDate: Date,
    feedbackFromSchool: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comments: String,
      submittedBy: String,
      submittedDate: Date,
      contactInfo: {
        name: String,
        position: String,
        phone: String,
        email: String,
      },
    },
    // Report generation fields
    reportStatus: {
      type: String,
      enum: ["none", "draft", "final"],
      default: "none",
    },
    reportDraft: {
      type: Object,
      default: null,
    },
    reportDraftUpdatedAt: { type: Date },
    reportSnapshot: {
      type: Object,
      default: null,
    },
    reportPdfPath: {
      type: String,
      default: null,
    },
    reportFinalizedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Helper method to convert file metadata to URL
function fileMetadataToUrl(fileMetadata) {
  if (!fileMetadata) return null;

  // If it's already a string, normalize it
  if (typeof fileMetadata === "string") {
    let urlPath = fileMetadata;
    // Convert Windows backslashes to forward slashes
    urlPath = urlPath.replace(/\\/g, "/");
    
    // If already starts with /uploads/, return as-is
    if (urlPath.startsWith("/uploads/")) {
      return urlPath;
    }
    
    // Extract from uploads/ onwards
    const uploadsIndex = urlPath.indexOf("/uploads/");
    if (uploadsIndex !== -1) {
      return urlPath.substring(uploadsIndex);
    }
    
    const uploadsIndex2 = urlPath.indexOf("uploads/");
    if (uploadsIndex2 !== -1) {
      return "/" + urlPath.substring(uploadsIndex2);
    }
    
    // If path looks absolute (contains full path), try to extract just filename
    if (urlPath.includes("/")) {
      const parts = urlPath.split("/");
      const filename = parts[parts.length - 1];
      // Try to reconstruct based on common patterns
      if (urlPath.includes("photos/")) {
        const idx = urlPath.indexOf("photos/");
        return "/uploads/" + urlPath.substring(idx);
      }
      if (urlPath.includes("videos/")) {
        const idx = urlPath.indexOf("videos/");
        return "/uploads/" + urlPath.substring(idx);
      }
      if (urlPath.includes("docs/")) {
        const idx = urlPath.indexOf("docs/");
        return "/uploads/" + urlPath.substring(idx);
      }
    }
    
    return urlPath;
  }

  // If it's an object with path, convert to URL
  if (fileMetadata.path) {
    let urlPath = fileMetadata.path;

    // Convert Windows backslashes to forward slashes
    urlPath = urlPath.replace(/\\/g, "/");

    // If already starts with /uploads/, return as-is
    if (urlPath.startsWith("/uploads/")) {
      return urlPath;
    }

    // Extract the path from 'uploads/' onwards (handle both absolute and relative paths)
    const uploadsIndex = urlPath.indexOf("/uploads/");
    if (uploadsIndex !== -1) {
      // Extract everything from '/uploads/' onwards
      urlPath = urlPath.substring(uploadsIndex);
    } else {
      const uploadsIndex2 = urlPath.indexOf("uploads/");
      if (uploadsIndex2 !== -1) {
        urlPath = "/" + urlPath.substring(uploadsIndex2);
      } else if (!urlPath.startsWith("/uploads/")) {
        // Try to find common patterns
        if (urlPath.includes("photos/")) {
          const idx = urlPath.indexOf("photos/");
          urlPath = "/uploads/" + urlPath.substring(idx);
        } else if (urlPath.includes("videos/")) {
          const idx = urlPath.indexOf("videos/");
          urlPath = "/uploads/" + urlPath.substring(idx);
        } else if (urlPath.includes("docs/")) {
          const idx = urlPath.indexOf("docs/");
          urlPath = "/uploads/" + urlPath.substring(idx);
        } else {
          // Last resort: prepend /uploads/
          urlPath = "/uploads/" + urlPath.replace(/^\/+/, "");
        }
      }
    }

    return urlPath;
  }

  return null;
}

// Transform file metadata arrays to URL arrays when converting to JSON
visitSchema.methods.toJSON = function () {
  const visit = this.toObject();

  // Transform photos array
  if (visit.photos && Array.isArray(visit.photos)) {
    visit.photos = visit.photos
      .map((p) => fileMetadataToUrl(p))
      .filter(Boolean);
  }

  // Transform videos array
  if (visit.videos && Array.isArray(visit.videos)) {
    visit.videos = visit.videos
      .map((v) => fileMetadataToUrl(v))
      .filter(Boolean);
  }

  // Transform docs array
  if (visit.docs && Array.isArray(visit.docs)) {
    visit.docs = visit.docs.map((d) => fileMetadataToUrl(d)).filter(Boolean);
  }

  return visit;
};

// ============================================
// DATABASE INDEXES FOR PERFORMANCE OPTIMIZATION
// ============================================

// Existing compound indexes
visitSchema.index({ date: 1, team: 1 });
visitSchema.index({ school: 1, status: 1 });

// Index for status-based queries (scheduled, visited, completed, cancelled)
visitSchema.index({ status: 1 });

// Index for date-based queries (sorted by date descending for recent visits)
visitSchema.index({ date: -1 });

// Compound index for team visits by date
visitSchema.index({ team: 1, date: -1 });

// Compound index for school visits by date
visitSchema.index({ school: 1, date: -1 });

// Index for submitted visits
visitSchema.index({ submittedBy: 1, submissionDate: -1 });

// Index for report status queries
visitSchema.index({ reportStatus: 1 });

// Compound index for visits with reports by date
visitSchema.index({ reportStatus: 1, date: -1 });

// Index for upload window queries
visitSchema.index({ uploadWindowStartUtc: 1, uploadWindowEndUtc: 1 });

// Compound index for active visits within upload window
visitSchema.index({ status: 1, uploadWindowStartUtc: 1, uploadWindowEndUtc: 1 });

// Index for visited date tracking (48-hour completion rule)
visitSchema.index({ visitedAt: 1, status: 1 });

// Index for notification flags (avoid duplicate sends)
visitSchema.index({ 
    windowOpenNotified: 1, 
    windowClosingNotified: 1, 
    windowClosedNotified: 1 
});

// Text index for search functionality
visitSchema.index({
    name: 'text',
    topicsCovered: 'text',
    challengesFaced: 'text',
    suggestions: 'text'
});

// Compound index for analytics queries (team performance over time)
visitSchema.index({ team: 1, status: 1, date: -1 });

// Compound index for school analytics
visitSchema.index({ school: 1, status: 1, date: -1 });

// Index for timestamps (createdAt, updatedAt)
visitSchema.index({ createdAt: -1 });
visitSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("Visit", visitSchema);
