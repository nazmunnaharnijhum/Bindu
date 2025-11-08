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
    available: { type: Boolean, default: true }, // donor currently available
    verified: { type: Boolean, default: false }, // admin verification flag
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Donor", donorSchema);
