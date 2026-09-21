import React, { useState, useEffect, useCallback } from "react";
import {
  getAllEmployees, getTrainingTemplates, getTrainingDepartments, getEmployeeDesignations,
  createTrainingTemplate,
  approveTrainingTemplate, deleteTrainingTemplate, addTrainingIndex, updateTrainingIndex,
  deleteTrainingIndex, getTrainingQuestions, addTrainingQuestion, updateTrainingQuestion,
  deleteTrainingQuestion, bulkAddTrainingQuestions, aiGenerateTrainingQuestions,
  getTrainingRecords,
} from "../api/services";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";

const STATUS_BADGE = {
  Pending: "bg-amber-100 text-amber-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-800",
};
const APPROVAL_BADGE = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-800",
};
const newQuestionRow = () => ({ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A" });

const QaRowEditor = ({ q, onChange, onRemove, namePrefix, canRemove }) => (
  <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
    <div className="flex gap-2 mb-1">
      <input className="flex-1 border rounded px-2 py-1 text-xs font-bold" placeholder="Question"
        value={q.question} onChange={(e) => onChange({ ...q, question: e.target.value })} />
      <button onClick={onRemove} disabled={canRemove === false}
        className="px-2 py-1 bg-red-600 text-white rounded text-xs disabled:bg-gray-300">✕</button>
    </div>
    <div className="grid grid-cols-4 gap-1 mb-1">
      {["A", "B", "C", "D"].map((opt) => (
        <input key={opt} className="border rounded px-2 py-1 text-xs" placeholder={`Option ${opt}`}
          value={q[`option${opt}`] || ""} onChange={(e) => onChange({ ...q, [`option${opt}`]: e.target.value })} />
      ))}
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 font-bold">Correct:</span>
      {["A", "B", "C", "D"].map((opt) => (
        <label key={opt} className="flex items-center gap-1 text-xs">
          <input type="radio" name={`${namePrefix}`} checked={(q.correctOption || "A") === opt}
            onChange={() => onChange({ ...q, correctOption: opt })} /> {opt}
        </label>
      ))}
    </div>
  </div>
);

const DESIGNATION_FALLBACK = ["COMMON"];

export default function Training() {
  const [tab, setTab] = useState("add"); // "add" | "approved" | "review"

  // ---------- ADD TEMPLATE ----------
  const [form, setForm] = useState({ department: "", name: "" });
  const [indices, setIndices] = useState([{ name: "Index 1", document: "", video: "" }]);
  const [questions, setQuestions] = useState([newQuestionRow()]);
  const [saving, setSaving] = useState(false);

  // ---------- APPROVED / MANAGEMENT ----------
  const [templates, setTemplates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState("all");
  const [approvalTab, setApprovalTab] = useState("Pending");
  const [expandId, setExpandId] = useState(null);
  const [qaMap, setQaMap] = useState({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [newIndexForm, setNewIndexForm] = useState({ templateId: "", name: "", document: "", video: "" });
  const [newQaForm, setNewQaForm] = useState({ templateId: "", question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A" });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editIndexForm, setEditIndexForm] = useState({ name: "", document: "", video: "" });
  const [editingQa, setEditingQa] = useState(null);
  const [editQaForm, setEditQaForm] = useState(newQuestionRow());

  // ---------- DESIGNATION DROPDOWN (employee API -> unique Designation + COMMON) ----------
  const [deptOptions, setDeptOptions] = useState(DESIGNATION_FALLBACK);
  const [qaMode, setQaMode] = useState("manual"); // manual | bulk | ai
  const [bulkQaRows, setBulkQaRows] = useState([]);
  const [aiCount, setAiCount] = useState(5);
  const [aiLoading, setAiLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // ---------- PERFORMANCE REVIEW ----------
  const [employees, setEmployees] = useState([]);
  const [empFilter, setEmpFilter] = useState("all");
  const [deptReviewFilter, setDeptReviewFilter] = useState("all"); // all | Common | <designation>
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [showDetails, setShowDetails] = useState({ common: false, dept: false });
  const [actionBusy, setActionBusy] = useState(""); // "ap:ID" | "del:ID" | "exp:ID" | "addidx:ID" | ... (button loading)

  // ================= LOADERS =================
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      // Training matching DESIGNATION-wise hai (department se nahi) → designation param bhejo.
      // department= bhi saath bhejte hain (purana param naam, ab usme bhi designation value jaati hai)
      // taaki purane chal rahe server par bhi filter sahi lage.
      const desigParam = deptFilter === "all" ? "" : deptFilter;
      const apParam = approvalTab === "all" ? "" : approvalTab;
      const res = await getTrainingTemplates({ designation: desigParam, department: desigParam, approval: apParam });
      setTemplates(res.data.templates || []);
    } catch (err) { console.error(err); toast.error("Failed to load templates"); }
    finally { setLoadingTemplates(false); }
  }, [deptFilter, approvalTab]);

  const loadDepartments = useCallback(async () => {
    try { const res = await getTrainingDepartments(); setDepartments(res.data.departments || []); }
    catch (err) { console.error(err); }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await getAllEmployees();
      const arr = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setEmployees(arr);
      // Designation dropdown isi list se bhi derive karo (COMMON + unique Designation)
      try {
        const dRes = await getEmployeeDesignations();
        const list = dRes.data?.designations || [];
        if (list.length) { setDeptOptions(list); return; }
      } catch (e) { /* fallback neeche */ }
      const seen = new Map();
      for (const e of arr) {
        const d = String(e.Designation || e.designation || "").trim();
        if (!d) continue;
        const k = d.toUpperCase();
        if (!seen.has(k)) seen.set(k, d);
      }
      const uniq = [...seen.values()].sort((a, b) => a.localeCompare(b));
      setDeptOptions(uniq.length ? ["COMMON", ...uniq] : DESIGNATION_FALLBACK);
    }
    catch (err) { console.error(err); }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    setShowDetails({ common: false, dept: false }); // reset expand on filter change
    try {
      // EK HI SOURCE: /records assigned rows + scoped summary dono deta hai
      // scope: all | common | <template-designation> ; status: all|Pending|In Progress|Completed
      const scopeParam = deptReviewFilter === "all" ? "all" : deptReviewFilter === "Common" ? "common" : deptReviewFilter;
      const res = await getTrainingRecords({
        employeeName: empFilter === "all" ? "all" : empFilter,
        scope: scopeParam,
        status: statusFilter === "all" ? "all" : statusFilter,
      });
      setRecords(res.data.records || []);
      setSummary(res.data.summary || null);
    } catch (err) { console.error(err); toast.error("Failed to load records"); }
    finally { setLoadingRecords(false); }
  }, [empFilter, deptReviewFilter, statusFilter]);

  useEffect(() => { loadDepartments(); loadEmployees(); }, [loadDepartments, loadEmployees]);
  useEffect(() => { if (tab !== "review") loadTemplates(); }, [loadTemplates, tab]);
  // review tab me Common/Dept join ke liye ALL approved templates bhi chahiye
  useEffect(() => {
    if (tab === "review") {
      getTrainingTemplates({ approval: "Approved" })
        .then((res) => setTemplates(res.data.templates || []))
        .catch((e) => console.error(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => {
    if (tab === "review") {
      if (empFilter !== "all") {
        setShowDetails({ common: false, dept: false });
        loadRecords();
      } else {
        // employee = all → load all records too (table won't show but data is ready)
        loadRecords();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, empFilter, deptReviewFilter, statusFilter]);

  // ================= QA HELPERS =================
  const loadQuestions = async (templateId) => {
    try {
      const res = await getTrainingQuestions(templateId);
      setQaMap((prev) => ({ ...prev, [templateId]: res.data.questions || [] }));
    } catch (err) { console.error(err); }
  };

  const toggleExpand = async (template) => {
    if (expandId === template.TemplateId) { setExpandId(null); return; }
    setActionBusy(`exp:${template.TemplateId}`);
    setExpandId(template.TemplateId);
    if (!qaMap[template.TemplateId]) await loadQuestions(template.TemplateId);
    setActionBusy("");
  };

  // ================= ADD TEMPLATE HANDLERS =================
  // Q/A source: manual list + bulk upload list dono merge hote hain
  const mergedQuestions = () => {
    const all = [...questions, ...bulkQaRows];
    return all.filter((q) => q.question && String(q.question).trim());
  };
  const downloadQaSample = () => {
    const sample = [
      { Question: "Document ka mukhya uddeshya kya hai?", OptionA: "Process follow karna", OptionB: "Bina dekhe kaam karna", OptionC: "Skip kar dena", OptionD: "Delete kar dena", CorrectOption: "A" },
      { Question: "Video dekhne ke baad pehla kadam kya hoga?", OptionA: "Doer ke saath discuss karke apply karna", OptionB: "Kuch na karna", OptionC: "Bina samjhe test dena", OptionD: "Video delete karna", CorrectOption: "A" },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws["!cols"] = [{ wch: 45 }, { wch: 30 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample_QA_Upload");
    XLSX.writeFile(wb, "Sample_QA_Upload_Format.xlsx");
    toast.success("Sample Q/A file downloaded!");
  };
  const handleQaFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        if (rows.length < 2) return toast.warn("Empty file");
        const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
        const qi = headers.findIndex((h) => h.includes("question"));
        const ai = headers.findIndex((h) => h.includes("optiona") || h === "a");
        const bi = headers.findIndex((h) => h.includes("optionb") || h === "b");
        const ci = headers.findIndex((h) => h.includes("optionc") || h === "c");
        const di = headers.findIndex((h) => h.includes("optiond") || h === "d");
        const ki = headers.findIndex((h) => h.includes("correct"));
        if (qi === -1 || ai === -1 || bi === -1 || ki === -1) return toast.error("Sample format follow karo: Question | OptionA | OptionB | OptionC | OptionD | CorrectOption");
        const parsed = rows.slice(1).filter((r) => r && r.some((c) => c)).map((r) => ({
          question: String(r[qi] || "").trim(),
          optionA: String(r[ai] || "").trim(),
          optionB: String(r[bi] || "").trim(),
          optionC: ci !== -1 ? String(r[ci] || "").trim() : "",
          optionD: di !== -1 ? String(r[di] || "").trim() : "",
          correctOption: String(r[ki] || "A").trim().toUpperCase(),
        })).filter((q) => q.question && q.optionA && q.optionB && ["A", "B", "C", "D"].includes(q.correctOption));
        if (!parsed.length) return toast.error("Koi valid row nahi mili");
        setBulkQaRows(parsed);
        toast.success(`${parsed.length} Q/A loaded! Check/edit karke SAVE dabao.`);
      } catch (err) { toast.error("Invalid file. Sample download karke dekho."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };
  const handleAiGenerate = async () => {
    setAiLoading(true);
    try {
      const res = await aiGenerateTrainingQuestions({
        topic: form.name.trim() || form.department.trim(),
        designation: form.department.trim(),
        count: aiCount,
        documents: indices.map((i) => i.document).filter(Boolean),
        videos: indices.map((i) => i.video).filter(Boolean),
      });
      const list = res.data.questions || [];
      if (!list.length) return toast.warn("AI se kuch nahi bana");
      setQuestions(list);
      setQaMode("ai");
      toast.success(`${list.length} AI Q/A ready! Edit/remove karke SAVE dabao.`);
    } catch (err) { toast.error(err.response?.data?.error || "AI generate failed"); }
    finally { setAiLoading(false); }
  };
  const handleSubmitTemplate = async () => {
    if (!form.department.trim() || !form.name.trim()) return toast.warn("Designation & Template Name are required");
    const validIndices = indices.filter((i) => i.name && i.name.trim());
    if (!validIndices.length) return toast.warn("At least one Index is required");
    setSaving(true);
    try {
      const res = await createTrainingTemplate({
        designation: form.department.trim(), // naya naam
        department: form.department.trim(), // purana compat alias (column B)
        name: form.name.trim(),
        indices: validIndices,
        questions: mergedQuestions(),
      });
      toast.success(res.data.message || "Template created");
      setForm({ department: "", name: "" });
      setIndices([{ name: "Index 1", document: "", video: "" }]);
      setQuestions([newQuestionRow()]);
      setBulkQaRows([]);
      setQaMode("manual");
      loadTemplates();
      setTab("approved");
      setApprovalTab("Pending");
    } catch (err) { toast.error(err.response?.data?.error || "Failed to create template"); }
    finally { setSaving(false); }
  };

  // ================= TEMPLATE MANAGEMENT =================
  const handleApproval = async (templateId, approval) => {
    setActionBusy(`ap:${templateId}`);
    try {
      await approveTrainingTemplate(templateId, approval);
      toast.success(approval === "Approved" ? "Template Approved ✅" : "Template moved to Pending");
      loadTemplates();
    } catch (err) { toast.error("Action failed"); }
    finally { setActionBusy(""); }
  };

  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`Delete template "${template.TemplateName}" and all its questions?`)) return;
    setActionBusy(`del:${template.TemplateId}`);
    try {
      await deleteTrainingTemplate(template.TemplateId);
      toast.success("Template deleted");
      if (expandId === template.TemplateId) setExpandId(null);
      loadTemplates();
    } catch (err) { toast.error("Delete failed"); }
    finally { setActionBusy(""); }
  };

  // ================= INDEX MANAGEMENT =================
  const handleAddIndex = async () => {
    if (!newIndexForm.name || !newIndexForm.name.trim()) return toast.warn("Index name required");
    setActionBusy(`addidx:${newIndexForm.templateId}`);
    try {
      await addTrainingIndex({ templateId: newIndexForm.templateId, name: newIndexForm.name, document: newIndexForm.document, video: newIndexForm.video });
      toast.success("Index added");
      setNewIndexForm({ templateId: "", name: "", document: "", video: "" });
      loadTemplates();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to add index"); }
    finally { setActionBusy(""); }
  };

  const startEditIndex = (templateId, indexNo, index) => {
    setEditingIndex({ templateId, indexNo });
    setEditIndexForm({ name: index.IndexName, document: index.Document, video: index.Video });
  };

  const cancelEditIndex = () => { setEditingIndex(null); setEditIndexForm({ name: "", document: "", video: "" }); };

  const saveEditIndex = async () => {
    if (!editIndexForm.name.trim()) return toast.warn("Index name required");
    setActionBusy(`editidx:${editingIndex.templateId}`);
    try {
      await updateTrainingIndex(editingIndex.templateId, editingIndex.indexNo, editIndexForm);
      toast.success("Index updated");
      cancelEditIndex();
      loadTemplates();
    } catch (err) { toast.error("Update failed"); }
    finally { setActionBusy(""); }
  };

  const handleDeleteIndex = async (templateId, indexNo, template) => {
    if (template.indices.length <= 1) return toast.warn("A template must have at least one index");
    if (!window.confirm("Delete this index?")) return;
    setActionBusy(`delidx:${templateId}:${indexNo}`);
    try {
      await deleteTrainingIndex(templateId, indexNo);
      toast.success("Index deleted");
      loadTemplates();
    } catch (err) { toast.error(err.response?.data?.error || "Delete failed"); }
    finally { setActionBusy(""); }
  };

  // ================= QUESTION MANAGEMENT =================
  const handleAddQuestion = async () => {
    if (!newQaForm.question || !newQaForm.question.trim()) return toast.warn("Question text required");
    setActionBusy(`addqa:${newQaForm.templateId}`);
    try {
      await addTrainingQuestion({ ...newQaForm });
      toast.success("Question added");
      setNewQaForm({ templateId: "", question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A" });
      loadQuestions(newQaForm.templateId);
    } catch (err) { toast.error("Failed to add question"); }
    finally { setActionBusy(""); }
  };

  // Approved tab me bhi Bulk Q/A add (Excel/CSV sample format) + AI generate
  const [mgBulkRows, setMgBulkRows] = useState([]);
  const [mgAiCount, setMgAiCount] = useState(5);
  const [mgAiLoading, setMgAiLoading] = useState(false);
  const mgDownloadSample = () => { downloadQaSample(); };
  const mgHandleFile = (e, templateId) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        if (rows.length < 2) return toast.warn("Empty file");
        const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
        const qi = headers.findIndex((h) => h.includes("question"));
        const ai = headers.findIndex((h) => h.includes("optiona") || h === "a");
        const bi = headers.findIndex((h) => h.includes("optionb") || h === "b");
        const ci = headers.findIndex((h) => h.includes("optionc") || h === "c");
        const di = headers.findIndex((h) => h.includes("optiond") || h === "d");
        const ki = headers.findIndex((h) => h.includes("correct"));
        if (qi === -1 || ai === -1 || bi === -1 || ki === -1) return toast.error("Sample format follow karo");
        const parsed = rows.slice(1).filter((r) => r && r.some((c) => c)).map((r) => ({
          question: String(r[qi] || "").trim(),
          optionA: String(r[ai] || "").trim(),
          optionB: String(r[bi] || "").trim(),
          optionC: ci !== -1 ? String(r[ci] || "").trim() : "",
          optionD: di !== -1 ? String(r[di] || "").trim() : "",
          correctOption: String(r[ki] || "A").trim().toUpperCase(),
          _tpl: templateId,
        })).filter((q) => q.question && q.optionA && q.optionB && ["A", "B", "C", "D"].includes(q.correctOption));
        if (!parsed.length) return toast.error("Koi valid row nahi mili");
        setMgBulkRows(parsed);
        toast.success(`${parsed.length} Q/A loaded! Neeche edit karke SAVE BULK dabao.`);
      } catch (err) { toast.error("Invalid file"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };
  const mgHandleAi = async (t) => {
    setMgAiLoading(true);
    try {
      const res = await aiGenerateTrainingQuestions({
        topic: t.TemplateName || t.Designation || t.Department,
        designation: t.Designation || t.Department,
        count: mgAiCount,
        documents: (t.indices || []).map((x) => x.Document).filter(Boolean),
        videos: (t.indices || []).map((x) => x.Video).filter(Boolean),
      });
      const list = (res.data.questions || []).map((q) => ({ ...q, _tpl: t.TemplateId }));
      if (!list.length) return toast.warn("AI se kuch nahi bana");
      setMgBulkRows(list);
      toast.success(`${list.length} AI Q/A ready! Edit/remove karke SAVE BULK dabao.`);
    } catch (err) { toast.error(err.response?.data?.error || "AI generate failed"); }
    finally { setMgAiLoading(false); }
  };
  const mgSaveBulk = async (templateId) => {
    const rows = mgBulkRows.filter((r) => r._tpl === templateId).map(({ _tpl, ...q }) => q);
    if (!rows.length) return toast.warn("Pehle file/AI se Q/A load karo");
    setBulkSaving(true);
    try {
      const res = await bulkAddTrainingQuestions(templateId, rows);
      toast.success(res.data.message || "Bulk Q/A added");
      setMgBulkRows(mgBulkRows.filter((r) => r._tpl !== templateId));
      loadQuestions(templateId);
    } catch (err) { toast.error(err.response?.data?.error || "Bulk save failed"); }
    finally { setBulkSaving(false); }
  };

  const startEditQa = (templateId, q) => {
    setEditingQa({ templateId, qaId: q.QaId });
    setEditQaForm({ question: q.Question, optionA: q.OptionA, optionB: q.OptionB, optionC: q.OptionC, optionD: q.OptionD, correctOption: q.CorrectOption });
  };

  const cancelEditQa = () => { setEditingQa(null); setEditQaForm(newQuestionRow()); };

  const saveEditQa = async () => {
    if (!editQaForm.question.trim()) return toast.warn("Question text required");
    setActionBusy(`editqa:${editingQa.qaId}`);
    try {
      await updateTrainingQuestion(editingQa.qaId, editQaForm);
      toast.success("Question updated");
      cancelEditQa();
      loadQuestions(editingQa.templateId);
    } catch (err) { toast.error("Update failed"); }
    finally { setActionBusy(""); }
  };

  const handleDeleteQuestion = async (templateId, qaId) => {
    if (!window.confirm("Delete this question?")) return;
    setActionBusy(`delqa:${qaId}`);
    try {
      await deleteTrainingQuestion(qaId);
      toast.success("Question deleted");
      loadQuestions(templateId);
    } catch (err) { toast.error("Delete failed"); }
    finally { setActionBusy(""); }
  };

  // ============================================================
  // RENDER
  // ============================================================
  const renderAddTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* -------- CREATE TEMPLATE -------- */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="text-lg font-black text-gray-800 mb-4">🏗️ Add New Template</h3>
        <label className="block text-xs font-bold text-gray-600 mb-1">Select Designation * (employee list se auto)</label>
        <select className="w-full border rounded-lg px-3 py-2 mb-3 text-sm bg-white"
          value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
          <option value="">-- Select Designation --</option>
          {deptOptions.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <label className="block text-xs font-bold text-gray-600 mb-1">Template Name *</label>
        <input className="w-full border rounded-lg px-3 py-2 mb-4 text-sm" placeholder="e.g. Sales Training"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <p className="text-[11px] text-gray-500 mb-4 -mt-2">Score system auto (fixed): Document 100 + Video 100 + Q/A 100 = <b>300 / template</b></p>

        {/* Indices */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-black text-gray-700">📑 Training Indices</h4>
          <button onClick={() => setIndices([...indices, { name: `Index ${indices.length + 1}`, document: "", video: "" }])}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">➕ Add Index</button>
        </div>
        <div className="space-y-2 mb-4">
          {indices.map((idx, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
              <div className="flex gap-2 mb-1">
                <input className="flex-1 border rounded px-2 py-1 text-xs font-bold" placeholder={`Index ${i + 1} Name`}
                  value={idx.name} onChange={(e) => { const arr = [...indices]; arr[i].name = e.target.value; setIndices(arr); }} />
                <button onClick={() => indices.length > 1 && setIndices(indices.filter((_, k) => k !== i))}
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs">✕</button>
              </div>
              <input className="w-full border rounded px-2 py-1 text-xs mb-1" placeholder="Document link / name"
                value={idx.document} onChange={(e) => { const arr = [...indices]; arr[i].document = e.target.value; setIndices(arr); }} />
              <input className="w-full border rounded px-2 py-1 text-xs" placeholder="Video link / name"
                value={idx.video} onChange={(e) => { const arr = [...indices]; arr[i].video = e.target.value; setIndices(arr); }} />
            </div>
          ))}
        </div>
      {/* Questions: Manual + Bulk Upload + AI Generate — teeno options hamesha visible */}
        <div className="mb-2">
          <h4 className="text-sm font-black text-gray-700 mb-2">❓ Q/A Upload ({mergedQuestions().length}) — Manual + Bulk + AI</h4>
          {/* 3 option buttons — bada visible panel */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button type="button" onClick={() => setQaMode("manual")}
              className={`px-2 py-2 rounded-lg text-xs font-black border-2 ${qaMode === "manual" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-700 border-blue-300"}`}>
              ✍️<br />Manual<br />One by One
            </button>
            <button type="button" onClick={() => setQaMode("bulk")}
              className={`px-2 py-2 rounded-lg text-xs font-black border-2 ${qaMode === "bulk" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-300"}`}>
              📤<br />Bulk<br />Upload Excel
            </button>
            <button type="button" onClick={() => setQaMode("ai")}
              className={`px-2 py-2 rounded-lg text-xs font-black border-2 ${qaMode === "ai" ? "bg-amber-600 text-white border-amber-600" : "bg-white text-amber-700 border-amber-300"}`}>
              🤖<br />AI<br />Generate
            </button>
          </div>
        </div>
        {/* Manual tab: sirf manual form; Bulk tab: manual + bulk panel; AI tab: manual + AI panel */}
        {(qaMode === "bulk" || qaMode === "ai") && (
          <div className="border-2 border-dashed rounded-lg p-3 mb-2 text-xs border-purple-300 bg-purple-50">
            {qaMode === "bulk" && (
              <div>
                <p className="font-black text-purple-800 mb-1">📤 Bulk Q/A Upload — Excel/CSV, ek baar me kai Q/A</p>
                <p className="text-purple-700 mb-2">Sample download → usi format me bharo → file select → list check/edit → SAVE TEMPLATE.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadQaSample} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700">📥 Sample (Excel)</button>
                  <label className="px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold cursor-pointer hover:bg-purple-700">
                    📁 Select File
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleQaFileUpload} />
                  </label>
                  {bulkQaRows.length > 0 && (
                    <button onClick={() => setBulkQaRows([])} className="px-3 py-1.5 bg-gray-400 text-white rounded-lg font-bold">🧹 Clear ({bulkQaRows.length})</button>
                  )}
                </div>
                <p className="font-bold text-purple-600 mt-2">Format: Question | OptionA | OptionB | OptionC | OptionD | CorrectOption(A/B/C/D)</p>
              </div>
            )}
            {qaMode === "ai" && (
              <div>
                <p className="font-black text-amber-800 mb-1">🤖 AI se Q/A Generate — documents/videos se draft</p>
                <p className="text-amber-700 mb-2">Upar Indices ke links + Template Name se draft banega. Edit/remove/manual-add allowed.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="font-bold text-amber-800">Kitne Q/A:</label>
                  <select value={aiCount} onChange={(e) => setAiCount(parseInt(e.target.value, 10))} className="border rounded-lg px-2 py-1 font-bold">
                    {[3, 5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button onClick={handleAiGenerate} disabled={aiLoading}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-black hover:bg-amber-700 disabled:bg-amber-300">
                    {aiLoading ? "⏳ Generating..." : "🤖 Generate Q/A"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end mb-2">
          <button onClick={() => setQuestions([...questions, newQuestionRow()])}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">➕ Add Question</button>
        </div>
        <div className="space-y-2 mb-2">
          {questions.map((q, i) => (
            <QaRowEditor key={`m-${i}`} q={q} namePrefix={`correct-m-${i}`} canRemove={questions.length > 1 || bulkQaRows.length > 0}
              onChange={(nq) => { const arr = [...questions]; arr[i] = nq; setQuestions(arr); }}
              onRemove={() => questions.length > 1 ? setQuestions(questions.filter((_, k) => k !== i)) : setQuestions([newQuestionRow()])} />
          ))}
        </div>
        {bulkQaRows.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-[11px] font-black text-purple-700">📤 Bulk/AI list ({bulkQaRows.length}) — edit/remove allowed:</p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {bulkQaRows.map((q, i) => (
                <QaRowEditor key={`b-${i}`} q={q} namePrefix={`correct-b-${i}`}
                  onChange={(nq) => { const arr = [...bulkQaRows]; arr[i] = nq; setBulkQaRows(arr); }}
                  onRemove={() => setBulkQaRows(bulkQaRows.filter((_, k) => k !== i))} />
              ))}
            </div>
          </div>
        )}
        {(questions.length === 0 || (questions.length === 1 && !questions[0].question)) && bulkQaRows.length === 0 && (
          <div className="space-y-2 mb-4" />
        )}
        {(qaMode === "manual" || qaMode === "ai") && <div className="mb-2" />}

        <button onClick={handleSubmitTemplate} disabled={saving}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-black text-sm hover:bg-blue-700 disabled:bg-blue-300">
          {saving ? "Saving..." : "💾 SAVE TEMPLATE"}
        </button>
      </div>

      {/* -------- HOW IT WORKS / INFO -------- */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="text-lg font-black text-gray-800 mb-3">📖 Data Flow</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>1️⃣ Admin creates a <b>Template</b> with multiple <b>Indices</b> (Index 1, Index 2 …).</p>
          <p>2️⃣ Each index has its own <b>Document</b> &amp; <b>Video</b>.</p>
          <p>3️⃣ <b>Q/A questions</b> link to Template ID (harr question ko unique <b>QA ID</b> milta hai).</p>
          <p>4️⃣ Saved template <b>Pending</b> me jata hai → <b>Approved Template</b> tab se Approve karein to Doer panel me available ho jata hai. Matching <b>Designation</b> se hoti hai — Common template sabko, baaki sirf usi Designation ke employees ko.</p>
          <p>5️⃣ Doer Index one-by-one complete karta hai → scores <b>EmployeeTrainingData</b> sheet me auto-update hote hain.</p>
          <p>6️⃣ Progress <b>Performance Review</b> tab me track karein.</p>
        </div>
        <div className="mt-4 p-4 bg-amber-100 border border-amber-300 rounded-lg text-xs text-amber-900">
          💡 Document/Video me link paste karein (Google Drive, YouTube, PDF) ya file ka naam. Values MasterTemplateData ke D &amp; E columns me store hoti hain.
        </div>
      </div>
    </div>
  );

  const renderApprovedTab = () => (
    <div className="mb-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl shadow p-4 mb-4">
        <span className="text-sm font-bold text-gray-700">🎖️ Designation:</span>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Designations</option>
          {deptOptions.filter((d) => d !== "COMMON").map((d) => <option key={d} value={d}>{d}</option>)}
          {departments.filter((d) => !deptOptions.includes(d)).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="mx-2">|</span>
        {["Pending", "Approved", "all"].map((t) => (
          <button key={t} onClick={() => setApprovalTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${approvalTab === t ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
            {t === "all" ? "All" : t}
          </button>
        ))}
      </div>

      {loadingTemplates ? (
        <p className="text-center text-gray-500 py-10">⏳ Loading templates...</p>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No templates found in <b>{approvalTab === "all" ? "any" : approvalTab}</b> status.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.TemplateId} className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-gray-800">{t.TemplateName || t.TemplateId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${APPROVAL_BADGE[t.Approval] || APPROVAL_BADGE.Pending}`}>{t.Approval}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    🆔 {t.TemplateId} &nbsp;•&nbsp; 🎖️ {t.Designation || t.Department} &nbsp;•&nbsp; 📑 {t.indices.length} Index{t.indices.length !== 1 ? "es" : ""} &nbsp;•&nbsp; ❓ {t.QuestionCount || 0} Q &nbsp;•&nbsp; 🎯 {t.TemplateScore || 100}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleExpand(t)} disabled={actionBusy === `exp:${t.TemplateId}`}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:bg-indigo-300">
                    {actionBusy === `exp:${t.TemplateId}` ? "⏳ Loading..." : expandId === t.TemplateId ? "▲ Hide" : "▼ Manage Indices / Q/A"}
                  </button>
                  {t.Approval !== "Approved" ? (
                    <button onClick={() => handleApproval(t.TemplateId, "Approved")} disabled={!!actionBusy}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:bg-emerald-300">
                      {actionBusy === `ap:${t.TemplateId}` ? "⏳ Approving..." : "✅ Approve"}
                    </button>
                  ) : (
                    <button onClick={() => handleApproval(t.TemplateId, "Pending")} disabled={!!actionBusy}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:bg-amber-300">
                      {actionBusy === `ap:${t.TemplateId}` ? "⏳ Moving..." : "⏸ To Pending"}
                    </button>
                  )}
                  <button onClick={() => handleDeleteTemplate(t)} disabled={!!actionBusy}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:bg-red-300">
                    {actionBusy === `del:${t.TemplateId}` ? "⏳ Deleting..." : "🗑 Delete"}
                  </button>
                </div>
              </div>
              {/* Expanded details */}
              {expandId === t.TemplateId && (
                <div className="px-4 py-3">
                  <h5 className="text-xs font-black text-gray-600 mb-1">📑 Indices</h5>
                  <div className="space-y-2">
                    {t.indices.map((idx, n) => (
                      <div key={n} className="border border-gray-200 rounded-lg p-2 flex flex-wrap items-center gap-2 bg-gray-50">
                        <span className="text-xs font-black text-gray-600">#{n + 1}</span>
                        {editingIndex && editingIndex.templateId === t.TemplateId && editingIndex.indexNo === n + 1 ? (
                          <>
                            <input className="border rounded px-2 py-1 text-xs" placeholder="Index Name" value={editIndexForm.name}
                              onChange={(e) => setEditIndexForm({ ...editIndexForm, name: e.target.value })} />
                            <input className="border rounded px-2 py-1 text-xs" placeholder="Document link/name" value={editIndexForm.document}
                              onChange={(e) => setEditIndexForm({ ...editIndexForm, document: e.target.value })} />
                            <input className="border rounded px-2 py-1 text-xs" placeholder="Video link/name" value={editIndexForm.video}
                              onChange={(e) => setEditIndexForm({ ...editIndexForm, video: e.target.value })} />
                            <button onClick={saveEditIndex} disabled={actionBusy === `editidx:${t.TemplateId}`} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs disabled:bg-emerald-300">{actionBusy === `editidx:${t.TemplateId}` ? "⏳..." : "💾 Save"}</button>
                            <button onClick={cancelEditIndex} className="px-2 py-1 bg-gray-300 rounded text-xs">Cancel</button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-bold text-gray-700">{idx.IndexName}</span>
                            <a href={idx.Document || "#"} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline truncate max-w-[160px]">📄 {idx.Document || "No doc"}</a>
                            <a href={idx.Video || "#"} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline truncate max-w-[160px]">🎬 {idx.Video || "No video"}</a>
                            <div className="flex gap-1">
                              <button onClick={() => startEditIndex(t.TemplateId, n + 1, idx)}
                                className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">✏️ Edit</button>
                              <button onClick={() => handleDeleteIndex(t.TemplateId, n + 1, t)} disabled={actionBusy === `delidx:${t.TemplateId}:${n + 1}`}
                                className="px-2 py-1 bg-red-600 text-white rounded text-xs disabled:bg-red-300">{actionBusy === `delidx:${t.TemplateId}:${n + 1}` ? "⏳" : "🗑"}</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 border border-dashed border-indigo-300 rounded-lg p-2 flex flex-wrap gap-2 items-center bg-indigo-50">
                    <span className="text-xs font-black text-indigo-700">➕ Add Index:</span>
                    <input className="border rounded px-2 py-1 text-xs" placeholder="Index Name"
                      value={newIndexForm.templateId === t.TemplateId ? newIndexForm.name : ""}
                      onChange={(e) => setNewIndexForm({ templateId: t.TemplateId, name: e.target.value, document: newIndexForm.document, video: newIndexForm.video })} />
                    <input className="border rounded px-2 py-1 text-xs w-44" placeholder="Document link/name"
                      value={newIndexForm.templateId === t.TemplateId ? newIndexForm.document : ""}
                      onChange={(e) => setNewIndexForm({ templateId: t.TemplateId, name: newIndexForm.name, document: e.target.value, video: newIndexForm.video })} />
                    <input className="border rounded px-2 py-1 text-xs w-44" placeholder="Video link/name"
                      value={newIndexForm.templateId === t.TemplateId ? newIndexForm.video : ""}
                      onChange={(e) => setNewIndexForm({ templateId: t.TemplateId, name: newIndexForm.name, document: newIndexForm.document, video: e.target.value })} />
                    <button onClick={handleAddIndex} disabled={actionBusy === `addidx:${t.TemplateId}`} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs disabled:bg-indigo-300">{actionBusy === `addidx:${t.TemplateId}` ? "⏳ Adding..." : "Add"}</button>
                  </div>
                  {/* Questions — manual + bulk upload + AI generate */}
                  <h5 className="text-xs font-black text-gray-600 mb-1 mt-3">❓ Q/A Test Questions (Manual + Bulk + AI)</h5>
                  <div className="border-2 border-dashed rounded-lg p-2 mb-2 text-xs border-purple-300 bg-purple-50 flex flex-wrap gap-2 items-center">
                    <button onClick={mgDownloadSample} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold">📥 Sample</button>
                    <label className="px-2 py-1 bg-purple-600 text-white rounded font-bold cursor-pointer">
                      📁 Bulk File
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => mgHandleFile(e, t.TemplateId)} />
                    </label>
                    <select value={mgAiCount} onChange={(e) => setMgAiCount(parseInt(e.target.value, 10))} className="border rounded px-1 py-1">
                      {[3, 5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n} Q/A</option>)}
                    </select>
                    <button onClick={() => mgHandleAi(t)} disabled={mgAiLoading} className="px-2 py-1 bg-amber-600 text-white rounded font-black disabled:bg-amber-300">
                      {mgAiLoading ? "⏳..." : "🤖 AI Generate"}
                    </button>
                    {mgBulkRows.filter((r) => r._tpl === t.TemplateId).length > 0 && (
                      <button onClick={() => mgSaveBulk(t.TemplateId)} disabled={bulkSaving} className="px-2 py-1 bg-blue-600 text-white rounded font-black disabled:bg-blue-300">
                        {bulkSaving ? "⏳ Saving..." : `💾 Save Bulk (${mgBulkRows.filter((r) => r._tpl === t.TemplateId).length})`}
                      </button>
                    )}
                  </div>
                  {mgBulkRows.filter((r) => r._tpl === t.TemplateId).length > 0 && (
                    <div className="space-y-1 mb-2 max-h-52 overflow-auto">
                      {mgBulkRows.filter((r) => r._tpl === t.TemplateId).map((q, bi) => {
                        const gi = mgBulkRows.findIndex((r) => r._tpl === t.TemplateId && r.question === q.question && r.optionA === q.optionA);
                        return (
                          <div key={bi} className="border border-purple-200 rounded-lg p-2 bg-white">
                            <div className="flex gap-1 mb-1">
                              <input className="flex-1 border rounded px-2 py-1 text-xs font-bold" value={q.question}
                                onChange={(e) => { const arr = [...mgBulkRows]; arr[gi] = { ...arr[gi], question: e.target.value }; setMgBulkRows(arr); }} />
                              <button onClick={() => { const arr = [...mgBulkRows]; arr.splice(gi, 1); setMgBulkRows(arr); }} className="px-2 py-1 bg-red-600 text-white rounded text-xs">✕</button>
                            </div>
                            <div className="grid grid-cols-4 gap-1 mb-1">
                              {["A", "B", "C", "D"].map((opt) => (
                                <input key={opt} className="border rounded px-1 py-1 text-xs" value={q[`option${opt}`] || ""}
                                  onChange={(e) => { const arr = [...mgBulkRows]; arr[gi] = { ...arr[gi], [`option${opt}`]: e.target.value }; setMgBulkRows(arr); }} />
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-500">Correct:</span>
                              {["A", "B", "C", "D"].map((opt) => (
                                <label key={opt} className="flex items-center gap-1 text-[11px]">
                                  <input type="radio" name={`mg-${t.TemplateId}-${bi}`} checked={(q.correctOption || "A") === opt}
                                    onChange={() => { const arr = [...mgBulkRows]; arr[gi] = { ...arr[gi], correctOption: opt }; setMgBulkRows(arr); }} /> {opt}
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(qaMap[t.TemplateId] || []).length === 0 ? (
                    <p className="text-xs text-gray-400">No questions yet. Use the form below to add.</p>
                  ) : (
                    <div className="space-y-2">
                      {(qaMap[t.TemplateId] || []).map((q, qi) => (
                        <div key={q.QaId} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-black text-gray-700">Q{qi + 1}. {q.Question}</span>
                            <div className="flex gap-1">
                              <button onClick={() => startEditQa(t.TemplateId, q)}
                                className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">✏️</button>
                              <button onClick={() => handleDeleteQuestion(t.TemplateId, q.QaId)} disabled={actionBusy === `delqa:${q.QaId}`}
                                className="px-2 py-1 bg-red-600 text-white rounded text-xs disabled:bg-red-300">{actionBusy === `delqa:${q.QaId}` ? "⏳" : "🗑"}</button>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            <span className={q.CorrectOption === "A" ? "text-emerald-700 font-bold" : ""}>A) {q.OptionA || "-"}</span> &nbsp;
                            <span className={q.CorrectOption === "B" ? "text-emerald-700 font-bold" : ""}>B) {q.OptionB || "-"}</span> &nbsp;
                            <span className={q.CorrectOption === "C" ? "text-emerald-700 font-bold" : ""}>C) {q.OptionC || "-"}</span> &nbsp;
                            <span className={q.CorrectOption === "D" ? "text-emerald-700 font-bold" : ""}>D) {q.OptionD || "-"}</span>
                          </div>
                          <div className="text-xs text-emerald-700 mt-1">✅ Correct: {q.CorrectOption}</div>
                          {editingQa && editingQa.qaId === q.QaId && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <input className="border rounded px-2 py-1 text-xs flex-1" placeholder="Question" value={editQaForm.question}
                                onChange={(e) => setEditQaForm({ ...editQaForm, question: e.target.value })} />
                              {["A", "B", "C", "D"].map((opt) => (
                                <input key={opt} className="border rounded px-2 py-1 text-xs w-28" placeholder={`Opt ${opt}`} value={editQaForm[`option${opt}`]}
                                  onChange={(e) => setEditQaForm({ ...editQaForm, [`option${opt}`]: e.target.value })} />
                              ))}
                              <select value={editQaForm.correctOption} className="border rounded px-2 py-1 text-xs"
                                onChange={(e) => setEditQaForm({ ...editQaForm, correctOption: e.target.value })}>
                                {["A", "B", "C", "D"].map((o) => <option key={o} value={o}>Correct: {o}</option>)}
                              </select>
                              <button onClick={saveEditQa} disabled={!!actionBusy} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs disabled:bg-emerald-300">{actionBusy === `editqa:${editingQa.qaId}` ? "⏳..." : "💾 Save"}</button>
                              <button onClick={cancelEditQa} className="px-2 py-1 bg-gray-300 rounded text-xs">Cancel</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 border border-dashed border-emerald-300 rounded-lg p-2 flex flex-wrap gap-2 items-center bg-emerald-50">
                    <span className="text-xs font-black text-emerald-700">➕ Add Question:</span>
                    <input className="border rounded px-2 py-1 text-xs flex-1" placeholder="Question"
                      value={newQaForm.templateId === t.TemplateId ? newQaForm.question : ""}
                      onChange={(e) => setNewQaForm({ ...newQaForm, templateId: t.TemplateId, question: e.target.value })} />
                    {["A", "B", "C", "D"].map((opt) => (
                      <input key={opt} className="border rounded px-2 py-1 text-xs w-24" placeholder={`Opt ${opt}`}
                        value={newQaForm.templateId === t.TemplateId ? newQaForm[`option${opt}`] : ""}
                        onChange={(e) => setNewQaForm({ ...newQaForm, templateId: t.TemplateId, [`option${opt}`]: e.target.value })} />
                    ))}
                    <select value={newQaForm.templateId === t.TemplateId ? newQaForm.correctOption : "A"} className="border rounded px-2 py-1 text-xs"
                      onChange={(e) => setNewQaForm({ ...newQaForm, templateId: t.TemplateId, correctOption: e.target.value })}>
                      {["A", "B", "C", "D"].map((o) => <option key={o} value={o}>Correct: {o}</option>)}
                    </select>
                    <button onClick={handleAddQuestion} disabled={actionBusy === `addqa:${t.TemplateId}`} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs disabled:bg-emerald-300">{actionBusy === `addqa:${t.TemplateId}` ? "⏳ Adding..." : "Add"}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReviewTab = () => {
    // Backend se assigned rows aati hain: har row me Type ("Common"/"Dept") + Started flag hota hai.
    // Type "Dept" ka matlab = employee ki DESIGNATION ka template (Common ke alawa).
    // summary me kabhi common missing na ho — rows se fallback counts nikalo.
    const selectedEmpRecords = records;
    const commonRecords = selectedEmpRecords.filter((r) => r.Type === "Common");
    const deptRecords = selectedEmpRecords.filter((r) => r.Type !== "Common");
    const S = summary || { common: {}, dept: {}, total: {}, templateCounts: {} };
    const fb = (rows) => ({
      assigned: rows.length,
      pending: rows.filter((r) => r.Status === "Pending").length,
      inProgress: rows.filter((r) => r.Status === "In Progress").length,
      completed: rows.filter((r) => r.Status === "Completed").length,
      totalEarned: rows.reduce((s, r) => s + (parseInt(r.TotalScore, 10) || 0), 0),
      totalMax: rows.length * 300,
    });
    // backend summary prefer karo, missing ho to rows se fallback
    const cS = (S.common && S.common.assigned !== undefined) ? S.common : { ...fb(commonRecords) };
    const dS = (S.dept && S.dept.assigned !== undefined) ? S.dept : { ...fb(deptRecords) };
    const tS = (S.total && S.total.assigned !== undefined) ? S.total : { ...fb(selectedEmpRecords) };
    // status filter sirf table pe lagta hai; cards hamesha assigned (all-status) summary dikhate hain
    const overallPct = tS.totalMax ? Math.round((tS.totalEarned / tS.totalMax) * 100) : 0;

    const statusCards = [
      { k: "all", label: "All", count: (cS.assigned || 0) + (dS.assigned || 0) },
      { k: "Pending", label: "Pending", count: tS.pending || 0 },
      { k: "In Progress", label: "In Progress", count: tS.inProgress || 0 },
      { k: "Completed", label: "Completed", count: tS.completed || 0 },
    ];

    return (
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl shadow p-4">
          <span className="text-sm font-bold text-gray-700">👤 Select Employee:</span>
          <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm font-bold">
            <option value="all">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.employeeID || emp.name} value={emp.name}>{emp.name} ({emp.Designation || emp.department || emp.Department || "-"})</option>
            ))}
          </select>
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-sm font-bold text-gray-700">🎖️ Designation:</span>
          <select value={deptReviewFilter} onChange={(e) => setDeptReviewFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm font-bold">
            <option value="all">All (Common + Designation)</option>
            <option value="Common">Common only</option>
            {deptOptions.filter((d) => d !== "COMMON").map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <span className="mx-2 text-gray-300">|</span>
          {statusCards.map((st) => (
            <button key={st.k} onClick={() => setStatusFilter(st.k)}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${statusFilter === st.k ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
              {st.label} ({st.count})
            </button>
          ))}
        </div>

        {loadingRecords ? (
          <p className="text-center text-gray-500 py-10">⏳ Loading records...</p>
        ) : (
          <>
            {/* ===== TOP SCORE CARDS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl shadow-lg p-5">
                <p className="text-xs uppercase opacity-80 font-bold">🏆 Total Learning (Common + Designation)</p>
                <p className="text-4xl font-black mt-2">{tS.assigned || 0}</p>
                <p className="text-xs opacity-90 mt-1">✅ {tS.completed || 0} Done • 🔄 {tS.inProgress || 0} Prog • ⏳ {tS.pending || 0} Pend</p>
                <p className="text-xs font-black mt-2">🎯 Score: {tS.totalEarned || 0}/{tS.totalMax || 0} ({overallPct}%)</p>
                <div className="h-2 bg-blue-300 rounded mt-2">
                  <div className="h-2 bg-white rounded" style={{ width: `${overallPct}%` }} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-xl shadow-lg p-5">
                <p className="text-xs uppercase opacity-80 font-bold">📒 Common Learning</p>
                <p className="text-4xl font-black mt-2">{cS.assigned || 0}</p>
                <p className="text-xs opacity-90 mt-1">✅ {cS.completed || 0} • 🔄 {cS.inProgress || 0} • ⏳ {cS.pending || 0}</p>
                <p className="text-xs opacity-90 mt-1">🎯 Score: <b>{cS.totalEarned || 0}/{cS.totalMax || 0}</b></p>
                <button
                  onClick={() => setShowDetails({ common: !showDetails.common, dept: false })}
                  className="mt-3 inline-flex items-center gap-1 text-xs bg-white text-emerald-700 px-3 py-1.5 rounded-full font-black hover:bg-emerald-50"
                >
                  ✅ Completed: {cS.completed || 0}
                  <span className="text-[10px]">{showDetails.common ? "▲" : "▼"}</span>
                </button>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-xl shadow-lg p-5">
                <p className="text-xs uppercase opacity-80 font-bold">🎖️ Designation Learning</p>
                <p className="text-4xl font-black mt-2">{dS.assigned || 0}</p>
                <p className="text-xs opacity-90 mt-1">✅ {dS.completed || 0} • 🔄 {dS.inProgress || 0} • ⏳ {dS.pending || 0}</p>
                <p className="text-xs opacity-90 mt-1">🎯 Score: <b>{dS.totalEarned || 0}/{dS.totalMax || 0}</b></p>
                <button
                  onClick={() => setShowDetails({ common: false, dept: !showDetails.dept })}
                  className="mt-3 inline-flex items-center gap-1 text-xs bg-white text-purple-700 px-3 py-1.5 rounded-full font-black hover:bg-purple-50"
                >
                  ✅ Completed: {dS.completed || 0}
                  <span className="text-[10px]">{showDetails.dept ? "▲" : "▼"}</span>
                </button>
              </div>
            </div>

            {/* ===== QUICK STATS ===== */}
            <div className="bg-white rounded-xl shadow p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Total Trainings (ID-wise)</p>
                <p className="text-2xl font-black text-gray-700">{tS.assigned || 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Common Trainings (ID-wise)</p>
                <p className="text-2xl font-black text-emerald-700">{cS.assigned || 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Designation Trainings (ID-wise)</p>
                <p className="text-2xl font-black text-purple-700">{dS.assigned || 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Overall %</p>
                <p className="text-2xl font-black text-blue-700">{overallPct}%</p>
              </div>
            </div>

            {/* ===== INDIVIDUAL DETAILS (expandable) ===== */}
            {(showDetails.common || showDetails.dept) && (
              <div className="bg-white rounded-xl shadow p-4">
                <h4 className="text-sm font-black text-gray-700 mb-3">
                  {showDetails.common ? "📒 Common Training Details (Individual)" : "🎖️ Designation Training Details (Individual)"}
                </h4>
                {(() => {
                  const list = showDetails.common ? commonRecords : deptRecords;
                  if (list.length === 0)
                    return <p className="text-xs text-gray-500 text-center py-4">Koi record nahi mila.</p>;
                  return (
                    <div className="space-y-2">
                      {list.map((r, i) => (
                        <div key={i} className="border border-gray-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-2 hover:bg-gray-50">
                          <div className="flex-1 min-w-[180px]">
                            <p className="text-sm font-black text-gray-700">{r.TemplateName || r.TemplateId}</p>
                            <p className="text-[10px] text-gray-400">{r.TemplateId}</p>
                            <p className="text-[10px] text-gray-500 mt-1">🎖️ <b>{r.TemplateDesignation || r.TemplateDepartment || r.Designation || r.Department || "Common"}</b> &nbsp;|&nbsp; 🎯 Score: <b>{r.TotalScore}/300</b>{!r.Started ? " • ⏳ Not started" : ""}</p>
                          </div>
                          <div className="text-[11px] text-gray-600">
                            <p>📅 Start: <b>{r.StartDate || "-"}</b></p>
                            <p>📅 End: <b>{r.EndDate || "-"}</b></p>
                          </div>
                          <div>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STATUS_BADGE[r.Status] || STATUS_BADGE.Pending}`}>{r.Status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ===== FULL TABLE ===== */}
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left text-xs text-gray-600">
                    <th className="px-3 py-2">Template</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2 text-center">📄 Doc</th>
                    <th className="px-3 py-2 text-center">🎬 Video</th>
                    <th className="px-3 py-2 text-center">❓ Q/A</th>
                    <th className="px-3 py-2 text-center">🎯 Total</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEmpRecords.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-6 text-gray-500 text-xs">Is filter me koi assigned learning nahi mili.</td></tr>
                  ) : selectedEmpRecords.map((r, i) => {
                    const pct = Math.min(100, Math.round((r.TotalScore / 300) * 100));
                    const isCommon = r.Type === "Common";
                    return (
                      <tr key={i} className={`border-t border-gray-200 hover:bg-gray-50 ${!r.Started ? "bg-amber-50/50" : ""}`}>
                        <td className="px-3 py-2 text-xs font-bold text-gray-700">
                          {r.TemplateName || r.TemplateId}
                          <br /><span className="text-[10px] text-gray-400">{r.TemplateId}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isCommon ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"}`}>
                            {isCommon ? "📒 Common" : `🎖️ ${r.TemplateDesignation || r.TemplateDepartment || r.Designation || r.Department || "-"}`}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">{r.EmployeeName}<br /><span className="text-[10px] text-gray-400">{r.Designation || r.Department}</span></td>
                        <td className="px-3 py-2 text-center">{r.DocumentScore}</td>
                        <td className="px-3 py-2 text-center">{r.VideoScore}</td>
                        <td className="px-3 py-2 text-center">{r.QaScore}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-blue-700">{r.TotalScore}</span>
                            <div className="flex-1 h-1.5 bg-blue-100 rounded">
                              <div className="h-1.5 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_BADGE[r.Status] || STATUS_BADGE.Pending}`}>{r.Status}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">{r.StartDate || "-"}</td>
                        <td className="px-3 py-2 text-xs">{r.EndDate || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex flex-wrap justify-between gap-4 mb-6">
        <h1 className="text-xl font-black">🎓 Training Module</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTab("add")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "add" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}>🏗️ Add Template</button>
          <button onClick={() => setTab("approved")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "approved" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}>✅ Approved Template</button>
          <button onClick={() => setTab("review")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "review" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}>📊 Performance Review</button>
        </div>
      </div>

      {tab === "add" && renderAddTab()}
      {tab === "approved" && renderApprovedTab()}
      {tab === "review" && renderReviewTab()}
    </div>
  );
}