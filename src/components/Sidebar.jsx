import { useRef, useState } from "react";

export default function Sidebar({
  projects = [],
  selectedProject = null,
  selectedDrawing = null,
  onSelectProject,
  onSelectDrawing,
  onNewProject,
  onUpload,
  onDeleteDrawing,
  onDeleteProject,
}) {
  const fileInputRef = useRef(null);
  const [confirmDeleteDrawingId, setConfirmDeleteDrawingId] = useState(null);
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState(null);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      onUpload(file);
      e.target.value = "";
    }
  }

  // ── Ritning borttagning ──
  function handleDrawingDeleteClick(e, drawing) {
    e.stopPropagation();
    setConfirmDeleteDrawingId(drawing.id);
  }
  function handleConfirmDeleteDrawing(e, drawing) {
    e.stopPropagation();
    setConfirmDeleteDrawingId(null);
    onDeleteDrawing(drawing);
  }
  function handleCancelDeleteDrawing(e) {
    e.stopPropagation();
    setConfirmDeleteDrawingId(null);
  }

  // ── Projekt borttagning ──
  function handleProjectDeleteClick(e, project) {
    e.stopPropagation();
    setConfirmDeleteProjectId(project.id);
  }
  function handleConfirmDeleteProject(e, project) {
    e.stopPropagation();
    setConfirmDeleteProjectId(null);
    onDeleteProject(project);
  }
  function handleCancelDeleteProject(e) {
    e.stopPropagation();
    setConfirmDeleteProjectId(null);
  }

  return (
    <aside className="sidebar">
      {/* ── Projekt ── */}
      <div className="sidebar-section">
        <div className="sidebar-label">Projekt</div>
        {projects.length === 0 && (
          <div
            style={{
              padding: "0 16px 8px",
              color: "var(--text-dim)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
          >
            Inga projekt än
          </div>
        )}
        {projects.map((p) => (
          <div key={p.id}>
            {/* ── Normal projektrad ── */}
            {confirmDeleteProjectId !== p.id && (
              <div
                className={`sidebar-item ${selectedProject?.id === p.id ? "active" : ""}`}
                onClick={() => onSelectProject(p)}
                style={{ justifyContent: "space-between", paddingRight: 8 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    overflow: "hidden",
                  }}
                >
                  <span className="sidebar-item-icon">▸</span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </span>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => handleProjectDeleteClick(e, p)}
                  title="Ta bort projekt"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ── Bekräfta borttagning av projekt ── */}
            {confirmDeleteProjectId === p.id && (
              <div
                style={{
                  padding: "6px 10px",
                  background: "var(--red-dim)",
                  borderLeft: "2px solid var(--red)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--red)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Ta bort "{p.name}"?
                </span>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  Alla ritningar raderas permanent.
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    className="btn"
                    style={{
                      padding: "2px 8px",
                      fontSize: 10,
                      background: "var(--red)",
                      color: "#fff",
                      border: "none",
                      flex: 1,
                    }}
                    onClick={(e) => handleConfirmDeleteProject(e, p)}
                  >
                    Ja, ta bort allt
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "2px 8px", fontSize: 10 }}
                    onClick={handleCancelDeleteProject}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{ padding: "8px 16px 4px" }}>
          <button className="btn btn-ghost btn-full" onClick={onNewProject}>
            + Nytt projekt
          </button>
        </div>
      </div>

      {/* ── Ritningar ── */}
      <div
        className="sidebar-section"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderBottom: "none",
        }}
      >
        <div className="sidebar-label">
          {selectedProject
            ? `Ritningar — ${selectedProject.name}`
            : "Ritningar"}
        </div>

        {!selectedProject ? (
          <div
            style={{
              padding: "0 16px",
              color: "var(--text-dim)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
          >
            Välj ett projekt
          </div>
        ) : (
          <>
            <div className="sidebar-scroll">
              {selectedProject.drawings?.length === 0 && (
                <div
                  style={{
                    padding: "0 16px 8px",
                    color: "var(--text-dim)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Inga ritningar än
                </div>
              )}
              {selectedProject.drawings?.map((d) => (
                <div key={d.id}>
                  {/* ── Normal ritningsrad ── */}
                  {confirmDeleteDrawingId !== d.id && (
                    <div
                      className={`sidebar-item ${selectedDrawing?.id === d.id ? "active" : ""}`}
                      onClick={() => onSelectDrawing(d)}
                      title={d.filename}
                      style={{
                        justifyContent: "space-between",
                        paddingRight: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          overflow: "hidden",
                        }}
                      >
                        <span className="sidebar-item-icon">📄</span>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 11.5,
                          }}
                        >
                          {d.filename}
                        </span>
                      </div>
                      <button
                        className="delete-btn"
                        onClick={(e) => handleDrawingDeleteClick(e, d)}
                        title="Ta bort ritning"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* ── Bekräfta borttagning av ritning ── */}
                  {confirmDeleteDrawingId === d.id && (
                    <div
                      style={{
                        padding: "6px 10px",
                        background: "var(--red-dim)",
                        borderLeft: "2px solid var(--red)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "var(--red)",
                          fontFamily: "var(--font-mono)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Ta bort {d.filename}?
                      </span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button
                          className="btn"
                          style={{
                            padding: "2px 8px",
                            fontSize: 10,
                            background: "var(--red)",
                            color: "#fff",
                            border: "none",
                          }}
                          onClick={(e) => handleConfirmDeleteDrawing(e, d)}
                        >
                          Ja
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "2px 8px", fontSize: 10 }}
                          onClick={handleCancelDeleteDrawing}
                        >
                          Nej
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <div style={{ padding: "12px 16px" }}>
              <button
                className="btn btn-ghost btn-full"
                onClick={() => fileInputRef.current?.click()}
              >
                + Ladda upp .pdf
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
