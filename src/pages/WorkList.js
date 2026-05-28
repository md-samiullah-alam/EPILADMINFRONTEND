import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAllEmployees, getAllWorklists, createWorklist, updateWorklistAdmin, bulkUploadWorklists, downloadWorklists } from "../api/services";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";

// PDF imports
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Yearly"];
const WORKING_TIMES = ["10M","15M","20M","30M", "45M", "60M", "90M", "120M", "150M", "180M", "210M", "240M", "300M"];
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_DATES = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PAGE_SIZE = 20;

export default function AdminWorkList() {
  const [worklists, setWorklists] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [customWorkingTime, setCustomWorkingTime] = useState("");
  const [form, setForm] = useState({ WorklistName: "", Frequency: "Daily", WorkingTime: "60M", EmployeeName: "", TemplateLinkRemark: "" });
  const [schedule, setSchedule] = useState({ scheduleDays: "", scheduleDates: "" });
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [yearlyMonth, setYearlyMonth] = useState("January");
  const [yearlyDate, setYearlyDate] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkData, setBulkData] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const bulkModalRef = useRef();
  const addModalRef = useRef();

  const loadWorklists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllWorklists({ employeeName: selectedEmp === "all" ? "" : selectedEmp, search });
      setWorklists(res.data.data || []);
    } catch (err) { toast.error("Failed to load worklists"); }
    finally { setLoading(false); }
  }, [selectedEmp, search]);

  const loadEmployees = useCallback(async () => {
    try { const res = await getAllEmployees(); setEmployees(res.data || []); } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadEmployees(); loadWorklists(); }, [loadEmployees, loadWorklists]);

  const handleClickOutside = (e, modalRef, closeFn) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) closeFn();
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ WorklistName: "", Frequency: "Daily", WorkingTime: "60M", EmployeeName: "", TemplateLinkRemark: "" });
    setSchedule({ scheduleDays: "", scheduleDates: "" });
    setSelectedDays([]); setSelectedDates([]);
    setYearlyMonth("January"); setYearlyDate(1);
    setCustomWorkingTime("");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setCustomWorkingTime(""); };

  const openEdit = (wl) => {
    setEditing(wl);
    setForm({ WorklistName: wl.WorklistName, Frequency: wl.Frequency, WorkingTime: wl.WorkingTime, EmployeeName: wl.EmployeeName, TemplateLinkRemark: wl.TemplateLink || wl.Remark || "" });
    
    if (wl.Frequency === "Weekly" && wl.ScheduleDays) {
      setSelectedDays(wl.ScheduleDays.split(","));
      setSchedule({ scheduleDays: wl.ScheduleDays, scheduleDates: "" });
    } else if (wl.Frequency === "Monthly" && wl.ScheduleDates) {
      setSelectedDates(wl.ScheduleDates.split(",").map(Number));
      setSchedule({ scheduleDays: "", scheduleDates: wl.ScheduleDates });
    } else if (wl.Frequency === "Yearly" && wl.ScheduleDates) {
      const parts = wl.ScheduleDates.split(" ");
      if (parts.length === 2) { setYearlyMonth(parts[0]); setYearlyDate(parseInt(parts[1])); }
      setSchedule({ scheduleDays: "", scheduleDates: wl.ScheduleDates });
    } else { setSelectedDays([]); setSelectedDates([]); setSchedule({ scheduleDays: "", scheduleDates: "" }); }
    setCustomWorkingTime("");
    setShowModal(true);
  };

  const handleWorkingTimeChange = (value) => {
    if (value === "custom") {
      const customValue = customWorkingTime.trim();
      if (customValue && !isNaN(parseInt(customValue))) setForm({ ...form, WorkingTime: `${parseInt(customValue)}M` });
    } else setForm({ ...form, WorkingTime: value });
  };

  const handleDayToggle = (day) => {
    let newDays = selectedDays.includes(day) ? selectedDays.filter(d => d !== day) : [...selectedDays, day];
    setSelectedDays(newDays);
    setSchedule({ scheduleDays: newDays.join(","), scheduleDates: "" });
  };

  const handleDateToggle = (date) => {
    let newDates = selectedDates.includes(date) ? selectedDates.filter(d => d !== date) : [...selectedDates, date];
    setSelectedDates(newDates);
    setSchedule({ scheduleDays: "", scheduleDates: newDates.join(",") });
  };

  const handleYearlyChange = (month, date) => {
    setYearlyMonth(month); setYearlyDate(date);
    setSchedule({ scheduleDays: "", scheduleDates: `${month} ${date}` });
  };

  const handleSave = async () => {
    if (!form.WorklistName.trim()) return toast.warn("Worklist Name required");
    if (!form.WorkingTime) return toast.warn("Working Time required");
    if (!editing && !form.EmployeeName) return toast.warn("Select employee");
    if (form.Frequency === "Weekly" && !schedule.scheduleDays) return toast.warn("Select at least one day");
    if (form.Frequency === "Monthly" && !schedule.scheduleDates) return toast.warn("Select at least one date");
    if (form.Frequency === "Yearly" && !schedule.scheduleDates) return toast.warn("Select month and date");
    
    setSaving(true);
    try {
      const val = form.TemplateLinkRemark.trim();
      const isUrl = val.startsWith('http://') || val.startsWith('https://');
      const payload = {
        WorklistName: form.WorklistName, Frequency: form.Frequency, WorkingTime: form.WorkingTime,
        TemplateLink: isUrl ? val : "", Remark: !isUrl ? val : "",
        ScheduleDays: schedule.scheduleDays, ScheduleDates: schedule.scheduleDates
      };
      if (editing) await updateWorklistAdmin(editing.WorkListId, { ...payload, EmployeeName: form.EmployeeName });
      else await createWorklist({ ...payload, EmployeeName: form.EmployeeName });
      toast.success(editing ? "Updated" : "Created");
      closeModal(); loadWorklists();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

  // ✅ FIXED: Excel Sample Download
  const downloadSampleBulkUpload = () => {
    const sampleData = [
      { WorklistName: "Daily Sales Report", Frequency: "Daily", WorkingTime: "60M", ScheduleDays: "", ScheduleDates: "", TemplateLinkRemark: "https://docs.google.com/spreadsheets/d/1ABC123" },
      { WorklistName: "Weekly Team Meeting", Frequency: "Weekly", WorkingTime: "90M", ScheduleDays: "Monday,Wednesday,Friday", ScheduleDates: "", TemplateLinkRemark: "Meeting agenda and minutes" },
      { WorklistName: "Monthly Performance Review", Frequency: "Monthly", WorkingTime: "120M", ScheduleDays: "", ScheduleDates: "1,15,30", TemplateLinkRemark: "https://docs.google.com/spreadsheets/d/2XYZ456" },
      { WorklistName: "Quarterly Business Review", Frequency: "Monthly", WorkingTime: "180M", ScheduleDays: "", ScheduleDates: "1,15", TemplateLinkRemark: "https://docs.google.com/presentation/d/3QRS789" },
      { WorklistName: "Annual Report", Frequency: "Yearly", WorkingTime: "240M", ScheduleDays: "", ScheduleDates: "December 25", TemplateLinkRemark: "Year end report preparation" }
    ];
    
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [{wch:30}, {wch:12}, {wch:10}, {wch:25}, {wch:15}, {wch:55}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample_Bulk_Upload");
    XLSX.writeFile(wb, `Sample_Bulk_Upload_Format.xlsx`);
    toast.success("✅ Sample Bulk Upload file downloaded!");
  };

  // ✅ FIXED: PDF Sample Download
  const downloadSamplePDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      doc.setFontSize(16);
      doc.text("Sample Bulk Upload Format", 14, 20);
      doc.setFontSize(10);
      doc.text("Follow this exact format for bulk upload:", 14, 30);
      
      autoTable(doc, {
        startY: 40,
        head: [["WorklistName", "Frequency", "WorkingTime", "ScheduleDays", "ScheduleDates", "TemplateLinkRemark"]],
        body: [
          ["Daily Sales Report", "Daily", "60M", "", "", "https://docs.google.com/..."],
          ["Weekly Team Meeting", "Weekly", "90M", "Monday,Wednesday,Friday", "", "Meeting agenda and minutes"],
          ["Monthly Performance Review", "Monthly", "120M", "", "1,15,30", "https://docs.google.com/..."],
          ["Annual Report", "Yearly", "180M", "", "December 25", "Year end report preparation"]
        ],
        theme: "grid",
        headStyles: { 
          fillColor: [41, 128, 185], 
          textColor: 255, 
          fontSize: 9, 
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: { 
          fontSize: 8, 
          cellPadding: 2,
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 40, halign: 'left' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 45, halign: 'left' },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 55, halign: 'left' }
        },
        margin: { left: 10, right: 10, top: 35 }
      });
      
      doc.save("Sample_Bulk_Upload_Format.pdf");
      toast.success("✅ Sample PDF format downloaded!");
    } catch (err) {
      console.error("PDF Error:", err);
      toast.error("PDF download failed. Check if jspdf-autotable is installed.");
    }
  };

  // ✅ FIXED: PDF Report Download
  const downloadPDFReport = () => {
    if (!worklists.length) return toast.info("No data to download");
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("WorkList Management Report", 14, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
      doc.text(`Total Worklists: ${worklists.length}`, 14, 36);
      doc.text(`Employee Filter: ${selectedEmp === "all" ? "All Employees" : selectedEmp}`, 14, 42);
      doc.text(`Search: ${search || "None"}`, 14, 48);
      
      // Prepare table data with proper text cleaning
      const tableData = worklists.map((wl, idx) => [
        (idx + 1).toString(),
        wl.EmployeeName || "-",
        wl.WorklistName || "-",
        wl.Frequency || "-",
        (wl.ScheduleDays || wl.ScheduleDates || "Every day") || "-",
        wl.WorkingTime || "-",
        (wl.TemplateLink || wl.Remark || "-").substring(0, 60)
      ]);
      
      autoTable(doc, { 
        startY: 55,
        head: [["#", "Employee", "Worklist", "Freq", "Schedule", "Time", "Link/Remark"]],
        body: tableData,
        theme: "grid",
        headStyles: { 
          fillColor: [41, 128, 185], 
          textColor: 255, 
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: { 
          fontSize: 8,
          cellPadding: 3,
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },      // # 
          1: { cellWidth: 35, halign: 'left' },        // Employee
          2: { cellWidth: 50, halign: 'left' },        // Worklist (increased)
          3: { cellWidth: 25, halign: 'center' },      // Frequency
          4: { cellWidth: 40, halign: 'left' },        // Schedule (increased)
          5: { cellWidth: 20, halign: 'center' },      // Time
          6: { cellWidth: 60, halign: 'left' }         // Link/Remark (increased)
        },
        margin: { top: 50, left: 10, right: 10, bottom: 10 },
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        didDrawPage: function(data) {
          // Add footer on each page
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.text(
            `Page ${data.pageNumber}`, 
            doc.internal.pageSize.width - 20, 
            doc.internal.pageSize.height - 10
          );
          doc.text(
            `WorkList Management System`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          );
        }
      });
      
      doc.save(`WorkList_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error("PDF Error:", err);
      toast.error("PDF download failed: " + err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        if (rows.length < 2) return toast.warn("Empty file");
        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes("worklistname"));
        const freqIdx = headers.findIndex(h => h.includes("frequency"));
        const timeIdx = headers.findIndex(h => h.includes("workingtime"));
        const daysIdx = headers.findIndex(h => h.includes("scheduledays"));
        const datesIdx = headers.findIndex(h => h.includes("scheduledates"));
        
        const parsed = rows.slice(1).filter(r => r && r.some(c => c)).map((r, i) => ({
          row: i + 2, 
          WorklistName: String(r[nameIdx] || "").trim(),
          Frequency: String(r[freqIdx] || "Daily").trim(),
          WorkingTime: String(r[timeIdx] || "").trim(),
          ScheduleDays: daysIdx !== -1 ? String(r[daysIdx] || "").trim() : "",
          ScheduleDates: datesIdx !== -1 ? String(r[datesIdx] || "").trim() : "",
          TemplateLink: "", Remark: ""
        })).filter(d => d.WorklistName && d.Frequency && d.WorkingTime);
        setBulkData(parsed); setBulkResult(null);
        toast.success(`${parsed.length} rows loaded`);
      } catch (err) { toast.error("Invalid file format"); }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    if (!bulkData.length) return toast.warn("No data");
    if (selectedEmp === "all") return toast.warn("Select employee first");
    setUploading(true);
    try {
      const res = await bulkUploadWorklists(bulkData.map(d => ({ ...d, EmployeeName: selectedEmp })));
      setBulkResult(res.data);
      toast.success(`Uploaded ${res.data?.summary?.created || 0} worklists`);
      loadWorklists(); setBulkData([]);
    } catch (err) { toast.error("Bulk upload failed"); }
    finally { setUploading(false); }
  };

  // ✅ FIXED: Excel Download
  const handleDownload = async (type = "all") => {
    try {
      const res = await downloadWorklists({ employeeName: type === "all" ? "all" : selectedEmp });
      const data = res.data.data || [];
      if (!data.length) return toast.info("No data");
      
      const ws = XLSX.utils.json_to_sheet(data.map(d => ({ 
        WorklistName: d.WorklistName, 
        Frequency: d.Frequency, 
        WorkingTime: d.WorkingTime,
        ScheduleDays: d.ScheduleDays || "",
        ScheduleDates: d.ScheduleDates || "",
        TemplateLinkRemark: d.TemplateLink || d.Remark || ""
      })));
      ws['!cols'] = [{wch:30}, {wch:12}, {wch:10}, {wch:25}, {wch:15}, {wch:55}];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "WorkList");
      XLSX.writeFile(wb, `WorkList_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel Downloaded");
    } catch (err) { 
      console.error(err);
      toast.error("Download failed"); 
    }
  };

  const closeBulkModal = () => { setShowBulk(false); setBulkData([]); setBulkResult(null); };

  const totalPages = Math.ceil(worklists.length / PAGE_SIZE);
  const paginatedData = worklists.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="flex flex-wrap justify-between gap-4 mb-6">
        <h1 className="text-xl font-black">WorkList Management</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">+ Add</button>
          <button onClick={() => setShowBulk(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">📤 Bulk Upload</button>
          <button onClick={() => handleDownload("all")} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold">📥 Download Excel</button>
          <button onClick={downloadPDFReport} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold">📄 Download PDF</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap gap-4">
        <select value={selectedEmp} onChange={(e) => { setSelectedEmp(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm min-w-[200px]">
          <option value="all">👥 All Employees</option>
          {employees.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
        </select>
        <input type="text" placeholder="🔍 Search worklist..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm flex-1" />
        {selectedEmp !== "all" && <button onClick={() => handleDownload("employee")} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm">📥 Download {selectedEmp}</button>}
      </div>

      {loading ? <div className="text-center py-20"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div></div>
      : worklists.length === 0 ? <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed"><p className="text-gray-500">No worklists found</p><p className="text-sm text-gray-400 mt-2">Click + Add to create your first worklist</p></div>
      : (
        <>
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase border-b">
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Worklist</th>
                  <th className="p-3 text-left">Frequency</th>
                  <th className="p-3 text-left">Schedule</th>
                  <th className="p-3 text-left">Time</th>
                  <th className="p-3 text-left">Link/Remark</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((wl, idx) => (
                  <tr key={wl.WorkListId} className="border-t hover:bg-slate-50">
                    <td className="p-3 text-slate-400 text-xs">{(page-1)*PAGE_SIZE + idx + 1}</td>
                    <td className="p-3 font-medium">{wl.EmployeeName}</td>
                    <td className="p-3">{wl.WorklistName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        wl.Frequency==="Daily"?"bg-blue-100 text-blue-700":
                        wl.Frequency==="Weekly"?"bg-amber-100 text-amber-700":
                        wl.Frequency==="Monthly"?"bg-purple-100 text-purple-700":
                        "bg-orange-100 text-orange-700"
                      }`}>
                        {wl.Frequency}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{wl.ScheduleDays || wl.ScheduleDates || "Every day"}</td>
                    <td className="p-3">{wl.WorkingTime}</td>
                    <td className="p-3 max-w-[200px] text-xs break-all">
                      {wl.TemplateLink ? 
                        <a href={wl.TemplateLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">📎 Link</a> : 
                        (wl.Remark || "-")
                      }
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => openEdit(wl)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-4 mt-6">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-4 py-2 bg-slate-200 rounded-lg disabled:opacity-50">Prev</button>
              <span className="px-4 py-2">Page {page} of {totalPages}</span>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-4 py-2 bg-slate-200 rounded-lg disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={(e)=>handleClickOutside(e,addModalRef,closeModal)}>
          <div ref={addModalRef} className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">✕</button>
            <h2 className="text-lg font-black mb-4">{editing ? "Edit" : "Add"} WorkList</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Worklist Name *</label>
                <input type="text" value={form.WorklistName} onChange={e=>setForm({...form,WorklistName:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"/>
              </div>
              
              <div>
                <label className="block text-xs font-bold mb-1">Frequency *</label>
                <select value={form.Frequency} onChange={e=>{setForm({...form,Frequency:e.target.value}); setSelectedDays([]); setSelectedDates([]); setSchedule({scheduleDays:"",scheduleDates:""});}} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {FREQUENCIES.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              
              {form.Frequency === "Weekly" && (
                <div>
                  <label className="block text-xs font-bold mb-1">Select Days *</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map(day=>(
                      <button key={day} type="button" onClick={()=>handleDayToggle(day)} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${selectedDays.includes(day)?"bg-blue-600 text-white":"bg-gray-100"}`}>
                        {day.slice(0,3)}
                      </button>
                    ))}
                  </div>
                  {selectedDays.length>0 && <p className="text-xs text-blue-600 mt-1">✅ {selectedDays.join(", ")}</p>}
                </div>
              )}
              
              {form.Frequency === "Monthly" && (
                <div>
                  <label className="block text-xs font-bold mb-1">Select Dates *</label>
                  <div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto border rounded-lg p-2">
                    {MONTH_DATES.map(date=>(
                      <button key={date} type="button" onClick={()=>handleDateToggle(date)} 
                        className={`px-2 py-1 rounded text-xs ${selectedDates.includes(date)?"bg-purple-600 text-white":"bg-gray-100"}`}>
                        {date}
                      </button>
                    ))}
                  </div>
                  {selectedDates.length>0 && <p className="text-xs text-purple-600 mt-1">✅ {selectedDates.join(", ")}</p>}
                </div>
              )}
              
              {form.Frequency === "Yearly" && (
                <div>
                  <label className="block text-xs font-bold mb-1">Select Month & Date *</label>
                  <div className="flex gap-3">
                    <select value={yearlyMonth} onChange={e=>handleYearlyChange(e.target.value,yearlyDate)} className="flex-1 border rounded-lg px-3 py-2 text-sm">
                      {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={yearlyDate} onChange={e=>handleYearlyChange(yearlyMonth,parseInt(e.target.value))} className="w-24 border rounded-lg px-3 py-2 text-sm">
                      {MONTH_DATES.map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-orange-600 mt-1">✅ Every {yearlyMonth} {yearlyDate}</p>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold mb-1">Working Time (Minutes) *</label>
                <select value={WORKING_TIMES.includes(form.WorkingTime)?form.WorkingTime:"custom"} onChange={e=>handleWorkingTimeChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-2">
                  <option value="30M">30 Min</option>
                  <option value="60M">60 Min (1 Hour)</option>
                  <option value="90M">90 Min (1.5 Hours)</option>
                  <option value="120M">120 Min (2 Hours)</option>
                  <option value="180M">180 Min (3 Hours)</option>
                  <option value="240M">240 Min (4 Hours)</option>
                  <option value="300M">300 Min (5 Hours)</option>
                  <option value="custom">Custom...</option>
                </select>
                {(!WORKING_TIMES.includes(form.WorkingTime) || form.WorkingTime==="custom") && 
                  <input type="number" placeholder="Enter minutes" value={customWorkingTime} 
                    onChange={e=>{setCustomWorkingTime(e.target.value); if(e.target.value) setForm({...form,WorkingTime:`${parseInt(e.target.value)}M`});}} 
                    className="w-full border rounded-lg px-3 py-2 text-sm"/>
                }
              </div>
              
              {!editing && (
                <div>
                  <label className="block text-xs font-bold mb-1">Employee *</label>
                  <select value={form.EmployeeName} onChange={e=>setForm({...form,EmployeeName:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select Employee</option>
                    {employees.map(e=><option key={e.name} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold mb-1">Template Link / Remark</label>
                <textarea value={form.TemplateLinkRemark} onChange={e=>setForm({...form,TemplateLinkRemark:e.target.value})} rows="3" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Paste Google Sheet link OR add remark..."/>
                <p className="text-xs text-slate-400 mt-1">💡 http:// or https:// = Template Link, otherwise = Remark</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulk && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={(e)=>handleClickOutside(e,bulkModalRef,closeBulkModal)}>
          <div ref={bulkModalRef} className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto relative">
            <button onClick={closeBulkModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">✕</button>
            <h2 className="text-lg font-black mb-4">📤 Bulk Upload Worklists</h2>
            
            {selectedEmp === "all" ? (
              <div className="p-4 bg-amber-50 rounded-lg text-amber-700 text-center">
                ⚠️ Please select an employee from the dropdown above first
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                  <span className="text-lg">👤</span>
                  <span>Uploading for: <strong className="text-blue-800">{selectedEmp}</strong></span>
                </div>
                
                <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                  <p className="font-bold text-amber-800 mb-2">📋 Download Sample Format</p>
                  <div className="flex gap-3 mb-3">
                    <button onClick={downloadSampleBulkUpload} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex-1 text-sm font-bold">
                      📥 Excel Sample
                    </button>
                    <button onClick={downloadSamplePDF} className="bg-red-600 text-white px-4 py-2 rounded-lg flex-1 text-sm font-bold">
                      📄 PDF Sample
                    </button>
                  </div>
                  <div className="text-xs text-amber-700">
                    <strong>Required Columns:</strong> WorklistName, Frequency, WorkingTime, ScheduleDays, ScheduleDates, TemplateLinkRemark
                  </div>
                </div>
                
                <div className="border-2 border-dashed rounded-xl p-6 text-center mb-4 hover:bg-gray-50 transition">
                  <input type="file" accept=".xlsx,.csv,.xls" onChange={handleFileUpload} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
                
                {bulkData.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-bold mb-2">📊 {bulkData.length} rows ready to upload</p>
                    <div className="max-h-40 overflow-y-auto text-xs border rounded-lg">
                      <table className="w-full">
                        <tbody>
                          {bulkData.slice(0,5).map((d,i)=>(
                            <tr key={i} className="border-t">
                              <td className="p-2 font-medium">{d.WorklistName}</td>
                              <td className="p-2">{d.Frequency}</td>
                              <td className="p-2">{d.WorkingTime}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {bulkData.length > 5 && <p className="p-2 text-center text-gray-500">+{bulkData.length - 5} more</p>}
                    </div>
                  </div>
                )}
                
                {bulkResult && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
                    <p className="text-emerald-600 font-bold">✅ Created: {bulkResult.summary?.created || 0}</p>
                    <p className="text-amber-600">⏭️ Skipped (duplicate): {bulkResult.summary?.skipped || 0}</p>
                    <p className="text-rose-600">❌ Errors: {bulkResult.summary?.errors || 0}</p>
                    {bulkResult.errors?.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-gray-600">View errors</summary>
                        <ul className="mt-1 text-xs text-rose-600 pl-4">
                          {bulkResult.errors.slice(0,3).map((e,i)=> <li key={i}>{e}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={closeBulkModal} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
                  <button onClick={handleBulkUpload} disabled={uploading || !bulkData.length} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 font-bold">
                    {uploading ? "Uploading..." : `⬆️ Upload ${bulkData.length} rows`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}