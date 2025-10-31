const Visit = require('../models/Visit');
const Team = require('../models/Team');
const School = require('../models/School');
const { optimizePhoto, generateThumbnail } = require('../utils/imageOptimizer');

// @desc    Get all visits
// @route   GET /api/visits
// @access  Private
exports.getVisits = async (req, res, next) => {
  try {
    // Auto-update past scheduled visits to completed
    await updatePastVisits();

    let query;
    const { status, month, year, team } = req.query;

    // All users can see all visits (removed role-based restrictions)
    query = Visit.find();

    // Apply team filter if provided
    if (team) {
      query = query.where("team").equals(team);
    }

    // Apply status filter if provided
    if (status && ["scheduled", "completed", "cancelled"].includes(status)) {
      query = query.where("status").equals(status);
    }

    // Apply date filter if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query = query.where("date").gte(startDate).lte(endDate);
    }

    const visits = await query
      .populate("school", "name address contactPerson")
      .populate("team", "name")
      .populate("submittedBy", "name role")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: visits.length,
      data: visits,
    });
  } catch (error) {
    console.error("Error in getVisits:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single visit
// @route   GET /api/visits/:id
// @access  Private
exports.getVisit = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate("school", "name address contactPerson")
      .populate("team", "name")
      .populate("submittedBy", "name email role");

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    // All authenticated users can view all visits (removed role-based restrictions)

    res.status(200).json({
      success: true,
      data: visit,
    });
  } catch (error) {
    console.error("Error in getVisit:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Helpers for IST window
function computeIstUploadWindow(date) {
  // date: JS Date assumed UTC instant of the scheduled visit date/time
  // We want windowStart at 12:00 PM IST on that visit's calendar day, and windowEnd +48h
  // IST offset is +5:30 hours, no DST.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const utcMs = new Date(date).getTime();
  const istMs = utcMs + IST_OFFSET_MS;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  // Midnight IST in UTC = 00:00 IST -> subtract offset from UTC midnight
  const midnightIstUtcMs = Date.UTC(y, m, d, 0, 0, 0) - IST_OFFSET_MS;
  const windowStartUtc = new Date(midnightIstUtcMs + 12 * 60 * 60 * 1000); // 12:00 IST in UTC
  const windowEndUtc = new Date(windowStartUtc.getTime() + 48 * 60 * 60 * 1000);
  return { windowStartUtc, windowEndUtc };
}

function isWithinUploadWindow(visit, now = new Date()) {
  if (!visit.uploadWindowStartUtc || !visit.uploadWindowEndUtc) return false;
  const n = now.getTime();
  return n >= new Date(visit.uploadWindowStartUtc).getTime() && n <= new Date(visit.uploadWindowEndUtc).getTime();
}

async function requireTeamMemberOrAdmin(req, visit) {
  if (req.user?.role === 'admin') return true;
  try {
    const team = await Team.findById(visit.team).select('members');
    const userId = String(req.user.id);
    return team && Array.isArray(team.members) && team.members.map(String).includes(userId);
  } catch (_) {
    return false;
  }
}

// @desc    Create new visit
// @route   POST /api/visits
// @access  Private (Both admin and volunteer with appropriate validation)
const mongoose = require("mongoose");

exports.createVisit = async (req, res, next) => {
  try {
    // Validate required fields
    if (!req.body.team || !mongoose.Types.ObjectId.isValid(req.body.team)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing team ID" });
    }
    if (!req.body.school || !mongoose.Types.ObjectId.isValid(req.body.school)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing school ID" });
    }
    if (!req.body.date) {
      return res
        .status(400)
        .json({ success: false, message: "Visit date is required" });
    }
    if (!req.body.assignedClass) {
      return res
        .status(400)
        .json({ success: false, message: "Assigned class is required" });
    }

    // Ensure referenced team and school exist
    const teamExists = await Team.findById(req.body.team).select("_id name members");
    if (!teamExists) {
      return res
        .status(404)
        .json({ success: false, message: "Team not found" });
    }

    const schoolExists = await School.findById(req.body.school).select(
      "_id name"
    );
    if (!schoolExists) {
      return res
        .status(404)
        .json({ success: false, message: "School not found" });
    }

    // Check if team is available on that date (prevent double booking)
    const visitDate = new Date(req.body.date);
    const startOfDay = new Date(
      visitDate.getFullYear(),
      visitDate.getMonth(),
      visitDate.getDate()
    );
    const endOfDay = new Date(
      visitDate.getFullYear(),
      visitDate.getMonth(),
      visitDate.getDate(),
      23,
      59,
      59
    );

    const existingVisit = await Visit.findOne({
      team: req.body.team,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["scheduled", "completed"] },
    });

    if (existingVisit) {
      return res.status(400).json({
        success: false,
        message: "Team already has a visit scheduled on this date",
      });
    }

    // Create the visit with proper default values
    const visitData = {
      ...req.body,
      status: req.body.status || "scheduled",
      submittedBy: req.user.id,
      childrenCount: req.body.childrenCount || 30,
      totalClasses: req.body.totalClasses || 1,
      classesVisited: req.body.classesVisited || 0,
    };

    // Compute upload window based on scheduled date (12:00 IST -> +48h)
    const win = computeIstUploadWindow(visitData.date);
    const visit = await Visit.create({
      ...visitData,
      uploadWindowStartUtc: win.windowStartUtc,
      uploadWindowEndUtc: win.windowEndUtc,
      uploadVisibility: 'public',
      timezone: 'Asia/Kolkata'
    });

    // Populate the created visit for response
    const populatedVisit = await Visit.findById(visit._id)
      .populate("school", "name address contactPerson")
      .populate("team", "name")
      .populate("submittedBy", "name role");

    // Notify: broadcast to all users as per requirement
    try {
      const { notifyUsers } = require("../utils/notificationService");
      const User = require('../models/User');
      const allUsers = await User.find({}).select('_id');
      const allIds = allUsers.map(u => u._id.toString());
      await notifyUsers(allIds, {
        title: "New Visit Scheduled",
        message: `${schoolExists.name}: ${new Date(visit.date).toLocaleDateString()} (uploads open 12:00 PM IST on visit day)`,
        type: "visit",
        link: `/frontend/visits.html`,
        meta: { visitId: visit._id, date: visit.date, schoolName: schoolExists.name },
        emailTemplate: "visitScheduled",
      });
    } catch (e) {
      console.warn("Notify visit schedule failed:", e.message);
    }

    res.status(201).json({
      success: true,
      data: populatedVisit,
      message: `Visit created successfully and assigned to ${teamExists.name}`,
    });
  } catch (error) {
    console.error("Error in createVisit:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Submit visit report
// @route   PUT /api/visits/:id/submit
// @access  Private
exports.submitVisitReport = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    // Enforce window and membership for submit
    if (!visit.uploadWindowStartUtc || !visit.uploadWindowEndUtc) {
      const win = computeIstUploadWindow(visit.date);
      visit.uploadWindowStartUtc = win.windowStartUtc;
      visit.uploadWindowEndUtc = win.windowEndUtc;
      await visit.save();
    }
    const isMember = await requireTeamMemberOrAdmin(req, visit);
    if (!isMember) return res.status(403).json({ success: false, message: 'Only assigned team members or admins can submit report.' });
    if (new Date() > new Date(visit.uploadWindowEndUtc)) {
      const end = new Date(visit.uploadWindowEndUtc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      return res.status(403).json({ success: false, message: `Uploads and edits closed at ${end}.` });
    }

    const reportData = {
      ...req.body,
      status: "completed",
      submittedBy: req.user.id,
      submissionDate: new Date(),
    };

    const updatedVisit = await Visit.findByIdAndUpdate(
      req.params.id,
      reportData,
      { new: true, runValidators: true }
    )
      .populate("school")
      .populate("team")
      .populate("submittedBy", "name");

    res.status(200).json({
      success: true,
      data: updatedVisit,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get visits statistics
// @route   GET /api/visits/stats
// @access  Private
exports.getVisitStats = async (req, res, next) => {
  try {
    let matchQuery = {};

    // All users can see all statistics (removed role-based restrictions)

    const stats = await Visit.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: 1 },
          completedVisits: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          scheduledVisits: {
            $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] },
          },
          cancelledVisits: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          totalChildren: { $sum: "$childrenCount" },
          averageChildren: { $avg: "$childrenCount" },
        },
      },
    ]);

    // Get monthly stats for the last 6 months
    const monthlyStats = await Visit.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          visits: { $sum: 1 },
          children: { $sum: "$childrenCount" },
          completedVisits: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...(stats[0] || {
          totalVisits: 0,
          completedVisits: 0,
          scheduledVisits: 0,
          cancelledVisits: 0,
          totalChildren: 0,
          averageChildren: 0,
        }),
        monthlyStats,
      },
    });
  } catch (error) {
    console.error("Error in getVisitStats:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Cancel a visit
// @route   PUT /api/visits/:id/cancel
// @access  Private/Admin
exports.cancelVisit = async (req, res, next) => {
  try {
    const visit = await Visit.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true }
    );

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    res.status(200).json({
      success: true,
      data: visit,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const { uploadVisitFiles } = require("../middleware/upload");
const { processUploadedFiles } = require("../utils/fileProcessing");
const fs = require("fs");
const path = require("path");
const { generateVisitReportPdf } = require('../utils/pdfService');

// @desc    Upload files for visit report
// @route   POST /api/visits/:id/upload
// @access  Private
exports.uploadVisitFiles = uploadVisitFiles;

exports.handleFileUpload = async (req, res, next) => {
  try {
    console.log("HandleFileUpload received files:", req.files);
    console.log("HandleFileUpload received body:", req.body);

    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      // Clean up uploaded files if visit doesn't exist
      if (req.files) {
        if (Array.isArray(req.files)) {
          // Handle array of files from multer.any()
          req.files.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error("Error deleting file:", e);
            }
          });
        } else {
          // Handle object of file arrays from multer.fields()
          Object.values(req.files).forEach((files) => {
            files.forEach((file) => {
              try {
                fs.unlinkSync(file.path);
              } catch (e) {
                console.error("Error deleting file:", e);
              }
            });
          });
        }
      }
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    // Enforce upload window and membership
    if (!visit.uploadWindowStartUtc || !visit.uploadWindowEndUtc) {
      const win = computeIstUploadWindow(visit.date);
      visit.uploadWindowStartUtc = win.windowStartUtc;
      visit.uploadWindowEndUtc = win.windowEndUtc;
      await visit.save();
    }

    const within = isWithinUploadWindow(visit);
    const isMember = await requireTeamMemberOrAdmin(req, visit);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Only assigned team members or admins can upload files for this visit.' });
    }
    if (!within) {
      const now = new Date();
      const start = new Date(visit.uploadWindowStartUtc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const end = new Date(visit.uploadWindowEndUtc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const msg = now < new Date(visit.uploadWindowStartUtc)
        ? `Uploads open at 12:00 PM IST on the visit date (${start}).`
        : `Uploads closed at ${end} (48 hours after start).`;
      return res.status(403).json({ success: false, message: msg });
    }

    const fileData = {
      photos: [],
      videos: [],
      docs: [],
    };

    // Process uploaded files with enhanced metadata (Hybrid Approach)
    if (req.files) {
      if (Array.isArray(req.files)) {
        // Handle files from multer.any()
        const photoFiles = req.files.filter(
          (file) => file.fieldname === "photos"
        );
        const videoFiles = req.files.filter(
          (file) => file.fieldname === "videos"
        );
        const docFiles = req.files.filter((file) => file.fieldname === "docs");

        if (photoFiles.length > 0) {
          const processedPhotos = await processUploadedFiles(
            photoFiles,
            "photos"
          );
          fileData.photos = processedPhotos;
          visit.photos = (visit.photos || []).concat(processedPhotos);
        }

        if (videoFiles.length > 0) {
          const processedVideos = await processUploadedFiles(
            videoFiles,
            "videos"
          );
          fileData.videos = processedVideos;
          visit.videos = (visit.videos || []).concat(processedVideos);
        }

        if (docFiles.length > 0) {
          const processedDocs = await processUploadedFiles(docFiles, "docs");
          fileData.docs = processedDocs;
          visit.docs = (visit.docs || []).concat(processedDocs);
        }
      } else {
        // Handle files from multer.fields()
        if (req.files.photos) {
          const processedPhotos = await processUploadedFiles(
            req.files.photos,
            "photos"
          );
          fileData.photos = processedPhotos;
          visit.photos = (visit.photos || []).concat(processedPhotos);
        }
        if (req.files.videos) {
          const processedVideos = await processUploadedFiles(
            req.files.videos,
            "videos"
          );
          fileData.videos = processedVideos;
          visit.videos = (visit.videos || []).concat(processedVideos);
        }
        if (req.files.docs) {
          const processedDocs = await processUploadedFiles(
            req.files.docs,
            "docs"
          );
          fileData.docs = processedDocs;
          visit.docs = (visit.docs || []).concat(processedDocs);
        }
      }
      // persist visit with new media metadata
      await visit.save();
    }

    res.status(200).json({
      success: true,
      data: fileData,
      message: "Files uploaded successfully with metadata",
    });
  } catch (error) {
    // Clean up files on error
    if (req.files) {
      if (Array.isArray(req.files)) {
        // Handle array of files from multer.any()
        req.files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error("Error deleting file:", e);
            }
          }
        });
      } else {
        // Handle object of file arrays from multer.fields()
        Object.values(req.files).forEach((files) => {
          files.forEach((file) => {
            if (fs.existsSync(file.path)) {
              try {
                fs.unlinkSync(file.path);
              } catch (e) {
                console.error("Error deleting file:", e);
              }
            }
          });
        });
      }
    }
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Submit complete visit report with files
// @route   PUT /api/visits/:id/complete-report
// @access  Private
exports.submitCompleteReport = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    // Only team members/admins may submit; enforce time window
    if (!visit.uploadWindowStartUtc || !visit.uploadWindowEndUtc) {
      const win = computeIstUploadWindow(visit.date);
      visit.uploadWindowStartUtc = win.windowStartUtc;
      visit.uploadWindowEndUtc = win.windowEndUtc;
      await visit.save();
    }
    const isMember = await requireTeamMemberOrAdmin(req, visit);
    if (!isMember) return res.status(403).json({ success: false, message: 'Only assigned team members or admins can submit report.' });
    // Block submissions before window opens (e.g., before 12:00 PM IST on visit date)
    if (new Date() < new Date(visit.uploadWindowStartUtc)) {
      const start = new Date(visit.uploadWindowStartUtc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      return res.status(403).json({ success: false, message: `Report submissions open at 12:00 PM IST on the visit date (${start}).` });
    }
    if (new Date() > new Date(visit.uploadWindowEndUtc)) {
      const end = new Date(visit.uploadWindowEndUtc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      return res.status(403).json({ success: false, message: `Uploads and edits closed at ${end}.` });
    }

    const reportData = {
      ...req.body,
      topicsCovered: req.body.topicsCovered
        ? req.body.topicsCovered.split(",").map((topic) => topic.trim())
        : [],
      teachingMethods: req.body.teachingMethods
        ? req.body.teachingMethods.split(",").map((method) => method.trim())
        : [],
      status: "completed",
      submittedBy: req.user.id,
      submissionDate: new Date(),
    };

    const updatedVisit = await Visit.findByIdAndUpdate(
      req.params.id,
      reportData,
      { new: true, runValidators: true }
    )
      .populate("school")
      .populate("team")
      .populate("submittedBy", "name");

    res.status(200).json({
      success: true,
      data: updatedVisit,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all gallery media from all visits with filters
// @route   GET /api/visits/gallery/all
// @access  Private
exports.getAllGalleryMedia = async (req, res, next) => {
  try {
    // Auto-update past scheduled visits to completed
    await updatePastVisits();

    const {
      team,
      school,
      startDate,
      endDate,
      recent,
      page = 1,
      limit = 50,
      sortBy = "recent",
    } = req.query;

    // Build query for visits (any status) with media so media is visible to all authenticated users
    let query = Visit.find({
      $or: [
        { photos: { $exists: true, $not: { $size: 0 } } },
        { videos: { $exists: true, $not: { $size: 0 } } },
        { docs: { $exists: true, $not: { $size: 0 } } },
      ],
    });

    // Apply filters
    if (team) {
      query = query.where("team").equals(team);
    }

    if (school) {
      query = query.where("school").equals(school);
    }

    // Date range filter
    if (startDate && endDate) {
      query = query
        .where("date")
        .gte(new Date(startDate))
        .lte(new Date(endDate));
    }

    // Recent filter (last N days)
    if (recent) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(recent));
      query = query.where("date").gte(daysAgo);
    }

    // Sort by date (most recent first by default)
    if (sortBy === "recent" || sortBy === "date") {
      query = query.sort({ date: -1 });
    } else if (sortBy === "oldest") {
      query = query.sort({ date: 1 });
    }

    // Populate related data
    query = query
      .populate("school", "name address")
      .populate("team", "name")
      .select("photos videos date school team name");

    // Execute query
    const visits = await query;

    // Aggregate all media from visits
    const allMedia = [];
    visits.forEach((visit) => {
      // Process photos
      if (visit.photos && visit.photos.length > 0) {
        visit.photos.forEach((photo) => {
          // Handle both object (with metadata) and string (legacy) formats
          let photoUrl =
            typeof photo === "object" ? photo.cloudUrl || photo.path : photo;

          // Normalize the path (convert absolute paths to web paths)
          photoUrl = normalizeFilePath(photoUrl);

          allMedia.push({
            url: photoUrl,
            type: "photo",
            visitId: visit._id,
            visitName: visit.name || "",
            visitDate: visit.date,
            school: visit.school
              ? {
                  id: visit.school._id,
                  name: visit.school.name,
                }
              : null,
            team: visit.team
              ? {
                  id: visit.team._id,
                  name: visit.team.name,
                }
              : null,
          });
        });
      }

      // Process videos
      if (visit.videos && visit.videos.length > 0) {
        visit.videos.forEach((video) => {
          // Handle both object (with metadata) and string (legacy) formats
          let videoUrl =
            typeof video === "object" ? video.cloudUrl || video.path : video;

          // Normalize the path (convert absolute paths to web paths)
          videoUrl = normalizeFilePath(videoUrl);

          allMedia.push({
            url: videoUrl,
            type: "video",
            visitId: visit._id,
            visitName: visit.name || "",
            visitDate: visit.date,
            school: visit.school
              ? {
                  id: visit.school._id,
                  name: visit.school.name,
                }
              : null,
            team: visit.team
              ? {
                  id: visit.team._id,
                  name: visit.team.name,
                }
              : null,
          });
        });
      }

      // Process documents
      if (visit.docs && visit.docs.length > 0) {
        visit.docs.forEach((doc) => {
          let docUrl =
            typeof doc === "object" ? doc.cloudUrl || doc.path : doc;

          docUrl = normalizeFilePath(docUrl);

          allMedia.push({
            url: docUrl,
            type: "doc",
            name: typeof doc === "object" ? (doc.originalName || doc.filename || "Document") : "Document",
            visitId: visit._id,
            visitName: visit.name || "",
            visitDate: visit.date,
            school: visit.school
              ? {
                  id: visit.school._id,
                  name: visit.school.name,
                }
              : null,
            team: visit.team
              ? {
                  id: visit.team._id,
                  name: visit.team.name,
                }
              : null,
          });
        });
      }
    });

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedMedia = allMedia.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      count: allMedia.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(allMedia.length / parseInt(limit)),
      data: paginatedMedia,
    });
  } catch (error) {
    console.error("Error in getAllGalleryMedia:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get visit gallery (photos and videos)
// @route   GET /api/visits/:id/gallery
// @access  Private
exports.getVisitGallery = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .select("photos videos docs school date")
      .populate("school", "name");

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    // Normalize photo and video paths
    const normalizedPhotos = (visit.photos || []).map((photo) => {
      if (typeof photo === "object" && photo !== null) {
        return {
          ...photo.toObject(),
          path: normalizeFilePath(photo.cloudUrl || photo.path),
        };
      }
      return normalizeFilePath(photo);
    });

    const normalizedVideos = (visit.videos || []).map((video) => {
      if (typeof video === "object" && video !== null) {
        return {
          ...video.toObject(),
          path: normalizeFilePath(video.cloudUrl || video.path),
        };
      }
      return normalizeFilePath(video);
    });

    const normalizedDocs = (visit.docs || []).map((doc) => {
      if (typeof doc === "object" && doc !== null) {
        return {
          ...doc.toObject(),
          path: normalizeFilePath(doc.cloudUrl || doc.path),
        };
      }
      return normalizeFilePath(doc);
    });

    res.status(200).json({
      success: true,
      data: {
        photos: normalizedPhotos,
        videos: normalizedVideos,
        docs: normalizedDocs,
        school: visit.school,
        date: visit.date,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update visit
// @route   PUT /api/visits/:id
// @access  Private
exports.updateVisit = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit)
      return res
        .status(404)
        .json({ success: false, message: "Visit not found" });

    // Enforce window for edits (block after windowEnd)
    if (!visit.uploadWindowStartUtc || !visit.uploadWindowEndUtc) {
      const win = computeIstUploadWindow(visit.date);
      visit.uploadWindowStartUtc = win.windowStartUtc;
      visit.uploadWindowEndUtc = win.windowEndUtc;
      await visit.save();
    }
    if (new Date() > new Date(visit.uploadWindowEndUtc)) {
      const end = new Date(visit.uploadWindowEndUtc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      return res.status(403).json({ success: false, message: `Edits are closed for this visit as of ${end}.` });
    }

    // If team or school are provided in update, validate them
    if (req.body.team && !mongoose.Types.ObjectId.isValid(req.body.team)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid team id" });
    }
    if (req.body.school && !mongoose.Types.ObjectId.isValid(req.body.school)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid school id" });
    }
    if (req.body.team) {
      const teamExists = await Team.findById(req.body.team).select("_id");
      if (!teamExists)
        return res
          .status(404)
          .json({ success: false, message: "Team not found" });
    }
    if (req.body.school) {
      const schoolExists = await School.findById(req.body.school).select("_id");
      if (!schoolExists)
        return res
          .status(404)
          .json({ success: false, message: "School not found" });
    }

    // Recompute window if date is updated
    let body = { ...req.body };
    if (req.body.date) {
      const win = computeIstUploadWindow(req.body.date);
      body.uploadWindowStartUtc = win.windowStartUtc;
      body.uploadWindowEndUtc = win.windowEndUtc;
    }

    const updated = await Visit.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    })
      .populate("school")
      .populate("team")
      .populate("submittedBy", "name");

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete visit
// @route   DELETE /api/visits/:id
// @access  Private
exports.deleteVisit = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit)
      return res
        .status(404)
        .json({ success: false, message: "Visit not found" });

    // All users can delete all visits (removed role-based restrictions)

    // delete upload directory if exists
    const uploadDir = path.join(__dirname, "../uploads", String(visit._id));
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }

    await Visit.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: "Visit deleted" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a media URL from visit (photos/videos/docs)
// @route   DELETE /api/visits/:id/media
// @access  Private
exports.deleteMedia = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url)
      return res
        .status(400)
        .json({ success: false, message: "Media url required" });
    const visit = await Visit.findById(req.params.id);
    if (!visit)
      return res
        .status(404)
        .json({ success: false, message: "Visit not found" });

    // Enforce window and membership for delete
    if (!visit.uploadWindowStartUtc || !visit.uploadWindowEndUtc) {
      const win = computeIstUploadWindow(visit.date);
      visit.uploadWindowStartUtc = win.windowStartUtc;
      visit.uploadWindowEndUtc = win.windowEndUtc;
      await visit.save();
    }
    const isMember = await requireTeamMemberOrAdmin(req, visit);
    if (!isMember) return res.status(403).json({ success: false, message: 'Only assigned team members or admins can modify media.' });
    if (new Date() > new Date(visit.uploadWindowEndUtc)) {
      const end = new Date(visit.uploadWindowEndUtc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      return res.status(403).json({ success: false, message: `Edits are closed as of ${end}.` });
    }

    const removeFrom = (arr) => {
      if (!arr) return false;
      const idx = arr.indexOf(url);
      if (idx === -1) return false;
      arr.splice(idx, 1);
      return true;
    };

    let removed =
      removeFrom(visit.photos) ||
      removeFrom(visit.videos) ||
      removeFrom(visit.docs);
    if (!removed)
      return res
        .status(404)
        .json({ success: false, message: "Media not found on visit" });

    // delete file on disk
    const filename = path.basename(url);
    const filePath = path.join(
      __dirname,
      "../uploads",
      String(visit._id),
      filename
    );
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await visit.save();

    res.status(200).json({ success: true, message: "Media removed" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================================
// Helpers
// ================================

// Normalize file paths to web-accessible URLs beginning with /uploads/
function normalizeFilePath(p) {
  if (!p) return p;
  let urlPath = typeof p === "string" ? p : String(p);
  // Normalize slashes
  urlPath = urlPath.replace(/\\/g, "/");
  // Extract from '/uploads/' if present
  const idx = urlPath.indexOf("/uploads/");
  if (idx !== -1) {
    return urlPath.substring(idx);
  }
  const idxAlt = urlPath.indexOf("uploads/");
  if (idxAlt !== -1) {
    return "/" + urlPath.substring(idxAlt);
  }
  // Fallback: ensure prefix
  if (!urlPath.startsWith("/uploads/")) {
    return "/uploads/" + urlPath.replace(/^\/?/, "");
  }
  return urlPath;
}

// Auto-fix inconsistent records only (do NOT auto-complete purely by date)
async function updatePastVisits() {
  try {
    // If, due to earlier bugs, a submitted report exists but status didn't flip
    await Visit.updateMany(
      { status: "scheduled", submittedBy: { $ne: null } },
      { $set: { status: "completed" } }
    );
  } catch (e) {
    console.warn("updatePastVisits failed:", e.message);
  }
}

// ================================
// Report Draft/Finalize/Download
// ================================

// @desc    Get or build report draft snapshot for a visit
// @route   GET /api/visits/:id/report/draft
// @access  Private/Admin
exports.getReportDraft = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('school', 'name address contactPerson')
      .populate('team', 'name');
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });

    const draft = visit.reportDraft || {
      childrenCount: visit.childrenCount,
      childrenResponse: visit.childrenResponse,
      topicsCovered: visit.topicsCovered || [],
      teachingMethods: visit.teachingMethods || [],
      challengesFaced: visit.challengesFaced || '',
      suggestions: visit.suggestions || ''
    };

    return res.status(200).json({ success: true, data: { draft, reportStatus: visit.reportStatus } });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

// @desc    Save/update report draft
// @route   PUT /api/visits/:id/report/draft
// @access  Private/Admin
exports.saveReportDraft = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });

    const payload = req.body || {};
    visit.reportDraft = payload;
    visit.reportStatus = 'draft';
    visit.reportDraftUpdatedAt = new Date();
    await visit.save();
    return res.status(200).json({ success: true, message: 'Draft saved', data: { reportStatus: visit.reportStatus } });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

