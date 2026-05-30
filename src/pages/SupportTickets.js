import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);

const DATE_FORMAT = "DD/MM/YYYY HH:mm:ss";

export default function SupportTicket() {
  const { user } = useContext(AuthContext);
  const fileInputRef = useRef();

  /* ================= STATES ================= */
  const [activeMainTab, setActiveMainTab] = useState("all");
  const [tickets, setTickets] = useState([]);
  const [createdTickets, setCreatedTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Status filter for All view
  const [statusFilter, setStatusFilter] = useState(""); // "", "Active", "Done", "Approved"
  
  // Status filter for Created view
  const [createdStatusFilter, setCreatedStatusFilter] = useState(""); // "", "Active", "Done", "Approved"

  // Department filter for All view
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [uniqueDepartments, setUniqueDepartments] = useState([]);

  const [allTicketsLoading, setAllTicketsLoading] = useState(false);
  const [createdTicketsLoading, setCreatedTicketsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState({});
  const [modalImage, setModalImage] = useState(null);
  const [userDept, setUserDept] = useState("");
  const [showDropdown, setShowDropdown] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  const [form, setForm] = useState({
    Issue: "",
    IssuePhoto: null,
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${user.token}` },
  };

  /* ================= LOADERS ================= */
  const loadUserDepartment = async () => {
    try {
      const res = await axios.get("/employee/all", authHeader);
      const currentUser = (res.data || []).find(e => e.name === user.name);
      setUserDept(currentUser?.department || "");
      console.log("User Department:", currentUser?.department);
    } catch (err) {
      console.error("Failed to load user department:", err);
      toast.error("Failed to load user department");
    }
  };

  const loadAllTickets = async () => {
    setAllTicketsLoading(true);
    try {
      const res = await axios.get("/support-tickets/all", authHeader);
      const ticketData = res.data.tickets || [];
      setTickets(ticketData);
      
      // Extract unique departments for filter
      const depts = [...new Set(ticketData.map(t => t.Department).filter(d => d))];
      setUniqueDepartments(depts);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load tickets");
    }
    setAllTicketsLoading(false);
  };

  const loadCreatedTickets = async () => {
    setCreatedTicketsLoading(true);
    try {
      const res = await axios.get("/support-tickets/created", authHeader);
      setCreatedTickets(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load created tickets");
    }
    setCreatedTicketsLoading(false);
  };

  const loadEmployees = async () => {
    try {
      const res = await axios.get("/employee/all", authHeader);
      setEmployees((res.data || []).filter((e) => e.name !== user.name));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadUserDepartment();
    loadAllTickets();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (activeMainTab === "create") {
      loadCreatedTickets();
    }
  }, [activeMainTab]);

  /* ================= ACTIONS ================= */
  const handleFileChange = (e) => {
    setForm((prev) => ({ ...prev, IssuePhoto: e.target.files[0] }));
  };

  const createTicket = async () => {
    if (!form.Issue) {
      toast.error("Issue description is required");
      return;
    }

    setCreating(true);
    const toastId = toast.loading("Creating ticket...");

    try {
      const formData = new FormData();
      formData.append("Issue", form.Issue);
      if (form.IssuePhoto) formData.append("IssuePhoto", form.IssuePhoto);

      // Clear form
      setForm({ Issue: "", IssuePhoto: null });
      if (fileInputRef.current) fileInputRef.current.value = null;

      await axios.post("/support-tickets/create", formData, {
        headers: {
          ...authHeader.headers,
          "Content-Type": "multipart/form-data",
        },
      });

      await loadCreatedTickets();
      
      toast.update(toastId, {
        render: "Ticket created successfully!",
        type: "success",
        isLoading: false,
        autoClose: 3000
      });
    } catch (err) {
      console.error(err);
      toast.update(toastId, {
        render: err.response?.data?.error || "Failed to create ticket",
        type: "error",
        isLoading: false,
        autoClose: 3000
      });
    }

    setCreating(false);
  };

  const updateStatus = async (id, status) => {
    setUpdating((p) => ({ ...p, [id]: true }));
    
    let actionText = "";
    if (status === "InProgress") actionText = "Starting";
    else if (status === "Done") actionText = "Completing";
    else if (status === "Approved") actionText = "Approving";
    else if (status === "Pending") actionText = "Rejecting";
    
    const toastId = toast.loading(`${actionText} ticket...`);

    try {
      const cleanId = encodeURIComponent(id.trim());
      console.log(`Updating ticket ${id} to status: ${status}`);
      
      const response = await axios.patch(
        `/support-tickets/status/${cleanId}`, 
        { Status: status }, 
        authHeader
      );
      
      console.log("Update response:", response.data);
      
      // Refresh both ticket lists
      await Promise.all([
        loadAllTickets(),
        loadCreatedTickets()
      ]);
      
      setShowDropdown((p) => ({ ...p, [id]: false }));
      
      let successMsg = "";
      if (status === "InProgress") successMsg = "Ticket started successfully!";
      else if (status === "Done") successMsg = "Ticket marked as done!";
      else if (status === "Approved") successMsg = "Ticket approved successfully!";
      else if (status === "Pending") successMsg = "Ticket rejected and sent back to pending!";
      
      toast.update(toastId, {
        render: successMsg,
        type: "success",
        isLoading: false,
        autoClose: 3000
      });
      
    } catch (err) {
      console.error("Update error:", err);
      toast.update(toastId, {
        render: err.response?.data?.error || "Failed to update status",
        type: "error",
        isLoading: false,
        autoClose: 3000
      });
    } finally {
      setUpdating((p) => ({ ...p, [id]: false }));
    }
  };

  // Update group of tickets (for approve/reject all)
  const updateGroupStatus = async (group, status, actionText) => {
    const groupKey = group.Issue;
    setActionLoading(prev => ({ ...prev, [groupKey]: true }));
    
    const toastId = toast.loading(`${actionText}ing all tickets...`);

    try {
      // Update the main ticket - backend will handle all related tickets
      const mainTicketId = group.tickets[0].TicketID;
      
      const response = await axios.patch(
        `/support-tickets/status/${encodeURIComponent(mainTicketId.trim())}`, 
        { Status: status }, 
        authHeader
      );
      
      console.log("Group update response:", response.data);
      
      await Promise.all([
        loadAllTickets(),
        loadCreatedTickets()
      ]);
      
      setShowDropdown((p) => ({ ...p, [group.Issue]: false }));
      
      toast.update(toastId, {
        render: `All tickets ${actionText.toLowerCase()}ed successfully!`,
        type: "success",
        isLoading: false,
        autoClose: 3000
      });
      return true;
    } catch (err) {
      console.error(`${actionText} error:`, err);
      toast.update(toastId, {
        render: err.response?.data?.error || `Failed to ${actionText.toLowerCase()} tickets`,
        type: "error",
        isLoading: false,
        autoClose: 3000
      });
      return false;
    } finally {
      setActionLoading(prev => ({ ...prev, [groupKey]: false }));
    }
  };

  // Filter tickets based on status filter and department filter
  const getFilteredTickets = (tickets, status, department) => {
    let filtered = tickets;
    
    // Status filter
    if (status) {
      switch(status) {
        case "Active":
          filtered = filtered.filter(t => t.Status === "Pending" || t.Status === "InProgress");
          break;
        case "Done":
          filtered = filtered.filter(t => t.Status === "Done" && t.Taskcompletedapproval !== "Approved");
          break;
        case "Approved":
          filtered = filtered.filter(t => t.Status === "Done" && t.Taskcompletedapproval === "Approved");
          break;
        default:
          break;
      }
    }
    
    // Department filter
    if (department) {
      filtered = filtered.filter(t => t.Department === department);
    }
    
    return filtered;
  };

  // Group tickets by Issue with Department
  const groupTicketsByIssue = (tickets) => {
    const grouped = {};
    
    tickets.forEach(ticket => {
      if (!grouped[ticket.Issue]) {
        grouped[ticket.Issue] = {
          Issue: ticket.Issue,
          tickets: [ticket],
          count: 1,
          TicketID: ticket.TicketID,
          CreatedBy: ticket.CreatedBy,
          CreatedDate: ticket.CreatedDate,
          IssuePhoto: ticket.IssuePhoto,
          Status: ticket.Status,
          WorkBy: ticket.WorkBy || "",
          DoneDate: ticket.DoneDate || "",
          Taskcompletedapproval: ticket.Taskcompletedapproval || "Pending",
          AssignedTo: ticket.AssignedTo,
          Department: ticket.Department || "N/A",
          uniqueWorkBy: ticket.WorkBy ? [ticket.WorkBy] : []
        };
      } else {
        grouped[ticket.Issue].tickets.push(ticket);
        grouped[ticket.Issue].count++;
        
        // Track unique workBy
        if (ticket.WorkBy && !grouped[ticket.Issue].uniqueWorkBy.includes(ticket.WorkBy)) {
          grouped[ticket.Issue].uniqueWorkBy.push(ticket.WorkBy);
        }
        
        // Update DoneDate if exists
        if (ticket.DoneDate && !grouped[ticket.Issue].DoneDate) {
          grouped[ticket.Issue].DoneDate = ticket.DoneDate;
        }
        
        // Update Taskcompletedapproval - if any ticket is approved, show approved
        if (ticket.Taskcompletedapproval === "Approved") {
          grouped[ticket.Issue].Taskcompletedapproval = "Approved";
        }
        
        // Department should be same for same issue
        if (ticket.Department && !grouped[ticket.Issue].Department) {
          grouped[ticket.Issue].Department = ticket.Department;
        }
      }
    });
    
    return Object.values(grouped);
  };

  // Group tickets by Issue for counting purposes only
  const getGroupedTicketsForCount = (tickets) => {
    const grouped = {};
    
    tickets.forEach(ticket => {
      if (!grouped[ticket.Issue]) {
        grouped[ticket.Issue] = {
          Issue: ticket.Issue,
          tickets: [ticket],
          Status: ticket.Status,
          Taskcompletedapproval: ticket.Taskcompletedapproval || "Pending"
        };
      } else {
        grouped[ticket.Issue].tickets.push(ticket);
        // Update Taskcompletedapproval - if any ticket is approved, mark group as approved
        if (ticket.Taskcompletedapproval === "Approved") {
          grouped[ticket.Issue].Taskcompletedapproval = "Approved";
        }
      }
    });
    
    return Object.values(grouped);
  };

  // Get unique counts based on grouped tickets
  const getUniqueCounts = (tickets) => {
    const grouped = getGroupedTicketsForCount(tickets);
    
    const active = grouped.filter(g => 
      g.Status === "Pending" || g.Status === "InProgress"
    ).length;
    
    const completed = grouped.filter(g => 
      g.Status === "Done" && g.Taskcompletedapproval !== "Approved"
    ).length;
    
    const approved = grouped.filter(g => 
      g.Status === "Done" && g.Taskcompletedapproval === "Approved"
    ).length;
    
    return { active, completed, approved };
  };

  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === "") return null;
    return dayjs(dateStr, DATE_FORMAT);
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === "") return "N/A";
    const date = parseDate(dateStr);
    return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : dateStr;
  };

  const timeAgo = (dateStr) => {
    if (!dateStr || dateStr === "") return "N/A";
    const date = parseDate(dateStr);
    return date.isValid() ? date.fromNow() : "N/A";
  };

  // ============== COUNT VARIABLES ==============
  // ALL TICKETS - Filtered by status and department
  const filteredAllForCount = getFilteredTickets(tickets, statusFilter, departmentFilter);
  const groupedAllForCount = groupTicketsByIssue(filteredAllForCount);
  const allCounts = getUniqueCounts(filteredAllForCount);
  const allActiveCount = allCounts.active;
  const allCompletedCount = allCounts.completed;
  const allApprovedCount = allCounts.approved;

  // CREATED TICKETS - Unique counts based on grouped tickets
  const filteredCreatedForCount = getFilteredTickets(createdTickets, createdStatusFilter, "");
  const createdCounts = getUniqueCounts(filteredCreatedForCount);
  const createdActiveCount = createdCounts.active;
  const createdCompletedCount = createdCounts.completed;
  const createdApprovedCount = createdCounts.approved;

  // Unique total counts for main tabs
  const uniqueAllTotal = groupTicketsByIssue(tickets).length;
  const uniqueCreatedTotal = groupTicketsByIssue(createdTickets).length;

  // Filter and group tickets for All view
  const filteredAll = getFilteredTickets(tickets, statusFilter, departmentFilter);
  const groupedAll = groupTicketsByIssue(filteredAll);
  
  // Filter and group tickets for Created view
  const filteredCreated = getFilteredTickets(createdTickets, createdStatusFilter, "");
  const groupedCreated = groupTicketsByIssue(filteredCreated);

  // Function to get status button class for All view
  const getStatusButtonClass = (status) => {
    const baseClasses = "px-4 py-2 rounded transition-colors";
    
    if (statusFilter === status) {
      switch(status) {
        case "Active":
          return `${baseClasses} bg-purple-600 text-white`;
        case "Done":
          return `${baseClasses} bg-green-500 text-white`;
        case "Approved":
          return `${baseClasses} bg-blue-600 text-white`;
        case "":
          return `${baseClasses} bg-gray-600 text-white`;
        default:
          return `${baseClasses} bg-gray-600 text-white`;
      }
    }
    
    return `${baseClasses} bg-gray-200 text-gray-700 hover:bg-gray-300`;
  };

  // Function to get status button class for Created view
  const getCreatedStatusButtonClass = (status) => {
    const baseClasses = "px-4 py-2 rounded transition-colors";
    
    if (createdStatusFilter === status) {
      switch(status) {
        case "Active":
          return `${baseClasses} bg-purple-600 text-white`;
        case "Done":
          return `${baseClasses} bg-green-500 text-white`;
        case "Approved":
          return `${baseClasses} bg-blue-600 text-white`;
        case "":
          return `${baseClasses} bg-gray-600 text-white`;
        default:
          return `${baseClasses} bg-gray-600 text-white`;
      }
    }
    
    return `${baseClasses} bg-gray-200 text-gray-700 hover:bg-gray-300`;
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <h2 className="text-xl font-semibold mb-3">Support Tickets</h2>

      {/* MAIN TABS */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setActiveMainTab("all")}
          className={`px-3 py-1.5 rounded text-sm transition ${
            activeMainTab === "all" 
              ? "bg-blue-600 text-white" 
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          All Support Tickets ({uniqueAllTotal})
        </button>

        <button
          onClick={() => setActiveMainTab("create")}
          className={`px-3 py-1.5 rounded text-sm transition ${
            activeMainTab === "create" 
              ? "bg-blue-600 text-white" 
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          Create Support Ticket ({uniqueCreatedTotal})
        </button>
      </div>

      {/* ================= ALL TICKETS TAB ================= */}
      {activeMainTab === "all" && (
        <>
          {/* STATUS FILTER TABS */}
          <div className="bg-white p-4 rounded shadow mb-4">
            <div className="flex gap-2 flex-wrap mb-3">
              <button
                onClick={() => setStatusFilter("Active")}
                className={getStatusButtonClass("Active")}
              >
                Active (Pending & InProgress) ({allActiveCount})
              </button>
              
              <button
                onClick={() => setStatusFilter("Done")}
                className={getStatusButtonClass("Done")}
              >
                Completed ({allCompletedCount})
              </button>
              
              <button
                onClick={() => setStatusFilter("Approved")}
                className={getStatusButtonClass("Approved")}
              >
                Approved ({allApprovedCount})
              </button>

              <button
                onClick={() => setStatusFilter("")}
                className={getStatusButtonClass("")}
              >
                All ({groupedAll.length})
              </button>
            </div>

            {/* DEPARTMENT FILTER */}
            {uniqueDepartments.length > 0 && (
              <div className="flex gap-2 flex-wrap items-center pt-3 border-t">
                <span className="text-sm font-medium text-gray-700">Department:</span>
                <button
                  onClick={() => setDepartmentFilter("")}
                  className={`px-3 py-1 rounded text-xs transition ${
                    departmentFilter === "" 
                      ? "bg-gray-600 text-white" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  All Departments
                </button>
                {uniqueDepartments.map(dept => (
                  <button
                    key={dept}
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-3 py-1 rounded text-xs transition ${
                      departmentFilter === dept 
                        ? "bg-purple-600 text-white" 
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TICKETS LIST - All view with Department */}
          <div className="space-y-2">
            {allTicketsLoading && (
              <div className="text-center py-6 text-sm">Loading tickets...</div>
            )}

            {!allTicketsLoading && groupedAll.length === 0 && (
              <div className="text-gray-500 text-center py-6 bg-white rounded-lg shadow-sm text-sm">
                {statusFilter === "Active" ? "No active tickets" :
                 statusFilter === "Done" ? "No completed tickets" :
                 statusFilter === "Approved" ? "No approved tickets" :
                 "No tickets available"}
              </div>
            )}

            {!allTicketsLoading && groupedAll.map((group) => {
              const isActionLoading = actionLoading[group.Issue];
              
              return (
                <div key={group.Issue} className="bg-white p-3 rounded-lg shadow-sm border hover:shadow transition">
                  <div className="flex flex-col md:flex-row justify-between gap-2">
                    <div className="flex-1">
                      {/* Line 1: Ticket ID and Issue */}
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono whitespace-nowrap">
                          {group.TicketID}
                        </span>
                        <span className="font-medium text-sm line-clamp-2 flex-1">
                          {group.Issue}
                        </span>
                      </div>
                      
                      {/* Line 2: Created By and Created Date */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1">
                        <span className="text-gray-500">Created By:</span>
                        <span className="font-medium">{group.CreatedBy}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">Created:</span>
                        <span className="font-medium">{formatDate(group.CreatedDate)}</span>
                      </div>
                      
                      {/* Line 3: DEPARTMENT (NEW) */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1">
                        <span className="text-gray-500">Department:</span>
                        <span className="font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                          {group.Department}
                        </span>
                      </div>
                      
                      {/* Line 4: Assigned To / Work By | Status | Done Date */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-gray-500">Assigned To:</span>
                        <span className="font-medium text-blue-600">
                          {group.uniqueWorkBy && group.uniqueWorkBy.length > 0 
                            ? group.uniqueWorkBy.join(", ") 
                            : "MIS"}
                        </span>
                        
                        <span className="text-gray-400">•</span>
                        
                        <span className="text-gray-500">Status:</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium
                          ${group.Status === "Pending" ? "bg-yellow-100 text-yellow-800" : ""}
                          ${group.Status === "InProgress" ? "bg-blue-100 text-blue-800" : ""}
                          ${group.Status === "Done" ? "bg-green-100 text-green-800" : ""}
                        `}>
                          {group.Status}
                        </span>
                        
                        {group.Taskcompletedapproval === "Approved" && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs font-medium">
                              ✓ Approved
                            </span>
                          </>
                        )}
                        
                        {group.DoneDate && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">Done:</span>
                            <span className="font-medium text-green-600">
                              {formatDate(group.DoneDate)}
                            </span>
                          </>
                        )}
                        
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-400">
                          {timeAgo(group.CreatedDate)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-row items-center gap-1 mt-2 md:mt-0 md:ml-2">
                      {group.IssuePhoto && (
                        <button
                          onClick={() => setModalImage(group.IssuePhoto)}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700 transition"
                        >
                          View
                        </button>
                      )}

                      {/* Show dropdown in Completed filter for non-MIS users */}
                      {statusFilter === "Done" && group.Status === "Done" && userDept !== "MIS" && (
                        <div className="relative">
                          <button
                            onClick={() => setShowDropdown({ ...showDropdown, [group.Issue]: !showDropdown[group.Issue] })}
                            disabled={isActionLoading}
                            className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700 transition flex items-center gap-1 disabled:opacity-50"
                          >
                            {isActionLoading ? "..." : (
                              <>
                                <span>Actions</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </>
                            )}
                          </button>
                          
                          {showDropdown[group.Issue] && !isActionLoading && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-10 border text-xs">
                              <button
                                onClick={async () => {
                                  const success = await updateGroupStatus(group, "Approved", "Approv");
                                  if (success) {
                                    setShowDropdown({ ...showDropdown, [group.Issue]: false });
                                  }
                                }}
                                className="block w-full text-left px-3 py-2 text-green-700 hover:bg-green-50 transition font-medium border-b"
                              >
                                ✓ Approve All
                              </button>
                              <button
                                onClick={async () => {
                                  const success = await updateGroupStatus(group, "Pending", "Reject");
                                  if (success) {
                                    setShowDropdown({ ...showDropdown, [group.Issue]: false });
                                  }
                                }}
                                className="block w-full text-left px-3 py-2 text-red-700 hover:bg-red-50 transition"
                              >
                                ↺ Reject All
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Show approved badge in approved filter */}
                      {statusFilter === "Approved" && group.Taskcompletedapproval === "Approved" && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                          ✓ Approved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ================= CREATE TAB ================= */}
      {activeMainTab === "create" && (
        <>
          {/* CREATE FORM */}
          <div className="bg-white p-3 rounded-lg shadow-sm mb-4 border">
            <h3 className="font-medium text-sm mb-2">Create New Ticket</h3>

            <textarea
              className="w-full border p-2 rounded mb-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              placeholder="Describe the issue..."
              value={form.Issue}
              onChange={(e) => setForm({ ...form, Issue: e.target.value })}
              rows="2"
            />

            <div className="flex items-center gap-2 mb-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-sm"
              />
            </div>

            {form.IssuePhoto && (
              <div className="mb-2">
                <img
                  src={URL.createObjectURL(form.IssuePhoto)}
                  alt="preview"
                  className="w-16 h-16 object-cover border rounded"
                />
              </div>
            )}

            <button
              disabled={creating}
              onClick={createTicket}
              className={`px-3 py-1.5 rounded text-white text-sm transition ${
                creating 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {creating ? "Creating..." : "Create Ticket"}
            </button>
          </div>

          {/* STATUS FILTER TABS - For Created view */}
          <div className="bg-white p-4 rounded shadow mb-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setCreatedStatusFilter("Active")}
              className={getCreatedStatusButtonClass("Active")}
            >
              Active (Pending & InProgress) ({createdActiveCount})
            </button>
            
            <button
              onClick={() => setCreatedStatusFilter("Done")}
              className={getCreatedStatusButtonClass("Done")}
            >
              Completed ({createdCompletedCount})
            </button>
            
            <button
              onClick={() => setCreatedStatusFilter("Approved")}
              className={getCreatedStatusButtonClass("Approved")}
            >
              Approved ({createdApprovedCount})
            </button>

            <button
              onClick={() => setCreatedStatusFilter("")}
              className={getCreatedStatusButtonClass("")}
            >
              All ({uniqueCreatedTotal})
            </button>
          </div>

          {/* CREATED TICKETS LIST with Department */}
          <div className="space-y-2">
            {createdTicketsLoading && (
              <div className="text-center py-6 text-sm">Loading created tickets...</div>
            )}

            {!createdTicketsLoading && groupedCreated.length === 0 && (
              <div className="text-gray-500 text-center py-6 bg-white rounded-lg shadow-sm text-sm">
                {createdStatusFilter === "Active" ? "No active tickets" :
                 createdStatusFilter === "Done" ? "No completed tickets" :
                 createdStatusFilter === "Approved" ? "No approved tickets" :
                 "No tickets available"}
              </div>
            )}

            {!createdTicketsLoading && groupedCreated.map((group) => {
              const isActionLoading = actionLoading[group.Issue];
              
              return (
                <div key={group.Issue} className="bg-white p-3 rounded-lg shadow-sm border hover:shadow transition">
                  <div className="flex flex-col md:flex-row justify-between gap-2">
                    <div className="flex-1">
                      {/* Line 1: Ticket ID and Issue */}
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono whitespace-nowrap">
                          {group.TicketID}
                        </span>
                        {group.count > 1 && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded whitespace-nowrap">
                            {group.count} tickets
                          </span>
                        )}
                        <span className="font-medium text-sm line-clamp-2 flex-1">
                          {group.Issue}
                        </span>
                      </div>
                      
                      {/* Line 2: Created By and Created Date */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1">
                        <span className="text-gray-500">Created By:</span>
                        <span className="font-medium">{group.CreatedBy}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">Created:</span>
                        <span className="font-medium">{formatDate(group.CreatedDate)}</span>
                      </div>
                      
                      {/* Line 3: DEPARTMENT (NEW) */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1">
                        <span className="text-gray-500">Department:</span>
                        <span className="font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                          {group.Department}
                        </span>
                      </div>
                      
                      {/* Line 4: Assigned To / Work By | Status | Done Date */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-gray-500">Assigned To:</span>
                        <span className="font-medium text-blue-600">
                          {group.uniqueWorkBy && group.uniqueWorkBy.length > 0 
                            ? group.uniqueWorkBy.join(", ") 
                            : "MIS"}
                        </span>
                        
                        <span className="text-gray-400">•</span>
                        
                        <span className="text-gray-500">Status:</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium
                          ${group.Status === "Pending" ? "bg-yellow-100 text-yellow-800" : ""}
                          ${group.Status === "InProgress" ? "bg-blue-100 text-blue-800" : ""}
                          ${group.Status === "Done" ? "bg-green-100 text-green-800" : ""}
                        `}>
                          {group.Status}
                        </span>
                        
                        {group.Taskcompletedapproval === "Approved" && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs font-medium">
                              ✓ Approved
                            </span>
                          </>
                        )}
                        
                        {group.DoneDate && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">Done:</span>
                            <span className="font-medium text-green-600">
                              {formatDate(group.DoneDate)}
                            </span>
                          </>
                        )}
                        
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-400">
                          {timeAgo(group.CreatedDate)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-row items-center gap-1 mt-2 md:mt-0 md:ml-2">
                      {group.IssuePhoto && (
                        <button
                          onClick={() => setModalImage(group.IssuePhoto)}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700 transition"
                        >
                          View
                        </button>
                      )}

                      {/* For Created view - Completed filter: Show Approve/Reject dropdown */}
                      {createdStatusFilter === "Done" && group.Status === "Done" && (
                        <div className="relative">
                          <button
                            onClick={() => setShowDropdown({ ...showDropdown, [group.Issue]: !showDropdown[group.Issue] })}
                            disabled={isActionLoading}
                            className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700 transition flex items-center gap-1 disabled:opacity-50"
                          >
                            {isActionLoading ? "..." : (
                              <>
                                <span>Actions</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </>
                            )}
                          </button>
                          
                          {showDropdown[group.Issue] && !isActionLoading && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-10 border text-xs">
                              <button
                                onClick={async () => {
                                  const success = await updateGroupStatus(group, "Approved", "Approv");
                                  if (success) {
                                    setShowDropdown({ ...showDropdown, [group.Issue]: false });
                                  }
                                }}
                                className="block w-full text-left px-3 py-2 text-green-700 hover:bg-green-50 transition font-medium border-b"
                              >
                                ✓ Approve All
                              </button>
                              <button
                                onClick={async () => {
                                  const success = await updateGroupStatus(group, "Pending", "Reject");
                                  if (success) {
                                    setShowDropdown({ ...showDropdown, [group.Issue]: false });
                                  }
                                }}
                                className="block w-full text-left px-3 py-2 text-red-700 hover:bg-red-50 transition"
                              >
                                ↺ Reject All
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Show approved badge in approved filter */}
                      {createdStatusFilter === "Approved" && group.Taskcompletedapproval === "Approved" && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                          ✓ Approved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* IMAGE MODAL */}
      {modalImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-w-2xl max-h-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalImage(null);
              }}
              className="absolute top-2 right-2 text-white bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-red-700 z-10 transition"
            >
              ×
            </button>
            <img
              src={modalImage}
              alt="Issue"
              className="max-w-full max-h-[80vh] rounded shadow-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}