/**
 * BatchScanSection.jsx — Collapsible section for scanning multiple drawings
 * at once for one or more component codes.
 *
 * Rendered inside ComponentPanel below the single-drawing scan section.
 *
 * Props:
 *   projectDrawings  — array of drawings in the current project
 *   batchState       — { status, codes, progress, currentFile, results } or null
 *   onBatchScan      — callback(drawingIds, codes[]) → starts batch
 *   onBatchAbort     — callback() → sets abort flag
 *   onSelectDrawing  — callback(drawing) → navigate to a drawing from results table
 */
import { useState } from "react";
import BatchResultsModal from "./BatchResultsModal";

export default function BatchScanSection({
  projectName = "Projekt",
  projectDrawings = [],
  batchState = null,
  onBatchScan,
  onBatchAbort,
  onSelectDrawing,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [codesInput, setCodesInput] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Keep selectedIds in sync when drawings list changes (e.g. new drawing uploaded)
  // New drawings are selected by default
  function toggleDrawing(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSelectAll() {
    if (selectedIds.length === projectDrawings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(projectDrawings.map((d) => d.id));
    }
  }

  function handleStart() {
    const codes = codesInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length === 0 || selectedIds.length === 0) return;
    onBatchScan(selectedIds, codes);
  }

  const isRunning = batchState?.status === "running";
  const isDone = batchState?.status === "done";
  const hasResults = isDone && batchState?.results;

  // Build sorted code list for the results table header
  const resultCodes = batchState?.codes || [];

  // Progress bar fill percentage
  const progressPct = batchState?.progress
    ? Math.round(
        (batchState.progress.current / batchState.progress.total) * 100,
      )
    : 0;

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      {/* ── Toggle header ── */}
      <div
        onClick={() => setIsOpen((o) => !o)}
        style={{
          padding: "10px 16px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          userSelect: "none",
        }}
        className="comp-group-header"
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
          }}
        >
          Projektskanning
        </span>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </div>

      {!isOpen ? null : (
        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* ── Component codes input ── */}
          <div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                marginBottom: 4,
              }}
            >
              KOMPONENTER (kommaseparerat)
            </div>
            <input
              className="input"
              placeholder="TD201, FD201, SP201…"
              value={codesInput}
              onChange={(e) => setCodesInput(e.target.value)}
              disabled={isRunning}
            />
          </div>

          {/* ── Drawing selection ── */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                RITNINGAR ({selectedIds.length}/{projectDrawings.length} valda)
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: "2px 7px" }}
                onClick={handleSelectAll}
                disabled={isRunning}
              >
                {selectedIds.length === projectDrawings.length
                  ? "Ingen"
                  : "Alla"}
              </button>
            </div>

            {projectDrawings.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Inga ritningar i projektet
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  maxHeight: 140,
                  overflowY: "auto",
                }}
              >
                {projectDrawings.map((d) => (
                  <label
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 6px",
                      borderRadius: "var(--radius)",
                      cursor: isRunning ? "default" : "pointer",
                      background: selectedIds.includes(d.id)
                        ? "var(--ui-white-dim)"
                        : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(d.id)}
                      onChange={() => toggleDrawing(d.id)}
                      disabled={isRunning}
                      style={{
                        accentColor: "var(--ui-white)",
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: selectedIds.includes(d.id)
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.filename}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Start / Abort button ── */}
          {!isRunning ? (
            <button
              className="btn btn-primary btn-full"
              onClick={handleStart}
              disabled={selectedIds.length === 0 || !codesInput.trim()}
            >
              ▶ Skanna {selectedIds.length} ritning
              {selectedIds.length !== 1 ? "ar" : ""}
            </button>
          ) : (
            <button className="btn btn-ghost btn-full" onClick={onBatchAbort}>
              ✕ Avbryt skanning
            </button>
          )}

          {/* ── Progress ── */}
          {isRunning && batchState?.progress && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Skannar {batchState.progress.current} av{" "}
                {batchState.progress.total}: {batchState.currentFile}
              </div>
              {/* Progress bar */}
              <div
                style={{
                  height: 4,
                  background: "var(--bg-3)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: "var(--ui-white)",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Results preview (max 3 rows) + modal button ── */}
          {hasResults &&
            (() => {
              const allRows = Object.entries(batchState.results);
              const previewRows = allRows.slice(0, 3);
              const grandTotal = allRows.reduce((s, [, r]) => s + r.total, 0);
              const MAX_COLS = 3;
              const previewCodes = resultCodes.slice(0, MAX_COLS);
              const extraCodes = resultCodes.length > MAX_COLS;

              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 0 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      RESULTAT
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      Totalt:{" "}
                      <strong style={{ color: "var(--ui-white)" }}>
                        {grandTotal}
                      </strong>
                    </div>
                  </div>

                  {/* Preview rows */}
                  {previewRows.map(([drawingId, row]) => {
                    // Sum per base code from breakdown
                    const baseTotals = {};
                    for (const [base, variants] of Object.entries(
                      row.breakdown || {},
                    )) {
                      baseTotals[base] = Object.values(variants).reduce(
                        (s, n) => s + n,
                        0,
                      );
                    }
                    return (
                      <div
                        key={drawingId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "5px 6px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            marginRight: 8,
                          }}
                          title={row.filename}
                        >
                          {row.filename}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexShrink: 0,
                            alignItems: "center",
                          }}
                        >
                          {previewCodes.map((code) => (
                            <span
                              key={code}
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {code.replace(/[0-9]/g, "")}:
                              <strong style={{ color: "var(--text-primary)" }}>
                                {baseTotals[code] ?? 0}
                              </strong>
                            </span>
                          ))}
                          {extraCodes && (
                            <span
                              style={{ fontSize: 10, color: "var(--text-dim)" }}
                            >
                              …
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              color: "var(--ui-white)",
                              fontWeight: 700,
                              minWidth: 20,
                              textAlign: "right",
                            }}
                          >
                            {row.total}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {allRows.length > 3 && (
                    <div
                      style={{
                        padding: "4px 6px",
                        fontSize: 10,
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      +{allRows.length - 3} till…
                    </div>
                  )}

                  {/* Open full results modal */}
                  <button
                    className="btn btn-ghost btn-full"
                    style={{ marginTop: 8 }}
                    onClick={() => setShowModal(true)}
                  >
                    Visa fullständigt resultat →
                  </button>
                </div>
              );
            })()}

          {/* Full results modal */}
          {showModal && (
            <BatchResultsModal
              batchState={batchState}
              projectName={projectName}
              projectDrawings={projectDrawings}
              onClose={() => setShowModal(false)}
              onSelectDrawing={(drawing) => {
                onSelectDrawing(drawing);
                setShowModal(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
