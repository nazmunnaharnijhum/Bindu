// Backend/Controllers/DonorController.js
const Donor = require("../Models/Donor");
const User = require("../Models/User");

// Create donor entry (any authenticated user or guest)
const createDonor = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      bloodGroup,
      age,
      district,
      available = true,
    } = req.body;

    if (!name || !phone || !bloodGroup) {
      return res
        .status(400)
        .json({ success: false, message: "name, phone and bloodGroup required" });
    }

    const newDonor = new Donor({
      userId: req.user?._id || null,
      name,
      phone,
      email: email || null,
      bloodGroup,
      age: age || null,
      district: district || null,
      available,
    });

    await newDonor.save();
    res.status(201).json({ success: true, donor: newDonor });
  } catch (err) {
    console.error("createDonor:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// List donors with filters and pagination
const listDonors = async (req, res) => {
  try {
    const { bloodGroup, district, available, q, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (district) filter.district = { $regex: new RegExp(district, "i") };
    if (available !== undefined) filter.available = available === "true" || available === true;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const donors = await Donor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Donor.countDocuments(filter);

    res.json({ success: true, donors, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    console.error("listDonors:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getDonor = async (req, res) => {
  try {
    const { id } = req.params;
    const donor = await Donor.findById(id);
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });
    res.json({ success: true, donor });
  } catch (err) {
    console.error("getDonor:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateDonor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const donor = await Donor.findByIdAndUpdate(id, updates, { new: true });
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });
    res.json({ success: true, donor });
  } catch (err) {
    console.error("updateDonor:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeDonor = async (req, res) => {
  try {
    const { id } = req.params;
    await Donor.findByIdAndDelete(id);
    res.json({ success: true, message: "Donor removed" });
  } catch (err) {
    console.error("removeDonor:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createDonor,
  listDonors,
  getDonor,
  updateDonor,
  removeDonor,
};
