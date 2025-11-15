// frontend/src/Pages/BloodDonors.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar/Navbar.jsx";
import Footer from "../components/Footer/Footer.jsx";

const API_BASE = "http://localhost:8080/api/donors";
const SOCKET_URL = "http://localhost:8080";

// List of Bangladesh districts (kept compact — add/remove as desired)
const DISTRICTS = [
  "Dhaka","Chattogram","Rajshahi","Khulna","Barishal","Sylhet","Rangpur","Mymensingh",
  "Cumilla","Gazipur","Narsingdi","Narayanganj","Bogura","Tangail","Jessore","Pabna",
  "Noakhali","Cox's Bazar","Faridpur","Kushtia","Dinajpur","Jamalpur","Panchagarh",
  "Thakurgaon","Brahmanbaria","Natore","Manikganj","Magura","Sherpur","Chuadanga",
  "Jhenaidah","Rangamati","Bagerhat","Kishoreganj","Sunamganj","Feni","Habiganj",
  "Naogaon","Netrakona","Madaripur","Shariatpur","Laxmipur","Meherpur","Bhola",
  "Pirojpur","Jhalokathi","Barguna","Gopalganj","Moulvibazar","Gaibandha","Kurigram",
  "Nilphamari","Lalmonirhat","Chapainawabganj","Joypurhat","Bandarban","Khagrachhari",
  "Satkhira","Narail","Rajbari","Sirajganj"
];

export default function BloodDonors() {
  const [donors, setDonors] = useState([]); // always an array
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    bloodGroup: "A+",
    phone: "",
    location: "",
    age: "",
    lastDonationDate: "",
    available: true,
  });

  // Filters used by UI
  const [filters, setFilters] = useState({
    q: "",
    bloodGroup: "",
    district: "",
    available: "", // "", "true", "false"
  });

  const socketRef = useRef(null);

  // --- Socket.IO: connect and listen for real-time events ---
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { autoConnect: true });

    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current.id);
    });

    socketRef.current.on("new_donor", (donor) => {
      setDonors(prev => {
        if (!Array.isArray(prev)) return [donor];
        if (prev.find(d => String(d._id) === String(donor._id))) return prev;
        return [donor, ...prev];
      });
      toast.info(`🩸 New donor: ${donor.name}`);
    });

    socketRef.current.on("update_donor", (donor) => {
      setDonors(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(d => (String(d._id) === String(donor._id) ? donor : d));
      });
      toast.info(`🔄 Donor updated: ${donor.name}`);
    });

    socketRef.current.on("remove_donor", ({ id }) => {
      setDonors(prev => prev.filter(d => String(d._id) !== String(id)));
      toast.warn("❌ Donor removed");
    });

    return () => {
      if (socketRef.current && socketRef.current.disconnect) socketRef.current.disconnect();
    };
  }, []);

  // --- Fetch donors from API ---
  useEffect(() => {
    fetchDonors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_BASE);
      if (res.data && res.data.success && Array.isArray(res.data.donors)) {
        // Normalize donors: ensure fields exist locally for display
        const normalized = res.data.donors.map(normalizeDonor);
        setDonors(normalized);
      } else {
        // handle scenario where API returns empty string or unexpected result
        const list = Array.isArray(res.data?.donors) ? res.data.donors : [];
        setDonors(list.map(normalizeDonor));
        if (!res.data?.success) toast.error(res.data?.message || "Failed to fetch donors");
      }
    } catch (err) {
      console.error("fetchDonors error:", err);
      toast.error("Error fetching donors");
      setDonors([]); // keep component stable
    } finally {
      setLoading(false);
    }
  };

  // --- Normalize donor for UI (calc nextEligibleDate, donationCount fallback, district key names) ---
  function normalizeDonor(d) {
    const donor = { ...d };
    // lastDonationDate may be stored as string or Date — coerce to ISO string or null
    const last = donor.lastDonationDate ? new Date(donor.lastDonationDate) : null;
    donor.lastDonationDate = last ? last.toISOString() : null;

    // next eligible is 3 months after last
    donor.nextEligibleDate = last ? new Date(new Date(last).setMonth(last.getMonth() + 3)).toISOString() : null;

    // donationCount — backend field or fallback to 0
    donor.donationCount = Number(donor.donationCount || donor.timesDonated || 0);

    // district vs location naming (some code uses district)
    donor.district = donor.district || donor.location || donor.region || null;

    // ensure available boolean
    donor.available = !!donor.available;

    return donor;
  }

  // --- Handle inputs for registration form ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  // --- Submit new donor ---
