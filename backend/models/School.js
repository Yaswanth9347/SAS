const mongoose = require("mongoose");

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add school name"],
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    contactPerson: {
      name: String,
      position: String,
      phone: String,
      phone2: String,
      email: String,
    },
    totalClasses: {
      type: Number,
      required: true,
      min: 1,
    },
    availableClasses: {
      type: Number,
      required: true,
    },
    grades: [String],
    notes: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Update availableClasses when totalClasses changes
schoolSchema.pre("save", function (next) {
  if (this.isModified("totalClasses") && !this.isModified("availableClasses")) {
    this.availableClasses = this.totalClasses;
  }
  next();
});

module.exports = mongoose.model("School", schoolSchema);
