const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    paymentType: {
      type: String,
      enum: {
        values: [
          "rent",
          "deposit",
          "mess_fee",
          "maintenance",
          "late_fee",
          "other",
        ],
        message: "Invalid payment type",
      },
      required: [true, "Payment type is required"],
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ["cash", "card", "bank_transfer", "online", "cheque", "upi"],
        message: "Invalid payment method",
      },
      required: [true, "Payment method is required"],
      index: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      unique: true,
      required: [true, "Receipt number is required"],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "success", "failed", "refunded", "cancelled"],
        message: "Invalid payment status",
      },
      default: "pending",
      index: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    paidDate: {
      type: Date,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundDate: {
      type: Date,
    },
    refundReason: {
      type: String,
      trim: true,
    },
    paymentGateway: {
      type: String,
      enum: ["razorpay", "stripe", "paytm", "cashfree", "manual", null],
      default: null,
    },
    gatewayPaymentId: {
      type: String,
      index: true,
    },
    gatewayOrderId: {
      type: String,
      index: true,
    },
    gatewaySignature: {
      type: String,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    notes: {
      type: String,
      trim: true,
    },
    paymentFor: {
      month: {
        type: Number,
        min: 1,
        max: 12,
      },
      year: {
        type: Number,
        min: 2000,
        max: 2100,
      },
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    attachments: [
      {
        filename: String,
        path: String,
        uploadDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: {
      type: Date,
    },
    lateFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
paymentSchema.index({ student: 1, paymentDate: -1 });
paymentSchema.index({ status: 1, paymentDate: -1 });
paymentSchema.index({ paymentType: 1, status: 1 });
paymentSchema.index({ receiptNumber: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ "paymentFor.month": 1, "paymentFor.year": 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual for formatted amount
paymentSchema.virtual("formattedAmount").get(function () {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(this.amount);
});

// Virtual for formatted net amount
paymentSchema.virtual("formattedNetAmount").get(function () {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(this.netAmount);
});

// Virtual for payment status text
paymentSchema.virtual("statusText").get(function () {
  const statusMap = {
    pending: "Pending",
    success: "Successful",
    failed: "Failed",
    refunded: "Refunded",
    cancelled: "Cancelled",
  };
  return statusMap[this.status] || this.status;
});

// Virtual for payment type text
paymentSchema.virtual("paymentTypeText").get(function () {
  const typeMap = {
    rent: "Room Rent",
    deposit: "Security Deposit",
    mess_fee: "Mess Fee",
    maintenance: "Maintenance Fee",
    late_fee: "Late Fee",
    other: "Other",
  };
  return typeMap[this.paymentType] || this.paymentType;
});

// Pre-save middleware to calculate net amount
paymentSchema.pre("save", function (next) {
  // Calculate net amount: amount + tax + lateFee - discount
  this.netAmount =
    this.amount + (this.tax || 0) + (this.lateFee || 0) - (this.discount || 0);

  // Set paid date when status changes to success
  if (this.status === "success" && !this.paidDate) {
    this.paidDate = new Date();
  }

  // Set refund date when status changes to refunded
  if (this.status === "refunded" && !this.refundDate) {
    this.refundDate = new Date();
  }

  next();
});

// Pre-save middleware to generate receipt number if not provided
paymentSchema.pre("save", async function (next) {
  if (!this.receiptNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const count = await mongoose.model("Payment").countDocuments();
    this.receiptNumber = `RCP/${year}/${month}/${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

// Method to mark payment as successful
paymentSchema.methods.markAsSuccess = async function (
  transactionId,
  gatewayData = {},
) {
  this.status = "success";
  this.transactionId = transactionId || this.transactionId;
  this.paidDate = new Date();

  if (gatewayData.paymentId) this.gatewayPaymentId = gatewayData.paymentId;
  if (gatewayData.orderId) this.gatewayOrderId = gatewayData.orderId;
  if (gatewayData.signature) this.gatewaySignature = gatewayData.signature;

  await this.save();
  return this;
};

// Method to mark payment as failed
paymentSchema.methods.markAsFailed = async function (reason) {
  this.status = "failed";
  this.notes = reason || this.notes;
  await this.save();
  return this;
};

// Method to process refund
paymentSchema.methods.processRefund = async function (amount, reason) {
  if (this.status !== "success") {
    throw new Error("Only successful payments can be refunded");
  }

  if (amount > this.amount) {
    throw new Error("Refund amount cannot exceed payment amount");
  }

  this.status = "refunded";
  this.refundAmount = amount;
  this.refundReason = reason;
  this.refundDate = new Date();

  await this.save();
  return this;
};

// Static method to get payment summary for a student
paymentSchema.statics.getStudentPaymentSummary = async function (studentId) {
  const summary = await this.aggregate([
    {
      $match: {
        student: mongoose.Types.ObjectId(studentId),
        status: "success",
      },
    },
    {
      $group: {
        _id: "$paymentType",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
        lastPayment: { $max: "$paymentDate" },
      },
    },
  ]);

  const totalPaid = await this.aggregate([
    {
      $match: {
        student: mongoose.Types.ObjectId(studentId),
        status: "success",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  return {
    byType: summary,
    totalPaid: totalPaid[0]?.total || 0,
    totalTransactions: summary.reduce((sum, item) => sum + item.count, 0),
  };
};

// Static method to get revenue report
paymentSchema.statics.getRevenueReport = async function (startDate, endDate) {
  const report = await this.aggregate([
    {
      $match: {
        status: "success",
        paymentDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: {
          paymentType: "$paymentType",
          paymentMethod: "$paymentMethod",
        },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
        averageAmount: { $avg: "$amount" },
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ]);

  const dailyReport = await this.aggregate([
    {
      $match: {
        status: "success",
        paymentDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$paymentDate" },
          month: { $month: "$paymentDate" },
          day: { $dayOfMonth: "$paymentDate" },
        },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
    },
  ]);

  return {
    byTypeAndMethod: report,
    daily: dailyReport,
    totalRevenue: report.reduce((sum, item) => sum + item.totalAmount, 0),
    totalTransactions: report.reduce((sum, item) => sum + item.count, 0),
  };
};

// Static method to get pending payments
paymentSchema.statics.getPendingPayments = async function () {
  return await this.find({
    status: "pending",
    paymentDate: { $lte: new Date() },
  }).populate("student", "name email phone");
};

// Static method to get overdue payments
paymentSchema.statics.getOverduePayments = async function () {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return await this.find({
    status: "pending",
    paymentDate: { $lte: thirtyDaysAgo },
  }).populate("student", "name email phone");
};

// Instance method to generate receipt data
paymentSchema.methods.getReceiptData = async function () {
  await this.populate("student", "name email phone registrationNumber address")
    .populate("receivedBy", "name")
    .execPopulate();

  return {
    receiptNumber: this.receiptNumber,
    date: this.paymentDate,
    studentName: this.student.name,
    studentEmail: this.student.email,
    studentPhone: this.student.phone,
    studentRegistration: this.student.registrationNumber,
    amount: this.amount,
    netAmount: this.netAmount,
    paymentType: this.paymentTypeText,
    paymentMethod: this.paymentMethod,
    transactionId: this.transactionId,
    status: this.statusText,
    description: this.description,
    receivedBy: this.receivedBy?.name || "System",
  };
};

// Export the model
module.exports = mongoose.model("Payment", paymentSchema);
