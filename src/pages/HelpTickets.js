import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function HelpTickets() {
  const { user } = useContext(AuthContext);
  const fileInputRef = useRef();

  const [tickets, setTickets] = useState([]);
  const [createdTickets, setCreatedTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    assignedTo: "",
    createdBy: "",
    status: "", // Can be "", "Pending", "InProgress", "Done", or "Active" for both Pending/InProgress
  });

  const [form, setForm] = useState({
    AssignedTo: "",
    Issue: "",
    IssuePhoto: null,
  });

  const [activeTab, setActiveTab] = useState("all");
  const [creating, setCreating] = useState(false);
  const [markingDone, setMarkingDone] = useState(null);
  const [modalImage, setModalImage] = useState(null);

  const authHeader = {
    headers: { Authorization: `Bearer ${user.token}` },
  };

  // ================= API CALLS =================
  const loadTickets = async () => {
    setLoading(true);
    try {
      let params = { ...filters };
      
      // If status filter is "Active", don't send status param to get all tickets
      // We'll filter them client-side
      if (params.status === "Active") {
        delete params.status;
      }
      
      const res = await axios.get("/helpTickets/all", {
        ...authHeader,
        params: params,
      });
      
      let filteredTickets = res.data.tickets || [];
      
      // Client-side filtering for Active status (Pending + InProgress)
      if (filters.status === "Active") {
        filteredTickets = filteredTickets.filter(t => 
          t.Status === "Pending" || t.Status === "InProgress"
        );
      }
      
      setTickets(filteredTickets);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch tickets");
    }
    setLoading(false);
  };

  const loadCreatedTickets = async () => {
    try {
      const res = await axios.get("/helpTickets/created", authHeader);
      setCreatedTickets(res.data || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load created tickets");
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await axios.get("/employee/all", authHeader);
      setEmployees(res.data.filter(e => e.name !== user.name));
    } catch (err) {
      console.error(err);
      alert("Failed to load employees");
    }
  };

  // ================= TAB SWITCH HANDLER =================
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);

    if (tab === "all") {
      loadTickets();
    } else if (tab === "create") {
      loadEmployees();
      loadCreatedTickets();
    }
  };

  // ================= STATUS FILTER HANDLER =================
  const handleStatusFilter = (status) => {
    setFilters(prev => ({ ...prev, status }));
  };

  // ================= INITIAL LOAD =================
  useEffect(() => {
    handleTabSwitch("all"); // First tab active
  }, []);

  // ================= LOAD TICKETS WHEN FILTERS CHANGE =================
  useEffect(() => {
    if (activeTab === "all") {
      loadTickets();
    }
  }, [filters.status]); // Reload when status filter changes

  // ================= ACTIONS =================
  const handleFileChange = (e) => {
    setForm(prev => ({ ...prev, IssuePhoto: e.target.files[0] }));
  };

  const createTicket = async () => {
    if (!form.AssignedTo || !form.Issue.trim()) {
      alert("All fields are required");
      return;
    }
    if (form.IssuePhoto) {
      const f = form.IssuePhoto;
      if (f.size > 5 * 1024 * 1024) return alert("Image too large (max 5MB). Please compress below 2MB and retry.");
      if (!/^(image\/(jpeg|png|gif|webp|jpg)|application\/pdf)$/.test(f.type) && !/\.(jpe?g|png|gif|webp|pdf)$/i.test(f.name || "")) {
        return alert("Only JPG, PNG, GIF, WEBP or PDF allowed. iPhone HEIC supported nahi hai - JPG/screenshot bhejo.");
      }
    }

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("AssignedTo", form.AssignedTo);
      formData.append("Issue", form.Issue.trim());
      if (form.IssuePhoto) formData.append("IssuePhoto", form.IssuePhoto, form.IssuePhoto.name);

      await axios.post("/helpTickets/create", formData, {
        headers: {
          ...authHeader.headers,
        },
        timeout: 60000,
      });

      await loadCreatedTickets();

      setForm({ AssignedTo: "", Issue: "", IssuePhoto: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      const srv = err.response?.data;
      alert(srv ? (srv.error + (srv.hint ? "\n" + srv.hint : "")) : "Failed to create ticket");
    }
    setCreating(false);
  };

  const markDone = async (id) => {
    setMarkingDone(id);
    const cleanId = encodeURIComponent(id.trim());

    try {
      await axios.patch(`/helpTickets/status/${cleanId}`, { Status: "Done" }, authHeader);
      setCreatedTickets(prev => prev.filter(t => t.TicketID !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to mark as done");
    }
    setMarkingDone(null);
  };

  // ================= TICKET CARD COMPONENT =================
  const TicketCard = ({ ticket, showMarkDone }) => {
    const createdDate = dayjs(ticket.CreatedDate, "DD/MM/YYYY HH:mm:ss");
    return (
      <div key={ticket.TicketID} className="bg-white p-4 rounded shadow mb-4 flex justify-between">
        <div>
          <div className="font-semibold">#{ticket.TicketID} — {ticket.Issue}</div>
          <div className="text-sm text-gray-600">Created By: {ticket.CreatedBy}</div>
          <div className="text-sm text-gray-600">Assigned To: {ticket.AssignedTo}</div>
          <div className="text-sm text-gray-600">{createdDate.fromNow()}</div>
        </div>
        <div className="flex items-center gap-2">
          {ticket.IssuePhoto && (
            <button
              onClick={() => setModalImage(ticket.IssuePhoto)}
              className="bg-gray-700 text-white px-3 py-1 rounded"
            >
              View Image
            </button>
          )}
          {showMarkDone ? (
            <button
              disabled={markingDone === ticket.TicketID}
              onClick={() => markDone(ticket.TicketID)}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              {markingDone === ticket.TicketID ? "Marking..." : "Mark Done"}
            </button>
          ) : (
            <span className={`px-3 py-1 rounded text-white ${
              ticket.Status === "Pending" ? "bg-yellow-500" :
              ticket.Status === "InProgress" ? "bg-blue-500" :
              ticket.Status === "Done" ? "bg-green-500" :
              "bg-gray-500"
            }`}>
              {ticket.Status}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Function to get status tab color
  const getStatusTabColor = (status) => {
    if (filters.status === status) {
      switch(status) {
        case "Pending":
          return "bg-yellow-500 text-white";
        case "InProgress":
          return "bg-blue-500 text-white";
        case "Active":
          return "bg-purple-600 text-white";
        case "Done":
          return "bg-green-500 text-white";
        default:
          return "bg-gray-600 text-white"; // For "All" tab
      }
    }
    return "bg-gray-200 text-gray-700 hover:bg-gray-300";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
      <h2 className="text-3xl font-bold mb-6">Help Tickets</h2>

      {/* MAIN TABS */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => handleTabSwitch("all")}
          className={`px-4 py-2 rounded transition-colors ${
            activeTab === "all" 
              ? "bg-blue-600 text-white" 
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          All Help Tickets
        </button>
        <button
          onClick={() => handleTabSwitch("create")}
          className={`px-4 py-2 rounded transition-colors ${
            activeTab === "create" 
              ? "bg-blue-600 text-white" 
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Create Help Ticket
        </button>
      </div>

      {/* ================= ALL TICKETS ================= */}
      {activeTab === "all" && (
        <>
          {/* STATUS FILTER TABS - With different colors */}
          <div className="bg-white p-4 rounded shadow mb-4 flex gap-2 flex-wrap">
            {/* Active tab for Pending + InProgress */}
            <button
              onClick={() => handleStatusFilter("Active")}
              className={`px-4 py-2 rounded transition-colors ${getStatusTabColor("Active")}`}
            >
               (Pending & In Progress)
            </button>
            
            <button
              onClick={() => handleStatusFilter("Done")}
              className={`px-4 py-2 rounded transition-colors ${getStatusTabColor("Done")}`}
            >
              Done
            </button>

            <button
              onClick={() => handleStatusFilter("")}
              className={`px-4 py-2 rounded transition-colors ${getStatusTabColor("")}`}
            >
              All
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {loading && <div className="text-center py-6 text-gray-500">Loading tickets...</div>}
            {!loading && tickets.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                {filters.status === "Active" ? "No active tickets (Pending or In Progress)" : 
                 filters.status ? `No ${filters.status} tickets available` : "No tickets available"}
              </div>
            )}
            {!loading && tickets.map(t => <TicketCard key={t.TicketID} ticket={t} showMarkDone={false} />)}
          </div>
        </>
      )}

      {/* ================= CREATE TAB ================= */}
      {activeTab === "create" && (
        <>
          {/* Create Form */}
          <div className="bg-white p-6 rounded shadow mb-6">
            <select
              className="w-full border p-2 rounded mb-4"
              value={form.AssignedTo}
              onChange={e => setForm({ ...form, AssignedTo: e.target.value })}
            >
              <option value="">Select Employee</option>
              {employees.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>

            <textarea
              className="w-full border p-2 rounded mb-4"
              placeholder="Describe the issue"
              value={form.Issue}
              onChange={e => setForm({ ...form, Issue: e.target.value })}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mb-4"
            />

            {form.IssuePhoto && (
              <img
                src={URL.createObjectURL(form.IssuePhoto)}
                alt="preview"
                className="w-32 h-32 object-cover mb-4 border rounded"
              />
            )}

            <button
              disabled={creating || !form.AssignedTo || !form.Issue.trim()}
              onClick={createTicket}
              className={`px-6 py-3 rounded text-white transition-colors ${
                creating || !form.AssignedTo || !form.Issue.trim() 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {creating ? "Creating Ticket..." : "Create Ticket"}
            </button>
          </div>

          {/* Created Tickets */}
          <div className="grid gap-4">
            {createdTickets.filter(t => !t.DoneDate).length === 0 && (
              <div className="text-center text-gray-500">No created tickets pending</div>
            )}

            {createdTickets
              .filter(t => !t.DoneDate)
              .map(t => <TicketCard key={t.TicketID} ticket={t} showMarkDone={true} />)}
          </div>
        </>
      )}

      {/* ================= IMAGE MODAL ================= */}
      {modalImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setModalImage(null)}
        >
          <div className="relative">
            {/* Close Button */}
            <button
              className="absolute top-2 right-2 text-white text-2xl font-bold bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-80"
              onClick={() => setModalImage(null)}
            >
              ×
            </button>

            <img
              src={modalImage}
              alt="Issue"
              className="max-w-[90vw] max-h-[90vh] rounded shadow-lg"
              onClick={e => e.stopPropagation()} // Prevent modal close when clicking image
            />
          </div>
        </div>
      )}
    </div>
  );
}