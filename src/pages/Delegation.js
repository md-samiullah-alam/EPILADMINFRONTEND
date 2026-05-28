import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Delegation() {
  const { user } = useContext(AuthContext);
  const [assignBy, setAssignBy] = useState("");

  const [employees, setEmployees] = useState([]);
  const [admin, setAdmin] = useState([]);

  const [selectedEmp, setSelectedEmp] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("pending"); // pending / completed / approved
  const [shiftTask, setShiftTask] = useState(null);
  const [shiftDate, setShiftDate] = useState("");
  const [loadingShiftBtn, setLoadingShiftBtn] = useState(false);
  const [loadingTaskId, setLoadingTaskId] = useState(null);
  const [loadingApprovalId, setLoadingApprovalId] = useState(null);

  const [editTask, setEditTask] = useState(null);  // For editing task
  const [deleteTaskId, setDeleteTaskId] = useState(null); // For delete task confirmation
  const whatsappRef = useRef(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [form, setForm] = useState({
    TaskName: "",
    Deadline: "",
    Priority: "",
    Notes: "",
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDownloadDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // -----------------------
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

  // ✅ Convert "dd/mm/yyyy" or "dd/mm/yyyy hh:mm:ss" → Date object
  function parseDDMMYYYY(dateStr) {
    if (!dateStr) return null;

    try {
      const [datePart, timePart] = dateStr.split(" ");
      const [dd, mm, yyyy] = datePart.split("/");
      const [hh = "00", min = "00", ss = "00"] = (timePart || "").split(":");

      return new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
        Number(ss)
      );
    } catch (err) {
      console.error("Date parse error:", err);
      return null;
    }
  }

  // ✅ Get today's date WITHOUT time (for accurate date comparison)
  function getTodayStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // ✅ Check if a date is today or in the past (compares year, month, day)
  function isTodayOrPast(deadlineDateStr) {
    const deadlineDate = parseDDMMYYYY(deadlineDateStr);
    if (!deadlineDate) return false;
    
    const today = getTodayStart();
    const deadlineOnlyDate = new Date(
      deadlineDate.getFullYear(),
      deadlineDate.getMonth(),
      deadlineDate.getDate()
    );
    
    return deadlineOnlyDate <= today;
  }

  // ----------------------- Download Report
  const downloadDelegationReport = () => {
    if (!selectedEmp) {
      toast.warn("Select employee first");
      return;
    }

    const filtered = tasks.filter(
      t => t.Taskcompletedapproval !== "Approved"
    );

    if (filtered.length === 0) {
      toast.info("No tasks to download");
      return;
    }

    filtered.sort((a, b) => {
      // 1️⃣ First sort by Name
      const nameCompare = (a.Name || "").localeCompare(b.Name || "");
      if (nameCompare !== 0) return nameCompare;

      // 2️⃣ Then sort by Status for same Name
      return (a.Status || "").localeCompare(b.Status || "");
    });

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFontSize(14);
    doc.text(`Delegation Report (Pending & Completed) - ${selectedEmp}`, 14, 15);

    autoTable(doc, {
      head: [[
        "Name",
        "Task Name",
        "Created Date",
        "Deadline",
        "Final Date",
        "Revisions",
        "Status"
      ]],
      body: filtered.map(t => [
        t.Name || "",
        t.TaskName || "",
        t.CreatedDate || "--",
        t.Deadline || "--",
        t.FinalDate || "--",
        t.Revisions || "--",
        t.Status 
      ]),
      startY: 22,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
      },
      columnStyles: {
        1: { cellWidth: 60 }, // Task Name column
        0: { cellWidth: 20 }
      },
    });

    doc.save(
      `delegation_report_all_${selectedEmp}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );

    toast.success("Delegation report downloaded");
    setShowDownloadDropdown(false);
  };

  const downloadDelegationReportCompleted = () => {
    if (!selectedEmp) {
      toast.warn("Select employee first");
      return;
    }

    const filtered = tasks.filter(
      t => t.Status === "Completed" && t.Taskcompletedapproval !== "Approved"
    );

    if (filtered.length === 0) {
      toast.info("No completed tasks to download");
      return;
    }

    filtered.sort((a, b) => {
      // 1️⃣ First sort by Name
      const nameCompare = (a.Name || "").localeCompare(b.Name || "");
      if (nameCompare !== 0) return nameCompare;

      // 2️⃣ Then sort by Status for same Name
      return (a.Status || "").localeCompare(b.Status || "");
    });

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFontSize(14);
    doc.text(`Completed Tasks Report - ${selectedEmp}`, 14, 15);

    autoTable(doc, {
      head: [[
        "Name",
        "Task Name",
        "Created Date",
        "Deadline",
        "Final Date",
        "Revisions",
        "Status"
      ]],
      body: filtered.map(t => [
        t.Name || "",
        t.TaskName || "",
        t.CreatedDate || "--",
        t.Deadline || "--",
        t.FinalDate || "--",
        t.Revisions || "--",
        t.Status 
      ]),
      startY: 22,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
      },
      columnStyles: {
        1: { cellWidth: 60 }, // Task Name column
        0: { cellWidth: 20 }
      },
    });

    doc.save(
      `delegation_report_completed_${selectedEmp}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );

    toast.success("Completed tasks report downloaded");
    setShowDownloadDropdown(false);
  };

  const downloadDelegationReportPending = () => {
    if (!selectedEmp) {
      toast.warn("Select employee first");
      return;
    }

    const filtered = tasks.filter(
      t => t.Status !== "Completed" && t.Taskcompletedapproval !== "Approved"
    );

    if (filtered.length === 0) {
      toast.info("No pending tasks to download");
      return;
    }

    filtered.sort((a, b) => {
      // 1️⃣ First sort by Name
      const nameCompare = (a.Name || "").localeCompare(b.Name || "");
      if (nameCompare !== 0) return nameCompare;

      // 2️⃣ Then sort by Status for same Name
      return (a.Status || "").localeCompare(b.Status || "");
    });

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFontSize(14);
    doc.text(`Pending Tasks Report - ${selectedEmp}`, 14, 15);

    autoTable(doc, {
      head: [[
        "Name",
        "Task Name",
        "Created Date",
        "Deadline",
        "Final Date",
        "Revisions",
        "Status"
      ]],
      body: filtered.map(t => [
        t.Name || "",
        t.TaskName || "",
        t.CreatedDate || "--",
        t.Deadline || "--",
        t.FinalDate || "--",
        t.Revisions || "--",
        t.Status 
      ]),
      startY: 22,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
      },
      columnStyles: {
        1: { cellWidth: 60 }, // Task Name column
        0: { cellWidth: 20 }
      },
    });

    doc.save(
      `delegation_report_pending_${selectedEmp}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );

    toast.success("Pending tasks report downloaded");
    setShowDownloadDropdown(false);
  };

  const sendPendingDelegationWhatsApp = async () => {
    if (!selectedEmp) {
      toast.warn("Select employee first");
      return;
    }

    try {
      // ✅ FIXED: Use proper date comparison
      const pending = tasks.filter(t => 
        isTodayOrPast(t.Deadline) && 
        t.Status !== "Completed"
      );

      if (pending.length === 0) {
        toast.info("No pending delegation tasks");
        return;
      }

      // helper
      const sendWA = async (empName, empNumber, empTasks) => {
        if (!empNumber || empTasks.length === 0) return;

        const payload = {
          number: `91${empNumber}`,
          employeeName: empName,
          delegations: empTasks.map(t => t.TaskName) // ✅ ARRAY
        };

        console.log("WA Payload 👉", payload); // 🧪 DEBUG (important)

        await axios.post(
          "/whatsapp/send-delegation",   // ✅ CORRECT API
          payload,
          {
            headers: { Authorization: `Bearer ${user.token}` }
          }
        );
      };

      // 🔹 ALL case
      if (selectedEmp === "all") {
        const map = {};

        pending.forEach(t => {
          if (!t.Name) return;
          if (!map[t.Name]) map[t.Name] = [];
          map[t.Name].push(t);
        });

        await Promise.all(
          Object.keys(map).map(name => {
            const emp = employees.find(e => e.name === name);
            if (!emp?.number) return;
            return sendWA(name, emp.number, map[name]);
          })
        );

        toast.success("All employees ko delegation WhatsApp bhej diya 🚀");
        return;
      }

      // 🔹 Single employee
      const empTasks = pending.filter(t => t.Name === selectedEmp);
      if (empTasks.length === 0) {
        toast.info("No pending tasks");
        return;
      }

      const emp = employees.find(e => e.name === selectedEmp);
      if (!emp?.number) {
        toast.warn("Employee WhatsApp number missing");
        return;
      }

      await sendWA(selectedEmp, emp.number, empTasks);
      toast.success("Delegation WhatsApp sent ✅");

    } catch (err) {
      console.error(err);
      toast.error("WhatsApp send failed ❌");
    }
  };

  // ✅ FIXED: delegationFlowup with proper date comparison
  const delegationFlowup = async () => {
    try {
      if (!selectedEmp) {
        toast.warn("Select employee first");
        return;
      }

      // 🔹 Pending tasks with proper date comparison
      const pending = tasks.filter(t => 
        isTodayOrPast(t.Deadline) && 
        t.Status !== "Completed" &&
        t.Name === selectedEmp
      );

      if (pending.length === 0) {
        toast.info("No pending tasks");
        return; // 🚫 NO WINDOW OPEN
      }

      const emp = employees.find(e => e.name === selectedEmp);
      if (!emp?.number) {
        toast.warn("Employee WhatsApp number missing");
        return;
      }

      // 🔹 Beautiful numbered task list
      const taskList = pending
        .map((t, i) => `${i + 1}. ${t.TaskName}`)
        .join("\n");

      const message = encodeURIComponent(
`Hi ${selectedEmp},

👉 This is a gentle reminder regarding today's pending & overdue tasks.
Kindly complete the tasks/shift the dates accordingly. ⏳📅

${taskList}

Thanks`
      );

      // 🔥 OPEN WHATSAPP ONLY WHEN EVERYTHING IS READY
      const whatsappWindow = window.open(
        `https://wa.me/${emp.number}?text=${message}`,
        "_blank"
      );

      if (!whatsappWindow) {
        toast.error("Popup blocked. Allow popups for this site.");
        return;
      }

      toast.success("WhatsApp opened successfully ✅");

    } catch (error) {
      console.error(error);
      toast.error("WhatsApp send failed ❌");
    }
  };

  const normalizeDate = (date) => {
    if (!date) return "";
    const d = new Date(date || Date.now());
    if (isNaN(d)) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  };

  // -----------------------
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

  const loadUserTasks = async (name, assignByValue) => {
    if (!name) return;
    setLoading(true);
    try {
      let url = `/delegations/search/by-name?name=${encodeURIComponent(name)}`;

      if (assignByValue && assignByValue !== "all") {
        url += `&assignBy=${encodeURIComponent(assignByValue)}`;
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      const formattedTasks = res.data.map((t) => ({
        ...t,
        CreatedDate: t.CreatedDate,
        Deadline: t.Deadline,
        FinalDate: t.FinalDate,
      }));

      setTasks(formattedTasks);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadEmployees();
      loadAdmin();
    }
  }, [user]);

  useEffect(() => {
    if (selectedEmp) {
      loadUserTasks(selectedEmp, assignBy);
    }
  }, [selectedEmp, assignBy]);

  const createTask = async () => {
    if (!selectedEmp) {
      toast.warn("Select employee first");
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
        Name: selectedEmp,
        AssignBy: assignBy
      };
      const res = await axios.post("/delegations/", payload, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      console.log("tsting: ", res);
      if (res.data.ok === true) {
        loadUserTasks();
        setTasks([
          {
            TaskID: res.data.TaskID,
            Name: selectedEmp,
            TaskName: form.TaskName,
            Deadline: normalizeDate(form.Deadline),
            CreatedDate: formatDateDDMMYYYYHHMMSS(),
            Revision1: "",
            Revision2: "",
            FinalDate: "",
            Revisions: 0,
            Priority: form.Priority,
            Status: "Pending",
            AssignBy: assignBy,
            Taskcompletedapproval: "Pending",
          },
          ...tasks,
        ]);

        setForm({ TaskName: "", Deadline: "", Priority: "", Notes: "" });
        setShowCreate(false);
        toast.success("Task created successfully");
      } else {
        toast.error("Failed to create task Technical Issue Please Re Create");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create task");
    } finally {
      setLoadingTaskId(null);
    }
  };

  // -----------------------
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
    setShiftDate("");
    setForm({ ...form, Deadline: task.Deadline });
  };

  const confirmShift = async () => {
    if (!form.Deadline) {
      toast.warn("Select new deadline");
      return;
    }
    setLoadingShiftBtn(true);
    const revisionField = shiftTask.Revisions === 0 ? "Revision1" : "Revision2";

    try {
      await axios.patch(
        `/delegations/shift/${shiftTask.TaskID}`,
        { newDeadline: normalizeDate(form.Deadline), revisionField },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      setTasks(
        tasks.map((t) =>
          t.TaskID === shiftTask.TaskID
            ? {
                ...t,
                [revisionField]: normalizeDate(form.Deadline),
                Deadline: normalizeDate(form.Deadline),
                Revisions: t.Revisions + 1,
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
      Deadline: task.Deadline, // sirf show ke liye, edit nahi hoga
      Priority: task.Priority,
      Notes: task.Followup,
    });
  };
  
  const updateTask = async () => {
    if (!form.TaskName) {
      toast.warn("Task Name is required");
      return;
    }

    setLoadingTaskId("update");
    try {
      const payload = {
        TaskName: form.TaskName, // ✅ ONLY NAME
      };

      await axios.put(`/delegations/update/${editTask.TaskID}`, payload, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      setTasks(
        tasks.map((t) =>
          t.TaskID === editTask.TaskID
            ? { ...t, TaskName: form.TaskName }
            : t
        )
      );

      setEditTask(null);
      setForm({ TaskName: "", Deadline: "", Priority: "", Notes: "" });
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
      setDeleteTaskId(null);
    }
  };

  // -----------------------
  const sortedTasks = [...tasks].sort((a, b) => {
    const nameA = (a.Name || "").toLowerCase();
    const nameB = (b.Name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // ✅ MAIN FILTER - UPDATED with proper date comparison
  const today = getTodayStart();

  const filteredTasks = sortedTasks.filter((t) => {
    if (activeTab === "pending") {
      return (
        t.Status !== "Completed" &&
        (!t.Taskcompletedapproval ||
          t.Taskcompletedapproval === "Pending" ||
          t.Taskcompletedapproval === "NotApproved")
      );
    } 
    else if (activeTab === "completed") {
      return (
        t.Status === "Completed" &&
        (!t.Taskcompletedapproval ||
          t.Taskcompletedapproval === "Pending" ||
          t.Taskcompletedapproval === "NotApproved")
      );
    } 
    else if (activeTab === "approved") {
      return (
        t.Status === "Completed" &&
        t.Taskcompletedapproval === "Approved"
      );
    } 
    else if (activeTab === "Today_Followup") {
      const deadlineDate = parseDDMMYYYY(t.Deadline);
      if (!deadlineDate) return false;

      const deadlineOnlyDate = new Date(
        deadlineDate.getFullYear(),
        deadlineDate.getMonth(),
        deadlineDate.getDate()
      );

      return (
        deadlineOnlyDate <= today &&   // ✅ aaj + past (includes month/year properly)
        t.Status !== "Completed"
      );
    }

    return false;
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Employee Select */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Select Employee */}
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Select Employee
          </label>
          <select
            className="w-full h-11 rounded-md border border-gray-300 bg-white px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                       hover:border-gray-400 transition"
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value)}
          >
            <option value="">-- Select Employee --</option>
            <option value="all">All Delegation</option>
            {employees
              .sort((a, b) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase())
              )
              .map((emp) => (
                <option key={emp.name} value={emp.name}>
                  {emp.name}
                </option>
              ))}
          </select>
        </div>

        {/* Assign By */}
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Assign By
          </label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white
                       px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500
                       hover:border-gray-400 transition"
            value={assignBy}
            onChange={(e) => setAssignBy(e.target.value)}
          >
            {/* Placeholder – dropdown me nahi dikhega */}
            <option value="" disabled hidden>
              -- Select Assign By --
            </option>

            {admin
              .filter(emp => typeof emp?.name === "string" && emp.name.trim() !== "")   // safety
              .sort((a, b) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase())
              )
              .map((emp) => (
                <option key={emp.name} value={emp.name}>
                  {emp.name}
                </option>
              ))}

            <option value="all">All Assign</option>
          </select>
        </div>
      </div>

      {/* Create Task And Download Buttons */}
      {selectedEmp && (
        <div className="mb-6 flex gap-3 flex-wrap">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? "Cancel" : "Create Task"}
          </button>

          {/* Download Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2"
              onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
            >
              Download Reports
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showDownloadDropdown && (
              <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 border">
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={downloadDelegationReport}
                >
                  📄 All Tasks (Pending & Completed)
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={downloadDelegationReportPending}
                >
                  ⏳ Only Pending Tasks
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={downloadDelegationReportCompleted}
                >
                  ✅ Only Completed Tasks
                </button>
              </div>
            )}
          </div>

          <button className="bg-gray-700 text-white px-4 py-2 rounded" onClick={delegationFlowup}>
            Pending Delegation Whatsapp Flowup
          </button>
        </div>
      )}

      {/* Create Task Form */}
      {showCreate && (
        <div className="bg-white p-4 rounded shadow border mb-6">
          <label htmlFor="taskName" className="block text-sm font-semibold mb-2">
            Task Name
          </label>
          <input
            type="text"
            placeholder="Task Name"
            className="w-full border p-2 rounded mb-2"
            value={form.TaskName}
            onChange={(e) => setForm({ ...form, TaskName: e.target.value })}
          />
          <label htmlFor="planDate" className="block text-sm font-semibold mb-2">
            Plan Date
          </label>
          <input
            type="date"
            className="w-full border p-2 rounded mb-2"
            value={form.Deadline}
            onChange={(e) => setForm({ ...form, Deadline: e.target.value })}
          />

          <button
            className="bg-green-600 text-white px-4 py-2 rounded"
            onClick={createTask}
            disabled={loadingTaskId === "create"}
          >
            {loadingTaskId === "create" ? "Creating..." : "Save Task"}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && selectedEmp && (
        <div className="text-center text-lg p-6">Loading tasks...</div>
      )}

      {!selectedEmp && (
        <div className="text-center text-gray-500 mt-10">
          Please select an employee to view delegation tasks.
        </div>
      )}

      {!loading && selectedEmp && (
        <>
          {/* Tabs */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <button
              className={`px-3 py-2 rounded ${
                activeTab === "pending" ? "bg-blue-600 text-white" : "bg-gray-300"
              }`}
              onClick={() => setActiveTab("pending")}
            >
              Pending / Shifted
            </button>
            <button
              className={`px-3 py-2 rounded ${
                activeTab === "Today_Followup" ? "bg-purple-600 text-white" : "bg-gray-300"
              }`}
              onClick={() => setActiveTab("Today_Followup")}
            >
              Today Followup
            </button>
            <button
              className={`px-3 py-2 rounded ${
                activeTab === "completed" ? "bg-green-600 text-white" : "bg-gray-300"
              }`}
              onClick={() => setActiveTab("completed")}
            >
              Completed
            </button>
            <button
              className={`px-3 py-2 rounded ${
                activeTab === "approved" ? "bg-purple-600 text-white" : "bg-gray-300"
              }`}
              onClick={() => setActiveTab("approved")}
            >
              Approved
            </button>
          </div>

          {/* Task List */}
          <div className="grid gap-4 max-h-[500px] overflow-y-auto">
            {filteredTasks.map((task) => (
              <div key={task.TaskID} className="p-4 bg-white rounded shadow border">
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold text-lg">{task.TaskName}</div>
                    <div className="text-sm text-gray-600">
                      Created: {task.CreatedDate || "—"}, <span/><span/>
                      Deadline: {task.Deadline || "—"}, <span />
                      Completed: {task.FinalDate || "—"}, <span />
                      Revision: {task.Revisions || "0"},<span/><span/>
                      Name: {task.Name || "_"}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      task.Status === "Completed"
                        ? "bg-green-100 text-green-700"
                        : task.Status === "Shifted"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {task.Status}
                  </span>
                </div>

                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => editTaskDetails(task)}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                  >
                    Edit
                  </button>
                </div>

                {activeTab === "completed" && task.Status === "Completed" && (
                  <div className="mt-3">
                    <label className="text-sm font-medium mr-2">Approval:</label>
                    <select
                      className="border p-1 rounded"
                      value={task.Taskcompletedapproval==="Pending"?"":task.Taskcompletedapproval || ""}
                      onChange={(e) =>
                        handleApprovalChange(task.TaskID, e.target.value)
                      }
                      disabled={loadingApprovalId === task.TaskID}
                    >
                      <option value="">Select</option>
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending</option>
                    </select>
                    {loadingApprovalId === task.TaskID ? "Processing..." : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      
      {editTask && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Task Name</h2>

            <label className="block text-sm font-semibold mb-2">
              Task Name
            </label>
            <input
              type="text"
              className="w-full border p-2 rounded mb-4"
              value={form.TaskName}
              onChange={(e) =>
                setForm({ ...form, TaskName: e.target.value })
              }
            />

            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded"
                onClick={() => setEditTask(null)}
              >
                Cancel
              </button>

              <button
                className="px-4 py-2 bg-green-600 text-white rounded"
                onClick={updateTask}
                disabled={loadingTaskId === "update"}
              >
                {loadingTaskId === "update" ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}
