import { useState, useEffect } from "react";
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
      showStatus(`${file.name} uppladdad`);
    } catch {
      showStatus("Upload failed");
    } finally {
      setLoading(false);
    }
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
        />

        <ComponentPanel
          drawingId={selectedDrawing?.id}
          scanResult={scanResult}
          manualItems={manualItems}
          highlightCode={highlightCode}
          loading={loading}
          onScan={handleScan}
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
            <div className="modal-title">Nytt Projekt</div>
            <input
              className="input"
              placeholder="Projektnamn"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              autoFocus
            />
            <input
              className="input"
              placeholder="Beskrivning (frivilligt)"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowNewProjectModal(false)}
              >
                Avbryt
              </button>
              <button className="btn btn-amber" onClick={handleCreateProject}>
                Skapa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
