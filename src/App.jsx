import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import DrawingViewer from "./components/DrawingViewer";
import KalkylView from "./components/KalkylView";
import ProjectInfoPanel from "./components/ProjectInfoPanel";
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
  getScanResult,
  addManualItem,
  getManualItems,
  clearDrawingData,
  saveBatchResult,
  getBatchResult,
  clearProjectData,
  updateProject,
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
  const [step, setStep] = useState("scan"); // "scan" | "kalkyl"
  const [kalkylData, setKalkylData] = useState({}); // { "TD201-160": { price: "", hours: "" } }

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
    setStep("scan");
    setKalkylData({});
    // Restore saved batch state for this project
    try {
      const saved = await getBatchResult(project.id);
      setBatchState(saved || null);
    } catch {
      setBatchState(null);
    }
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

  async function handleSelectDrawing(drawing, codes = null) {
    setSelectedDrawing(drawing);
    setScanResult(null);
    setManualItems([]);
    setPageNumber(1);
    setPageCount(1);
    setHighlightCode(null);

    // Normal navigation (no codes) — restore saved state from DB
    if (!codes || codes.length === 0) {
      setLoading(true);
      try {
        const [savedResult, savedManuals] = await Promise.all([
          getScanResult(drawing.id),
          getManualItems(drawing.id),
        ]);
        if (savedResult) {
          // Use String() to ensure key matches regardless of number vs string type
          const batchWarnings =
            batchState?.results?.[String(drawing.id)]?.warnings || [];
          setScanResult({ ...savedResult, warnings: batchWarnings });
          const pages = Object.values(savedResult.components)
            .flat()
            .map((c) => c.page);
          if (pages.length > 0) setPageCount(Math.max(...pages));
        } else {
          // No scan result in DB — check if batchState has warnings for this drawing
          const batchRow = batchState?.results?.[String(drawing.id)];
          if (batchRow?.warnings?.length > 0) {
            setScanResult({
              total_found: 0,
              components: {},
              warnings: batchRow.warnings,
            });
          }
        }
        setManualItems(savedManuals || []);
      } catch {
        // No saved data — start fresh, that's fine
      } finally {
        setLoading(false);
      }
      return;
    }

    // If codes are provided (navigating from batch results modal),
    // automatically run a merged scan for all codes on this drawing.
    if (codes && codes.length > 0) {
      setLoading(true);
      showStatus(`Skannar ${drawing.filename}…`);
      try {
        // Fetch page dimensions explicitly before scanning so they are
        // guaranteed to be set when setScanResult fires and the highlight
        // layer tries to render. Without this, the useEffect that normally
        // fetches dimensions races against the scan and often loses.
        try {
          const dims = await getPageInfo(drawing.id, 1);
          setPageDimensions(dims);
        } catch {
          setPageDimensions(null);
        }

        const mergedComponents = {};
        const mergedWarnings = [];
        let totalFound = 0;

        for (const code of codes) {
          const result = await scanDrawing(drawing.id, code);
          for (const [base, instances] of Object.entries(result.components)) {
            if (!mergedComponents[base]) mergedComponents[base] = [];
            mergedComponents[base].push(...instances);
          }
          for (const w of result.warnings || []) {
            if (!mergedWarnings.find((e) => e.x0 === w.x0 && e.y0 === w.y0)) {
              mergedWarnings.push(w);
            }
          }
          totalFound += result.total_found;
        }

        setScanResult({
          total_found: totalFound,
          components: mergedComponents,
          warnings: mergedWarnings,
        });
        const pages = Object.values(mergedComponents)
          .flat()
          .map((c) => c.page);
        if (pages.length > 0) setPageCount(Math.max(...pages));
        showStatus(`Hittade ${totalFound} komponenter i ${drawing.filename}`);
      } catch {
        showStatus("Skanning misslyckades");
      } finally {
        setLoading(false);
      }
    }
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

  async function handleManualAdd(item) {
    // 1. Save to DB and add to local manualItems list
    if (selectedDrawing) {
      try {
        const saved = await addManualItem(selectedDrawing.id, item);
        setManualItems((prev) => [...prev, { ...item, id: saved.id }]);
      } catch {
        setManualItems((prev) => [...prev, item]);
      }
    } else {
      setManualItems((prev) => [...prev, item]);
    }

    // 2. Merge into batchState so the item appears in Excel/PDF exports.
    // We add to breakdown and components but NOT to total, so Sammanfattning
    // doesn't double-count (it sums batchState.total + manualItems.length separately).
    if (selectedDrawing && batchState?.results) {
      setBatchState((prev) => {
        if (!prev?.results) return prev;
        const drawingId = selectedDrawing.id;
        const row = prev.results[drawingId];
        if (!row) return prev;

        // Add to breakdown: { base_code: { full_code: count } }
        const newBreakdown = { ...row.breakdown };
        if (!newBreakdown[item.base_code]) newBreakdown[item.base_code] = {};
        newBreakdown[item.base_code] = {
          ...newBreakdown[item.base_code],
          [item.code]: (newBreakdown[item.base_code][item.code] || 0) + 1,
        };

        // Add to components array (used for bulk PNG download highlight boxes)
        const newComponents = [
          ...(row.components || []),
          {
            code: item.code,
            base_code: item.base_code,
            page: item.page,
            x0: item.x0,
            y0: item.y0,
            x1: item.x1,
            y1: item.y1,
          },
        ];

        const updated = {
          ...prev,
          results: {
            ...prev.results,
            [drawingId]: {
              ...row,
              breakdown: newBreakdown,
              components: newComponents,
              total: row.total + 1,
            },
          },
        };

        if (selectedProject) {
          saveBatchResult(selectedProject.id, updated).catch(() => {});
        }
        return updated;
      });
    }
  }

  // Merges a new batch scan into the existing batchState.
  // New codes overwrite old for the same drawings; drawings not in the new scan keep their results.
  // Uses startsWith matching so searching "TD" correctly supersedes "TD201", "TD301" etc.
  function mergeBatchState(existing, newScan) {
    if (!existing || !existing.results) return { ...newScan, status: "done" };

    // Remove existing codes that are subsumed by any new code (e.g. "TD" supersedes "TD201").
    // Keep codes that have no overlap with the new search.
    const newCodes = newScan.codes || [];
    const filteredOldCodes = (existing.codes || []).filter(
      (oldCode) =>
        !newCodes.some(
          (newCode) =>
            oldCode.startsWith(newCode) || newCode.startsWith(oldCode),
        ),
    );
    const allCodes = [...new Set([...filteredOldCodes, ...newCodes])];

    const mergedResults = { ...(existing.results || {}) };

    for (const [drawingId, newRow] of Object.entries(newScan.results || {})) {
      const existingRow = mergedResults[drawingId];
      if (!existingRow) {
        mergedResults[drawingId] = newRow;
      } else {
        // Remove existing breakdown keys subsumed by any new code
        const cleanedBreakdown = Object.fromEntries(
          Object.entries(existingRow.breakdown || {}).filter(
            ([oldKey]) =>
              !newCodes.some(
                (newCode) =>
                  oldKey.startsWith(newCode) || newCode.startsWith(oldKey),
              ),
          ),
        );
        const mergedBreakdown = {
          ...cleanedBreakdown,
          ...(newRow.breakdown || {}),
        };

        // Remove old component instances for any base_code matched by the new search codes,
        // then add the fresh instances. Uses startsWith so "TD" removes TD201, TD301 etc.
        const existingComponents = (existingRow.components || []).filter(
          (c) =>
            !newCodes.some(
              (code) =>
                c.base_code.startsWith(code) || code.startsWith(c.base_code),
            ),
        );
        const mergedComponents = [
          ...existingComponents,
          ...(newRow.components || []),
        ];

        // Recalculate total from merged breakdown
        const total = Object.values(mergedBreakdown).reduce(
          (sum, variants) =>
            sum + Object.values(variants).reduce((s, n) => s + n, 0),
          0,
        );

        mergedResults[drawingId] = {
          ...existingRow,
          breakdown: mergedBreakdown,
          components: mergedComponents,
          total,
          pageDimensions: newRow.pageDimensions || existingRow.pageDimensions,
        };
      }
    }

    return {
      status: "done",
      codes: allCodes,
      progress: newScan.progress,
      currentFile: "",
      results: mergedResults,
    };
  }

  async function handleBatchScan(drawingIds, codes) {
    const preScanBatchState = batchState; // capture before overwriting with "running" state
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

      // Fetch page dimensions for this drawing (used by bulk download)
      let pageDimensions = null;
      try {
        pageDimensions = await getPageInfo(drawingIds[i], 1);
      } catch {
        /* non-critical — download will skip this drawing if missing */
      }

      // Scan each code separately and collect full variant breakdown
      // e.g. "TD201" → { "TD201-125": 2, "TD201-160": 3 }
      // Also keep raw instances (x/y coordinates) for image rendering.
      const breakdown = {};
      const allInstances = [];
      const allWarnings = [];
      let total = 0;
      for (const code of codes) {
        if (batchAbortRef.current) break;
        try {
          const res = await scanDrawing(drawingIds[i], code);
          const variantCounts = {};
          for (const instances of Object.values(res.components)) {
            for (const inst of instances) {
              variantCounts[inst.code] = (variantCounts[inst.code] || 0) + 1;
              allInstances.push(inst);
            }
          }
          breakdown[code] = variantCounts;
          total += res.total_found;
          for (const w of res.warnings || []) {
            if (!allWarnings.find((e) => e.x0 === w.x0 && e.y0 === w.y0)) {
              allWarnings.push(w);
            }
          }
        } catch {
          breakdown[code] = {};
        }
      }

      results[drawingIds[i]] = {
        filename,
        breakdown,
        total,
        components: allInstances,
        warnings: allWarnings,
        pageDimensions,
      };
    }

    const newScan = {
      status: "done",
      codes,
      progress: { current: drawingIds.length, total: drawingIds.length },
      currentFile: "",
      results,
    };

    // Merge into pre-scan state so previous searches accumulate
    const merged = mergeBatchState(preScanBatchState, newScan);
    setBatchState(merged);

    // Persist to DB so results survive page refresh
    if (selectedProject) {
      try {
        await saveBatchResult(selectedProject.id, merged);
      } catch (e) {
        console.error("Save batch failed:", e);
      }
    }
  }

  function handleBatchAbort() {
    batchAbortRef.current = true;
    setBatchState((prev) => (prev ? { ...prev, status: "done" } : null));
  }

  // Remove a warning from batchState (by drawing id + position) and persist.
  // This is the single source of truth — no separate dismissed-set needed.
  function handleDismissWarning({ drawingId, x0, y0 }) {
    setBatchState((prev) => {
      if (!prev?.results) return prev;
      const row = prev.results[drawingId];
      if (!row) return prev;
      const updated = {
        ...prev,
        results: {
          ...prev.results,
          [drawingId]: {
            ...row,
            warnings: (row.warnings || []).filter(
              (w) => !(w.x0 === x0 && w.y0 === y0),
            ),
          },
        },
      };
      // Persist immediately so warning doesn't return on refresh
      if (selectedProject) {
        saveBatchResult(selectedProject.id, updated).catch(() => {});
      }
      return updated;
    });
    // Also remove from current scanResult so ComponentPanel warning disappears
    setScanResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        warnings: (prev.warnings || []).filter(
          (w) => !(w.x0 === x0 && w.y0 === y0),
        ),
      };
    });
  }

  async function handleResetAll() {
    if (!selectedDrawing) return;

    // Clear scan result and manual items for current drawing only
    setScanResult(null);
    setManualItems([]);
    setHighlightCode(null);

    // Remove only this drawing from batchState, keeping other drawings intact
    if (batchState?.results) {
      setBatchState((prev) => {
        if (!prev?.results) return prev;
        const updatedResults = { ...prev.results };
        delete updatedResults[selectedDrawing.id];
        const updated = { ...prev, results: updatedResults };
        // Persist updated batchState without this drawing
        if (selectedProject) {
          saveBatchResult(selectedProject.id, updated).catch(() => {});
        }
        return updated;
      });
    }

    // Clear DB scan data for this drawing only
    try {
      await clearDrawingData(selectedDrawing.id);
    } catch {
      /* non-critical */
    }
    showStatus("Ritningens resultat rensade");
  }

  async function handleResetProject() {
    if (!selectedProject) return;
    setBatchState(null);
    setScanResult(null);
    setManualItems([]);
    setHighlightCode(null);
    try {
      await clearProjectData(selectedProject.id);
    } catch (e) {
      console.error("clearProjectData failed:", e);
    }
    showStatus("Alla resultat i projektet rensade");
  }

  async function handleUpdateProject(data) {
    if (!selectedProject) return;
    try {
      const updated = await updateProject(selectedProject.id, data);
      // Update selectedProject in-place so UI reflects changes immediately
      setSelectedProject((prev) => ({ ...prev, ...updated }));
      // Also update the project in the sidebar list
      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProject.id ? { ...p, name: updated.name } : p,
        ),
      );
      showStatus("Projektinfo sparad");
    } catch {
      showStatus("Kunde inte spara projektinfo");
    }
  }

  function handleKalkylChange(variant, field, value) {
    setKalkylData((prev) => ({
      ...prev,
      [variant]: { ...(prev[variant] || {}), [field]: value },
    }));
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
          <span className="topbar-sub">Din Kalkyl Kompis</span>
          {batchState?.results && (
            <>
              <div className="topbar-sep" />
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                }}
              >
                <button
                  className="btn"
                  onClick={() => setStep("scan")}
                  style={{
                    borderRadius: 0,
                    border: "none",
                    padding: "4px 14px",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    background:
                      step === "scan" ? "var(--ui-white)" : "transparent",
                    color: step === "scan" ? "var(--bg-0)" : "var(--text-dim)",
                    letterSpacing: "0.06em",
                  }}
                >
                  Steg 1 — Skanning
                </button>
                <button
                  className="btn"
                  onClick={() => setStep("kalkyl")}
                  style={{
                    borderRadius: 0,
                    border: "none",
                    padding: "4px 14px",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    background:
                      step === "kalkyl" ? "var(--ui-white)" : "transparent",
                    color:
                      step === "kalkyl" ? "var(--bg-0)" : "var(--text-dim)",
                    letterSpacing: "0.06em",
                  }}
                >
                  Steg 2 — Kalkyl
                </button>
              </div>
            </>
          )}
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

        {step === "scan" ? (
          <>
            {!selectedDrawing && selectedProject ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  background: "var(--bg-0)",
                }}
              >
                <ProjectInfoPanel
                  project={selectedProject}
                  onSave={handleUpdateProject}
                />
              </div>
            ) : (
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
                onOpenChat={() => setSelectedDrawing(null)}
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
            )}

            <ComponentPanel
              drawingId={selectedDrawing?.id}
              scanResult={scanResult}
              manualItems={manualItems}
              highlightCode={highlightCode}
              loading={loading}
              onScan={handleScan}
              onClearScan={async () => {
                setScanResult(null);
                setManualItems([]);
                setHighlightCode(null);
                if (selectedDrawing) {
                  try {
                    await clearDrawingData(selectedDrawing.id);
                  } catch {
                    /* non-critical */
                  }
                }
              }}
              projectName={selectedProject?.name || "Projekt"}
              projectDrawings={selectedProject?.drawings || []}
              hasProject={!!selectedProject}
              batchState={batchState}
              onBatchScan={handleBatchScan}
              onBatchAbort={handleBatchAbort}
              onSelectDrawing={handleSelectDrawing}
              onHighlight={setHighlightCode}
              onManualAdd={handleManualAdd}
              onResetAll={handleResetAll}
              onResetProject={selectedProject ? handleResetProject : null}
              onDismissWarning={handleDismissWarning}
            />
          </>
        ) : (
          <div
            style={{
              gridColumn: "2 / -1",
              display: "flex",
              background: "var(--bg-1)",
              overflow: "hidden",
            }}
          >
            <KalkylView
              projectName={selectedProject?.name || "Projekt"}
              batchState={batchState}
              kalkylData={kalkylData}
              onKalkylChange={handleKalkylChange}
            />
          </div>
        )}
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
