import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ======================================================
// MULTI-SELECT DROPDOWN COMPONENT WITH SEARCH
// ======================================================
const MultiSelectDropdown = ({ options, selectedValues, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (optionValue) => {
    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter(v => v !== optionValue));
    } else {
      onChange([...selectedValues, optionValue]);
    }
  };

  const selectAll = () => {
    onChange(options.map(opt => opt.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedCount = selectedValues.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="w-full min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:border-gray-400 transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedCount === 0 ? "text-gray-400" : "text-gray-700"}>
          {selectedCount === 0 
            ? (placeholder || "Select employees...") 
            : `${selectedCount} employee(s) selected`}
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-20 max-h-80 overflow-hidden">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="🔍 Search employees..."
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="p-2 border-b flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); selectAll(); }}
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
            >
              ✅ Select All
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="text-xs bg-gray-300 px-2 py-1 rounded hover:bg-gray-400"
            >
              ✖ Clear All
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-gray-400 text-sm">No employees found</div>
            ) : (
              filteredOptions.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedValues.includes(opt.value)}
                    onChange={() => toggleOption(opt.value)}
                  />
                  <span className="text-sm text-gray-700">{opt.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ======================================================
// MAIN DELEGATION COMPONENT
// ======================================================
export default function Delegation() {
  const { user } = useContext(AuthContext);
  const [assignBy, setAssignBy] = useState("");
  const [employees, setEmployees] = useState([]);
  const [admin, setAdmin] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [shiftTask, setShiftTask] = useState(null);
  const [loadingShiftBtn, setLoadingShiftBtn] = useState(false);
  const [loadingTaskId, setLoadingTaskId] = useState(null);
  const [loadingApprovalId, setLoadingApprovalId] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [form, setForm] = useState({
    TaskName: "",
    Deadline: "",
    Priority: "",
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDownloadDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper Functions
  function formatDateDDMMYYYYHHMMSS(date = new Date()) {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utc + istOffset);
    const dd = String(istDate.getDate()).padStart(2, "0");
    const mm = String(istDate.getMonth() + 1).padStart(2, "0");
    const yyyy = istDate.getFullYear();
    const hh = String(istDate.getHours()).padStart(2, "0");
    const min = String(istDate.getMinutes()).padStart(2, "0");
    const ss = String(istDate.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
  }

  function parseDDMMYYYY(dateStr) {
    if (!dateStr) return null;
    try {
      const [datePart, timePart] = dateStr.split(" ");
      const [dd, mm, yyyy] = datePart.split("/");
      const [hh = "00", min = "00", ss = "00"] = (timePart || "").split(":");
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
    } catch (err) {
      return null;
    }
  }

  function getTodayStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function isTodayOrPast(deadlineDateStr) {
    const deadlineDate = parseDDMMYYYY(deadlineDateStr);
    if (!deadlineDate) return false;
    const today = getTodayStart();
    const deadlineOnlyDate = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    return deadlineOnlyDate <= today;
  }

  const normalizeDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d)) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  };

  // API Calls
  const loadEmployees = async () => {
    try {
      const res = await axios.get("/employee/all", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setEmployees(res.data || []);
    } catch (err) {
      console.error("Failed to load employees", err);
      toast.error("Failed to load employees");
    }
  };

  const loadAdmin = async () => {
    try {
      const res = await axios.get("/employee/allAdmin", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setAdmin(res.data || []);
    } catch (err) {
      console.error("Failed to load Admin", err);
      toast.error("Failed to load Admin");
    }
  };

  const loadUserTasks = async (empNames, assignByValue) => {
    if (!empNames || empNames.length === 0) {
      setTasks([]);
      return;
    }
    
    setLoading(true);
    try {
      const namesParam = empNames.join(",");
      let url = `/delegations/search/by-name?name=${encodeURIComponent(namesParam)}`;
      
      if (assignByValue && assignByValue !== "all") {
        url += `&assignBy=${encodeURIComponent(assignByValue)}`;
      }
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      if (res.data && Array.isArray(res.data)) {
        const formattedTasks = res.data.map((t) => ({
          ...t,
          CreatedDate: t.CreatedDate,
          Deadline: t.Deadline,
          FinalDate: t.FinalDate,
        }));
        setTasks(formattedTasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error("Error loading tasks:", err);
      toast.error("Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const createBulkTasks = async () => {
    if (selectedEmployees.length === 0) {
      toast.warn("Select at least one employee first");
      return;
    }
    if (!form.TaskName || !form.Deadline) {
      toast.warn("Task Name & Deadline required");
      return;
    }

    setLoadingTaskId("create");
    try {
      const payload = {
        TaskName: form.TaskName,
        Deadline: normalizeDate(form.Deadline),
        EmployeeNames: selectedEmployees,
        AssignBy: assignBy,
        Priority: form.Priority
      };
      
      const res = await axios.post("/delegations/bulk", payload, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      if (res.data.ok === true) {
        await loadUserTasks(selectedEmployees, assignBy);
        setForm({ TaskName: "", Deadline: "", Priority: "" });
        setShowCreate(false);
        toast.success(`${res.data.createdCount} task(s) created successfully`);
      } else {
        toast.error("Failed to create tasks");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create tasks");
    } finally {
      setLoadingTaskId(null);
    }
  };

  // Effects
  useEffect(() => {
    if (user) {
      loadEmployees();
      loadAdmin();
    }
  }, [user]);

  useEffect(() => {
    if (selectedEmployees.length > 0) {
      loadUserTasks(selectedEmployees, assignBy);
    } else {
      setTasks([]);
    }
  }, [selectedEmployees, assignBy]);

  // Task Actions
  const handleDone = async (taskID) => {
    setLoadingTaskId(taskID);
    try {
      await axios.patch(`/delegations/done/${taskID}`, null, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setTasks(
        tasks.map((t) =>
          t.TaskID === taskID
            ? { ...t, Status: "Completed", FinalDate: formatDateDDMMYYYYHHMMSS() }
            : t
        )
      );
      toast.success("Task marked as done");
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark task as done");
    } finally {
      setLoadingTaskId(null);
    }
  };

  const openShiftPicker = (task) => {
    setShiftTask(task);
    setForm({ ...form, Deadline: task.Deadline });
  };

  const confirmShift = async () => {
    if (!form.Deadline) {
      toast.warn("Select new deadline");
      return;
    }
    setLoadingShiftBtn(true);

    try {
      await axios.patch(
        `/delegations/shift/${shiftTask.TaskID}`,
        { newDeadline: normalizeDate(form.Deadline) },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      setTasks(
        tasks.map((t) =>
          t.TaskID === shiftTask.TaskID
            ? {
                ...t,
                Deadline: normalizeDate(form.Deadline),
                Revisions: (t.Revisions || 0) + 1,
                Status: "Shifted",
              }
            : t
        )
      );

      setShiftTask(null);
      setForm({ ...form, Deadline: "" });
      toast.success("Task deadline shifted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to shift deadline");
    } finally {
      setLoadingShiftBtn(false);
    }
  };

  const handleApprovalChange = async (taskID, value) => {
    setLoadingApprovalId(taskID);
    try {
      await axios.patch(
        `/delegations/approve/${taskID}`,
        { approvalStatus: value },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setTasks(
        tasks.map((t) => {
          if (value === "Pending") {
            return t.TaskID === taskID
              ? { ...t, FinalDate: "", Status: "Pending", Taskcompletedapproval: value }
              : t;
          } else {
            return t.TaskID === taskID ? { ...t, Taskcompletedapproval: value } : t;
          }
        })
      );
      toast.success("Approval status updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update approval");
    } finally {
      setLoadingApprovalId(null);
    }
  };

  const editTaskDetails = (task) => {
    setEditTask(task);
    setForm({
      TaskName: task.TaskName,
      Deadline: task.Deadline,
      Priority: task.Priority,
    });
  };

  const updateTask = async () => {
    if (!form.TaskName) {
      toast.warn("Task Name is required");
      return;
    }

    setLoadingTaskId("update");
    try {
      const payload = { TaskName: form.TaskName };
      await axios.put(`/delegations/update/${editTask.TaskID}`, payload, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      setTasks(
        tasks.map((t) =>
          t.TaskID === editTask.TaskID ? { ...t, TaskName: form.TaskName } : t
        )
      );

      setEditTask(null);
      setForm({ TaskName: "", Deadline: "", Priority: "" });
      toast.success("Task updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task");
    } finally {
      setLoadingTaskId(null);
    }
  };

  const deleteTask = async (taskID) => {
    setLoadingTaskId(taskID);
    try {
      await axios.delete(`/delegations/delete/${taskID}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setTasks(tasks.filter((t) => t.TaskID !== taskID));
      toast.success("Task deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete task");
    } finally {
      setLoadingTaskId(null);
    }
  };

  // Report Downloads
  const downloadDelegationReport = (type = "all") => {
    if (selectedEmployees.length === 0) {
      toast.warn("Select employees first");
      return;
    }

    let filtered = [];
    if (type === "pending") {
      filtered = tasks.filter(t => t.Status !== "Completed" && t.Taskcompletedapproval !== "Approved");
    } else if (type === "completed") {
      filtered = tasks.filter(t => t.Status === "Completed" && t.Taskcompletedapproval !== "Approved");
    } else {
      filtered = tasks.filter(t => t.Taskcompletedapproval !== "Approved");
    }

    if (filtered.length === 0) {
      toast.info("No tasks to download");
      return;
    }

    filtered.sort((a, b) => (a.Name || "").localeCompare(b.Name || ""));

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text(`Delegation Report - ${selectedEmployees.join(", ")}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Report Type: ${type.toUpperCase()}`, 14, 22);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      head: [["Name", "Task Name", "Created Date", "Deadline", "Final Date", "Revisions", "Status", "Approval"]],
      body: filtered.map(t => [
        t.Name || "", t.TaskName || "", t.CreatedDate || "--", 
        t.Deadline || "--", t.FinalDate || "--", t.Revisions || "--", 
        t.Status || "--", t.Taskcompletedapproval || "Pending"
      ]),
      startY: 35,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    });

    doc.save(`delegation_report_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Report downloaded");
    setShowDownloadDropdown(false);
  };

  // WhatsApp Functions
  const sendPendingDelegationWhatsApp = async () => {
    if (selectedEmployees.length === 0) {
      toast.warn("Select employees first");
      return;
    }

    try {
      const pending = tasks.filter(t => isTodayOrPast(t.Deadline) && t.Status !== "Completed");

      if (pending.length === 0) {
        toast.info("No pending delegation tasks");
        return;
      }

      const sendWA = async (empName, empNumber, empTasks) => {
        if (!empNumber || empTasks.length === 0) return;
        const payload = {
          number: `91${empNumber}`,
          employeeName: empName,
          delegations: empTasks.map(t => t.TaskName)
        };
        await axios.post("/whatsapp/send-delegation", payload, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
      };

      const map = {};
      pending.forEach(t => {
        if (!t.Name) return;
        if (!map[t.Name]) map[t.Name] = [];
        map[t.Name].push(t);
      });

      await Promise.all(
        Object.keys(map).map(name => {
          const emp = employees.find(e => e.name === name);
          if (!emp?.number) return Promise.resolve();
          return sendWA(name, emp.number, map[name]);
        })
      );

      toast.success("WhatsApp messages sent successfully 🚀");
    } catch (err) {
      console.error(err);
      toast.error("WhatsApp send failed ❌");
    }
  };

  const delegationFlowup = async () => {
    if (selectedEmployees.length === 0) {
      toast.warn("Select employees first");
      return;
    }

    try {
      const pending = tasks.filter(t => isTodayOrPast(t.Deadline) && t.Status !== "Completed");

      if (pending.length === 0) {
        toast.info("No pending tasks");
        return;
      }

      const map = {};
      pending.forEach(t => {
        if (!t.Name) return;
        if (!map[t.Name]) map[t.Name] = [];
        map[t.Name].push(t);
      });

      for (const [empName, empTasks] of Object.entries(map)) {
        const emp = employees.find(e => e.name === empName);
        if (!emp?.number) continue;

        const taskList = empTasks.map((t, i) => `${i + 1}. ${t.TaskName}`).join("\n");
        const message = encodeURIComponent(
          `Hi ${empName},\n\n👉 This is a gentle reminder regarding today's pending & overdue tasks.\nKindly complete the tasks/shift the dates accordingly. ⏳📅\n\n${taskList}\n\nThanks`
        );

        window.open(`https://wa.me/${emp.number}?text=${message}`, "_blank");
        await new Promise(r => setTimeout(r, 500));
      }

      toast.success("WhatsApp opened for all employees ✅");
    } catch (error) {
      console.error(error);
      toast.error("WhatsApp send failed ❌");
    }
  };

  // Filter Tasks
  const sortedTasks = [...tasks].sort((a, b) => {
    const nameA = (a.Name || "").toLowerCase();
    const nameB = (b.Name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const today = getTodayStart();

  const filteredTasks = sortedTasks.filter((t) => {
    if (activeTab === "pending") {
      return t.Status !== "Completed" && (!t.Taskcompletedapproval || t.Taskcompletedapproval === "Pending" || t.Taskcompletedapproval === "NotApproved");
    } else if (activeTab === "completed") {
      return t.Status === "Completed" && (!t.Taskcompletedapproval || t.Taskcompletedapproval === "Pending" || t.Taskcompletedapproval === "NotApproved");
    } else if (activeTab === "approved") {
      return t.Status === "Completed" && t.Taskcompletedapproval === "Approved";
    } else if (activeTab === "Today_Followup") {
      const deadlineDate = parseDDMMYYYY(t.Deadline);
      if (!deadlineDate) return false;
      const deadlineOnlyDate = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
      return deadlineOnlyDate <= today && t.Status !== "Completed";
    }
    return false;
  });

  const employeeOptions = employees
    .filter(emp => emp && emp.name)
    .sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()))
    .map(emp => ({ value: emp.name, name: emp.name }));

  const ShiftModal = () => {
    if (!shiftTask) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded shadow w-full max-w-md">
          <h2 className="text-lg font-semibold mb-4">Shift Deadline</h2>
          <p className="text-sm text-gray-600 mb-4">Task: {shiftTask.TaskName}</p>
          <label className="block text-sm font-semibold mb-2">New Deadline Date</label>
          <input
            type="date"
            className="w-full border p-2 rounded mb-4"
            value={form.Deadline}
            onChange={(e) => setForm({ ...form, Deadline: e.target.value })}
          />
          <div className="flex justify-end gap-3">
            <button className="px-4 py-2 bg-gray-400 text-white rounded" onClick={() => setShiftTask(null)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={confirmShift} disabled={loadingShiftBtn}>
              {loadingShiftBtn ? "Shifting..." : "Confirm Shift"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Employee Multi-Select */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Select Employees
          </label>
          <MultiSelectDropdown
            options={employeeOptions}
            selectedValues={selectedEmployees}
            onChange={setSelectedEmployees}
            placeholder="Select employees..."
          />
          {selectedEmployees.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {selectedEmployees.length} employee(s) selected
            </p>
          )}
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Assign By
          </label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:border-gray-400 transition"
            value={assignBy}
            onChange={(e) => setAssignBy(e.target.value)}
          >
            <option value="">-- Select Assign By --</option>
            {admin
              .filter(emp => emp && emp.name)
              .sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()))
              .map((emp) => (
                <option key={emp.name} value={emp.name}>{emp.name}</option>
              ))}
            <option value="all">All Assign</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      {selectedEmployees.length > 0 && (
        <div className="mb-6 flex gap-3 flex-wrap">
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "Create Task"}
          </button>

          <div className="relative" ref={dropdownRef}>
            <button className="bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2" onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}>
              Download Reports
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showDownloadDropdown && (
              <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 border">
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => downloadDelegationReport("all")}>📄 All Tasks</button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => downloadDelegationReport("pending")}>⏳ Only Pending Tasks</button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => downloadDelegationReport("completed")}>✅ Only Completed Tasks</button>
              </div>
            )}
          </div>

          <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={sendPendingDelegationWhatsApp}>
            Send WhatsApp Reminder
          </button>
          <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={delegationFlowup}>
            Open WhatsApp Flowup
          </button>
        </div>
      )}

      {/* Create Task Form */}
      {showCreate && (
        <div className="bg-white p-4 rounded shadow border mb-6">
          <h3 className="font-semibold text-lg mb-3">Create Task for {selectedEmployees.length} Employee(s)</h3>
          <label className="block text-sm font-semibold mb-2">Task Name *</label>
          <input type="text" placeholder="Task Name" className="w-full border p-2 rounded mb-2" value={form.TaskName} onChange={(e) => setForm({ ...form, TaskName: e.target.value })} />
          <label className="block text-sm font-semibold mb-2">Plan Date *</label>
          <input type="date" className="w-full border p-2 rounded mb-2" value={form.Deadline} onChange={(e) => setForm({ ...form, Deadline: e.target.value })} />
          <label className="block text-sm font-semibold mb-2">Priority</label>
          <select className="w-full border p-2 rounded mb-2" value={form.Priority} onChange={(e) => setForm({ ...form, Priority: e.target.value })}>
            <option value="">Select Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={createBulkTasks} disabled={loadingTaskId === "create"}>
            {loadingTaskId === "create" ? "Creating..." : `Create Task for ${selectedEmployees.length} Employee(s)`}
          </button>
        </div>
      )}

      {/* Loading & Empty States */}
      {loading && selectedEmployees.length > 0 && (
        <div className="text-center text-lg p-6">Loading tasks...</div>
      )}
      
      {selectedEmployees.length === 0 && (
        <div className="text-center text-gray-500 mt-10">Please select employees to view delegation tasks.</div>
      )}

      {/* Tabs & Task List */}
      {!loading && selectedEmployees.length > 0 && tasks.length > 0 && (
        <>
          <div className="flex gap-3 mb-6 flex-wrap">
            <button className={`px-3 py-2 rounded ${activeTab === "pending" ? "bg-blue-600 text-white" : "bg-gray-300"}`} onClick={() => setActiveTab("pending")}>Pending / Shifted</button>
            <button className={`px-3 py-2 rounded ${activeTab === "Today_Followup" ? "bg-purple-600 text-white" : "bg-gray-300"}`} onClick={() => setActiveTab("Today_Followup")}>Today Followup</button>
            <button className={`px-3 py-2 rounded ${activeTab === "completed" ? "bg-green-600 text-white" : "bg-gray-300"}`} onClick={() => setActiveTab("completed")}>Completed</button>
            <button className={`px-3 py-2 rounded ${activeTab === "approved" ? "bg-purple-600 text-white" : "bg-gray-300"}`} onClick={() => setActiveTab("approved")}>Approved</button>
          </div>

          <div className="grid gap-4 max-h-[500px] overflow-y-auto">
            {filteredTasks.map((task) => (
              <div key={task.TaskID} className="p-4 bg-white rounded shadow border">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{task.TaskName}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Employee:</span> {task.Name || "_"} | 
                      <span className="font-medium ml-2">Created:</span> {task.CreatedDate || "—"} | 
                      <span className="font-medium ml-2">Deadline:</span> {task.Deadline || "—"} | 
                      <span className="font-medium ml-2">Completed:</span> {task.FinalDate || "—"} | 
                      <span className="font-medium ml-2">Revisions:</span> {task.Revisions || "0"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      task.Status === "Completed" ? "bg-green-100 text-green-700" : 
                      task.Status === "Shifted" ? "bg-yellow-100 text-yellow-700" : 
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {task.Status}
                    </span>
                    {task.Priority && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        task.Priority === "High" ? "bg-red-100 text-red-700" :
                        task.Priority === "Medium" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {task.Priority}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-3 flex gap-2 flex-wrap">
                  {task.Status !== "Completed" && (
                    <>
                      <button onClick={() => handleDone(task.TaskID)} disabled={loadingTaskId === task.TaskID} className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                        {loadingTaskId === task.TaskID ? "..." : "Mark Done"}
                      </button>
                      <button onClick={() => openShiftPicker(task)} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm">Shift Deadline</button>
                    </>
                  )}
                  <button onClick={() => editTaskDetails(task)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Edit Name</button>
                  <button onClick={() => deleteTask(task.TaskID)} className="bg-red-600 text-white px-3 py-1 rounded text-sm">Delete</button>
                </div>

                {activeTab === "completed" && task.Status === "Completed" && (
                  <div className="mt-3 pt-2 border-t">
                    <label className="text-sm font-medium mr-2">Approval:</label>
                    <select
                      className="border p-1 rounded text-sm"
                      value={task.Taskcompletedapproval === "Pending" ? "" : task.Taskcompletedapproval || ""}
                      onChange={(e) => handleApprovalChange(task.TaskID, e.target.value)}
                      disabled={loadingApprovalId === task.TaskID}
                    >
                      <option value="">Select</option>
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending</option>
                    </select>
                    {loadingApprovalId === task.TaskID && <span className="ml-2 text-sm text-gray-500">Processing...</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredTasks.length === 0 && (
            <div className="text-center text-gray-500 py-10">No tasks in this category</div>
          )}
        </>
      )}

      {!loading && selectedEmployees.length > 0 && tasks.length === 0 && (
        <div className="text-center text-gray-500 py-10">No tasks found for selected employees</div>
      )}

      {/* Edit Modal */}
      {editTask && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Task Name</h2>
            <label className="block text-sm font-semibold mb-2">Task Name</label>
            <input
              type="text"
              className="w-full border p-2 rounded mb-4"
              value={form.TaskName}
              onChange={(e) => setForm({ ...form, TaskName: e.target.value })}
            />
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 bg-gray-400 text-white rounded" onClick={() => setEditTask(null)}>Cancel</button>
              <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={updateTask} disabled={loadingTaskId === "update"}>
                {loadingTaskId === "update" ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShiftModal />

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}