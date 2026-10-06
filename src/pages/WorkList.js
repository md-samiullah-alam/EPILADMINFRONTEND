import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAllEmployees, getAllWorklists, createWorklist, updateWorklistAdmin, deleteWorklistAdmin, bulkUploadWorklists, downloadWorklists, getAdminOccupancy, updateAITime, getAISheet } from "../api/services";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Yearly"];
const WORKING_TIMES = ["10M","15M","20M","30M", "45M", "60M", "90M", "120M", "150M", "180M", "210M", "240M", "300M"];
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_DATES = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PAGE_SIZE = 20;

export default function AdminWorkList() {
  const [activeTab, setActiveTab] = useState("worklist"); // "worklist" | "occupancy" | "aisheet"

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
  
  const [occupancyDate, setOccupancyDate] = useState(new Date().toISOString().slice(0,10));
  const [occupancyData, setOccupancyData] = useState(null);
  const [loadingOcc, setLoadingOcc] = useState(false);
  const [sortOrder, setSortOrder] = useState("top");

  const [showAIModal, setShowAIModal] = useState(false);
  const [aiWorklist, setAiWorklist] = useState(null);
  const [selectedAITime, setSelectedAITime] = useState("");
  const [aiSaving, setAiSaving] = useState(false);

  const [aiSheetData, setAISheetData] = useState([]);
  const [loadingAISheet, setLoadingAISheet] = useState(false);

  // New state for worklist sorting
  const [worklistSortOrder, setWorklistSortOrder] = useState("top"); // "top" | "bottom"

  const bulkModalRef = useRef();
  const addModalRef = useRef();
  const aiModalRef = useRef();

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

  const fetchOccupancy = useCallback(async () => {
    if (activeTab !== "occupancy") return;
    setLoadingOcc(true);
    try {
      const res = await getAdminOccupancy(occupancyDate);
      setOccupancyData(res.data);
    } catch (err) { toast.error("Failed to load occupancy data"); console.error(err); }
    finally { setLoadingOcc(false); }
  }, [occupancyDate, activeTab]);

  useEffect(() => { if (activeTab === "occupancy") fetchOccupancy(); }, [fetchOccupancy, activeTab]);

  const fetchAISheet = useCallback(async () => {
    if (activeTab !== "aisheet") return;
    setLoadingAISheet(true);
    try {
      const res = await getAISheet({ employeeName: selectedEmp === "all" ? "" : selectedEmp });
      setAISheetData(res.data.data || []);
    } catch (err) { toast.error("Failed to load AI Sheet data"); console.error(err); }
    finally { setLoadingAISheet(false); }
  }, [activeTab, selectedEmp]);

  useEffect(() => { if (activeTab === "aisheet") fetchAISheet(); }, [fetchAISheet, activeTab]);

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

  const openAITimeSheet = (wl) => {
    setAiWorklist(wl);
    setSelectedAITime(wl.AITime || "");
    setShowAIModal(true);
  };

  const closeAIModal = () => {
    setShowAIModal(false);
    setAiWorklist(null);
    setSelectedAITime("");
  };

  const handleSaveAITime = async () => {
    if (!selectedAITime || !selectedAITime.trim()) return toast.warn("Please select AI Time");
    setAiSaving(true);
    try {
      await updateAITime(aiWorklist.WorkListId, selectedAITime);
      toast.success("AI Time updated successfully!");
      closeAIModal();
      loadWorklists();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to update AI Time"); }
    finally { setAiSaving(false); }
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
      const payload = { WorklistName: form.WorklistName, Frequency: form.Frequency, WorkingTime: form.WorkingTime, TemplateLink: isUrl ? val : "", Remark: !isUrl ? val : "", ScheduleDays: schedule.scheduleDays, ScheduleDates: schedule.scheduleDates };
      if (editing) await updateWorklistAdmin(editing.WorkListId, { ...payload, EmployeeName: form.EmployeeName });
      else await createWorklist({ ...payload, EmployeeName: form.EmployeeName });
      toast.success(editing ? "Updated" : "Created");
      closeModal(); loadWorklists();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

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

  const downloadSamplePDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(16); doc.text("Sample Bulk Upload Format", 14, 20);
      doc.setFontSize(10); doc.text("Follow this exact format for bulk upload:", 14, 30);
      autoTable(doc, {
        startY: 40,
        head: [["WorklistName", "Frequency", "WorkingTime", "ScheduleDays", "ScheduleDates", "TemplateLinkRemark"]],
        body: [["Daily Sales Report","Daily","60M","","","https://docs.google.com/..."],["Weekly Team Meeting","Weekly","90M","Monday,Wednesday,Friday","","Meeting agenda and minutes"],["Monthly Performance Review","Monthly","120M","","1,15,30","https://docs.google.com/..."],["Annual Report","Yearly","180M","","December 25","Year end report preparation"]],
        theme: "grid",
        headStyles: { fillColor: [41,128,185], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        columnStyles: { 0:{cellWidth:40,halign:'left'}, 1:{cellWidth:25,halign:'center'}, 2:{cellWidth:25,halign:'center'}, 3:{cellWidth:45,halign:'left'}, 4:{cellWidth:25,halign:'center'}, 5:{cellWidth:55,halign:'left'} },
        margin: { left: 10, right: 10, top: 35 }
      });
      doc.save("Sample_Bulk_Upload_Format.pdf");
      toast.success("✅ Sample PDF format downloaded!");
    } catch (err) { console.error("PDF Error:", err); toast.error("PDF download failed."); }
  };

  const downloadPDFReport = () => {
    if (!worklists.length) return toast.info("No data to download");
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(16); doc.setFont("helvetica","bold"); doc.text("WorkList Management Report", 14, 20);
      doc.setFontSize(10); doc.setFont("helvetica","normal");
      doc.text(`Generated: ${new Date().toLocaleString()}`,14,30);
      doc.text(`Total Worklists: ${worklists.length}`,14,36);
      doc.text(`Employee Filter: ${selectedEmp==="all"?"All Employees":selectedEmp}`,14,42);
      doc.text(`Search: ${search||"None"}`,14,48);
      const tableData = worklists.map((wl,idx)=>[(idx+1).toString(),wl.EmployeeName||"-",wl.WorklistName||"-",wl.Frequency||"-",(wl.ScheduleDays||wl.ScheduleDates||"Every day")||"-",wl.WorkingTime||"-",wl.AITime||"-",(wl.TemplateLink||wl.Remark||"-").substring(0,60)]);
      autoTable(doc,{startY:55,head:[["#","Employee","Worklist","Freq","Schedule","Time","AI Time","Link/Remark"]],body:tableData,theme:"grid",headStyles:{fillColor:[41,128,185],textColor:255,fontSize:9,fontStyle:'bold',halign:'center',valign:'middle'},bodyStyles:{fontSize:8,cellPadding:3,valign:'middle'},alternateRowStyles:{fillColor:[245,245,245]},columnStyles:{0:{cellWidth:10,halign:'center'},1:{cellWidth:30,halign:'left'},2:{cellWidth:45,halign:'left'},3:{cellWidth:20,halign:'center'},4:{cellWidth:35,halign:'left'},5:{cellWidth:18,halign:'center'},6:{cellWidth:18,halign:'center'},7:{cellWidth:55,halign:'left'}},margin:{top:50,left:10,right:10,bottom:10},pageBreak:'auto',rowPageBreak:'avoid',didDrawPage:function(data){doc.setFontSize(8);doc.setFont("helvetica","italic");doc.text(`Page ${data.pageNumber}`,doc.internal.pageSize.width-20,doc.internal.pageSize.height-10);doc.text(`WorkList Management System`,doc.internal.pageSize.width/2,doc.internal.pageSize.height-10,{align:'center'});}});
      doc.save(`WorkList_Report_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (err) { console.error("PDF Error:",err); toast.error("PDF download failed: "+err.message); }
  };

  const downloadAISheetPDF = () => {
    if (!aiSheetData.length) return toast.info("No AI Sheet data to download");
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(16); doc.setFont("helvetica","bold"); doc.text("AI Analysis Sheet - Time Reduction Report",14,20);
      doc.setFontSize(10); doc.setFont("helvetica","normal");
      doc.text(`Generated: ${new Date().toLocaleString()}`,14,30);
      doc.text(`Employee Filter: ${selectedEmp==="all"?"All Employees":selectedEmp}`,14,36);
      doc.text(`Total Tasks: ${aiSheetData.length}`,14,42);
      const tableData = aiSheetData.map((item,idx)=>[(idx+1).toString(),item.EmployeeName||"-",item.TaskName,item.Frequency,item.OriginalTime,item.ReducedTime,item.PercentageFaster]);
      autoTable(doc,{startY:50,head:[["#","Employee","Task Name","Freq","Original Time","AI/Portal Time","% Faster"]],body:tableData,theme:"grid",headStyles:{fillColor:[16,185,129],textColor:255,fontSize:9,fontStyle:'bold',halign:'center',valign:'middle'},bodyStyles:{fontSize:8,cellPadding:3,valign:'middle'},alternateRowStyles:{fillColor:[240,253,244]},columnStyles:{0:{cellWidth:10,halign:'center'},1:{cellWidth:35,halign:'left'},2:{cellWidth:55,halign:'left'},3:{cellWidth:20,halign:'center'},4:{cellWidth:25,halign:'center'},5:{cellWidth:30,halign:'center'},6:{cellWidth:25,halign:'center'}},margin:{top:50,left:10,right:10,bottom:10},pageBreak:'auto',didDrawPage:function(data){doc.setFontSize(8);doc.setFont("helvetica","italic");doc.text(`Page ${data.pageNumber}`,doc.internal.pageSize.width-20,doc.internal.pageSize.height-10);doc.text(`AI Analysis Sheet Report`,doc.internal.pageSize.width/2,doc.internal.pageSize.height-10,{align:'center'});}});
      doc.save(`AI_Sheet_Report_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("AI Sheet PDF downloaded successfully");
    } catch (err) { console.error("PDF Error:",err); toast.error("PDF download failed: "+err.message); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result,{type:"binary"});
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
        if(rows.length<2) return toast.warn("Empty file");
        const headers = rows[0].map(h=>String(h).trim().toLowerCase());
        const nameIdx = headers.findIndex(h=>h.includes("worklistname"));
        const freqIdx = headers.findIndex(h=>h.includes("frequency"));
        const timeIdx = headers.findIndex(h=>h.includes("workingtime"));
        const daysIdx = headers.findIndex(h=>h.includes("scheduledays"));
        const datesIdx = headers.findIndex(h=>h.includes("scheduledates"));
        const parsed = rows.slice(1).filter(r=>r&&r.some(c=>c)).map((r,i)=>({row:i+2,WorklistName:String(r[nameIdx]||"").trim(),Frequency:String(r[freqIdx]||"Daily").trim(),WorkingTime:String(r[timeIdx]||"").trim(),ScheduleDays:daysIdx!==-1?String(r[daysIdx]||"").trim():"",ScheduleDates:datesIdx!==-1?String(r[datesIdx]||"").trim():"",TemplateLink:"",Remark:""})).filter(d=>d.WorklistName&&d.Frequency&&d.WorkingTime);
        setBulkData(parsed);setBulkResult(null);
        toast.success(`${parsed.length} rows loaded`);
      } catch(err) { toast.error("Invalid file format"); }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    if(!bulkData.length) return toast.warn("No data");
    if(selectedEmp==="all") return toast.warn("Select employee first");
    setUploading(true);
    try {
      const res = await bulkUploadWorklists(bulkData.map(d=>({...d,EmployeeName:selectedEmp})));
      setBulkResult(res.data);
      toast.success(`Uploaded ${res.data?.summary?.created||0} worklists`);
      loadWorklists(); setBulkData([]);
    } catch(err) { toast.error("Bulk upload failed"); }
    finally { setUploading(false); }
  };

  const handleDownload = async (type="all") => {
    try {
      const res = await downloadWorklists({employeeName:type==="all"?"all":selectedEmp});
      const data = res.data.data||[];
      if(!data.length) return toast.info("No data");
      const ws = XLSX.utils.json_to_sheet(data.map(d=>({WorklistName:d.WorklistName,Frequency:d.Frequency,WorkingTime:d.WorkingTime,ScheduleDays:d.ScheduleDays||"",ScheduleDates:d.ScheduleDates||"",TemplateLinkRemark:d.TemplateLink||d.Remark||"",AITime:d.AITime||""})));
      ws['!cols']=[{wch:30},{wch:12},{wch:10},{wch:25},{wch:15},{wch:55},{wch:12}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"WorkList");
      XLSX.writeFile(wb,`WorkList_${type}_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success("Excel Downloaded");
    } catch(err) { console.error(err); toast.error("Download failed"); }
  };

  const closeBulkModal = () => { setShowBulk(false); setBulkData([]); setBulkResult(null); };

  const downloadOccupancyPDF = () => {
    if(!occupancyData?.occupancyList) return toast.info("No data to download");
    try {
      const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      doc.setFontSize(16); doc.setFont("helvetica","bold"); doc.text("Occupancy Report",14,20);
      doc.setFontSize(10); doc.setFont("helvetica","normal");
      doc.text(`Date: ${occupancyDate}`,14,30);
      doc.text(`Generated: ${new Date().toLocaleString()}`,14,36);
      doc.text(`Avg Occupancy: ${occupancyData.summary.averageOccupancy}%  |  Overloaded: ${occupancyData.summary.overloadedCount}  |  Underloaded: ${occupancyData.summary.underloadedCount}  |  Total: ${occupancyData.summary.totalEmployees}`,14,42);
      const sorted = getSortedOccupancyList();
      const tableData = sorted.map((emp,idx)=>[(idx+1).toString(),emp.employeeName,`${emp.assignedHours} hrs (${emp.assignedMinutes} min)`,`${emp.workingHours} hrs`,`${emp.occupancyPercentage}%`,emp.status==='overload'?'Overloaded':emp.status==='underload'?'Underloaded':'Balanced']);
      autoTable(doc,{startY:50,head:[["#","Employee","Assigned Time","Working Hours","Occupancy","Status"]],body:tableData,theme:"grid",headStyles:{fillColor:[41,128,185],textColor:255,fontSize:9,fontStyle:'bold',halign:'center'},bodyStyles:{fontSize:8,cellPadding:3,valign:'middle'},alternateRowStyles:{fillColor:[245,245,245]},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:45,halign:'left'},2:{cellWidth:50,halign:'center'},3:{cellWidth:40,halign:'center'},4:{cellWidth:35,halign:'center'},5:{cellWidth:35,halign:'center'}},margin:{top:50,left:10,right:10,bottom:10},pageBreak:'auto',didDrawPage:function(data){doc.setFontSize(8);doc.setFont("helvetica","italic");doc.text(`Page ${data.pageNumber}`,doc.internal.pageSize.width-20,doc.internal.pageSize.height-10);doc.text(`Occupancy Report - ${occupancyDate}`,doc.internal.pageSize.width/2,doc.internal.pageSize.height-10,{align:'center'});}});
      doc.save(`Occupancy_Report_${occupancyDate}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch(err) { console.error("PDF Error:",err); toast.error("PDF download failed: "+err.message); }
  };

  const getSortedOccupancyList = () => {
    if(!occupancyData?.occupancyList) return [];
    const list = [...occupancyData.occupancyList];
    if(sortOrder==="top") return list.sort((a,b)=>b.occupancyPercentage-a.occupancyPercentage);
    else return list.sort((a,b)=>a.occupancyPercentage-b.occupancyPercentage);
  };

  // Helper function to sort worklists by WorkingTime
  const getSortedWorklists = () => {
    if (!worklists.length) return [];
    const sorted = [...worklists];
    return sorted.sort((a, b) => {
      // Extract numeric value from WorkingTime (e.g., "60M" -> 60)
      const getTimeValue = (timeStr) => {
        if (!timeStr) return 0;
        const num = parseInt(timeStr);
        return isNaN(num) ? 0 : num;
      };
      
      const timeA = getTimeValue(a.WorkingTime);
      const timeB = getTimeValue(b.WorkingTime);
      
      if (worklistSortOrder === "top") {
        return timeB - timeA; // Highest first (descending)
      } else {
        return timeA - timeB; // Lowest first (ascending)
      }
    });
  };

  const totalPages = Math.ceil(worklists.length/PAGE_SIZE);
  const sortedWorklists = getSortedWorklists();
  const paginatedData = sortedWorklists.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  // ========== RENDER ==========
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex flex-wrap justify-between gap-4 mb-6">
        <h1 className="text-xl font-black">WorkList Management</h1>
        <div className="flex gap-2 flex-wrap">
          {/* Worklist tab buttons - only show when on worklist tab */}
          {activeTab === "worklist" && (
            <>
              <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">+ Add</button>
              <button onClick={() => setShowBulk(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">📤 Bulk Upload</button>
              <button onClick={() => handleDownload("all")} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold">📥 Download Excel</button>
              <button onClick={downloadPDFReport} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold">📄 Download PDF</button>
            </>
          )}
        </div>
      </div>

      {/* ========== TABS ========== */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("worklist")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${
            activeTab === "worklist" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📋 Worklist
        </button>
        <button
          onClick={() => setActiveTab("occupancy")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${
            activeTab === "occupancy" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📊 Occupancy
        </button>
        <button
          onClick={() => setActiveTab("aisheet")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${
            activeTab === "aisheet" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          🤖 AI Sheet
        </button>
      </div>

      {/* ========== TAB 1: WORKLIST ========== */}
      {activeTab === "worklist" && (
        <>
          <div className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap gap-4">
            <select value={selectedEmp} onChange={(e)=>{setSelectedEmp(e.target.value);setPage(1);}} className="border rounded-lg px-3 py-2 text-sm min-w-[200px]">
              <option value="all">👥 All Employees</option>
              {employees.map(e=><option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
            <input type="text" placeholder="🔍 Search worklist..." value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1);}} className="border rounded-lg px-3 py-2 text-sm flex-1" />
            {selectedEmp!=="all" && <button onClick={()=>handleDownload("employee")} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm">📥 Download {selectedEmp}</button>}
            {/* Sorting Button for Worklist */}
            <button 
              onClick={() => setWorklistSortOrder(worklistSortOrder === "top" ? "bottom" : "top")} 
              className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-200 transition"
            >
              {worklistSortOrder === "top" ? "🔽 Sort: High to Low" : "🔼 Sort: Low to High"}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div></div>
          ) : worklists.length===0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed"><p className="text-gray-500">No worklists found</p><p className="text-sm text-gray-400 mt-2">Click + Add to create your first worklist</p></div>
          ) : (
            <>
              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-xs uppercase border-b">
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Employee</th>
                    <th className="p-3 text-left">Worklist</th>
                    <th className="p-3 text-left">Frequency</th>
                    <th className="p-3 text-left">Schedule</th>
                    <th className="p-3 text-left">
                      Time
                      <span className="ml-1 text-xs text-slate-400">
                        ({worklistSortOrder === "top" ? "⬇️" : "⬆️"})
                      </span>
                    </th>
                    <th className="p-3 text-left">AI Time</th>
                    <th className="p-3 text-left">Link/Remark</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr></thead>
                  <tbody>
                    {paginatedData.map((wl,idx)=>(
                      <tr key={wl.WorkListId} className="border-t hover:bg-slate-50">
                        <td className="p-3 text-slate-400 text-xs">{(page-1)*PAGE_SIZE+idx+1}</td>
                        <td className="p-3 font-medium">{wl.EmployeeName}</td>
                        <td className="p-3">{wl.WorklistName}</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${wl.Frequency==="Daily"?"bg-blue-100 text-blue-700":wl.Frequency==="Weekly"?"bg-amber-100 text-amber-700":wl.Frequency==="Monthly"?"bg-purple-100 text-purple-700":"bg-orange-100 text-orange-700"}`}>{wl.Frequency}</span></td>
                        <td className="p-3 text-xs">{wl.ScheduleDays||wl.ScheduleDates||"Every day"}</td>
                        <td className="p-3 font-medium">
                          {wl.WorkingTime}
                          {/* Show indicator if this is the highest or lowest */}
                          {paginatedData.length > 1 && (
                            <span className="ml-1 text-xs">
                              {parseInt(wl.WorkingTime) === Math.max(...paginatedData.map(w => parseInt(w.WorkingTime) || 0)) && "🔴"}
                              {parseInt(wl.WorkingTime) === Math.min(...paginatedData.filter(w => w.WorkingTime).map(w => parseInt(w.WorkingTime) || 0)) && "🟢"}
                            </span>
                          )}
                        </td>
                        <td className="p-3">{wl.AITime?<span className="text-emerald-600 font-bold">🤖 {wl.AITime}</span>:<span className="text-gray-400">-</span>}</td>
                        <td className="p-3 max-w-[200px] text-xs break-all">{wl.TemplateLink?<a href={wl.TemplateLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">📎 Link</a>:(wl.Remark||"-")}</td>
                        <td className="p-3 text-center"><button onClick={()=>openAITimeSheet(wl)} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs hover:bg-emerald-700 font-bold">🤖 AI Time Sheet</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages>1 && (
                <div className="flex justify-center gap-4 mt-6">
                  <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-4 py-2 bg-slate-200 rounded-lg disabled:opacity-50">Prev</button>
                  <span className="px-4 py-2">Page {page} of {totalPages}</span>
                  <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-4 py-2 bg-slate-200 rounded-lg disabled:opacity-50">Next</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ========== TAB 2: OCCUPANCY ========== */}
      {activeTab === "occupancy" && (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
            <h2 className="text-lg font-black text-slate-800">📈 Occupancy Report</h2>
            <div className="flex gap-3 items-center">
              <input type="date" value={occupancyDate} onChange={(e)=>setOccupancyDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              <button onClick={()=>setSortOrder(sortOrder==="top"?"bottom":"top")} className="bg-slate-200 px-3 py-2 rounded-lg text-sm font-bold">{sortOrder==="top"?"🔽 Top to Bottom":"🔼 Bottom to Top"}</button>
              <button onClick={fetchOccupancy} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm">Refresh</button>
              {occupancyData && <button onClick={downloadOccupancyPDF} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-bold">📄 Download PDF</button>}
            </div>
          </div>
          {loadingOcc ? (
            <div className="text-center py-10">Loading occupancy...</div>
          ) : occupancyData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-blue-50 p-3 rounded-lg text-center"><div className="text-xs text-blue-600">Avg Occupancy</div><div className="text-2xl font-bold">{occupancyData.summary.averageOccupancy}%</div></div>
                <div className="bg-red-50 p-3 rounded-lg text-center"><div className="text-xs text-red-600">Overloaded</div><div className="text-2xl font-bold">{occupancyData.summary.overloadedCount}</div></div>
                <div className="bg-amber-50 p-3 rounded-lg text-center"><div className="text-xs text-amber-600">Underloaded</div><div className="text-2xl font-bold">{occupancyData.summary.underloadedCount}</div></div>
                <div className="bg-green-50 p-3 rounded-lg text-center"><div className="text-xs text-green-600">Total Employees</div><div className="text-2xl font-bold">{occupancyData.summary.totalEmployees}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-slate-100"><tr><th className="p-2 text-left">Rank</th><th className="p-2 text-left">Employee</th><th className="p-2 text-left">Assigned Time</th><th className="p-2 text-left">Working Hours</th><th className="p-2 text-left">Occupancy</th><th className="p-2 text-left">Status</th></tr></thead>
                  <tbody>
                    {getSortedOccupancyList().map((emp,idx)=>(
                      <tr key={emp.employeeName} className="border-t hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-400">{idx+1}.</td>
                        <td className="p-2 font-medium">{emp.employeeName}</td>
                        <td className="p-2">{emp.assignedHours} hrs</td>
                        <td className="p-2">{emp.workingHours} hrs</td>
                        <td className="p-2"><div className="flex items-center gap-2"><div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full ${emp.occupancyPercentage>100?'bg-red-500':emp.occupancyPercentage<50?'bg-amber-500':'bg-green-500'}`} style={{width:`${Math.min(emp.occupancyPercentage,100)}%`}}></div></div><span>{emp.occupancyPercentage}%</span></div></td>
                        <td className="p-2"><span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.status==='overload'?'bg-red-100 text-red-700':emp.status==='underload'?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>{emp.status==='overload'?'⚠️ Overloaded':emp.status==='underload'?'⚠️ Underloaded':'✅ Balanced'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-gray-500">Select a date and click Refresh</div>
          )}
        </div>
      )}

      {/* ========== TAB 3: AI SHEET ========== */}
      {activeTab === "aisheet" && (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
            <h2 className="text-lg font-black text-emerald-700">🤖 AI Analysis Sheet - Time Reduction Report</h2>
            <div className="flex gap-3 items-center">
              <select value={selectedEmp} onChange={(e)=>{setSelectedEmp(e.target.value);setPage(1);}} className="border rounded-lg px-3 py-2 text-sm min-w-[200px]">
                <option value="all">👥 All Employees</option>
                {employees.map(e=><option key={e.name} value={e.name}>{e.name}</option>)}
              </select>
              <button onClick={fetchAISheet} className="bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-bold">🔄 Refresh</button>
              {aiSheetData.length>0 && <button onClick={downloadAISheetPDF} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-bold">📄 Download PDF</button>}
            </div>
          </div>
          {loadingAISheet ? (
            <div className="text-center py-10">Loading AI Sheet data...</div>
          ) : aiSheetData.length===0 ? (
            <div className="text-center py-6 text-gray-500">No AI Time data available. Employees need to submit AI Time from Doer panel first.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-emerald-50">
                  <tr><th className="p-2 text-left border">#</th><th className="p-2 text-left border">Employee</th><th className="p-2 text-left border">Task Name</th><th className="p-2 text-left border">Frequency</th><th className="p-2 text-center border">⏰ Original Time </th><th className="p-2 text-center border">🤖 AI/Portal Time </th><th className="p-2 text-center border">⚡ Time Saved</th><th className="p-2 text-center border">🚀 % Faster</th></tr>
                </thead>
                <tbody>
                  {aiSheetData.map((item,idx)=>(
                    <tr key={item.WorkListId||idx} className="border-t hover:bg-slate-50">
                      <td className="p-2 text-slate-400 text-xs">{idx+1}</td>
                      <td className="p-2 font-medium">{item.EmployeeName}</td>
                      <td className="p-2">{item.TaskName}</td>
                      <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.Frequency==="Daily"?"bg-blue-100 text-blue-700":item.Frequency==="Weekly"?"bg-amber-100 text-amber-700":item.Frequency==="Monthly"?"bg-purple-100 text-purple-700":"bg-orange-100 text-orange-700"}`}>{item.Frequency}</span></td>
                      <td className="p-2 text-center font-bold text-amber-600">{item.OriginalTime}</td>
                      <td className="p-2 text-center font-bold text-emerald-600">{item.AITime}</td>
                      <td className="p-2 text-center font-bold text-blue-600">{item.ReducedTime}</td>
                      <td className="p-2 text-center">{item.PercentageFaster!=="N/A"?<span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">{item.PercentageFaster}</span>:<span className="text-gray-400">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={(e)=>handleClickOutside(e,addModalRef,closeModal)}>
          <div ref={addModalRef} className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">✕</button>
            <h2 className="text-lg font-black mb-4">{editing?"Edit":"Add"} WorkList</h2>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold mb-1">Worklist Name *</label><input type="text" value={form.WorklistName} onChange={e=>setForm({...form,WorklistName:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div><label className="block text-xs font-bold mb-1">Frequency *</label><select value={form.Frequency} onChange={e=>{setForm({...form,Frequency:e.target.value});setSelectedDays([]);setSelectedDates([]);setSchedule({scheduleDays:"",scheduleDates:""});}} className="w-full border rounded-lg px-3 py-2 text-sm">{FREQUENCIES.map(f=><option key={f} value={f}>{f}</option>)}</select></div>
              {form.Frequency==="Weekly"&&(<div><label className="block text-xs font-bold mb-1">Select Days *</label><div className="flex flex-wrap gap-2">{WEEK_DAYS.map(day=>(<button key={day} type="button" onClick={()=>handleDayToggle(day)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${selectedDays.includes(day)?"bg-blue-600 text-white":"bg-gray-100"}`}>{day.slice(0,3)}</button>))}</div>{selectedDays.length>0&&<p className="text-xs text-blue-600 mt-1">✅ {selectedDays.join(", ")}</p>}</div>)}
              {form.Frequency==="Monthly"&&(<div><label className="block text-xs font-bold mb-1">Select Dates *</label><div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto border rounded-lg p-2">{MONTH_DATES.map(date=>(<button key={date} type="button" onClick={()=>handleDateToggle(date)} className={`px-2 py-1 rounded text-xs ${selectedDates.includes(date)?"bg-purple-600 text-white":"bg-gray-100"}`}>{date}</button>))}</div>{selectedDates.length>0&&<p className="text-xs text-purple-600 mt-1">✅ {selectedDates.join(", ")}</p>}</div>)}
              {form.Frequency==="Yearly"&&(<div><label className="block text-xs font-bold mb-1">Select Month & Date *</label><div className="flex gap-3"><select value={yearlyMonth} onChange={e=>handleYearlyChange(e.target.value,yearlyDate)} className="flex-1 border rounded-lg px-3 py-2 text-sm">{MONTHS.map(m=><option key={m} value={m}>{m}</option>)}</select><select value={yearlyDate} onChange={e=>handleYearlyChange(yearlyMonth,parseInt(e.target.value))} className="w-24 border rounded-lg px-3 py-2 text-sm">{MONTH_DATES.map(d=><option key={d} value={d}>{d}</option>)}</select></div><p className="text-xs text-orange-600 mt-1">✅ Every {yearlyMonth} {yearlyDate}</p></div>)}
              <div><label className="block text-xs font-bold mb-1">Working Time (Minutes) *</label><select value={WORKING_TIMES.includes(form.WorkingTime)?form.WorkingTime:"custom"} onChange={e=>handleWorkingTimeChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-2"><option value="30M">30 Min</option><option value="60M">60 Min (1 Hour)</option><option value="90M">90 Min (1.5 Hours)</option><option value="120M">120 Min (2 Hours)</option><option value="180M">180 Min (3 Hours)</option><option value="240M">240 Min (4 Hours)</option><option value="300M">300 Min (5 Hours)</option><option value="custom">Custom...</option></select>{(!WORKING_TIMES.includes(form.WorkingTime)||form.WorkingTime==="custom")&&<input type="number" placeholder="Enter minutes" value={customWorkingTime} onChange={e=>{setCustomWorkingTime(e.target.value);if(e.target.value)setForm({...form,WorkingTime:`${parseInt(e.target.value)}M`});}} className="w-full border rounded-lg px-3 py-2 text-sm"/>}</div>
              {!editing&&(<div><label className="block text-xs font-bold mb-1">Employee *</label><select value={form.EmployeeName} onChange={e=>setForm({...form,EmployeeName:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select Employee</option>{employees.map(e=><option key={e.name} value={e.name}>{e.name}</option>)}</select></div>)}
              <div><label className="block text-xs font-bold mb-1">Template Link / Remark</label><textarea value={form.TemplateLinkRemark} onChange={e=>setForm({...form,TemplateLinkRemark:e.target.value})} rows="3" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Paste Google Sheet link OR add remark..."/><p className="text-xs text-slate-400 mt-1">💡 http:// or https:// = Template Link, otherwise = Remark</p></div>
            </div>
            <div className="flex justify-end gap-3 mt-6"><button onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving?"Saving...":"Save"}</button></div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulk && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={(e)=>handleClickOutside(e,bulkModalRef,closeBulkModal)}>
          <div ref={bulkModalRef} className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto relative">
            <button onClick={closeBulkModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">✕</button>
            <h2 className="text-lg font-black mb-4">📤 Bulk Upload Worklists</h2>
            {selectedEmp==="all"?<div className="p-4 bg-amber-50 rounded-lg text-amber-700 text-center">⚠️ Please select an employee from the dropdown above first</div>:<><div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2"><span className="text-lg">👤</span><span>Uploading for: <strong className="text-blue-800">{selectedEmp}</strong></span></div>
            <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg"><p className="font-bold text-amber-800 mb-2">📋 Download Sample Format</p><div className="flex gap-3 mb-3"><button onClick={downloadSampleBulkUpload} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex-1 text-sm font-bold">📥 Excel Sample</button><button onClick={downloadSamplePDF} className="bg-red-600 text-white px-4 py-2 rounded-lg flex-1 text-sm font-bold">📄 PDF Sample</button></div><div className="text-xs text-amber-700"><strong>Required Columns:</strong> WorklistName, Frequency, WorkingTime, ScheduleDays, ScheduleDates, TemplateLinkRemark</div></div>
            <div className="border-2 border-dashed rounded-xl p-6 text-center mb-4 hover:bg-gray-50 transition"><input type="file" accept=".xlsx,.csv,.xls" onChange={handleFileUpload} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></div>
            {bulkData.length>0&&<div className="mb-4"><p className="text-sm font-bold mb-2">📊 {bulkData.length} rows ready to upload</p><div className="max-h-40 overflow-y-auto text-xs border rounded-lg"><table className="w-full"><tbody>{bulkData.slice(0,5).map((d,i)=>(<tr key={i} className="border-t"><td className="p-2 font-medium">{d.WorklistName}</td><td className="p-2">{d.Frequency}</td><td className="p-2">{d.WorkingTime}</td></tr>))}</tbody></table>{bulkData.length>5&&<p className="p-2 text-center text-gray-500">+{bulkData.length-5} more</p>}</div></div>}
            {bulkResult&&<div className="mb-4 p-3 bg-slate-50 rounded-lg border"><p className="text-emerald-600 font-bold">✅ Created: {bulkResult.summary?.created||0}</p><p className="text-amber-600">⏭️ Skipped (duplicate): {bulkResult.summary?.skipped||0}</p><p className="text-rose-600">❌ Errors: {bulkResult.summary?.errors||0}</p>{bulkResult.errors?.length>0&&<details className="mt-2"><summary className="text-xs cursor-pointer text-gray-600">View errors</summary><ul className="mt-1 text-xs text-rose-600 pl-4">{bulkResult.errors.slice(0,3).map((e,i)=><li key={i}>{e}</li>)}</ul></details>}</div>}
            <div className="flex justify-end gap-3 mt-4"><button onClick={closeBulkModal} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button><button onClick={handleBulkUpload} disabled={uploading||!bulkData.length} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 font-bold">{uploading?"Uploading...":`⬆️ Upload ${bulkData.length} rows`}</button></div></>}
          </div>
        </div>
      )}

      {/* AI TIME SHEET MODAL */}
      {showAIModal && aiWorklist && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={(e)=>handleClickOutside(e,aiModalRef,closeAIModal)}>
          <div ref={aiModalRef} className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl relative">
            <button onClick={closeAIModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            <h2 className="text-lg font-black text-slate-800 mb-4">🤖 AI Time Sheet (Admin)</h2>
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-bold text-slate-700">👤 Employee: {aiWorklist.EmployeeName}</p>
                <p className="text-sm font-bold text-slate-700 mt-1">📋 Task: {aiWorklist.WorklistName}</p>
                <p className="text-sm text-slate-600 mt-1">📊 Frequency: {aiWorklist.Frequency}</p>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"><p className="text-sm font-bold text-amber-800">⏰ Current Working Time :</p><p className="text-2xl font-black text-amber-600 mt-1">{aiWorklist.WorkingTime}</p></div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg"><p className="text-sm text-blue-800">💡 After using AI / Portal, how much time does this task take now? Select the reduced time below.</p></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-2">Select AI/Portal Reduced Time *</label><select value={selectedAITime} onChange={(e)=>setSelectedAITime(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">-- Select Time --</option><option value="5M">5 Minutes</option><option value="10M">10 Minutes</option><option value="15M">15 Minutes</option><option value="20M">20 Minutes</option><option value="30M">30 Minutes</option><option value="45M">45 Minutes</option><option value="60M">60 Minutes (1 Hour)</option><option value="90M">90 Minutes (1.5 Hours)</option><option value="120M">120 Minutes (2 Hours)</option><option value="150M">150 Minutes (2.5 Hours)</option><option value="180M">180 Minutes (3 Hours)</option><option value="210M">210 Minutes (3.5 Hours)</option><option value="240M">240 Minutes (4 Hours)</option><option value="300M">300 Minutes (5 Hours)</option></select></div>
              {selectedAITime&&<div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg"><p className="text-sm text-emerald-800">🚀 New AI Time will be saved: <strong>{selectedAITime}</strong></p></div>}
            </div>
            <div className="flex justify-end gap-3 mt-6"><button onClick={closeAIModal} className="px-4 py-2 bg-gray-200 rounded-lg font-bold text-sm">Cancel</button><button onClick={handleSaveAITime} disabled={aiSaving||!selectedAITime} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:bg-emerald-300">{aiSaving?"Saving...":"💾 Save AI Time"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}