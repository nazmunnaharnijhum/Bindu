import express from "express";
import Donor from "../Models/DonorModel.js";

const router = express.Router();

// ✅ Register a new donor
router.post("/", async (req, res) => {
  try {
    const { name, email, bloodGroup, phone, location } = req.body;

    const existing = await Donor.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Donor already registered" });
    }

    const donor = await Donor.create({
      name,
      email,
      bloodGroup,
      phone,
      location,
    });

    // Emit real-time event
    req.io.emit("new_donor", donor);

    res
      .status(201)
      .json({ success: true, message: "Donor registered successfully", donor });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error registering donor",
      error: err.message,
    });
  }
});

// ✅ Get all donors
router.get("/", async (req, res) => {
  try {
    const donors = await Donor.find().sort({ createdAt: -1 });
    res.json({ success: true, donors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
