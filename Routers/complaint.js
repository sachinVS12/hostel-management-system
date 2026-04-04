const Complaint = require("../models/Complaint");
const User = require("../models/User");

// @desc    Get all complaints (Admin only)
// @route   GET /api/complaints
exports.getAllComplaints = async (req, res) => {
  try {
    let query;

    // If user is admin, get all complaints with student details
    if (req.user.role === "admin") {
      query = Complaint.find().populate(
        "student",
        "name email registrationNumber phone",
      );
    } else {
      // If student, get only their complaints
      query = Complaint.find({ student: req.user.id });
    }

    const complaints = await query.sort("-createdAt");

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single complaint
// @route   GET /api/complaints/:id
exports.getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id).populate(
      "student",
      "name email registrationNumber phone",
    );

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Check if user has permission to view this complaint
    if (
      req.user.role !== "admin" &&
      complaint.student._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this complaint",
      });
    }

    res.status(200).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create new complaint
// @route   POST /api/complaints
exports.createComplaint = async (req, res) => {
  try {
    // Add student ID to request body
    req.body.student = req.user.id;

    const complaint = await Complaint.create(req.body);

    res.status(201).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update complaint (Admin only)
// @route   PUT /api/complaints/:id
exports.updateComplaint = async (req, res) => {
  try {
    let complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Only admin can update complaints
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this complaint",
      });
    }

    complaint = await Complaint.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update complaint status (Admin only)
// @route   PUT /api/complaints/:id/status
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { status, adminResponse } = req.body;

    let complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Only admin can update status
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update complaint status",
      });
    }

    complaint.status = status;
    if (adminResponse) {
      complaint.adminResponse = adminResponse;
    }
    if (status === "resolved") {
      complaint.resolvedAt = Date.now();
    }

    await complaint.save();

    res.status(200).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete complaint (Admin only)
// @route   DELETE /api/complaints/:id
exports.deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Only admin can delete complaints
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this complaint",
      });
    }

    await complaint.remove();

    res.status(200).json({
      success: true,
      message: "Complaint deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get complaints by status (Admin only)
// @route   GET /api/complaints/status/:status
exports.getComplaintsByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    // Validate status
    const validStatuses = ["pending", "in-progress", "resolved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status parameter",
      });
    }

    const complaints = await Complaint.find({ status })
      .populate("student", "name email registrationNumber")
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get complaints statistics (Admin only)
// @route   GET /api/complaints/stats
exports.getComplaintStats = async (req, res) => {
  try {
    const stats = await Complaint.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const priorityStats = await Complaint.aggregate([
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryStats = await Complaint.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    const averageResolutionTime = await Complaint.aggregate([
      {
        $match: {
          status: "resolved",
          resolvedAt: { $exists: true },
          createdAt: { $exists: true },
        },
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ["$resolvedAt", "$createdAt"] },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageDays: { $avg: "$resolutionTime" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        byStatus: stats,
        byPriority: priorityStats,
        byCategory: categoryStats,
        averageResolutionDays: averageResolutionTime[0]?.averageDays || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add comment to complaint (Admin only)
// @route   POST /api/complaints/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: "Please add a comment",
      });
    }

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Add comment to complaint (you would need to add comments array to schema)
    // For now, we'll update the adminResponse field
    const newComment = `\n[${new Date().toLocaleString()}] Admin: ${comment}`;
    complaint.adminResponse = complaint.adminResponse
      ? complaint.adminResponse + newComment
      : newComment;

    await complaint.save();

    res.status(200).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get complaints by student ID (Admin only)
// @route   GET /api/complaints/student/:studentId
exports.getComplaintsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if student exists
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const complaints = await Complaint.find({ student: studentId }).sort(
      "-createdAt",
    );

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
