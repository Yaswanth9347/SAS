const Contact = require('../models/Contact');

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
exports.submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters'
      });
    }

    if (!email || !email.match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (!message || message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters'
      });
    }

    const contact = await Contact.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject?.trim() || 'General Inquiry',
      message: message.trim(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: contact
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit contact form'
    });
  }
};

// @desc    Get all contact messages
// @route   GET /api/contact/admin
// @access  Private/Admin
exports.getAllContacts = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('reply.repliedBy', 'name email');

    const count = await Contact.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: contacts
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch contacts'
    });
  }
};

// @desc    Get single contact message
// @route   GET /api/contact/admin/:id
// @access  Private/Admin
exports.getContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('reply.repliedBy', 'name email role');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch contact'
    });
  }
};

// @desc    Mark contact as read
// @route   PUT /api/contact/admin/:id/read
// @access  Private/Admin
exports.markAsRead = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: 'read' },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact marked as read',
      data: contact
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to mark contact as read'
    });
  }
};

// @desc    Reply to contact message
// @route   PUT /api/contact/admin/:id/reply
// @access  Private/Admin
exports.replyToContact = async (req, res) => {
  try {
    const { replyMessage } = req.body;

    if (!replyMessage || replyMessage.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Reply message must be at least 10 characters'
      });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      {
        status: 'replied',
        reply: {
          message: replyMessage.trim(),
          repliedBy: req.user.id,
          repliedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    ).populate('reply.repliedBy', 'name email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    // Send email notification to user with the reply
    try {
      const { sendContactReplyEmail } = require('../utils/emailService');
      await sendContactReplyEmail({
        to: contact.email,
        name: contact.name,
        subject: contact.subject,
        originalMessage: contact.message,
        reply: replyMessage.trim(),
        repliedBy: req.user.name
      });
    } catch (emailError) {
      console.error('Failed to send reply email:', emailError);
      // Don't fail the whole request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Reply sent successfully',
      data: contact
    });
  } catch (error) {
    console.error('Reply to contact error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to send reply'
    });
  }
};

// @desc    Archive contact message
// @route   PUT /api/contact/admin/:id/archive
// @access  Private/Admin
exports.archiveContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: 'archived' },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact archived successfully',
      data: contact
    });
  } catch (error) {
    console.error('Archive contact error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to archive contact'
    });
  }
};

// @desc    Delete contact message
// @route   DELETE /api/contact/admin/:id
// @access  Private/Admin
exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact message deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete contact'
    });
  }
};

// @desc    Get contact statistics
// @route   GET /api/contact/admin/stats
// @access  Private/Admin
exports.getContactStats = async (req, res) => {
  try {
    // Get counts by status
    const stats = await Contact.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total count
    const total = await Contact.countDocuments();

    // Get today's count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Contact.countDocuments({
      createdAt: { $gte: today }
    });

    // Get this week's count
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = await Contact.countDocuments({
      createdAt: { $gte: weekAgo }
    });

    // Get this month's count
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCount = await Contact.countDocuments({
      createdAt: { $gte: monthStart }
    });

    // Format stats by status
    const statusStats = {
      new: 0,
      read: 0,
      replied: 0,
      archived: 0
    };

    stats.forEach(stat => {
      if (statusStats.hasOwnProperty(stat._id)) {
        statusStats[stat._id] = stat.count;
      }
    });

    // Get recent contacts
    const recentContacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email subject status createdAt');

    res.status(200).json({
      success: true,
      data: {
        total,
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        byStatus: statusStats,
        recentContacts
      }
    });
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch statistics',
      data: {
        total: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        byStatus: {
          new: 0,
          read: 0,
          replied: 0,
          archived: 0
        },
        recentContacts: []
      }
    });
  }
};

// @desc    Bulk update contact status
// @route   PUT /api/contact/admin/bulk-update
// @access  Private/Admin
exports.bulkUpdateContacts = async (req, res) => {
  try {
    const { contactIds, status } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide contact IDs as an array'
      });
    }

    if (!['new', 'read', 'replied', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const result = await Contact.updateMany(
      { _id: { $in: contactIds } },
      { $set: { status } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} contact(s) updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update contacts'
    });
  }
};
