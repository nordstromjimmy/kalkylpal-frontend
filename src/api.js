/**
 * api.js — All communication with the FastAPI backend.
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Auth helpers ──────────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem("kalkylpal_token");
}

export function setToken(token) {
  localStorage.setItem("kalkylpal_token", token);
}

export function clearToken() {
  localStorage.removeItem("kalkylpal_token");
}

/**
 * Wraps fetch with Authorization header and handles 401 → redirect to login.
 */
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects() {
  const res = await apiFetch(`${BASE}/projects/`);
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function createProject(name, description = "") {
  const res = await apiFetch(`${BASE}/projects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function getProject(projectId) {
  const res = await apiFetch(`${BASE}/projects/${projectId}`);
  if (!res.ok) throw new Error("Failed to load project");
  return res.json();
}

export async function getProjectSummary(projectId) {
  const res = await apiFetch(`${BASE}/projects/${projectId}/summary`);
  if (!res.ok) throw new Error("Failed to load summary");
  return res.json();
}

export async function updateProject(projectId, data) {
  const res = await apiFetch(`${BASE}/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}

// ── Drawings ──────────────────────────────────────────────────────────────────

export async function uploadDrawing(projectId, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(
    `${BASE}/drawings/upload?project_id=${projectId}`,
    {
      method: "POST",
      body: form,
    },
  );
  if (!res.ok) throw new Error("Failed to upload drawing");
  return res.json();
}

export async function scanDrawing(drawingId, searchCode = "") {
  const params = searchCode
    ? `?search_code=${encodeURIComponent(searchCode)}`
    : "";
  const res = await apiFetch(`${BASE}/drawings/${drawingId}/scan${params}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to scan drawing");
  return res.json();
}

export async function getComponents(drawingId, baseCode = "") {
  const params = baseCode ? `?base_code=${encodeURIComponent(baseCode)}` : "";
  const res = await apiFetch(
    `${BASE}/drawings/${drawingId}/components${params}`,
  );
  if (!res.ok) throw new Error("Failed to load components");
  return res.json();
}

/**
 * Image URL — uses the public endpoint since <img src> can't send auth headers.
 */
export function getPageImageUrl(drawingId, pageNumber, dpi = 150) {
  return `${BASE}/public/drawings/${drawingId}/page/${pageNumber}/image?dpi=${dpi}`;
}

export async function getPageInfo(drawingId, pageNumber) {
  const res = await apiFetch(
    `${BASE}/drawings/${drawingId}/page/${pageNumber}/info`,
  );
  if (!res.ok) throw new Error("Failed to load page info");
  return res.json();
}

export async function deleteDrawing(drawingId) {
  const res = await apiFetch(`${BASE}/drawings/${drawingId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete drawing");
  return res.json();
}

export async function deleteProject(projectId) {
  const res = await apiFetch(`${BASE}/projects/${projectId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Kunde inte ta bort projekt");
  return res.json();
}

// ── Persisted scan results & manual items ─────────────────────────────────────

export async function getScanResult(drawingId) {
  const res = await apiFetch(`${BASE}/drawings/${drawingId}/scan-result`);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error("Failed to load scan result");
  return res.json();
}

export async function addManualItem(drawingId, item) {
  const res = await apiFetch(`${BASE}/drawings/${drawingId}/manual-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: item.code,
      base_code: item.base_code,
      page: item.page,
      x0: item.x0 ?? null,
      y0: item.y0 ?? null,
      x1: item.x1 ?? null,
      y1: item.y1 ?? null,
    }),
  });
  if (!res.ok) throw new Error("Failed to save manual item");
  return res.json();
}

export async function getManualItems(drawingId) {
  const res = await apiFetch(`${BASE}/drawings/${drawingId}/manual-items`);
  if (!res.ok) throw new Error("Failed to load manual items");
  return res.json();
}

export async function deleteManualItem(drawingId, itemId) {
  const res = await apiFetch(
    `${BASE}/drawings/${drawingId}/manual-items/${itemId}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to delete manual item");
  return res.json();
}

export async function clearDrawingData(drawingId) {
  const res = await apiFetch(`${BASE}/drawings/${drawingId}/clear-data`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to clear drawing data");
  return res.json();
}

export async function saveBatchResult(projectId, batchState) {
  const res = await apiFetch(`${BASE}/projects/${projectId}/batch-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchState),
  });
  if (!res.ok) throw new Error("Failed to save batch result");
  return res.json();
}

export async function getBatchResult(projectId) {
  const res = await apiFetch(`${BASE}/projects/${projectId}/batch-result`);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error("Failed to load batch result");
  return res.json();
}

export async function clearProjectData(projectId) {
  const res = await apiFetch(`${BASE}/projects/${projectId}/clear-data`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to clear project data");
  return res.json();
}

// ── AI Chat ───────────────────────────────────────────────────────────────────

export async function getChatHistory(projectId) {
  const res = await apiFetch(`${BASE}/projects/${projectId}/chat`);
  if (!res.ok) throw new Error("Failed to load chat history");
  return res.json();
}

export async function sendChatMessage(projectId, message) {
  const res = await apiFetch(`${BASE}/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function clearChatHistory(projectId) {
  const res = await apiFetch(`${BASE}/projects/${projectId}/chat`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to clear chat");
  return res.json();
}

export async function getAnnotatedPdf(drawingId, pageNumber, boxes) {
  const res = await apiFetch(
    `${BASE}/drawings/${drawingId}/page/${pageNumber}/annotated-pdf`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boxes }),
    },
  );
  if (!res.ok) throw new Error("Failed to get annotated PDF");
  return res.blob();
}
