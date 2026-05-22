import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAllEmployees, getAllWorklists, createWorklist, updateWorklistAdmin, bulkUploadWorklists, downloadWorklists } from "../api/services";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const FREQUENCIES = ["Daily", "Weekly", "Monthly"];
const WORKING_TIMES = ["30M", "45M", "60M", "90M", "120M", "150M", "180M", "210M", "240M", "300M"];
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
  const [form, setForm] = useState({ 
    WorklistName: "", 
    Frequency: "Daily", 
    WorkingTime: "60M", 
    EmployeeName: "",
    TemplateLinkRemark: ""
  });
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
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      closeFn();
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ WorklistName: "", Frequency: "Daily", WorkingTime: "60M", EmployeeName: "", TemplateLinkRemark: "" });
    setCustomWorkingTime("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setCustomWorkingTime("");
  };

  const openEdit = (wl) => {
    setEditing(wl);
    setForm({ 
      WorklistName: wl.WorklistName, 
      Frequency: wl.Frequency, 
      WorkingTime: wl.WorkingTime, 
      EmployeeName: wl.EmployeeName,
      TemplateLinkRemark: wl.TemplateLink || wl.Remark || ""
    });
    setCustomWorkingTime("");
    setShowModal(true);
  };

  const handleWorkingTimeChange = (value) => {
    if (value === "custom") {
      const customValue = customWorkingTime.trim();
      if (customValue && !isNaN(parseInt(customValue))) {
        setForm({ ...form, WorkingTime: `${parseInt(customValue)}M` });
      }
    } else {
      setForm({ ...form, WorkingTime: value });
    }
  };

  const handleSave = async () => {
    if (!form.WorklistName.trim()) return toast.warn("Worklist Name is required");
    if (!form.WorkingTime) return toast.warn("Working Time is required");
    if (!editing && !form.EmployeeName) return toast.warn("Please select an employee");
    setSaving(true);
    try {
      const val = form.TemplateLinkRemark.trim();
      const isUrl = val.startsWith('http://') || val.startsWith('https://') || val.includes('docs.google.com');
      
      const payload = {
        WorklistName: form.WorklistName,
        Frequency: form.Frequency,
        WorkingTime: form.WorkingTime,
        TemplateLink: isUrl ? val : "",
        Remark: !isUrl ? val : ""
      };
      
      if (editing) {
        await updateWorklistAdmin(editing.WorkListId, { ...payload, EmployeeName: form.EmployeeName });
        toast.success("Worklist updated");
      } else {
        await createWorklist({ ...payload, EmployeeName: form.EmployeeName });
        toast.success("Worklist created");
      }
      closeModal();
      loadWorklists();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  // Download Sample Bulk Upload Format (Excel with 5 dummy samples)
  const downloadSampleBulkUpload = () => {
    const sampleData = [
      { 
        WorklistName: "Daily Sales Report", 
        Frequency: "Daily", 
        WorkingTime: "60M", 
        TemplateLinkRemark: "https://docs.google.com/spreadsheets/d/1ABC123_DAILY_SALES" 
      },
      { 
        WorklistName: "Weekly Team Meeting", 
        Frequency: "Weekly", 
        WorkingTime: "90M", 
        TemplateLinkRemark: "Meeting agenda and minutes to be updated" 
      },
      { 
        WorklistName: "Monthly Performance Review", 
        Frequency: "Monthly", 
        WorkingTime: "120M", 
        TemplateLinkRemark: "https://docs.google.com/spreadsheets/d/2XYZ456_MONTHLY_REVIEW" 
      },
      { 
        WorklistName: "Client Follow-up Calls", 
        Frequency: "Daily", 
        WorkingTime: "45M", 
        TemplateLinkRemark: "Call all pending clients and update status" 
      },
      { 
        WorklistName: "Quarterly Business Review", 
        Frequency: "Monthly", 
        WorkingTime: "180M", 
        TemplateLinkRemark: "https://docs.google.com/presentation/d/3QRS789_QBR" 
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [{wch:35}, {wch:12}, {wch:12}, {wch:60}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample_Bulk_Upload");
    XLSX.writeFile(wb, `Sample_Bulk_Upload_Format.xlsx`);
    toast.success("✅ Sample Bulk Upload file downloaded! Use this format.");
  };

  // Download Sample Format (PDF)
  const downloadSamplePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(33, 33, 33);
    doc.text("📋 Sample Bulk Upload Format", 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text("Follow this exact format for bulk upload:", 14, 30);
    doc.text("Column Names (must match exactly):", 14, 38);
    
    const sampleData = [
      ["Daily Sales Report", "Daily", "60M", "https://docs.google.com/spreadsheets/d/1ABC123"],
      ["Weekly Team Meeting", "Weekly", "90M", "Meeting agenda and minutes"],
      ["Monthly Performance Review", "Monthly", "120M", "https://docs.google.com/spreadsheets/d/2XYZ456"],
      ["Client Follow-up Calls", "Daily", "45M", "Call all pending clients"],
      ["Quarterly Business Review", "Monthly", "180M", "https://docs.google.com/presentation/d/3QRS789"],
    ];
    
    autoTable(doc, {
      startY: 48,
      head: [["WorklistName", "Frequency", "WorkingTime", "TemplateLinkRemark"]],
      body: sampleData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 55 }
      }
    });
    
    doc.setFontSize(10);
    doc.setTextColor(200, 100, 0);
    doc.text("⚠️ Instructions:", 14, doc.lastAutoTable.finalY + 10);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("1. WorklistName - Name of the task (required)", 14, doc.lastAutoTable.finalY + 18);
    doc.text("2. Frequency - Must be: Daily, Weekly, or Monthly (required)", 14, doc.lastAutoTable.finalY + 24);
    doc.text("3. WorkingTime - Minutes format (e.g., 30M, 60M, 90M, 120M, 180M) (required)", 14, doc.lastAutoTable.finalY + 30);
    doc.text("4. TemplateLinkRemark - Google Sheet link OR any remark (optional)", 14, doc.lastAutoTable.finalY + 36);
    
    doc.save(`Sample_Bulk_Upload_Format.pdf`);
    toast.success("✅ Sample PDF format downloaded!");
  };

  // Download PDF Report
  const downloadPDFReport = () => {
    if (worklists.length === 0) {
      toast.info("No data to download");
      return;
    }
    
    const doc = new jsPDF();
    const currentDate = new Date().toLocaleString();
    
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text("WorkList Management Report", 14, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Employee Filter: ${selectedEmp === "all" ? "All Employees" : selectedEmp}`, 14, 28);
    doc.text(`Generated: ${currentDate}`, 14, 34);
    doc.text(`Total Worklists: ${worklists.length}`, 14, 40);
    
    const tableData = worklists.map((wl, idx) => [
      idx + 1,
      wl.EmployeeName,
      wl.WorklistName,
      wl.Frequency,
      wl.WorkingTime,
      wl.TemplateLink || wl.Remark || "-"
    ]);
    
    autoTable(doc, {
      startY: 48,
      head: [["#", "Employee", "Worklist Name", "Frequency", "Working Time (Minutes)", "Link / Remark"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 10, right: 10 }
    });
    
    doc.save(`WorkList_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF Report downloaded");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) return toast.warn("Empty file");

        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        
        const nameIdx = headers.findIndex(h => h.includes("worklistname") || h.includes("name"));
        const freqIdx = headers.findIndex(h => h.includes("frequency") || h.includes("freq"));
        const timeIdx = headers.findIndex(h => h.includes("workingtime") || h.includes("time"));
        const remarkIdx = headers.findIndex(h => h.includes("templatelinkremark") || h.includes("remark") || h.includes("template") || h.includes("link"));

        if (nameIdx === -1 || freqIdx === -1 || timeIdx === -1) {
          return toast.warn("File must have columns: WorklistName, Frequency, WorkingTime");
        }

        const parsed = rows.slice(1)
          .filter(r => r && r.some(c => c !== undefined && c !== null && String(c).trim() !== ""))
          .map((r, i) => {
            let workingTime = String(r[timeIdx] || "").trim();
            // Ensure WorkingTime has M suffix
            if (workingTime && !workingTime.toUpperCase().endsWith('M') && !isNaN(parseInt(workingTime))) {
              workingTime = `${parseInt(workingTime)}M`;
            }
            
            const remarkValue = remarkIdx !== -1 ? String(r[remarkIdx] || "").trim() : "";
            const isUrl = remarkValue.startsWith('http://') || remarkValue.startsWith('https://') || remarkValue.includes('docs.google.com');
            
            return {
              row: i + 2,
              WorklistName: String(r[nameIdx] || "").trim(),
              Frequency: String(r[freqIdx] || "Daily").trim(),
              WorkingTime: workingTime,
              TemplateLink: isUrl ? remarkValue : "",
              Remark: !isUrl ? remarkValue : ""
            };
          })
          .filter(d => d.WorklistName && d.Frequency && d.WorkingTime);

        if (parsed.length === 0) {
          toast.warn("No valid data rows found. Please check sample format.");
          return;
        }
        
        setBulkData(parsed);
        setBulkResult(null);
        toast.success(`${parsed.length} rows loaded successfully!`);
      } catch (err) { 
        console.error(err);
        toast.error("Invalid file format. Please download sample file first."); 
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    if (!bulkData.length) return toast.warn("No valid data to upload");
    if (selectedEmp === "all") return toast.warn("Please select an employee first");
    const dataWithEmp = bulkData.map(d => ({ ...d, EmployeeName: selectedEmp }));
    setUploading(true);
    try {
      const res = await bulkUploadWorklists(dataWithEmp);
      setBulkResult(res.data);
      toast.success(`Uploaded ${res.data?.summary?.created || 0} worklists`);
      loadWorklists();
      setBulkData([]);
    } catch (err) { 
      toast.error("Bulk upload failed. Please check format."); 
    }
    finally { setUploading(false); }
  };

  const handleDownload = async (type = "all") => {
    try {
      const res = await downloadWorklists({ employeeName: type === "all" ? "all" : selectedEmp });
      const data = res.data.data || [];
      if (!data.length) return toast.info("No data to download");
      const ws = XLSX.utils.json_to_sheet(data.map(d => ({ 
        WorklistName: d.WorklistName, 
        Frequency: d.Frequency, 
        WorkingTime: d.WorkingTime, 
        EmployeeName: d.EmployeeName,
        TemplateLinkRemark: d.TemplateLink || d.Remark || ""
      })));
      ws['!cols'] = [{wch:35}, {wch:12}, {wch:12}, {wch:20}, {wch:55}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "WorkList");
      XLSX.writeFile(wb, `WorkList_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel Downloaded");
    } catch (err) { toast.error("Download failed"); }
  };

  const closeBulkModal = () => {
    setShowBulk(false);
    setBulkData([]);
    setBulkResult(null);
  };

  const formatWorkingTimeDisplay = (time) => {
    if (!time) return "-";
    const minutes = time.replace('M', '');
    return `${minutes} Minutes`;
  };

  const totalPages = Math.ceil(worklists.length / PAGE_SIZE);
  const paginatedData = worklists.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-800">WorkList Management</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700">+ Add WorkList</button>
          <button onClick={() => setShowBulk(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700">📤 Bulk Upload</button>
          {/* <button onClick={() => handleDownload("all")} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700">📥 Download Excel</button> */}
          <button onClick={downloadPDFReport} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-700">📄 Download PDF</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-col sm:flex-row gap-4">
        <select value={selectedEmp} onChange={(e) => { setSelectedEmp(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm font-medium min-w-[200px]">
          <option value="all">👥 All Employees</option>
          {employees.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
        </select>
        <input type="text" placeholder="🔍 Search worklist name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm flex-1" />
        {selectedEmp !== "all" && (
          <button onClick={() => handleDownload("employee")} className="bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap">📥 Download {selectedEmp}</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div></div>
      ) : worklists.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <p className="text-slate-400 font-bold">No worklists found</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left font-black text-slate-600 uppercase text-xs">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Worklist Name</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Working Time (Minutes)</th>
                    <th className="px-4 py-3">Work List Template Link/Remark</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((wl, idx) => (
                    <tr key={wl.WorkListId} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{wl.EmployeeName}</td>
                      <td className="px-4 py-3">{wl.WorklistName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          wl.Frequency === "Daily" ? "bg-blue-100 text-blue-700" :
                          wl.Frequency === "Weekly" ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                        }`}>{wl.Frequency}</span>
                      </td>
                      <td className="px-4 py-3">{formatWorkingTimeDisplay(wl.WorkingTime)}</td>
                      <td className="px-4 py-3 max-w-[250px]">
                        {wl.TemplateLink ? (
                          <a href={wl.TemplateLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs break-all">
                            📎 {wl.TemplateLink.length > 40 ? wl.TemplateLink.substring(0, 40) + "..." : wl.TemplateLink}
                          </a>
                        ) : wl.Remark ? (
                          <span className="text-xs text-slate-600">💬 {wl.Remark.length > 50 ? wl.Remark.substring(0, 50) + "..." : wl.Remark}</span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openEdit(wl)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700">✏️ Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-4 mt-6">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-slate-200 rounded-lg font-bold text-sm disabled:opacity-50">◀ Prev</button>
              <span className="text-sm font-bold text-slate-600 self-center">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-slate-200 rounded-lg font-bold text-sm disabled:opacity-50">Next ▶</button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
          onClick={(e) => handleClickOutside(e, addModalRef, closeModal)}
        >
          <div ref={addModalRef} className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto relative">
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ✕
            </button>
            <h2 className="text-lg font-black text-slate-800 mb-4">{editing ? "✏️ Edit WorkList" : "➕ Add WorkList"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Worklist Name *</label>
                <input type="text" value={form.WorklistName} onChange={(e) => setForm({ ...form, WorklistName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Enter worklist name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Frequency *</label>
                <select value={form.Frequency} onChange={(e) => setForm({ ...form, Frequency: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Working Time (Minutes) *</label>
                <select 
                  value={WORKING_TIMES.includes(form.WorkingTime) ? form.WorkingTime : "custom"} 
                  onChange={(e) => handleWorkingTimeChange(e.target.value)} 
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
                >
                  <option value="30M">30 Minutes</option>
                  <option value="45M">45 Minutes</option>
                  <option value="60M">60 Minutes (1 Hour)</option>
                  <option value="90M">90 Minutes (1.5 Hours)</option>
                  <option value="120M">120 Minutes (2 Hours)</option>
                  <option value="150M">150 Minutes (2.5 Hours)</option>
                  <option value="180M">180 Minutes (3 Hours)</option>
                  <option value="210M">210 Minutes (3.5 Hours)</option>
                  <option value="240M">240 Minutes (4 Hours)</option>
                  <option value="300M">300 Minutes (5 Hours)</option>
                  <option value="custom">Custom Minutes...</option>
                </select>
                {(!WORKING_TIMES.includes(form.WorkingTime) || form.WorkingTime === "custom") && (
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Enter minutes (e.g., 75)" 
                      value={customWorkingTime}
                      onChange={(e) => {
                        setCustomWorkingTime(e.target.value);
                        if (e.target.value && !isNaN(parseInt(e.target.value))) {
                          setForm({ ...form, WorkingTime: `${parseInt(e.target.value)}M` });
                        }
                      }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">Format: 30M, 60M, 90M, 120M, etc.</p>
              </div>
              {!editing && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Employee Name *</label>
                  <select value={form.EmployeeName} onChange={(e) => setForm({ ...form, EmployeeName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Select Employee --</option>
                    {employees.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">📎 Work List Template Link / Remark</label>
                <textarea 
                  value={form.TemplateLinkRemark} 
                  onChange={(e) => setForm({ ...form, TemplateLinkRemark: e.target.value })} 
                  className="w-full border rounded-lg px-3 py-2 text-sm" 
                  rows="3"
                  placeholder="Paste Google Sheet link OR add any remark/note..."
                />
                <p className="text-xs text-slate-400 mt-1">
                  💡 If it starts with http:// or https:// it will be saved as Template Link, otherwise as Remark
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-lg font-bold text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:bg-blue-300">{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulk && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
          onClick={(e) => handleClickOutside(e, bulkModalRef, closeBulkModal)}
        >
          <div ref={bulkModalRef} className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[85vh] overflow-y-auto relative">
            <button 
              onClick={closeBulkModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ✕
            </button>
            
            <h2 className="text-lg font-black text-slate-800 mb-4">📤 Bulk Upload WorkLists</h2>
            
            {selectedEmp === "all" ? (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-medium">
                ⚠️ Please select an Employee from the filter dropdown first, then come back to bulk upload.
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm font-medium">
                  👤 Uploading for: <strong>{selectedEmp}</strong>
                </div>

                {/* Sample Format Section */}
                <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl shadow-sm">
                  <p className="text-base font-bold text-amber-800 mb-2 flex items-center gap-2">
                    📋 <span className="underline">Sample Bulk Upload Format</span>
                  </p>
                  <p className="text-xs text-amber-700 mb-3">Download sample file to see the correct format <strong>(5 dummy samples included)</strong>:</p>
                  
                  <div className="flex gap-3 mb-4">
                    <button 
                      onClick={downloadSampleBulkUpload}
                      className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-emerald-700 flex-1 flex items-center justify-center gap-2"
                    >
                      📥 Sample Bulk Upload (Excel)
                    </button>
                    <button 
                      onClick={downloadSamplePDF}
                      className="bg-red-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-red-700 flex-1 flex items-center justify-center gap-2"
                    >
                      📄 Sample Bulk Upload (PDF)
                    </button>
                  </div>
                  
                  <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
                    <p className="font-bold text-xs text-amber-800 mb-2">📌 Expected Columns (Excel):</p>
                    <div className="space-y-1 text-xs text-amber-700">
                      <p>1. <strong className="text-amber-800">WorklistName</strong> - Name of the task (e.g., Daily Report)</p>
                      <p>2. <strong className="text-amber-800">Frequency</strong> - Daily / Weekly / Monthly</p>
                      <p>3. <strong className="text-amber-800">WorkingTime</strong> - Minutes format (e.g., 60M, 90M, 120M)</p>
                      <p>4. <strong className="text-amber-800">TemplateLinkRemark</strong> - Google Sheet link OR remark text</p>
                    </div>
                    <p className="mt-2 text-xs text-amber-600 font-bold">⚠️ WorkingTime examples: 30M, 45M, 60M, 90M, 120M, 180M</p>
                  </div>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center mb-4 bg-slate-50">
                  <input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} className="block w-full text-sm file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  <p className="text-xs text-slate-400 mt-2">Upload Excel file with columns: WorklistName, Frequency, WorkingTime, TemplateLinkRemark</p>
                </div>

                {bulkData.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-bold text-slate-700 mb-2">{bulkData.length} rows ready to upload</p>
                    <div className="max-h-40 overflow-y-auto text-xs border rounded-lg">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-100 sticky top-0">
                            <th className="p-2">#</th>
                            <th className="p-2">Worklist Name</th>
                            <th className="p-2">Frequency</th>
                            <th className="p-2">Working Time</th>
                            <th className="p-2">Link/Remark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkData.slice(0, 5).map((d, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2 text-slate-400">{d.row}</td>
                              <td className="p-2 font-medium">{d.WorklistName}</td>
                              <td className="p-2">{d.Frequency}</td>
                              <td className="p-2">{d.WorkingTime}</td>
                              <td className="p-2 max-w-[150px] truncate text-blue-600">{d.TemplateLink || d.Remark || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {bulkData.length > 5 && <p className="text-slate-400 text-xs mt-1">...and {bulkData.length - 5} more rows</p>}
                  </div>
                )}

                {bulkResult && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                    <p className="font-bold text-emerald-600">✅ Created: {bulkResult.summary?.created || 0}</p>
                    <p className="font-bold text-amber-600">⏭️ Skipped: {bulkResult.summary?.skipped || 0}</p>
                    <p className="font-bold text-rose-600">❌ Errors: {bulkResult.summary?.errors || 0}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button onClick={closeBulkModal} className="px-4 py-2 bg-gray-200 rounded-lg font-bold text-sm">Close</button>
                  <button onClick={handleBulkUpload} disabled={uploading || !bulkData.length} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:bg-indigo-300">
                    {uploading ? "⏳ Uploading..." : `📤 Upload ${bulkData.length} rows`}
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