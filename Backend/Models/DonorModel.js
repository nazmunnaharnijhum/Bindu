import mongoose from "mongoose";

const donorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    bloodGroup: {
      type: String,
      required: true,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    phone: {
      type: String,
      required: true,
      match: [/^[0-9]{10,15}$/, "Invalid phone number"],
    },
    location: {
      type: String,
      required: true,
    },
    lastDonated: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Donor", donorSchema);
