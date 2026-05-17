// ============================================================
// CENTRALIZED API SERVICE LAYER
// Eliminates scattered axios calls across all pages
// Single source of truth for all API calls
// ============================================================
import axios from "./axios";

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

const formDataHeader = (extra = {}) => ({
  headers: { ...extra, "Content-Type": "multipart/form-data", Authorization: `Bearer ${localStorage.getItem("token")}` },
});

// ──── AUTH ────
export const loginAdmin = (employeeID, password) =>
  axios.post("/adminauth/admin/login", { employeeID, password });

// ──── EMPLOYEE ────
export const getAllEmployees = () =>
  axios.get("/employee/all", authHeader());

export const getAllAdmin = () =>
  axios.get("/employee/allAdmin", authHeader());

// ──── DELEGATION ────
export const searchDelegationByName = (name, assignBy) => {
  let url = `/delegations/search/by-name?name=${encodeURIComponent(name)}`;
  if (assignBy && assignBy !== "all") url += `&assignBy=${encodeURIComponent(assignBy)}`;
  return axios.get(url, authHeader());
};

export const createDelegation = (payload) =>
  axios.post("/delegations/", payload, authHeader());

export const updateDelegation = (taskID, payload) =>
  axios.put(`/delegations/update/${taskID}`, payload, authHeader());

export const deleteDelegation = (taskID) =>
  axios.delete(`/delegations/delete/${taskID}`, authHeader());

export const approveDelegation = (taskID, approvalStatus) =>
  axios.patch(`/delegations/approve/${taskID}`, { approvalStatus }, authHeader());

// ──── CHECKLIST ────
export const searchChecklistByName = (name) =>
  axios.get("/checklist/search/by-name", { ...authHeader(), params: { name } });

export const markChecklistDone = (taskID) =>
  axios.patch(`/checklist/done/${taskID}`, {}, authHeader());

export const createChecklistTemplate = (payload) =>
  axios.post("/checklist/create-template", payload, authHeader());

// ──── HELP TICKETS ────
export const getAllHelpTickets = (params) =>
  axios.get("/helpTickets/all", { ...authHeader(), params });

export const createHelpTicket = (formData) =>
  axios.post("/helpTickets/create", formData, formDataHeader());

export const updateHelpTicketStatus = (ticketID, Status) =>
  axios.patch(`/helpTickets/status/${encodeURIComponent(ticketID.trim())}`, { Status }, authHeader());

// ──── SUPPORT TICKETS ────
export const getAllSupportTickets = (params) =>
  axios.get("/support-tickets/all", { ...authHeader(), params });

export const updateSupportTicketStatus = (ticketID, Status) =>
  axios.patch(`/support-tickets/status/${ticketID}`, { Status }, authHeader());

// ──── DASHBOARD ────
export const getAllDashboard = (params) =>
  axios.get("/allDashboard/all-dashboard", { ...authHeader(), params });

// ──── WHATSAPP ────
export const sendWhatsAppDelegation = (payload) =>
  axios.post("/whatsapp/send-delegation", payload, authHeader());

// ──── WORKLIST ────
export const getAllWorklists = (params) =>
  axios.get("/worklist/all", { ...authHeader(), params });

export const createWorklist = (payload) =>
  axios.post("/worklist/", payload, authHeader());

export const updateWorklistAdmin = (id, payload) =>
  axios.put(`/worklist/admin/${id}`, payload, authHeader());

export const deleteWorklistAdmin = (id) =>
  axios.delete(`/worklist/admin/${id}`, authHeader());

export const bulkUploadWorklists = (worklists) =>
  axios.post("/worklist/bulk", { worklists }, authHeader());

export const downloadWorklists = (params) =>
  axios.get("/worklist/download", { ...authHeader(), params });
