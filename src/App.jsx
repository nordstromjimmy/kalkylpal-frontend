import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import DrawingViewer from "./components/DrawingViewer";
import ComponentPanel from "./components/ComponentPanel";
import {
  getProjects,
  getProject,
  createProject,
  uploadDrawing,
  scanDrawing,
  getPageInfo,
  deleteDrawing,
  deleteProject,
} from "./api";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [pageDimensions, setPageDimensions] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [manualItems, setManualItems] = useState([]);
  const [highlightCode, setHighlightCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [batchState, setBatchState] = useState(null);
  // Abort flag — set to true to stop the batch loop after the current drawing
  const batchAbortRef = useRef(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedDrawing) return;
    getPageInfo(selectedDrawing.id, pageNumber)
      .then(setPageDimensions)
      .catch(() => setPageDimensions(null));
  }, [selectedDrawing, pageNumber]);

  async function loadProjects() {
    try {
      setProjects(await getProjects());
    } catch {
      showStatus("Could not load projects — is the backend running?");
    }
  }

  async function handleSelectProject(project) {
    const full = await getProject(project.id);
    setSelectedProject(full);
    setSelectedDrawing(null);
    setScanResult(null);
    setManualItems([]);
    setPageNumber(1);
    setHighlightCode(null);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    try {
      await createProject(newProjectName.trim(), newProjectDesc.trim());
      setNewProjectName("");
      setNewProjectDesc("");
      setShowNewProjectModal(false);
      await loadProjects();
      showStatus(`Project "${newProjectName}" created`);
    } catch {
      showStatus("Failed to create project");
    }
  }

  async function handleUpload(file) {
    if (!selectedProject) return;
    setLoading(true);
    showStatus(`Uploading ${file.name}…`);
    try {
      await uploadDrawing(selectedProject.id, file);
      setSelectedProject(await getProject(selectedProject.id));
      showStatus(`${file.name} uploaded`);
    } catch {
      showStatus("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  function handlePrevDrawing() {
    const drawings = selectedProject?.drawings || [];
    const idx = drawings.findIndex((d) => d.id === selectedDrawing?.id);
    if (idx > 0) handleSelectDrawing(drawings[idx - 1]);
  }

  function handleNextDrawing() {
    const drawings = selectedProject?.drawings || [];
    const idx = drawings.findIndex((d) => d.id === selectedDrawing?.id);
    if (idx < drawings.length - 1) handleSelectDrawing(drawings[idx + 1]);
  }

  async function handleDeleteProject(project) {
    try {
      await deleteProject(project.id);
      // If the deleted project was selected, clear everything
      if (selectedProject?.id === project.id) {
        setSelectedProject(null);
        setSelectedDrawing(null);
        setScanResult(null);
        setManualItems([]);
        setPageNumber(1);
        setHighlightCode(null);
      }
      await loadProjects();
      showStatus(`Projekt "${project.name}" borttaget`);
    } catch {
      showStatus("Kunde inte ta bort projektet");
    }
  }

  async function handleDeleteDrawing(drawing) {
    try {
      await deleteDrawing(drawing.id);
      // If the deleted drawing was selected, clear the viewer
      if (selectedDrawing?.id === drawing.id) {
        setSelectedDrawing(null);
        setScanResult(null);
        setManualItems([]);
        setPageNumber(1);
        setHighlightCode(null);
      }
      // Reload the project so the sidebar drawing list updates
      setSelectedProject(await getProject(selectedProject.id));
      showStatus(`${drawing.filename} deleted`);
    } catch {
      showStatus("Failed to delete drawing");
    }
  }

  function handleSelectDrawing(drawing) {
    setSelectedDrawing(drawing);
    setScanResult(null);
    setManualItems([]);
    setPageNumber(1);
    setPageCount(1);
    setHighlightCode(null);
  }

  async function handleScan(searchCode) {
    if (!selectedDrawing) return;
    setLoading(true);
    setScanResult(null);
    setHighlightCode(null);
    showStatus(`Scanning${searchCode ? ` for "${searchCode}"` : ""}…`);
    try {
      const result = await scanDrawing(selectedDrawing.id, searchCode);
      setScanResult(result);
      showStatus(
        `Found ${result.total_found} component instance${result.total_found !== 1 ? "s" : ""}`,
      );
      const pages = Object.values(result.components)
        .flat()
        .map((c) => c.page);
      if (pages.length > 0) setPageCount(Math.max(...pages));
    } catch {
      showStatus("Scan failed");
    } finally {
      setLoading(false);
    }
  }

  function handleManualAdd(item) {
    setManualItems((prev) => [...prev, item]);
  }

  async function handleBatchScan(drawingIds, codes) {
    batchAbortRef.current = false;
    setBatchState({
      status: "running",
      codes,
      progress: { current: 0, total: drawingIds.length },
      currentFile: "",
      results: {},
    });

    const results = {};

    for (let i = 0; i < drawingIds.length; i++) {
      // Check abort flag before each drawing
      if (batchAbortRef.current) break;

      const drawing = selectedProject.drawings.find(
        (d) => d.id === drawingIds[i],
      );
      const filename = drawing?.filename ?? `Ritning ${drawingIds[i]}`;

      setBatchState((prev) => ({
        ...prev,
        progress: { current: i + 1, total: drawingIds.length },
        currentFile: filename,
      }));

      // Scan each code separately and collect full variant breakdown
      // e.g. "TD201" → { "TD201-125": 2, "TD201-160": 3 }
      const breakdown = {};
      let total = 0;
      for (const code of codes) {
        if (batchAbortRef.current) break;
        try {
          const res = await scanDrawing(drawingIds[i], code);
          // Flatten instances by full code (e.g. "TD201-160")
          const variantCounts = {};
          for (const instances of Object.values(res.components)) {
            for (const inst of instances) {
              variantCounts[inst.code] = (variantCounts[inst.code] || 0) + 1;
            }
          }
          breakdown[code] = variantCounts;
          total += res.total_found;
        } catch {
          breakdown[code] = {};
        }
      }

      results[drawingIds[i]] = { filename, breakdown, total };
    }

    setBatchState((prev) => ({
      ...prev,
      status: batchAbortRef.current ? "done" : "done",
      results,
    }));
  }

  function handleBatchAbort() {
    batchAbortRef.current = true;
    setBatchState((prev) => (prev ? { ...prev, status: "done" } : null));
  }

  function showStatus(msg) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 3500);
  }

  const allComponents = scanResult
    ? Object.values(scanResult.components).flat()
    : [];

  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <span className="topbar-logo">
            KALKYL<span>PAL</span>
          </span>
          <div className="topbar-sep" />
          <span className="topbar-sub">VVS Component Scanner</span>
          {statusMsg && (
            <>
              <div className="topbar-sep" />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--amber)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {statusMsg}
              </span>
            </>
          )}
        </header>

        <Sidebar
          projects={projects}
          selectedProject={selectedProject}
          selectedDrawing={selectedDrawing}
          onSelectProject={handleSelectProject}
          onSelectDrawing={handleSelectDrawing}
          onNewProject={() => setShowNewProjectModal(true)}
          onUpload={handleUpload}
          onDeleteDrawing={handleDeleteDrawing}
          onDeleteProject={handleDeleteProject}
        />

        <DrawingViewer
          drawingId={selectedDrawing?.id}
          pageNumber={pageNumber}
          pageCount={pageCount}
          pageDimensions={pageDimensions}
          components={allComponents}
          warnings={scanResult?.warnings || []}
          manualItems={manualItems}
          highlightCode={highlightCode}
          onPageChange={setPageNumber}
          onPrevDrawing={handlePrevDrawing}
          onNextDrawing={handleNextDrawing}
          hasPrevDrawing={(() => {
            const d = selectedProject?.drawings || [];
            const i = d.findIndex((x) => x.id === selectedDrawing?.id);
            return i > 0;
          })()}
          hasNextDrawing={(() => {
            const d = selectedProject?.drawings || [];
            const i = d.findIndex((x) => x.id === selectedDrawing?.id);
            return i >= 0 && i < d.length - 1;
          })()}
        />

        <ComponentPanel
          drawingId={selectedDrawing?.id}
          scanResult={scanResult}
          manualItems={manualItems}
          highlightCode={highlightCode}
          loading={loading}
          onScan={handleScan}
          onClearScan={() => {
            setScanResult(null);
            setManualItems([]);
            setHighlightCode(null);
          }}
          projectName={selectedProject?.name || "Projekt"}
          projectDrawings={selectedProject?.drawings || []}
          batchState={batchState}
          onBatchScan={handleBatchScan}
          onBatchAbort={handleBatchAbort}
          onSelectDrawing={handleSelectDrawing}
          onHighlight={setHighlightCode}
          onManualAdd={handleManualAdd}
        />
      </div>

      {showNewProjectModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowNewProjectModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">// New Project</div>
            <input
              className="input"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              autoFocus
            />
            <input
              className="input"
              placeholder="Description (optional)"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowNewProjectModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-amber" onClick={handleCreateProject}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
