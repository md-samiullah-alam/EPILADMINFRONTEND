import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import axios from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import jsPDF from "jspdf";
import "jspdf-autotable";
import axiosLib from "axios";

// ============================================================
// MEMOIZED SUB-COMPONENTS (prevent unnecessary re-renders)
// ============================================================

//OK
const THEMES = {
  blue: "bg-blue-600 text-white",
  amber: "bg-amber-500 text-white",
  emerald: "bg-emerald-600 text-white",
  indigo: "bg-indigo-600 text-white",
  rose: "bg-rose-600 text-white",
  slate: "bg-slate-700 text-white",
};

const MiniCard = React.memo(({ title, value, theme }) => (
  <div className={`${THEMES[theme]} p-3 rounded-lg text-center shadow transition-all duration-300 hover:scale-105`}>
    <h3 className="text-[9px] uppercase font-black opacity-90">{title}</h3>
    <p className="text-lg font-black mt-1">{value || 0}</p>
  </div>
));

const Card = React.memo(({ title, value, theme }) => (
  <div className={`${THEMES[theme]} p-4 rounded-xl text-center shadow transition-all duration-300 hover:scale-105 hover:rotate-1`}>
    <h3 className="text-[10px] uppercase font-black opacity-80">{title}</h3>
    <p className="text-xl font-black">{value || 0}</p>
  </div>
));

const SingleSection = React.memo(({ title, data, showScore = false, formatPercent = (val) => val }) => {
  const score = useMemo(() => {
    if (!showScore) return null;
    const pendingPercent = parseFloat(data?.pendingPercent || 0);
    const delayPercent = parseFloat(data?.delayPercent || 0);
    return `-${((pendingPercent * 0.80) + (delayPercent * 0.20)).toFixed(2)}`;
  }, [showScore, data?.pendingPercent, data?.delayPercent]);

  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-all overflow-hidden group">
      <div className="px-6 py-3 border-b bg-slate-50 group-hover:bg-indigo-50 transition-colors">
        <h2 className="font-black uppercase text-slate-700 group-hover:text-indigo-700">{title}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 p-6">
        <Card title="Total Work" value={data.totalWork || 0} theme="slate" />
        <Card title="Completed" value={data.completedWork || data.totalCompleted || 0} theme="emerald" />
        <Card title="On Time" value={data.onTimeWork || data.totalOnTime || 0} theme="emerald" />
        <Card title="Pending" value={data.pendingWork || data.totalPending || 0} theme="amber" />
        <Card title="Pending %" value={formatPercent(data.pendingPercent)} theme="indigo" />
        <Card title="Delay %" value={formatPercent(data.delayPercent)} theme="rose" />
        {showScore && <Card title="Overall Score" value={score || formatPercent(data.overallScore)} theme="blue" />}
      </div>
    </div>
  );
});

