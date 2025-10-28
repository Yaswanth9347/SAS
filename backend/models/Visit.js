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
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
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
  },
  {
    timestamps: true,
  }
);

// Helper method to convert file metadata to URL
function fileMetadataToUrl(fileMetadata) {
  if (!fileMetadata) return null;

  // If it's already a string, return as-is (backward compatibility)
  if (typeof fileMetadata === "string") {
    return fileMetadata;
  }

  // If it's an object with path, convert to URL
  if (fileMetadata.path) {
    let urlPath = fileMetadata.path;

    // Convert Windows backslashes to forward slashes
    urlPath = urlPath.replace(/\\/g, "/");

    // Extract the path from 'uploads/' onwards (handle both absolute and relative paths)
    const uploadsIndex = urlPath.indexOf("/uploads/");
    if (uploadsIndex !== -1) {
      // Extract everything from '/uploads/' onwards (keep 'uploads' in the path)
      urlPath = urlPath.substring(uploadsIndex);
    } else {
      // Fallback: if path starts with 'uploads/', ensure leading slash
      if (urlPath.startsWith("uploads/")) {
        urlPath = "/" + urlPath;
      } else if (!urlPath.startsWith("/uploads/")) {
        // If it doesn't have uploads prefix at all, add it
        urlPath = "/uploads/" + urlPath;
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

// Index for better query performance
visitSchema.index({ date: 1, team: 1 });
visitSchema.index({ school: 1, status: 1 });

module.exports = mongoose.model("Visit", visitSchema);
