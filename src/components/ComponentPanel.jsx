/**
 * ComponentPanel.jsx — Right panel.
 *
 * Features:
 *  - Search field + Scan button
 *  - Component list grouped by base_code, with variant breakdown
 *  - Click a component to highlight only that type on the drawing
 *  - Manual add: enter a code + count for components missed by scanner
 *  - Warnings section
 *
 * Props:
 *   drawingId      — currently selected drawing id
 *   scanResult     — result from last scan { total_found, components, warnings }
 *   manualItems    — array of manually added components
 *   highlightCode  — which base_code is highlighted in the viewer
 *   loading        — bool, is a scan in progress
 *   onScan         — callback(searchCode) → triggers scan
 *   onHighlight    — callback(base_code | null) → set/clear highlight
 *   onManualAdd    — callback({ code, base_code, count, page }) → add manual item
 */
import { useState } from "react";

export default function ComponentPanel({
  drawingId = null,
  scanResult = null,
  manualItems = [],
  highlightCode = null,
  loading = false,
  onScan,
  onHighlight,
  onManualAdd,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualCount, setManualCount] = useState("1");
  const [manualPage, setManualPage] = useState("1");
  const [expandedGroups, setExpandedGroups] = useState({});

  function toggleGroup(base_code) {
    setExpandedGroups((prev) => ({ ...prev, [base_code]: !prev[base_code] }));
  }

  function handleScan() {
    onScan(searchInput.trim());
  }

  function handleManualAdd() {
    if (!manualCode.trim()) return;
    const count = parseInt(manualCount) || 1;
    const page = parseInt(manualPage) || 1;
    // Add `count` manual entries
    for (let i = 0; i < count; i++) {
      onManualAdd({
        code: manualCode.trim().toUpperCase(),
        base_code: manualCode.trim().toUpperCase().split(/[-/]/)[0],
        page,
        // Manual items have no position — show them in a list, not on the drawing
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

  // Total count including manual additions
  const autoTotal = scanResult?.total_found || 0;
  const manualTotal = manualItems?.length || 0;
  const grandTotal = autoTotal + manualTotal;

  return (
    <div className="component-panel">
      {/* ── Stats ── */}
      <div className="panel-section">
        <div className="panel-label">Sammanfattning</div>
        <div className="stat-row">
          <span className="stat-label">Automatiskt upptäckta</span>
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
            Total
          </span>
          <span className="stat-value" style={{ fontSize: 24 }}>
            {grandTotal}
          </span>
        </div>
      </div>

      {/* ── Search & Scan ── */}
      <div className="panel-section">
        <div className="panel-label">Scanna ritning</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            className="input"
            placeholder="Filter: TD201, RL1…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
          />
        </div>
        <button
          className="btn btn-amber btn-full"
          onClick={handleScan}
          disabled={loading || !drawingId}
        >
          {loading ? (
            <>
              <div className="spinner" /> Scannar..
            </>
          ) : (
            "▶ Starta sökning"
          )}
        </button>
        {searchInput && (
          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Filtrera efter "{searchInput.toUpperCase()}" — rensa för att scanna
            allt
          </div>
        )}
      </div>

      {/* ── Scroll area: component list + manual additions + warnings ── */}
      <div className="panel-scroll">
        {/* Component list */}
        {sortedGroups.length > 0 && (
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
              {highlightCode && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 10, padding: "3px 8px" }}
                  onClick={() => onHighlight(null)}
                >
                  Visa alla
                </button>
              )}
            </div>

            {sortedGroups.map((base_code) => {
              const instances = components[base_code];
              const isExpanded = expandedGroups[base_code];
              const isHighlighted = highlightCode === base_code;

              // Group variants by full code
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
                    Object.entries(variants).map(([code, count]) => (
                      <div
                        key={code}
                        className={`comp-variant ${isHighlighted ? "highlighted" : ""}`}
                      >
                        <span>{code}</span>
                        <span className="comp-variant-count">×{count}</span>
                      </div>
                    ))}
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
            Välj en ritning och starta en sökning
          </div>
        )}

        {drawingId && sortedGroups.length === 0 && !loading && (
          <div
            style={{
              padding: 16,
              color: "var(--text-dim)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
          >
            Inga komponenter har hittats
          </div>
        )}

        {/* Manual additions list */}
        {manualItems?.length > 0 && (
          <>
            <div style={{ padding: "10px 16px 4px" }}>
              <div
                className="panel-label"
                style={{ marginBottom: 0, color: "var(--green)" }}
              >
                Tillagda manuellt
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
                  p.{m.page}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <>
            <div style={{ padding: "10px 16px 4px" }}>
              <div
                className="panel-label"
                style={{ marginBottom: 0, color: "var(--red)" }}
              >
                ⚠ Verifiera manuellt ({warnings.length})
              </div>
            </div>
            {warnings.map((w, i) => (
              <div key={i} className="warning-item">
                <span className="warning-dot">▸</span>
                <div className="warning-text">
                  <span className="warning-code">{w.fragment}</span>
                  {" — label may be obscured on page "}
                  {w.page}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Manual Add ── */}
      <div
        className="panel-section"
        style={{ borderTop: "1px solid var(--border)", borderBottom: "none" }}
      >
        {!showManualForm ? (
          <button
            className="btn btn-full"
            onClick={() => setShowManualForm(true)}
            disabled={!drawingId}
          >
            + Lägg till komponent manuellt
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="panel-label" style={{ marginBottom: 0 }}>
              Lägg till komponent
            </div>
            <input
              className="input"
              placeholder="T.ex TD201-160"
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
                  Antal
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
                  Sida
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
                className="btn"
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
    </div>
  );
}
