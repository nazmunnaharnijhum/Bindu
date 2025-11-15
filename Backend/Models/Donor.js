// Backend/Models/Donor.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const donorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "users", default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: null, lowercase: true },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9+]{6,16}$/, "Invalid phone number"],
    },
    bloodGroup: {
      type: String,
      required: true,
      enum: BLOOD_GROUPS,
    },
    age: { type: Number, min: 0, max: 150, default: null },
    district: { type: String, trim: true, default: null },
    available: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    notes: { type: String, default: null },

    // 🩸 New fields
    lastDonationDate: { type: Date, default: null },
    donationCount: { type: Number, default: 0 },
    nextEligibleDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// Automatically calculate next eligible date and availability
donorSchema.pre("save", function (next) {
  if (this.lastDonationDate) {
    const nextEligible = new Date(this.lastDonationDate);
    nextEligible.setMonth(nextEligible.getMonth() + 3); // 3 months later
    this.nextEligibleDate = nextEligible;

    const now = new Date();
    this.available = now >= nextEligible;
  }
  next();
});

module.exports = mongoose.model("Donor", donorSchema);
