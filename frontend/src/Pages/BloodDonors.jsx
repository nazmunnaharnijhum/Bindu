// frontend/src/Pages/BloodDonors.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar/Navbar.jsx";
import Footer from "../components/Footer/Footer.jsx";

const API_BASE = "http://localhost:8080/api/donors";
const SOCKET_URL = "http://localhost:8080";

// District list (compact)
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
  // donor list + pagination meta
  const [donors, setDonors] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 8 });
  const [loading, setLoading] = useState(false);

  // form (registration)
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

  // filter UI values
  const [filters, setFilters] = useState({
    q: "",
    bloodGroup: "",
    district: "",
    available: "",
  });

  const socketRef = useRef(null);

  // Helper: normalize donor object for UI
  const normalizeDonor = (d) => {
    const donor = { ...d };
    // unify field names
    donor.district = donor.district || donor.location || donor.region || null;
    donor.donationCount = Number(donor.donationCount || donor.timesDonated || 0);
    donor.lastDonationDate = donor.lastDonationDate ? new Date(donor.lastDonationDate).toISOString() : null;
    donor.nextEligibleDate = donor.lastDonationDate ? new Date(new Date(donor.lastDonationDate).setMonth(new Date(donor.lastDonationDate).getMonth() + 3)).toISOString() : null;
    donor.available = !!donor.available;
    return donor;
  };

  // Merge list with dedupe by _id (incoming first)
  const mergeDonors = (oldList = [], newList = []) => {
    const map = new Map();
    // push newList first so newest appear first
    newList.forEach(d => map.set(String(d._id), normalizeDonor(d)));
    oldList.forEach(d => {
      if (!map.has(String(d._id))) map.set(String(d._id), normalizeDonor(d));
    });
    return Array.from(map.values());
  };

  // Fetch page from backend with filters & pagination
  const fetchPage = useCallback(async (page = 1, limit = meta.limit, suppliedFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
      };
      if (suppliedFilters.q) params.q = suppliedFilters.q;
      if (suppliedFilters.bloodGroup) params.bloodGroup = suppliedFilters.bloodGroup;
      if (suppliedFilters.district) params.district = suppliedFilters.district;
      if (suppliedFilters.available !== "") params.available = suppliedFilters.available;

      const res = await axios.get(API_BASE, { params });
      if (res.data && res.data.success) {
        const list = Array.isArray(res.data.donors) ? res.data.donors.map(normalizeDonor) : [];
        setDonors(list);
        setMeta({
          total: res.data.meta?.total ?? (Array.isArray(list) ? list.length : 0),
          page: res.data.meta?.page ?? page,
          limit: res.data.meta?.limit ?? limit,
        });
      } else {
        // fallback: set empty list
        setDonors([]);
        setMeta(prev => ({ ...prev, page }));
        toast.error(res.data?.message || "Failed to fetch donors");
      }
    } catch (err) {
      console.error("fetchPage error:", err);
      toast.error("Error fetching donors");
      setDonors([]);
    } finally {
      setLoading(false);
    }
  }, [meta.limit, filters]);

  // initial fetch
  useEffect(() => {
    fetchPage(1, meta.limit, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when page changes or filters change (page resets to 1 on filter change)
  useEffect(() => {
    fetchPage(meta.page, meta.limit, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.page, meta.limit]);

  // Socket.IO setup
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { autoConnect: true });

    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current.id);
    });

    // When server emits new donor, merge without duplicates
    socketRef.current.on("new_donor", (donor) => {
      // If we're on the first page, show it at top (backend sort should place newest first)
      setDonors(prev => {
        const incoming = normalizeDonor(donor);
        // if already present, return prev
        if (prev.find(d => String(d._id) === String(incoming._id))) return prev;
        // prepend and keep page size consistent (optional)
        const merged = [incoming, ...prev];
        return merged;
      });
      // update total count (optimistic +1)
      setMeta(prev => ({ ...prev, total: (prev.total || 0) + 1 }));
      toast.info(`🩸 New donor registered: ${donor.name}`);
    });

    socketRef.current.on("update_donor", (donor) => {
      setDonors(prev => prev.map(d => (String(d._id) === String(donor._id) ? normalizeDonor(donor) : d)));
      toast.info(`🔄 Donor updated: ${donor.name}`);
    });

    socketRef.current.on("remove_donor", ({ id }) => {
      setDonors(prev => prev.filter(d => String(d._id) !== String(id)));
      setMeta(prev => ({ ...prev, total: Math.max(0, (prev.total || 1) - 1) }));
      toast.warn("❌ Donor removed");
    });

    return () => {
      if (socketRef.current && socketRef.current.disconnect) socketRef.current.disconnect();
    };
  }, []);

  // form input handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // submit handler - sends to backend and relies on socket to add/notify (dedupe handled)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // compute automatic availability (3 months rule)
    let available = form.available;
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
        toast.success("Donor registered successfully");
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
        // fetch first page to show newest (server emits and socket will also add; merge prevents duplicates)
        // Keep user on first page so they see the newly registered donors
        setMeta(prev => ({ ...prev, page: 1 }));
        fetchPage(1, meta.limit, filters);
      } else {
        toast.error(res.data?.message || "Registration failed");
      }
    } catch (err) {
      console.error("register error:", err);
      toast.error(err.response?.data?.message || "Error registering donor");
    }
  };

  // Apply client-side filters (used in case backend returns unfiltered page)
  const applyClientFilters = (list) => {
    if (!Array.isArray(list)) return [];
    const q = (filters.q || "").toString().trim().toLowerCase();
    const bg = (filters.bloodGroup || "").toString().trim().toLowerCase();
    const districtFilter = (filters.district || "").toString().trim().toLowerCase();
    const avail = filters.available; // "", "true", "false"

    return list.filter(d => {
      const name = (d.name || "").toString().toLowerCase();
      const group = (d.bloodGroup || "").toString().toLowerCase();
      const district = (d.district || "").toString().toLowerCase();
      const phone = (d.phone || "").toString().toLowerCase();
      const email = (d.email || "").toString().toLowerCase();

      const qMatch = !q || name.includes(q) || phone.includes(q) || email.includes(q) || group.includes(q) || district.includes(q);
      const groupMatch = !bg || group === bg;
      const districtMatch = !districtFilter || district.includes(districtFilter);

      let availabilityMatch = true;
      if (avail === "true") availabilityMatch = !!d.available;
      if (avail === "false") availabilityMatch = !d.available;

      return qMatch && groupMatch && districtMatch && availabilityMatch;
    });
  };

  // filtered list to render (we rely primarily on server-side filtering/pagination; this is a safety)
  const renderedDonors = applyClientFilters(donors);

  // pagination helpers
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / meta.limit));
  const gotoPage = (p) => {
    const page = Math.max(1, Math.min(totalPages, p));
    setMeta(prev => ({ ...prev, page }));
    fetchPage(page, meta.limit, filters);
  };

  // when filters change, reset to page 1
  useEffect(() => {
    setMeta(prev => ({ ...prev, page: 1 }));
    fetchPage(1, meta.limit, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.bloodGroup, filters.district, filters.available]);

  const resetFilters = () => {
    setFilters({ q: "", bloodGroup: "", district: "", available: "" });
    setMeta(prev => ({ ...prev, page: 1 }));
    fetchPage(1, meta.limit, { q: "", bloodGroup: "", district: "", available: "" });
  };

  // UI helpers
  const fmtDate = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(); } catch { return "—"; }
  };

  const renderPageButtons = () => {
    // show up to 7 page buttons centered on current page
    const maxButtons = 7;
    let start = Math.max(1, meta.page - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }
    const buttons = [];
    for (let p = start; p <= end; p++) {
      buttons.push(
        <button
          key={p}
          onClick={() => gotoPage(p)}
          className={`px-3 py-1 rounded ${p === meta.page ? "bg-[#E8D8C4] text-[#561C24] font-semibold" : "bg-transparent border border-[#C7B7A3]"}`}
        >
          {p}
        </button>
      );
    }
    return buttons;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#8A0302] via-[#6A1E55] to-[#2C0E37] text-[#E8D8C4]">
      {/* <Navbar /> */}
      <ToastContainer />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold text-center">🩸 Bindu — Blood Donor Registry</h1>

        {/* Registration form */}
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

        {/* Filters + search + reset */}
        <div className="bg-[#561C24]/70 p-4 rounded-xl border border-[#C7B7A3] flex flex-col md:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Search by name, phone, email, blood group, or district..."
            value={filters.q}
            onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
            className="p-2 rounded flex-1 bg-transparent border border-[#C7B7A3] text-[#E8D8C4]"
          />

          <select value={filters.bloodGroup} onChange={(e) => setFilters(prev => ({ ...prev, bloodGroup: e.target.value }))}
            className="p-2 rounded border border-[#C7B7A3] bg-transparent text-[#E8D8C4]">
            <option value="">All Blood Groups</option>
            {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
          </select>

          <select value={filters.district} onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value }))}
            className="p-2 rounded border border-[#C7B7A3] bg-transparent text-[#E8D8C4]">
            <option value="">All Districts</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select value={filters.available} onChange={(e) => setFilters(prev => ({ ...prev, available: e.target.value }))}
            className="p-2 rounded border border-[#C7B7A3] bg-transparent text-[#E8D8C4]">
            <option value="">All</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>

          <button onClick={resetFilters} className="px-4 py-2 rounded bg-[#E8D8C4] text-[#561C24] font-semibold">
            Reset
          </button>
        </div>

        {/* Donors list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading && <div className="text-center col-span-2">Loading donors...</div>}
          {!loading && renderedDonors.length === 0 && <div className="col-span-2 text-center text-[#C7B7A3]">No donors found.</div>}

          {renderedDonors.map(d => {
            const badge =
              (d.donationCount || 0) >= 15 ? "💎 Platinum Donor" :
              (d.donationCount || 0) >= 10 ? "🥇 Gold Donor" :
              (d.donationCount || 0) >= 5 ? "🥈 Silver Donor" : null;

            return (
              <div key={d._id || d.id} className="p-4 rounded-xl bg-[#561C24]/60 border border-[#C7B7A3]">
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
                        Last donated: {fmtDate(d.lastDonationDate)}<br />
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

        {/* Pagination (page numbers) */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => gotoPage(meta.page - 1)} disabled={meta.page <= 1}
            className="px-3 py-1 rounded border border-[#C7B7A3]">Prev</button>

          {renderPageButtons()}

          <button onClick={() => gotoPage(meta.page + 1)} disabled={meta.page >= totalPages}
            className="px-3 py-1 rounded border border-[#C7B7A3]">Next</button>
        </div>

        <div className="text-center text-sm text-[#C7B7A3] mt-2">
          Page {meta.page} of {totalPages} • {meta.total} donors
        </div>

      </div>

      <Footer />
    </div>
  );
}
