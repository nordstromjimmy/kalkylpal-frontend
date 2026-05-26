/**
 * api.js — All communication with the FastAPI backend.
 *
 * Keeping all fetch() calls in one file means:
 *  - If the backend URL changes, we change it in one place
 *  - Easy to see every API call the app makes
 *  - Components stay clean — they call functions, not raw fetch()
 */

const BASE = "http://localhost:8000";

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
