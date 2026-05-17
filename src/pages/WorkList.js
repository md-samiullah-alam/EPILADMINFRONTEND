import React, { useState, useEffect, useCallback } from "react";
import { getAllEmployees, getAllWorklists, createWorklist, updateWorklistAdmin, deleteWorklistAdmin, bulkUploadWorklists, downloadWorklists } from "../api/services";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";

const FREQUENCIES = ["Daily", "Weekly", "Monthly"];
const PAGE_SIZE = 20;

export default function WorkList() {
  const [worklists, setWorklists] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ WorklistName: "", Frequency: "Daily", WorkingTime: "", EmployeeName: "" });
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkData, setBulkData] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const openCreate = () => {
    setEditing(null);
    setForm({ WorklistName: "", Frequency: "Daily", WorkingTime: "", EmployeeName: "" });
    setShowModal(true);
  };

  const openEdit = (wl) => {
    setEditing(wl);
    setForm({ WorklistName: wl.WorklistName, Frequency: wl.Frequency, WorkingTime: wl.WorkingTime, EmployeeName: wl.EmployeeName });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.WorklistName.trim()) return toast.warn("Worklist Name is required");
    if (!form.WorkingTime.trim()) return toast.warn("Working Time is required");
    setSaving(true);
    try {
      if (editing) {
        await updateWorklistAdmin(editing.WorkListId, form);
        toast.success("Worklist updated");
      } else {
        await createWorklist(form);
        toast.success("Worklist created");
      }
      setShowModal(false);
      loadWorklists();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  const confirmDelete = (wl) => {
    setDeleteTarget(wl);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWorklistAdmin(deleteTarget.WorkListId);
      toast.success("Worklist deleted");
      setDeleteTarget(null);
      loadWorklists();
    } catch (err) { toast.error("Failed to delete"); }
  };

  // BULK UPLOAD - Only WorklistName, Frequency, WorkingTime. Employee from dropdown.
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) return toast.warn("Empty file or no data rows");

        // Detect headers (case-insensitive)
        const headers = rows[0].map(h => String(h).trim().toLowerCase());

        // Find column indices by header name
        const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("worklist") || h.includes("task"));
        const freqIdx = headers.findIndex(h => h.includes("frequen") || h.includes("freq"));
        const timeIdx = headers.findIndex(h => h.includes("time") || h.includes("working"));

        if (nameIdx === -1 || freqIdx === -1 || timeIdx === -1) {
          return toast.warn("File must have columns: WorklistName (or TaskName), Frequency, WorkingTime");
        }

        // Parse data rows (skip header, skip empty rows)
        const parsed = rows.slice(1)
          .filter(r => r && r.some(c => c !== undefined && c !== null && String(c).trim() !== ""))
          .map((r, i) => ({
            row: i + 2,
            WorklistName: String(r[nameIdx] || "").trim(),
            Frequency: String(r[freqIdx] || "Daily").trim(),
            WorkingTime: String(r[timeIdx] || "").trim(),
          }))
          .filter(d => d.WorklistName && d.Frequency && d.WorkingTime);

        setBulkData(parsed);
        setBulkResult(null);
      } catch (err) { toast.error("Invalid file format. Please upload a valid Excel file."); }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    if (!bulkData.length) return toast.warn("No valid data to upload");
    // Attach EmployeeName from dropdown for each row
    const dataWithEmp = bulkData.map(d => ({
      ...d,
      EmployeeName: selectedEmp !== "all" ? selectedEmp : "",
    }));
    setUploading(true);
    try {
      const res = await bulkUploadWorklists(dataWithEmp);
      setBulkResult(res.data);
      toast.success(`Uploaded ${res.data?.summary?.created || 0} worklists`);
      loadWorklists();
    } catch (err) { toast.error("Bulk upload failed"); }
    finally { setUploading(false); }
  };

  const handleDownload = async (type = "all") => {
    try {
      const res = await downloadWorklists({ employeeName: type === "all" ? "all" : selectedEmp });
      const data = res.data.data || [];
      if (!data.length) return toast.info("No data to download");
      const ws = XLSX.utils.json_to_sheet(data.map(d => ({ WorklistName: d.WorklistName, Frequency: d.Frequency, WorkingTime: d.WorkingTime, EmployeeName: d.EmployeeName })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "WorkList");
      XLSX.writeFile(wb, `WorkList_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Downloaded");
    } catch (err) { toast.error("Download failed"); }
  };

  const totalPages = Math.ceil(worklists.length / PAGE_SIZE);
  const paginatedData = worklists.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-800">WorkList Management</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition">+ Add WorkList</button>
          <button onClick={() => setShowBulk(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition">Bulk Upload</button>
          <button onClick={() => handleDownload("all")} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 transition">Download All</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-col sm:flex-row gap-4">
        <select value={selectedEmp} onChange={(e) => { setSelectedEmp(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm font-medium min-w-[200px]">
          <option value="all">All Employees</option>
          {employees.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
        </select>
        <input type="text" placeholder="Search worklist name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm flex-1" />
        {selectedEmp !== "all" && (
          <button onClick={() => handleDownload("employee")} className="bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap">Download {selectedEmp}</button>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-500 font-bold">Loading worklists...</p>
        </div>
      ) : worklists.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <p className="text-slate-400 font-bold">No worklists found</p>
        </div>
      ) : (
        <>
          {/* Table - NO TASK ID COLUMN */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left font-black text-slate-600 uppercase text-xs">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Worklist Name</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Working Time</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((wl, idx) => (
                    <tr key={wl.WorkListId} className="border-t hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-400 text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{wl.EmployeeName}</td>
                      <td className="px-4 py-3">{wl.WorklistName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          wl.Frequency === "Daily" ? "bg-blue-100 text-blue-700" :
                          wl.Frequency === "Weekly" ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                        }`}>{wl.Frequency}</span>
                      </td>
                      <td className="px-4 py-3">{wl.WorkingTime}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => openEdit(wl)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700">Edit</button>
                          <button onClick={() => confirmDelete(wl)} className="bg-rose-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-rose-700">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-4 mt-6">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-slate-200 rounded-lg font-bold text-sm disabled:opacity-50">Prev</button>
              <span className="text-sm font-bold text-slate-600 self-center">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-slate-200 rounded-lg font-bold text-sm disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-black text-slate-800 mb-4">{editing ? "Edit WorkList" : "Add WorkList"}</h2>
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
                <label className="block text-xs font-bold text-slate-600 mb-1">Working Time *</label>
                <input type="text" value={form.WorkingTime} onChange={(e) => setForm({ ...form, WorkingTime: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g., 09:00 - 18:00" />
              </div>
              {!editing && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Employee Name</label>
                  <select value={form.EmployeeName} onChange={(e) => setForm({ ...form, EmployeeName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Select Employee --</option>
                    {employees.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg font-bold text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:bg-blue-300">{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL - Only WorklistName, Frequency, WorkingTime */}
      {showBulk && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-black text-slate-800 mb-4">Bulk Upload WorkLists</h2>

            {selectedEmp === "all" ? (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-medium">
                ⚠️ Please select an Employee from the filter dropdown first, then come back to bulk upload.
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm font-medium">
                  Uploading for: <strong>{selectedEmp}</strong>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center mb-4">
                  <input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} className="block w-full text-sm" />
                  <p className="text-xs text-slate-400 mt-2">Columns: <strong>WorklistName, Frequency, WorkingTime</strong></p>
                  <p className="text-xs text-slate-300">Frequency must be: Daily, Weekly, or Monthly</p>
                </div>

                {bulkData.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-bold text-slate-700 mb-2">{bulkData.length} rows ready</p>
                    <div className="max-h-40 overflow-y-auto text-xs border rounded-lg">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-100 text-left">
                            <th className="p-2">#</th><th className="p-2">Worklist Name</th><th className="p-2">Frequency</th><th className="p-2">Working Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkData.slice(0, 5).map((d, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2 text-slate-400">{d.row}</td>
                              <td className="p-2">{d.WorklistName}</td>
                              <td className="p-2">{d.Frequency}</td>
                              <td className="p-2">{d.WorkingTime}</td>
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
                    <p className="font-bold text-amber-600">⏭️ Skipped (Duplicates): {bulkResult.summary?.skipped || 0}</p>
                    <p className="font-bold text-rose-600">❌ Errors: {bulkResult.summary?.errors || 0}</p>
                    {bulkResult.errors?.length > 0 && (
                      <div className="mt-2 text-rose-600">
                        {bulkResult.errors.map((e, i) => <p key={i}>Row {e.row}: {e.errors?.join(", ")}</p>)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowBulk(false); setBulkData([]); setBulkResult(null); }} className="px-4 py-2 bg-gray-200 rounded-lg font-bold text-sm">Close</button>
              {selectedEmp !== "all" && (
                <button onClick={handleBulkUpload} disabled={uploading || !bulkData.length} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:bg-indigo-300">
                  {uploading ? "Uploading..." : `Upload ${bulkData.length} rows`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-black text-slate-800 mb-3">Confirm Delete</h2>
            <p className="text-sm text-slate-600 mb-2">Are you sure you want to delete this worklist?</p>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="font-bold text-slate-800">{deleteTarget.WorklistName}</p>
              <p className="text-xs text-slate-500">{deleteTarget.EmployeeName} • {deleteTarget.Frequency} • {deleteTarget.WorkingTime}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 bg-gray-200 rounded-lg font-bold text-sm">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold text-sm hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}