// @desc    Finalize report and generate PDF (only if visit is completed)
// @route   POST /api/visits/:id/report/finalize
// @access  Private/Admin
exports.finalizeReport = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('school', 'name address contactPerson')
      .populate('team', 'name');
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    if (visit.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Report can be finalized only after visit is completed.' });
    }

    // Build snapshot from draft or current data
    const snapshot = {
      childrenCount: visit.childrenCount,
      childrenResponse: visit.childrenResponse,
      topicsCovered: (visit.reportDraft?.topicsCovered ?? visit.topicsCovered) || [],
      teachingMethods: (visit.reportDraft?.teachingMethods ?? visit.teachingMethods) || [],
      challengesFaced: visit.reportDraft?.challengesFaced ?? visit.challengesFaced ?? '',
      suggestions: visit.reportDraft?.suggestions ?? visit.suggestions ?? ''
    };

    // Generate PDF
    const pdfPathAbs = await generateVisitReportPdf(visit, snapshot);
    // Normalize to web path
    const rel = pdfPathAbs.replace(/\\/g, '/');
    const idx = rel.indexOf('/uploads/');
    const webPath = idx !== -1 ? rel.substring(idx) : '/uploads/' + path.basename(pdfPathAbs);

    visit.reportSnapshot = snapshot;
    visit.reportPdfPath = webPath;
    visit.reportFinalizedAt = new Date();
    visit.reportStatus = 'final';
    await visit.save();

    return res.status(200).json({ success: true, message: 'Report finalized', data: { pdfPath: webPath } });
  } catch (e) {
    console.error('finalizeReport error:', e);
    return res.status(400).json({ success: false, message: e.message });
  }
};

// @desc    Download finalized report PDF
// @route   GET /api/visits/:id/report/download
// @access  Private/Admin
exports.downloadReportPdf = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    if (!visit.reportPdfPath) return res.status(404).json({ success: false, message: 'No finalized report for this visit' });

    // Convert web path to disk path
    const diskPath = path.join(__dirname, '..', visit.reportPdfPath.replace(/^\/?uploads\//, 'uploads/'));
    if (!fs.existsSync(diskPath)) return res.status(404).json({ success: false, message: 'Report file missing' });
    res.setHeader('Content-Disposition', `attachment; filename="Report-${visit._id}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(diskPath).pipe(res);
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};