// ============================================================
// MAIN DASHBOARD COMPONENT
// ============================================================
export default function Dashboard() {
  const { user } = useContext(AuthContext);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [weekRange, setWeekRange] = useState({ start: "", end: "" });
  const [allDashboardData, setAllDashboardData] = useState([]);

  // ================= LOAD EMPLOYEES (memoized) =================
  const loadEmployees = useCallback(async () => {
    try {
      const res = await axios.get("/employee/all", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setEmployees(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [user.token]);

  // ================= LOAD DASHBOARD (memoized) =================
  const loadAllDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("/allDashboard/all-dashboard", {
        params: {
          month: selectedMonth,
          week: selectedWeek,
          selectedName: selectedEmployee === "all" ? "" : selectedEmployee,
        },
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setAllDashboardData(res.data.data || []);
      setWeekRange({ start: res.data.weekStart, end: res.data.weekEnd });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.token, selectedEmployee, selectedMonth, selectedWeek]);

  // ================= EFFECTS =================
  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { loadAllDashboard(); }, [loadAllDashboard]);

  // ================= MEMOIZED HELPERS =================
  const formatPercent = useCallback((value) => {
    if (!value) return "-0.00%";
    const num = parseFloat(value);
    if (isNaN(num)) return "-0.00%";
    return `-${num.toFixed(2)}%`;
  }, []);

  const calculateWithoutDelegation = useCallback((emp) => {
    const checklist = emp.checklist || {};
    const helpAssigned = emp.helpTicket?.assigned || {};
    const supportAssigned = emp.supportTicket?.assigned || {};
    const totalWork = (checklist.totalWork || 0) + (helpAssigned.totalWork || 0) + (supportAssigned.totalWork || 0);
    const completedWork = (checklist.completedWork || 0) + (helpAssigned.completedWork || 0) + (supportAssigned.completedWork || 0);
    const pendingWork = (checklist.pendingWork || 0) + (helpAssigned.pendingWork || 0) + (supportAssigned.pendingWork || 0);
    const onTimeWork = (checklist.onTimeWork || 0) + (helpAssigned.onTimeWork || 0) + (supportAssigned.onTimeWork || 0);
    const pendingPercent = totalWork > 0 ? ((pendingWork / totalWork) * 100).toFixed(2) : "0.00";
    const delayPercent = totalWork > 0 ? (((totalWork - onTimeWork) / totalWork) * 100).toFixed(2) : "0.00";
    const overallScore = ((parseFloat(pendingPercent) * 0.80) + (parseFloat(delayPercent) * 0.20)).toFixed(2);
    return { totalWork, completedWork, pendingWork, onTimeWork, pendingPercent: `-${pendingPercent}`, delayPercent: `-${delayPercent}`, overallScore: `-${overallScore}` };
  }, []);

  const calculateDelegationOverall = useCallback((delegation) => {
    const del = delegation || {};
    const pendingPercent = parseFloat(del.pendingPercent || 0);
    const delayPercent = parseFloat(del.delayPercent || 0);
    return `-${((pendingPercent * 0.80) + (delayPercent * 0.20)).toFixed(2)}`;
  }, []);

  // ================= WHATSAPP & PDF (same logic, kept for functionality) =================
  const sendBulkWhatsApp = useCallback(async () => {
    if (allDashboardData.length === 0) return alert("No data to send!");
    if (!window.confirm(`Send WhatsApp report to ${allDashboardData.length} employees?`)) return;
    setIsUpdating(true);
    const PHONE_ID = process.env.REACT_APP_META_WA_PHONE_ID;
    const TOKEN = process.env.REACT_APP_META_WA_TOKEN;
    const isMonday = new Date().getDay() === 1;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < allDashboardData.length; i++) {
      const emp = allDashboardData[i];
      const empInfo = employees.find(e => e.name === emp.name);
      const phone = empInfo?.number;
      if (!phone) continue;

      const cleanPhone = phone.toString().replace(/\D/g, "");
      const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const withoutDelData = calculateWithoutDelegation(emp);
      const woOverall = withoutDelData.overallScore.replace("-", "");
      const delOverall = calculateDelegationOverall(emp.delegation).replace("-", "");
      const isHighScorer = parseFloat(woOverall) > 10 || parseFloat(delOverall) > 10;
      const var5 = isMonday ? (isHighScorer ? "⚠️ EM MEETING ALERT: Score > 10%" : "🌟 EXCELLENT") : "🚀 PERFORMANCE REMINDER";
      const var6 = isMonday ? (isHighScorer ? "Prepared with reasons." : "Proud of you!") : "Maintain your score.";

      try {
        await axiosLib.post(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
          messaging_product: "whatsapp",
          to: finalPhone,
          type: "template",
          template: {
            name: "workreport",
            language: { code: "en" },
            components: [{ type: "body", parameters: [
              { type: "text", text: String(emp.name) },
              { type: "text", text: `${weekRange.start} to ${weekRange.end}` },
              { type: "text", text: String(delOverall) },
              { type: "text", text: String(woOverall) },
              { type: "text", text: String(var5) },
              { type: "text", text: String(var6) }
            ]}]
          }
        }, { headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } });
        await delay(2000);
      } catch (err) {
        console.error(`Error for ${emp.name}:`, err.response?.data || err.message);
      }
    }
    setIsUpdating(false);
    alert("Bulk Process completed!");
  }, [allDashboardData, employees, weekRange, calculateWithoutDelegation, calculateDelegationOverall]);

  const downloadPDF = useCallback((filterType = "all") => {
    if (!allDashboardData.length) return alert("Please wait, data is still loading!");
    const doc = new jsPDF("landscape", "mm", "a4");
    doc.setFillColor(255, 235, 156);
    doc.rect(10, 10, 277, 8, "F");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`WEEK NO.-0${selectedWeek} ( ${weekRange.start} TO ${weekRange.end} ) - ${filterType === 'em' ? 'EM ONLY' : 'ALL'}`, 148, 15.5, { align: "center" });

    const headers = [
      [{ content: "DOER NO.", rowSpan: 2 }, { content: "DOER NAME", rowSpan: 2 }, { content: "WITHOUT DELEGATION", colSpan: 7 }, { content: "DELEGATION", colSpan: 7 }, { content: "OVERALL", colSpan: 7 }, { content: "EM DOER", rowSpan: 2 }],
      ["TOTAL", "COMPLETED", "ON TIME", "PENDING", "PEND %", "DELAY %", "SCORE", "TOTAL", "COMPLETED", "ON TIME", "PENDING", "PEND %", "DELAY %", "SCORE", "TOTAL", "COMPLETED", "ON TIME", "PENDING", "PEND %", "DELAY %", "SCORE", ""]
    ];

    const body = allDashboardData.map((emp, idx) => {
      const withoutDelData = calculateWithoutDelegation(emp);
      const delOverall = calculateDelegationOverall(emp.delegation);
      const overall = emp.overall || {};
      const woOverallNum = parseFloat(withoutDelData.overallScore.replace("-", "") || 0);
      const delOverallNum = parseFloat(delOverall.replace("-", "") || 0);
      const isEMDoer = (woOverallNum > 10 || delOverallNum > 10) ? "YES" : "NO";
      const del = emp.delegation || {};
      return [
        idx + 1, emp.name,
        withoutDelData.totalWork, withoutDelData.completedWork, withoutDelData.onTimeWork, withoutDelData.pendingWork,
        withoutDelData.pendingPercent + "%", withoutDelData.delayPercent + "%", withoutDelData.overallScore,
        del.totalWork || 0, del.completedWork || 0, del.onTimeWork || 0, del.pendingWork || 0,
        formatPercent(del.pendingPercent), formatPercent(del.delayPercent), delOverall,
        overall.totalWork || 0, overall.totalCompleted || 0, overall.totalOnTime || 0, overall.totalPending || 0,
        formatPercent(overall.pendingPercent), formatPercent(overall.delayPercent), formatPercent(overall.overallScore),
        isEMDoer
      ];
    }).filter((row) => filterType !== "em" || row[row.length - 1] === "YES");

    doc.autoTable({
      head: headers, body, startY: 18, theme: 'grid',
      styles: { fontSize: 5, halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0] },
      headStyles: { fillColor: [198, 224, 180], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 1: { cellWidth: 20 }, 7: { cellWidth: 8 }, 14: { cellWidth: 8 }, 21: { cellWidth: 8 }, 22: { cellWidth: 8 } }
    });
    doc.save(`${filterType === "em" ? "EM_Report" : "Full_Report"}_W${selectedWeek}.pdf`);
  }, [allDashboardData, selectedWeek, weekRange, calculateWithoutDelegation, calculateDelegationOverall, formatPercent]);

  // ================= MEMOIZED RENDER =================
  const employeeDataRendered = useMemo(() => {
    return allDashboardData.map((emp, idx) => {
      const withoutDelData = calculateWithoutDelegation(emp);
      const delOverall = calculateDelegationOverall(emp.delegation);
      const overallData = emp.overall || {};
      const woOverallNum = parseFloat(withoutDelData.overallScore.replace("-", "") || 0);
      const delOverallNum = parseFloat(delOverall.replace("-", "") || 0);
      const combinedOverall = ((woOverallNum + delOverallNum) / 2).toFixed(2);
      return { emp, idx, withoutDelData, delOverall, overallData, combinedOverall, woOverallNum, delOverallNum };
    });
  }, [allDashboardData, calculateWithoutDelegation, calculateDelegationOverall]);

  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans">
      <header className="sticky top-0 z-40 bg-slate-800 text-white px-4 py-3 md:px-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="font-black uppercase text-base md:text-lg leading-tight tracking-wider">Management Dashboard</h1>
            <p className="text-[10px] md:text-xs text-blue-400 font-bold">{weekRange.start || "Loading..."} — {weekRange.end || "Loading..."}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <div className="grid grid-cols-2 sm:flex items-center bg-slate-900 rounded-xl p-2 gap-2 w-full sm:w-auto border border-slate-700">
              <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer p-1">
                <option value="all" className="text-black font-bold">All Employees</option>
                {employees.map((emp) => <option key={emp.key || emp.name} value={emp.key || emp.name} className="text-black">{emp.name}</option>)}
              </select>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer p-1">
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1} className="text-black">{new Date(0, i).toLocaleString("default", { month: "long" })}</option>)}
              </select>
              <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value === "all" ? "all" : Number(e.target.value))} className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer p-1 sm:border-l sm:border-slate-700 sm:pl-2">
                <option value="all" className="text-black">All Weeks</option>
                {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w} className="text-black">Week {w}</option>)}
              </select>
            </div>
            {selectedEmployee === "all" && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button onClick={() => downloadPDF("all")} disabled={loading} className={`flex-1 sm:flex-none text-white text-[9px] font-black px-4 py-2 rounded shadow-lg transition-all active:scale-95 ${loading ? 'bg-slate-600' : 'bg-blue-600 hover:bg-blue-700'}`}>ALL REPORT</button>
                <button onClick={() => downloadPDF("em")} disabled={loading} className={`flex-1 sm:flex-none text-white text-[9px] font-black px-4 py-2 rounded shadow-lg transition-all active:scale-95 ${loading ? 'bg-slate-600' : 'bg-rose-600 hover:bg-rose-700'}`}>EM REPORT</button>
                <button onClick={sendBulkWhatsApp} disabled={true} className="flex-1 sm:flex-none text-white text-[9px] font-black px-4 py-2 rounded shadow-lg bg-slate-600">WHATSAPP</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 relative">
        {(loading || isUpdating) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/80 backdrop-blur-sm z-50">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 font-bold text-[10px]">{isUpdating ? "WA" : "DATA"}</div>
            </div>
            <p className="mt-4 text-slate-600 font-black text-xs animate-pulse uppercase tracking-widest">{isUpdating ? "Sending..." : "Fetching Dashboard..."}</p>
          </div>
        )}

        {!loading && (
          <div className="animate-fadeIn">
            {selectedEmployee === "all" ? (
              <div className="space-y-6">
                {employeeDataRendered.map(({ emp, idx, withoutDelData, delOverall, overallData, combinedOverall }) => (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all duration-300 group">
                    <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-blue-50 group-hover:from-blue-50 group-hover:to-indigo-50 transition-colors">
                      <div className="flex justify-between items-center">
                        <h2 className="font-black uppercase text-lg text-slate-700 group-hover:text-blue-700">{emp.name}</h2>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">Employee #{idx + 1}</span>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${parseFloat(combinedOverall) > 10 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{parseFloat(combinedOverall) > 10 ? '⚠️ EM Required' : '✅ Good'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 cursor-default">
                      <SectionBlock title="Delegation" data={emp.delegation} score={delOverall} formatPercent={formatPercent} theme="slate" />
                      <SectionBlock title="Without Delegation" data={withoutDelData} formatPercent={formatPercent} theme="blue" score={withoutDelData.overallScore} />
                      <SectionBlock title="Overall" data={overallData} formatPercent={formatPercent} theme="emerald" score={formatPercent(overallData.overallScore)} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                <SingleSection title="Delegation" data={allDashboardData[0]?.delegation} showScore={true} formatPercent={formatPercent} />
                <SingleSection title="Checklist" data={allDashboardData[0]?.checklist} formatPercent={formatPercent} />
                <SingleSection title="Help Tickets Assigned" data={allDashboardData[0]?.helpTicket?.assigned} formatPercent={formatPercent} />
                <SingleSection title="Help Tickets Created" data={allDashboardData[0]?.helpTicket?.created} formatPercent={formatPercent} />
                <SingleSection title="Support Tickets Assigned" data={allDashboardData[0]?.supportTicket?.assigned} formatPercent={formatPercent} />
                <SingleSection title="Support Tickets Created" data={allDashboardData[0]?.supportTicket?.created} formatPercent={formatPercent} />
                <SingleSection title="Overall" data={allDashboardData[0]?.overall} showScore={true} formatPercent={formatPercent} />
              </div>
            )}

            {allDashboardData.length === 0 && !loading && (
              <div className="text-center py-20 bg-white rounded-3xl shadow-inner border-2 border-dashed border-slate-300">
                <p className="text-slate-400 font-bold uppercase tracking-widest">No Data Found</p>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}

// Memoized section block
const SectionBlock = React.memo(({ title, data, score, formatPercent, theme }) => {
  const baseTheme = theme === "blue" ? "from-blue-50" : theme === "emerald" ? "from-emerald-50" : "from-slate-50";
  return (
    <div className={`border border-slate-200 rounded-xl p-5 bg-gradient-to-br ${baseTheme} to-white hover:shadow-md transition-all duration-300 hover:border-blue-300`}>
      <h3 className="font-black text-sm uppercase text-center mb-4 text-slate-600 border-b pb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <MiniCard title="Total Work" value={data?.totalWork || 0} theme="slate" />
        <MiniCard title="Completed" value={data?.completedWork || data?.totalCompleted || 0} theme="emerald" />
        <MiniCard title="On Time" value={data?.onTimeWork || data?.totalOnTime || 0} theme="emerald" />
        <MiniCard title="Pending" value={data?.pendingWork || data?.totalPending || 0} theme="amber" />
        <MiniCard title="Pending %" value={formatPercent(data?.pendingPercent)} theme="indigo" />
        <MiniCard title="Delay %" value={formatPercent(data?.delayPercent)} theme="rose" />
      </div>
      {score !== undefined && (
        <div className="mt-5 pt-4 border-t border-slate-200">
          <div className="text-center">
            <span className="text-xs font-bold text-slate-500">{title} Score</span>
            <p className="text-xl font-black text-blue-600">{score}</p>
          </div>
        </div>
      )}
    </div>
  );
});