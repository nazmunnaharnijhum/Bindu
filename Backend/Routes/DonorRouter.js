// Backend/Routes/DonorRouter.js
const express = require("express");
const router = express.Router();
const Donor = require("../Models/Donor");
const { requireRole } = require("../Middlewares/RoleAuth");

// Helper to parse booleans from query strings
const parseBool = (v) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes";
};

/**
 * Create donor (guest or logged in user)
 * body: { name, email, phone, bloodGroup, age, district, available, notes }
 */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      bloodGroup,
      age,
      district,
      available = true,
      notes,
    } = req.body;

    if (!name || !phone || !bloodGroup) {
      return res
        .status(400)
        .json({ success: false, message: "name, phone and bloodGroup required" });
    }

    // optionally link to user if authenticated (AuthRouter sets req.user id)
    const userId = req.user?.id || req.user?._id || null;

    const donor = new Donor({
      userId,
      name,
      email: email || null,
      phone,
      bloodGroup,
      age: age || null,
      district: district || null,
      available: available === undefined ? true : !!available,
      notes: notes || null,
    });

    await donor.save();

    // Emit real-time event (index.js attaches req.io)
    try {
      if (req.io) req.io.emit("new_donor", donor);
    } catch (e) {
      console.warn("Failed to emit new_donor:", e.message);
    }

    res.status(201).json({ success: true, donor });
  } catch (err) {
    console.error("create donor error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/**
 * List donors with filters:
 * query params: bloodGroup, district, available, q (search), page, limit, sort
 */
router.get("/", async (req, res) => {
  try {
    const { bloodGroup, district, available, q, page = 1, limit = 20, sort = "-createdAt" } = req.query;

    const filter = {};
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (district) filter.district = { $regex: new RegExp(district, "i") };
    const avail = parseBool(available);
    if (avail !== undefined) filter.available = avail;

    if (q) {
      const qRegex = new RegExp(q, "i");
      filter.$or = [{ name: qRegex }, { phone: qRegex }, { email: qRegex }, { district: qRegex }];
    }

    const skip = (Math.max(0, Number(page) - 1)) * Number(limit);
    const donors = await Donor.find(filter).sort(sort).skip(skip).limit(Number(limit));
    const total = await Donor.countDocuments(filter);

    res.json({
      success: true,
      donors,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    console.error("list donors error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/** Get donor by id */
router.get("/:id", async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });
    res.json({ success: true, donor });
  } catch (err) {
    console.error("get donor error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/** Update donor (admin only) */
router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    const updates = req.body;
    const donor = await Donor.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });

    if (req.io) req.io.emit("update_donor", donor);
    res.json({ success: true, donor });
  } catch (err) {
    console.error("update donor error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/** Toggle availability (admin only) */
router.patch("/:id/availability", requireRole("admin"), async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });
    donor.available = !donor.available;
    await donor.save();
    if (req.io) req.io.emit("update_donor", donor);
    res.json({ success: true, donor });
  } catch (err) {
    console.error("toggle availability error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/** Delete donor (admin only) */
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    await Donor.findByIdAndDelete(req.params.id);
    if (req.io) req.io.emit("remove_donor", { id: req.params.id });
    res.json({ success: true, message: "Donor removed" });
  } catch (err) {
    console.error("delete donor error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
