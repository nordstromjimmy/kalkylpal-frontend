/**
 * api.js — All communication with the FastAPI backend.
 *
 * Keeping all fetch() calls in one file means:
 *  - If the backend URL changes, we change it in one place
 *  - Easy to see every API call the app makes
 *  - Components stay clean — they call functions, not raw fetch()
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Projects ─────────────────────────────────────────────────────────────────

export async function getProjects() {
  const res = await fetch(`${BASE}/projects/`);
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function createProject(name, description = "") {
  const res = await fetch(`${BASE}/projects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function getProject(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}`);
  if (!res.ok) throw new Error("Failed to load project");
  return res.json();
}

export async function getProjectSummary(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/summary`);
  if (!res.ok) throw new Error("Failed to load summary");
  return res.json();
}

// ── Drawings ──────────────────────────────────────────────────────────────────

export async function uploadDrawing(projectId, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/drawings/upload?project_id=${projectId}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload drawing");
  return res.json();
}

export async function scanDrawing(drawingId, searchCode = "") {
  const params = searchCode
    ? `?search_code=${encodeURIComponent(searchCode)}`
    : "";
  const res = await fetch(`${BASE}/drawings/${drawingId}/scan${params}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to scan drawing");
  return res.json();
}

export async function getComponents(drawingId, baseCode = "") {
  const params = baseCode ? `?base_code=${encodeURIComponent(baseCode)}` : "";
  const res = await fetch(`${BASE}/drawings/${drawingId}/components${params}`);
  if (!res.ok) throw new Error("Failed to load components");
  return res.json();
}

/**
 * Returns the URL string for the page image.
 * We return a URL rather than fetching bytes because we set it as <img src>.
 */
export function getPageImageUrl(drawingId, pageNumber, dpi = 150) {
  return `${BASE}/drawings/${drawingId}/page/${pageNumber}/image?dpi=${dpi}`;
}

export async function getPageInfo(drawingId, pageNumber) {
  const res = await fetch(
    `${BASE}/drawings/${drawingId}/page/${pageNumber}/info`,
  );
  if (!res.ok) throw new Error("Failed to load page info");
  return res.json(); // { width, height, page_number }
}

export async function deleteDrawing(drawingId) {
  const res = await fetch(`${BASE}/drawings/${drawingId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete drawing");
  return res.json();
}

export async function deleteProject(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Kunde inte ta bort projekt");
  return res.json();
}

// ── Persisted scan results & manual items ─────────────────────────────────────

/**
 * Loads the last scan result from stored ComponentInstances.
 * Returns null if no scan has been run for this drawing.
 */
export async function getScanResult(drawingId) {
  const res = await fetch(`${BASE}/drawings/${drawingId}/scan-result`);
  if (res.status === 204) return null; // no scan stored
  if (!res.ok) throw new Error("Failed to load scan result");
  return res.json();
}

export async function addManualItem(drawingId, item) {
  const res = await fetch(`${BASE}/drawings/${drawingId}/manual-items`, {
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
  return res.json(); // returns { id, code, ... } — id needed for future deletion
}

export async function getManualItems(drawingId) {
  const res = await fetch(`${BASE}/drawings/${drawingId}/manual-items`);
  if (!res.ok) throw new Error("Failed to load manual items");
  return res.json();
}

export async function deleteManualItem(drawingId, itemId) {
  const res = await fetch(
    `${BASE}/drawings/${drawingId}/manual-items/${itemId}`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) throw new Error("Failed to delete manual item");
  return res.json();
}

export async function clearDrawingData(drawingId) {
  const res = await fetch(`${BASE}/drawings/${drawingId}/clear-data`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to clear drawing data");
  return res.json();
}

export async function saveBatchResult(projectId, batchState) {
  const res = await fetch(`${BASE}/projects/${projectId}/batch-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchState),
  });
  if (!res.ok) throw new Error("Failed to save batch result");
  return res.json();
}

export async function getBatchResult(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/batch-result`);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error("Failed to load batch result");
  return res.json();
}

export async function clearProjectData(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/clear-data`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to clear project data");
  return res.json();
}

export async function updateProject(projectId, data) {
  const res = await fetch(`${BASE}/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}
