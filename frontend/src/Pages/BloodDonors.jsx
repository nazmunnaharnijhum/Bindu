// frontend/src/Pages/BloodDonors.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = "http://localhost:8080/api/donors";
const SOCKET_URL = "http://localhost:8080";

export default function BloodDonors() {
  const [donors, setDonors] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    bloodGroup: "A+",
    phone: "",
    location: "",
    age: "",
  });
  const [filters, setFilters] = useState({
    q: "",
    bloodGroup: "",
    district: "",
    available: "",
    page: 1,
    limit: 10,
  });
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10 });
  const socketRef = useRef(null);

  useEffect(() => {
    // connect socket
    socketRef.current = io(SOCKET_URL, { autoConnect: true });

    socketRef.current.on("connect", () => {
      console.log("socket connected:", socketRef.current.id);
    });

    // when a new donor is created anywhere, prepend to list
    socketRef.current.on("new_donor", (donor) => {
      setDonors((prev) => {
        // prevent duplicate if already in list
        if (prev.find((d) => d._id === donor._id)) return prev;
        return [donor, ...prev];
      });
      toast.info(`New donor registered: ${donor.name}`);
    });

    socketRef.current.on("update_donor", (donor) => {
      setDonors((prev) => prev.map((d) => (d._id === donor._id ? donor : d)));
      toast.info(`Donor updated: ${donor.name}`);
    });

    socketRef.current.on("remove_donor", ({ id }) => {
      setDonors((prev) => prev.filter((d) => d._id !== id));
      toast.info(`Donor removed`);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchDonors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit]);

  const fetchDonors = async (overridePage) => {
    try {
      const params = {
        page: overridePage || filters.page,
        limit: filters.limit,
      };
      if (filters.q) params.q = filters.q;
      if (filters.bloodGroup) params.bloodGroup = filters.bloodGroup;
      if (filters.district) params.district = filters.district;
      if (filters.available !== "") params.available = filters.available;

      const res = await axios.get(API_BASE, { params });
      if (res.data && res.data.success) {
        setDonors(res.data.donors);
        setMeta(res.data.meta || { total: 0, page: params.page, limit: params.limit });
      } else {
        toast.error("Failed to fetch donors");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching donors");
    }
  };

  const handleChange = (e) => {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((f) => ({ ...f, [name]: value, page: 1 }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        email: form.email || null,
        phone: form.phone,
        bloodGroup: form.bloodGroup,
        age: form.age ? Number(form.age) : undefined,
        district: form.location || undefined,
      };
      const res = await axios.post(API_BASE, payload);
      if (res.data && res.data.success) {
        toast.success("Donor registered successfully");
        setForm({ name: "", email: "", bloodGroup: "A+", phone: "", location: "", age: "" });
        // fetch page 1 to show newest or rely on socket (socket will prepend)
        fetchDonors(1);
      } else {
        toast.error(res.data?.message || "Registration failed");
      }
    } catch (err) {
      console.error("Error registering donor", err);
      const message = err.response?.data?.message || "Registration error";
      toast.error(message);
    }
  };

  const gotoPage = (p) => {
    setFilters((f) => ({ ...f, page: p }));
    fetchDonors(p);
  };

  return (
    <div className="min-h-screen bg-[#8A0302] p-6 text-[#E8D8C4]">
      <ToastContainer />
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">🩸 Bindu — Blood Donor Registry</h1>

        {/* Register form */}
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
            <input name="location" placeholder="District / Location" value={form.location} onChange={handleChange}
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]" />
            <input name="age" placeholder="Age (optional)" value={form.age} onChange={handleChange} type="number"
              className="p-3 rounded bg-transparent border border-[#C7B7A3] text-[#E8D8C4]" />
          </div>

          <div className="mt-4 flex gap-3">
            <button type="submit" className="px-6 py-2 rounded bg-gradient-to-r from-[#C7B7A3] to-[#E8D8C4] text-[#561C24] font-semibold">
              Register Donor
            </button>
            <button type="button" onClick={() => { setForm({ name: "", email: "", bloodGroup: "A+", phone: "", location: "", age: "" }); }}
              className="px-4 py-2 rounded border border-[#C7B7A3]">
              Clear
            </button>
          </div>
        </form>

        {/* Filters */}
        <div className="bg-[#561C24]/70 p-4 rounded-xl border border-[#C7B7A3] flex flex-col md:flex-row gap-3 items-center">
          <input name="q" placeholder="Search name / phone / email" value={filters.q} onChange={handleFilterChange}
            className="p-2 rounded flex-1 bg-transparent border border-[#C7B7A3] text-[#E8D8C4]" />
          <select name="bloodGroup" value={filters.bloodGroup} onChange={handleFilterChange}
            className="p-2 rounded border border-[#C7B7A3]">
            <option value="">All Blood Groups</option>
            {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
          </select>
          <input name="district" placeholder="District" value={filters.district} onChange={handleFilterChange}
            className="p-2 rounded border border-[#C7B7A3]" />
          <select name="available" value={filters.available} onChange={handleFilterChange} className="p-2 rounded border border-[#C7B7A3]">
            <option value="">All</option>
            <option value="true">Available</option>
            <option value="false">Not available</option>
          </select>
          <button onClick={() => fetchDonors(1)} className="px-4 py-2 rounded bg-[#E8D8C4] text-[#561C24] font-semibold">Apply</button>
        </div>

        {/* Donors list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {donors.map((d) => (
            <div key={d._id} className="p-4 rounded-xl bg-[#561C24]/60 border border-[#C7B7A3]">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{d.name}</h3>
                  <div className="text-sm">{d.email}</div>
                  <div className="mt-2">🩸 <strong>{d.bloodGroup}</strong>  •  📞 {d.phone}</div>
                  <div className="mt-1">📍 {d.district || "—" } • Age: {d.age ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded ${d.available ? "bg-green-600" : "bg-gray-500"} text-white text-sm`}>
                    {d.available ? "Available" : "Unavailable"}
                  </div>
                  <div className="text-xs text-gray-300 mt-2">{new Date(d.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 mt-4">
          <button disabled={meta.page <= 1} onClick={() => gotoPage(meta.page - 1)} className="px-3 py-1 rounded border">
            Prev
          </button>
          <div>Page {meta.page} • {meta.total} total</div>
          <button disabled={(meta.page * meta.limit) >= meta.total} onClick={() => gotoPage(meta.page + 1)} className="px-3 py-1 rounded border">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
