/**
 * BatchResultsModal.jsx — Full results modal with per-drawing variant breakdown.
 *
 * Layout:
 *   Per drawing section:
 *     RITNING: filename.pdf           X st
 *       BaseCode                      total
 *         • BaseCode-variant          count
 *
 *   Summary section at bottom:
 *     SUMMERING (alla ritningar)
 *       Variant                       total
 *
 * Exports:
 *   Excel — two sheets: "Detaljer" and "Summering"
 *   PDF   — same grouped layout
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function BatchResultsModal({
  batchState,
  projectName = "Projekt",
  projectDrawings = [],
  onClose,
  onSelectDrawing,
}) {
  const codes = batchState?.codes || [];
  const results = batchState?.results || {};
  const rows = Object.entries(results);

  // Build flat summary: variant → total across all drawings
  const variantSummary = {};
  for (const [, row] of rows) {
    for (const [, variants] of Object.entries(row.breakdown || {})) {
      for (const [variant, count] of Object.entries(variants)) {
        variantSummary[variant] = (variantSummary[variant] || 0) + count;
      }
    }
  }
  const sortedVariants = Object.keys(variantSummary).sort();
  const grandTotal = rows.reduce((s, [, r]) => s + r.total, 0);

  // ── Excel export — two sheets ─────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Detaljer — one row per variant per drawing
    const detailRows = [["Ritning", "Komponentkod", "Antal"]];
    for (const [, row] of rows) {
      for (const [baseCode, variants] of Object.entries(row.breakdown || {})) {
        for (const [variant, count] of Object.entries(variants).sort()) {
          detailRows.push([row.filename, variant, count]);
        }
      }
    }
    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    wsDetail["!cols"] = [{ wch: 40 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detaljer");

    // Sheet 2: Summering — total per variant
    const summaryRows = [["Komponentkod", "Totalt antal"]];
    for (const variant of sortedVariants) {
      summaryRows.push([variant, variantSummary[variant]]);
    }
    summaryRows.push(["", ""]);
    summaryRows.push(["TOTALT", grandTotal]);
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summering");

    XLSX.writeFile(wb, `${projectName}_komponenter.xlsx`);
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  function exportPDF() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 18;

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(projectName, 14, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("KalkylPal — Komponentöversikt", 14, y);
    doc.text(new Date().toLocaleDateString("sv-SE"), pageWidth - 14, y, {
      align: "right",
    });
    doc.setTextColor(0);
    y += 8;

    // Per-drawing sections
    for (const [, row] of rows) {
      // Check page break
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(26, 34, 54);
      doc.rect(14, y - 4, pageWidth - 28, 8, "F");
      doc.setTextColor(255);
      doc.text(row.filename, 16, y + 1);
      doc.text(`${row.total} st`, pageWidth - 16, y + 1, { align: "right" });
      doc.setTextColor(0);
      y += 10;

      for (const [baseCode, variants] of Object.entries(row.breakdown || {})) {
        const baseTotal = Object.values(variants).reduce((s, n) => s + n, 0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60);
        doc.text(baseCode, 18, y);
        doc.text(String(baseTotal), pageWidth - 16, y, { align: "right" });
        doc.setTextColor(0);
        y += 5;

        for (const [variant, count] of Object.entries(variants).sort()) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(80);
          doc.text(`• ${variant}`, 24, y);
          doc.setTextColor(0);
          doc.text(String(count), pageWidth - 16, y, { align: "right" });
          y += 5;
        }
        y += 2;
      }
      y += 4;
    }

    // Summary table
    if (y > 220) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("SUMMERING (alla ritningar)", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Komponentkod", "Totalt antal"]],
      body: sortedVariants.map((v) => [v, variantSummary[v]]),
      foot: [["TOTALT", grandTotal]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [13, 19, 33],
        textColor: 255,
        fontStyle: "bold",
      },
      footStyles: {
        fillColor: [26, 34, 54],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: { 1: { halign: "right" } },
    });

    doc.save(`${projectName}_komponenter.pdf`);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--border-bright)",
          borderRadius: "var(--radius-lg)",
          width: "min(92vw, 680px)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: 13,
                color: "var(--ui-white)",
              }}
            >
              Skanningsresultat — {projectName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                marginTop: 2,
                fontFamily: "var(--font-mono)",
              }}
            >
              {rows.length} ritning{rows.length !== 1 ? "ar" : ""} ·{" "}
              {codes.join(", ")} · {grandTotal} st totalt
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn" onClick={exportExcel}>
              ↓ Excel
            </button>
            <button className="btn" onClick={exportPDF}>
              ↓ PDF
            </button>

            <button className="btn btn-ghost" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {/* Per-drawing sections */}
          {rows.map(([drawingId, row]) => {
            const drawing = projectDrawings.find(
              (d) => d.id === parseInt(drawingId),
            );
            return (
              <div key={drawingId} style={{ marginBottom: 4 }}>
                {/* Drawing header — clickable */}
                <div
                  onClick={() => {
                    onSelectDrawing(drawing);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 20px",
                    background: "var(--bg-3)",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--ui-white-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--bg-3)")
                  }
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--ui-white)",
                    }}
                  >
                    {row.filename}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {row.total} st →
                  </span>
                </div>

                {/* Base code groups */}
                {Object.entries(row.breakdown || {}).map(
                  ([baseCode, variants]) => {
                    const baseTotal = Object.values(variants).reduce(
                      (s, n) => s + n,
                      0,
                    );
                    return (
                      <div key={baseCode} style={{ padding: "6px 20px 2px" }}>
                        {/* Base code row */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "3px 0",
                            marginBottom: 2,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {baseCode}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {baseTotal}
                          </span>
                        </div>

                        {/* Variant rows */}
                        {Object.entries(variants)
                          .sort()
                          .map(([variant, count]) => (
                            <div
                              key={variant}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "3px 0 3px 12px",
                                borderLeft: "1px solid var(--border)",
                                marginLeft: 4,
                                marginBottom: 1,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 12,
                                  color: "var(--text-primary)",
                                }}
                              >
                                <span
                                  style={{
                                    color: "var(--text-dim)",
                                    marginRight: 6,
                                  }}
                                >
                                  •
                                </span>
                                {variant}
                              </span>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "var(--ui-white)",
                                }}
                              >
                                {count}
                              </span>
                            </div>
                          ))}
                      </div>
                    );
                  },
                )}

                <div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    margin: "6px 0 0",
                  }}
                />
              </div>
            );
          })}

          {/* Summary section */}
          {sortedVariants.length > 0 && (
            <div style={{ padding: "12px 20px" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: 10,
                }}
              >
                Summering — alla ritningar
              </div>

              {sortedVariants.map((variant) => (
                <div
                  key={variant}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text-primary)",
                    }}
                  >
                    {variant}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ui-white)",
                    }}
                  >
                    {variantSummary[variant]}
                  </span>
                </div>
              ))}

              {/* Grand total */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "10px 0 0",
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  Totalt
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--ui-white)",
                  }}
                >
                  {grandTotal}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