const handleSubmit = async (e) => {
  e.preventDefault();

  let available = form.available;

  // auto-calc availability
  if (form.lastDonationDate) {
    const last = new Date(form.lastDonationDate);
    const nextEligible = new Date(last);
    nextEligible.setMonth(nextEligible.getMonth() + 3);
    available = new Date() >= nextEligible;
  }

  const payload = {
    name: form.name,
    email: form.email || null,
    phone: form.phone,
    bloodGroup: form.bloodGroup,
    age: form.age ? Number(form.age) : null,
    district: form.location || null,
    lastDonationDate: form.lastDonationDate || null,
    available,
  };

  try {
    const res = await axios.post(API_BASE, payload);

    if (res.data && res.data.success) {
      toast.success("Donor registered successfully!");

      // ❌ don't manually push donor — socket will add it
      // ✔️ prevents duplicates

      // reset form
      setForm({
        name: "",
        email: "",
        bloodGroup: "A+",
        phone: "",
        location: "",
        age: "",
        lastDonationDate: "",
        available: true,
      });
    } else {
      toast.error(res.data?.message || "Registration failed");
    }
  } catch (err) {
    toast.error(err.response?.data?.message || "Error registering donor");
  }
};


  // --- Filtering logic (search + blood group + district + availability) ---
  const applyFilters = (list) => {
    if (!Array.isArray(list)) return [];

    const q = (filters.q || "").toString().trim().toLowerCase();
    const bloodGroupFilter = (filters.bloodGroup || "").toString().trim().toLowerCase();
    const districtFilter = (filters.district || "").toString().trim().toLowerCase();
    const availableFilter = filters.available; // "", "true", "false"

    return list.filter(d => {
      // safe lowercase conversions
      const name = (d.name || "").toString().toLowerCase();
      const group = (d.bloodGroup || "").toString().toLowerCase();
      const district = (d.district || "").toString().toLowerCase();
      const phone = (d.phone || "").toString().toLowerCase();
      const email = (d.email || "").toString().toLowerCase();

      // search query matches name / phone / email / group / district
      const qMatch = !q || name.includes(q) || phone.includes(q) || email.includes(q) || group.includes(q) || district.includes(q);

      // blood group filter
      const groupMatch = !bloodGroupFilter || group === bloodGroupFilter;

      // district filter (partial)
      const districtMatch = !districtFilter || district.includes(districtFilter);

      // availability filter
      let availabilityMatch = true;
      if (availableFilter === "true") availabilityMatch = !!d.available;
      if (availableFilter === "false") availabilityMatch = !d.available;

      return qMatch && groupMatch && districtMatch && availabilityMatch;
    });
  };

  const filteredDonors = applyFilters(donors);

  // --- Reset filters (Option A: full reset) ---
  const resetFilters = () => {
    setFilters({
      q: "",
      bloodGroup: "",
      district: "",
      available: "",
    });
    fetchDonors(); // re-fetch fresh list from server to ensure full list
  };

  // small helper to format date for display
  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "—";
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#8A0302] via-[#6A1E55] to-[#2C0E37] text-[#E8D8C4]">
      {/* <Navbar /> */}

      <ToastContainer />
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold text-center">🩸 Bindu — Blood Donor Registry</h1>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="bg-[#561C24]/70 p-6 rounded-xl border border-[#C7B7A3]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input name="name" required placeholder="Full name" value={form.name} onChange={handleChange}
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]" />

            <input name="email" placeholder="Email (optional)" value={form.email} onChange={handleChange}
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]" />

            <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} required
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]">
              {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>

            <input name="phone" required placeholder="Phone" value={form.phone} onChange={handleChange}
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]" />

            <select name="location" value={form.location} onChange={handleChange}
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]">
              <option value="">Select District</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <input name="age" placeholder="Age (optional)" value={form.age} onChange={handleChange} type="number"
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]" />

            <input name="lastDonationDate" type="date" value={form.lastDonationDate} onChange={handleChange}
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]" />

            <label className="flex items-center gap-2 text-sm text-[#E8D8C4]">
              <input type="checkbox" name="available" checked={form.available} onChange={handleChange} />
              Available for donation
            </label>

          </div>

          <div className="mt-4 flex gap-3">
            <button type="submit" className="px-6 py-2 rounded bg-gradient-to-r from-[#C7B7A3] to-[#E8D8C4] text-[#561C24] font-semibold">
              Register Donor
            </button>
            <button type="button" onClick={() => setForm({
                name: "", email: "", bloodGroup: "A+", phone: "", location: "", age: "", lastDonationDate: "", available: true
              })} className="px-4 py-2 rounded border border-[#C7B7A3]">
              Clear
            </button>
          </div>
        </form>

        {/* -----------------------
            Filters (SEARCH | BLOOD GROUP | DISTRICT | AVAILABILITY | RESET)
           ----------------------- */}
        <div className="bg-[#561C24]/70 p-4 rounded-xl border border-[#C7B7A3] flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name, phone, email, blood group, or district..."
            value={filters.q}
            onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
            className="p-2 rounded flex-1 bg-transparent border border-[#C7B7A3] text-[#E8D8C4]"
          />

          {/* Blood group filter */}
          <select value={filters.bloodGroup} onChange={(e) => setFilters(prev => ({ ...prev, bloodGroup: e.target.value }))}
            className="p-2 rounded border border-[#C7B7A3] bg-transparent text-[#E8D8C4]">
            <option value="">All Blood Groups</option>
            {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
          </select>

          {/* District filter */}
          <select value={filters.district} onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value }))}
            className="p-2 rounded border border-[#C7B7A3] bg-transparent text-[#E8D8C4]">
            <option value="">All Districts</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Availability filter */}
          <select value={filters.available} onChange={(e) => setFilters(prev => ({ ...prev, available: e.target.value }))}
            className="p-2 rounded border border-[#C7B7A3] bg-transparent text-[#E8D8C4]">
            <option value="">All</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>

          {/* Reset button (next to search as requested) */}
          <button onClick={resetFilters} className="px-4 py-2 rounded bg-[#E8D8C4] text-[#561C24] font-semibold">
            Reset
          </button>
        </div>

        {/* Donor list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading && <div className="text-center col-span-2">Loading donors...</div>}
          {!loading && filteredDonors.length === 0 && (
            <div className="col-span-2 text-center text-[#C7B7A3]">No donors found.</div>
          )}

          {filteredDonors.map(d => {
            const badge =
              (d.donationCount || 0) >= 15 ? "💎 Platinum Donor" :
              (d.donationCount || 0) >= 10 ? "🥇 Gold Donor" :
              (d.donationCount || 0) >= 5 ? "🥈 Silver Donor" : null;

            return (
              <div key={d._id || d.id || Math.random()} className="p-4 rounded-xl bg-[#561C24]/60 border border-[#C7B7A3]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {d.name} {badge && <span className="text-sm">{badge}</span>}
                    </h3>
                    <div className="text-sm">{d.email || "—"}</div>
                    <div className="mt-2">🩸 <strong>{d.bloodGroup}</strong> • 📞 {d.phone}</div>
                    <div className="mt-1">📍 {d.district || "—"} • Age: {d.age ?? "—"}</div>

                    {d.lastDonationDate && (
                      <div className="mt-1 text-sm">
                        Last donated: {fmtDate(d.lastDonationDate)}<br/>
                        Next eligible: {d.nextEligibleDate ? fmtDate(d.nextEligibleDate) : "—"}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className={`px-3 py-1 rounded ${d.available ? "bg-green-600" : "bg-gray-500"} text-white text-sm`}>
                      {d.available ? "Available" : "Unavailable"}
                    </div>
                    <div className="text-xs text-gray-300 mt-2">{d.donationCount ? `${d.donationCount} donations` : ""}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <Footer />
    </div>
  );
}
