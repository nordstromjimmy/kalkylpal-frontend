/**
 * ComponentPanel.jsx — Right panel.
 *
 * Features:
 *  - Search field + scan button
 *  - Clear button to reset scan results entirely
 *  - Component list grouped by base_code, with variant breakdown
 *  - Click a component to highlight only that type on the drawing
 *  - Toggle to show/hide all highlight boxes
 *  - Manual add: enter a code + count for components missed by the scanner
 *  - Warnings section
 *
 * Props:
 *   drawingId      — currently selected drawing id
 *   scanResult     — result from last scan { total_found, components, warnings }
 *   manualItems    — array of manually added components
 *   highlightCode  — which base_code is highlighted in the viewer
 *   loading        — bool, is a scan in progress
 *   onScan         — callback(searchCode) → triggers scan
 *   onClearScan    — callback() → resets scan results back to empty state
 *   onHighlight    — callback(base_code | null | "__none__") → set/clear highlight
 *   onManualAdd    — callback({ code, base_code, page }) → add manual item
 */
import { useState } from "react";
import BatchScanSection from "./BatchScanSection";

export default function ComponentPanel({
  drawingId = null,
  scanResult = null,
  manualItems = [],
  highlightCode = null,
  loading = false,
  onScan,
  onClearScan,
  onHighlight,
  onManualAdd,
  projectName = "Projekt",
  projectDrawings = [],
  batchState = null,
  onBatchScan,
  onBatchAbort,
  onSelectDrawing,
  onResetAll,
  onResetProject,
  onDismissWarning,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [isScanOpen, setIsScanOpen] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualCount, setManualCount] = useState("1");
  const [manualPage, setManualPage] = useState("1");
  const [expandedGroups, setExpandedGroups] = useState({});
  // Warning confirm state: { index, code } or null
  const [confirming, setConfirming] = useState(null);
  // Set of warning indices the user has dismissed or confirmed
  const [dismissedWarnings, setDismissedWarnings] = useState(new Set());

  function toggleGroup(base_code) {
    setExpandedGroups((prev) => ({ ...prev, [base_code]: !prev[base_code] }));
  }

  function handleScan() {
    onScan(searchInput.trim());
  }

  function handleClear() {
    setSearchInput("");
    setExpandedGroups({});
    onHighlight(null);
    onClearScan();
  }

  function handleManualAdd() {
    if (!manualCode.trim()) return;
    const count = parseInt(manualCount) || 1;
    const page = parseInt(manualPage) || 1;
    for (let i = 0; i < count; i++) {
      onManualAdd({
        code: manualCode.trim().toUpperCase(),
        base_code: manualCode.trim().toUpperCase().split(/[-/]/)[0],
        page,
        x0: null,
        y0: null,
        x1: null,
        y1: null,
      });
    }
    setManualCode("");
    setManualCount("1");
    setShowManualForm(false);
  }

  const components = scanResult?.components || {};
  const warnings = scanResult?.warnings || [];
  const sortedGroups = Object.keys(components).sort();

  // Summary shows project-wide totals when a batch scan exists,
  // otherwise falls back to the currently selected drawing's scan.
  // When batchState exists, manual items are already included in batchState totals
  // (added in handleManualAdd), so subtract manualItems.length to avoid double counting.
  const batchTotal = batchState?.results
    ? Object.values(batchState.results).reduce((s, r) => s + r.total, 0)
    : null;
  const manualTotal = manualItems?.length || 0;
  const autoTotal =
    batchTotal !== null
      ? batchTotal - manualTotal
      : scanResult?.total_found || 0;
  const grandTotal = autoTotal + manualTotal;
  const hasResults = scanResult !== null;

  // Button label for the show/hide all toggle
  function toggleLabel() {
    if (highlightCode === "__none__") return "Visa alla";
    if (highlightCode) return "Visa alla";
    return "Dölj alla";
  }

  function handleToggleHighlight() {
    if (highlightCode === "__none__" || highlightCode) {
      onHighlight(null);
    } else {
      onHighlight("__none__");
    }
  }

  return (
    <div className="component-panel">
      {/* ── Sammanfattning ── */}
      <div className="panel-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div className="panel-label" style={{ marginBottom: 0 }}>
            Sammanfattning
          </div>
          {(drawingId ? batchState?.results || scanResult : onResetProject) && (
            <button
              className="btn btn-ghost"
              style={{
                fontSize: 10,
                padding: "2px 8px",
                color: "var(--red)",
                borderColor: "var(--red)",
              }}
              onClick={drawingId ? onResetAll : onResetProject}
              title={
                drawingId
                  ? "Rensa resultat för vald ritning"
                  : "Rensa alla ritningar i projektet"
              }
            >
              {drawingId ? "Rensa ritning" : "Rensa alla ritningar"}
            </button>
          )}
        </div>
        <div className="stat-row">
          <span className="stat-label">Automatiskt hittade</span>
          <span className="stat-value">{autoTotal}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Manuellt tillagda</span>
          <span className="stat-value green">{manualTotal}</span>
        </div>
        <div
          className="stat-row"
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: 6,
            paddingTop: 6,
          }}
        >
          <span
            className="stat-label"
            style={{ fontWeight: 600, color: "var(--text-primary)" }}
          >
            Totalt
          </span>
          <span className="stat-value" style={{ fontSize: 24 }}>
            {grandTotal}
          </span>
        </div>
      </div>

      {/* ── Skanna ritning (collapsible) — hidden, using Projektskanning instead ── */}
      {false && (
        <div className="panel-section" style={{ padding: 0 }}>
          <div
            onClick={() => setIsScanOpen((o) => !o)}
            className="comp-group-header"
            style={{
              padding: "10px 16px",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              userSelect: "none",
            }}
          >
            <div className="panel-label" style={{ marginBottom: 0 }}>
              Skanna ritning
            </div>
            <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
              {isScanOpen ? "▲" : "▼"}
            </span>
          </div>
          {isScanOpen && (
            <div
              style={{
                padding: "0 16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Filtrera: TD201, RL1…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleScan}
                  disabled={loading || !drawingId}
                >
                  {loading ? (
                    <>
                      <div className="spinner" /> Skannar…
                    </>
                  ) : (
                    "▶ Kör skanning"
                  )}
                </button>
                {hasResults && (
                  <button
                    className="btn btn-ghost"
                    onClick={handleClear}
                    title="Rensa resultat"
                  >
                    Rensa
                  </button>
                )}
              </div>
              {searchInput && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Filtrerar på "{searchInput.toUpperCase()}" — rensa för att
                  skanna allt
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Scroll area ── */}
      <div className="panel-scroll">
        {/* Component list — hidden, results shown in Projektskanning instead */}
        {false && sortedGroups.length > 0 && (
          <>
            <div
              style={{
                padding: "10px 16px 4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="panel-label" style={{ marginBottom: 0 }}>
                Hittade komponenter
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: "3px 8px" }}
                onClick={handleToggleHighlight}
              >
                {toggleLabel()}
              </button>
            </div>

            {sortedGroups.map((base_code) => {
              const instances = components[base_code];
              const isExpanded = expandedGroups[base_code];
              const isHighlighted = highlightCode === base_code;

              const variants = instances.reduce((acc, inst) => {
                acc[inst.code] = (acc[inst.code] || 0) + 1;
                return acc;
              }, {});

              return (
                <div key={base_code} className="comp-group">
                  <div
                    onClick={() => {
                      toggleGroup(base_code);
                      onHighlight(isHighlighted ? null : base_code);
                    }}
                    className={`comp-group-header${isHighlighted ? " is-highlighted" : ""}`}
                  >
                    <span className="comp-group-name">{base_code}</span>
                    <span className="comp-group-count">{instances.length}</span>
                  </div>

                  {isExpanded &&
                    Object.entries(variants).map(([code, count]) => {
                      const isVariantHighlighted = highlightCode === code;
                      return (
                        <div
                          key={code}
                          className={`comp-variant ${isVariantHighlighted ? "highlighted" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation(); // don't trigger the base_code row click
                            onHighlight(isVariantHighlighted ? null : code);
                          }}
                        >
                          <span>{code}</span>
                          <span className="comp-variant-count">×{count}</span>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </>
        )}

        {!drawingId && (
          <div
            style={{
              padding: 16,
              color: "var(--text-dim)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
          >
            Välj en ritning och kör en skanning
          </div>
        )}

        {drawingId && !hasResults && !loading && !batchState?.results && (
          <div
            style={{
              padding: 16,
              color: "var(--text-dim)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
          >
            Inga komponenter hittade ännu — kör en skanning
          </div>
        )}

        {/* Manuellt tillagda */}
        {manualItems?.length > 0 && (
          <>
            <div style={{ padding: "10px 16px 4px" }}>
              <div
                className="panel-label"
                style={{ marginBottom: 0, color: "var(--green)" }}
              >
                Manuellt tillagda
              </div>
            </div>
            {manualItems.map((m, i) => (
              <div
                key={i}
                className="comp-variant"
                style={{ color: "var(--green)" }}
              >
                <span>+ {m.code}</span>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  s.{m.page}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Varningar */}
        {warnings.length > 0 &&
          (() => {
            const visibleWarnings = warnings.filter(
              (_, i) => !dismissedWarnings.has(i),
            );
            if (visibleWarnings.length === 0) return null;
            return (
              <>
                <div style={{ padding: "10px 16px 4px" }}>
                  <div
                    className="panel-label"
                    style={{ marginBottom: 0, color: "var(--red)" }}
                  >
                    ⚠ Kontrollera manuellt ({visibleWarnings.length})
                  </div>
                </div>
                {warnings.map((w, i) => {
                  if (dismissedWarnings.has(i)) return null;

                  // Best-guess code: fragment + first nearby text that looks like a code tail
                  const tail =
                    (w.nearby_text || []).find((t) => /^\d{1,4}[-/]/.test(t)) ||
                    "";
                  const guess = (w.fragment + tail).toUpperCase();
                  const isConfirming = confirming?.index === i;

                  return (
                    <div
                      key={i}
                      className="warning-item"
                      style={{
                        flexDirection: "column",
                        gap: 6,
                        alignItems: "stretch",
                      }}
                    >
                      {!isConfirming && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flex: 1,
                            }}
                          >
                            <span className="warning-dot">▸</span>
                            <div className="warning-text">
                              <span className="warning-code">{w.fragment}</span>
                              {" — etikett kan vara dold på sida "}
                              {w.page}
                            </div>
                          </div>
                          <div
                            style={{ display: "flex", gap: 4, flexShrink: 0 }}
                          >
                            <button
                              className="btn btn-ghost"
                              style={{
                                fontSize: 10,
                                padding: "2px 7px",
                                color: "var(--green)",
                                borderColor: "var(--green)",
                              }}
                              onClick={() =>
                                setConfirming({ index: i, code: guess })
                              }
                              title="Bekräfta som komponent"
                            >
                              ✓
                            </button>
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 10, padding: "2px 7px" }}
                              onClick={() => {
                                setDismissedWarnings(
                                  (prev) => new Set([...prev, i]),
                                );
                                if (onDismissWarning && drawingId)
                                  onDismissWarning({
                                    drawingId,
                                    x0: w.x0,
                                    y0: w.y0,
                                  });
                                if (confirming?.index === i)
                                  setConfirming(null);
                              }}
                              title="Ignorera"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                      {isConfirming && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: "2px 0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text-dim)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            Bekräfta kod för sida {w.page}:
                          </div>
                          <input
                            className="input"
                            value={confirming.code}
                            onChange={(e) =>
                              setConfirming((prev) => ({
                                ...prev,
                                code: e.target.value.toUpperCase(),
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && confirming.code.trim()) {
                                onManualAdd({
                                  code: confirming.code.trim(),
                                  base_code: confirming.code
                                    .trim()
                                    .split(/[-/]/)[0],
                                  page: w.page,
                                  x0: w.x0,
                                  y0: w.y0,
                                  x1: w.x1,
                                  y1: w.y1,
                                });
                                setDismissedWarnings(
                                  (prev) => new Set([...prev, i]),
                                );
                                if (onDismissWarning && drawingId)
                                  onDismissWarning({
                                    drawingId,
                                    x0: w.x0,
                                    y0: w.y0,
                                  });
                                setConfirming(null);
                              }
                              if (e.key === "Escape") setConfirming(null);
                            }}
                            autoFocus
                            style={{ fontFamily: "var(--font-mono)" }}
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn btn-green"
                              style={{ flex: 1 }}
                              disabled={!confirming.code.trim()}
                              onClick={() => {
                                onManualAdd({
                                  code: confirming.code.trim(),
                                  base_code: confirming.code
                                    .trim()
                                    .split(/[-/]/)[0],
                                  page: w.page,
                                  x0: w.x0,
                                  y0: w.y0,
                                  x1: w.x1,
                                  y1: w.y1,
                                });
                                setDismissedWarnings(
                                  (prev) => new Set([...prev, i]),
                                );
                                if (onDismissWarning && drawingId)
                                  onDismissWarning({
                                    drawingId,
                                    x0: w.x0,
                                    y0: w.y0,
                                  });
                                setConfirming(null);
                              }}
                            >
                              ✓ Lägg till
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() => setConfirming(null)}
                            >
                              Avbryt
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
      </div>
      {/* ── Projektskanning ── */}
      <BatchScanSection
        projectName={projectName}
        projectDrawings={projectDrawings}
        batchState={batchState}
        onBatchScan={onBatchScan}
        onBatchAbort={onBatchAbort}
        onSelectDrawing={onSelectDrawing}
      />

      {/* ── Lägg till manuellt ── */}
      <div
        className="panel-section"
        style={{ borderTop: "1px solid var(--border)", borderBottom: "none" }}
      >
        {!showManualForm ? (
          <button
            className="btn btn-green btn-full"
            onClick={() => setShowManualForm(true)}
            disabled={!drawingId}
          >
            + Lägg till komponent manuellt
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="panel-label" style={{ marginBottom: 0 }}>
              Lägg till manuellt
            </div>
            <input
              className="input"
              placeholder="Kod, t.ex. TD201-160"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    marginBottom: 4,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  ANTAL
                </div>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={manualCount}
                  onChange={(e) => setManualCount(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    marginBottom: 4,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  SIDA
                </div>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={manualPage}
                  onChange={(e) => setManualPage(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-green"
                style={{ flex: 1 }}
                onClick={handleManualAdd}
              >
                Lägg till
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowManualForm(false)}
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Varning: inskannad ritning ── */}
      {scanResult?.is_scanned && (
        <div
          style={{
            margin: "0 16px 12px",
            padding: "10px 12px",
            background: "var(--red-dim)",
            border: "1px solid var(--red)",
            borderRadius: "var(--radius)",
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: "var(--red)", flexShrink: 0, marginTop: 1 }}>
            ⚠
          </span>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                color: "var(--red)",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
              }}
            >
              Inskannad ritning
            </span>
            <br />
            Denna PDF verkar vara en inskannad bild och innehåller ingen sökbar
            text — komponenter kan inte detekteras automatiskt. Lägg till
            manuellt eller kontakta den som skapat ritningen för en digital
            version.
          </div>
        </div>
      )}
    </div>
  );
}
