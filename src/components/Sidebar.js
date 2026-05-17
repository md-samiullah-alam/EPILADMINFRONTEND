import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FaTasks, FaClipboardList, FaLifeRing, FaHeadset, FaBars, FaTimes, FaCodeBranch, FaList } from "react-icons/fa";
import axios from "axios";

// MenuItem Component
const MenuItem = ({ to, children, icon: Icon, onClick, count }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `relative flex items-center gap-3 px-4 py-3 rounded-md transition-colors duration-200 font-medium ${
        isActive
          ? "bg-blue-600 text-white shadow-lg"
          : "text-gray-200 hover:bg-gray-800 hover:text-white"
      }`
    }
  >
    {Icon && <Icon className="w-5 h-5" />}
    <span className="flex-1">{children}</span>
    {count > 0 && (
      <span className="absolute top-0 right-0 bg-red-600 text-white px-2 py-1 rounded-full text-xs">
        {count}
      </span>
    )}
  </NavLink>
);

// Group tickets by Issue for counting
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
      if (ticket.Taskcompletedapproval === "Approved") {
        grouped[ticket.Issue].Taskcompletedapproval = "Approved";
      }
    }
  });
  
  return Object.values(grouped);
};

const getUniqueCounts = (tickets) => {
  const grouped = getGroupedTicketsForCount(tickets);
  const active = grouped.filter(g => g.Status === "Pending" || g.Status === "InProgress").length;
  const completed = grouped.filter(g => g.Status === "Done" && g.Taskcompletedapproval !== "Approved").length;
  const approved = grouped.filter(g => g.Status === "Done" && g.Taskcompletedapproval === "Approved").length;
  return { active, completed, approved, total: grouped.length };
};

export default function Sidebar({ mobile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [helpTicketCount, setHelpTicketCount] = useState(0);
  const [supportTicketCount, setSupportTicketCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState("1.0.0");

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  // Load version from package.json
  useEffect(() => {
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setVersion(data.version))
      .catch(() => setVersion("1.0.0"));
  }, []);

  // Load tickets count
  const loadTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const authHeader = { headers: { Authorization: `Bearer ${token}` } };

      const [supportRes, helpRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BASE_URL}/api/support-tickets/all`, authHeader),
        axios.get(`${process.env.REACT_APP_BASE_URL}/api/helpTickets/all`, authHeader),
      ]);

      const supportTickets = supportRes.data.tickets || [];
      const helpTickets = helpRes.data.tickets || [];

      const supportGrouped = getGroupedTicketsForCount(supportTickets);
      const helpGrouped = getGroupedTicketsForCount(helpTickets);

      const activeSupportCount = supportGrouped.filter(g => g.Status === "Pending" || g.Status === "InProgress").length;
      const activeHelpCount = helpGrouped.filter(g => g.Status === "Pending" || g.Status === "InProgress").length;

      setSupportTicketCount(activeSupportCount);
      setHelpTicketCount(activeHelpCount);
      
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(() => loadTickets(), 900000);
    return () => clearInterval(interval);
  }, []);

  // Mobile Sidebar
  if (mobile) {
    return (
      <>
        <button
          className="md:hidden fixed top-4 left-4 z-[100] bg-gray-900 text-white p-2 rounded-md shadow-lg"
          onClick={toggleSidebar}
        >
          {isOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
        </button>

        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-[90] transform transition-transform duration-300 flex flex-col ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
            <button onClick={closeSidebar} className="text-gray-400 hover:text-white text-2xl">
              ✕
            </button>
            <div className="text-right">
              <div className="text-lg font-semibold leading-none">Admin Portal</div>
              <div className="text-[11px] text-gray-400 mt-1 leading-none">Tracked Performance Overview</div>
            </div>
          </div>

          <nav className="flex-1 p-6 space-y-2">
            <MenuItem to="/dashboard" icon={FaTasks} count={0}>Dashboard</MenuItem>
            <MenuItem to="/delegation" icon={FaTasks} onClick={closeSidebar}>Delegation</MenuItem>
            <MenuItem to="/checklist" icon={FaClipboardList} onClick={closeSidebar}>Checklist</MenuItem>
            <MenuItem to="/help-ticket" icon={FaLifeRing} onClick={closeSidebar} count={helpTicketCount}>
              Help Ticket
            </MenuItem>
            <MenuItem to="/support-ticket" icon={FaHeadset} onClick={closeSidebar} count={supportTicketCount}>
              Support Ticket
            </MenuItem>
            <MenuItem to="/worklist" icon={FaList} onClick={closeSidebar}>WorkList</MenuItem>
          </nav>

          {/* ✅ VERSION AT BOTTOM - MOBILE */}
          <div className="p-4 border-t border-gray-800 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <FaCodeBranch className="w-3 h-3" />
              <span>v{version}</span>
              <span className="mx-1">•</span>
              <span>© 2024</span>
            </div>
          </div>
        </aside>

        {isOpen && <div className="fixed inset-0 bg-black bg-opacity-40 z-[80]" onClick={closeSidebar} />}
      </>
    );
  }

  // Desktop Sidebar
  return (
    <aside className="h-screen w-64 bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="text-2xl font-bold">Admin Portal</div>
        <div className="text-xs text-gray-400">Tracked Performance Overview</div>
      </div>

      <nav className="flex-1 p-6 space-y-2">
        <MenuItem to="/dashboard" icon={FaTasks} count={0}>Dashboard</MenuItem>
        <MenuItem to="/delegation" icon={FaTasks} count={0}>Delegation</MenuItem>
        <MenuItem to="/checklist" icon={FaClipboardList} count={0}>Checklist</MenuItem>
        <MenuItem to="/help-ticket" icon={FaLifeRing} count={helpTicketCount}>
          Help Ticket
        </MenuItem>
        <MenuItem to="/support-ticket" icon={FaHeadset} count={supportTicketCount}>
          Support Ticket
        </MenuItem>
        <MenuItem to="/worklist" icon={FaList} count={0}>WorkList</MenuItem>
      </nav>

      {/* ✅ VERSION AT BOTTOM - DESKTOP */}
      <div className="p-4 border-t border-gray-800 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <FaCodeBranch className="w-3 h-3" />
          <span>v{version}</span>
          <span className="mx-1">•</span>
          <span>© 2026</span>
        </div>
      </div>
    </aside>
  );
}