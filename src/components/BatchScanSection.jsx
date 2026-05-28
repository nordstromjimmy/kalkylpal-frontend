/**
 * BatchScanSection.jsx — Collapsible section for scanning multiple drawings
 * at once for one or more component codes.
 *
 * Results are shown inline (no modal) with a scrollable container.
 * Excel and PDF export are built in.
 */
import { useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getPageImageUrl } from "../api";

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);

  // ── Bulk drawing download ─────────────────────────────────────────────────
  async function downloadAllDrawings() {
    if (!batchState?.results) return;
    setIsDownloading(true);

    const allRows = Object.entries(batchState.results);
    const zip = new JSZip();

    for (let i = 0; i < allRows.length; i++) {
      const [drawingIdStr, row] = allRows[i];
      setDownloadProgress({
        current: i + 1,
        total: allRows.length,
        filename: row.filename,
      });

      if (!row.components?.length || !row.pageDimensions) continue;

      try {
        // Fetch the page image at 200 DPI for a sharp download
        const resp = await fetch(
          getPageImageUrl(parseInt(drawingIdStr), 1, 200),
        );
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);

        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);

        // Scale PDF point coordinates → canvas pixel coordinates
        const scaleX = bitmap.width / row.pageDimensions.width;
        const scaleY = bitmap.height / row.pageDimensions.height;

        // Draw highlight boxes for every detected component
        row.components.forEach((c) => {
          const x = c.x0 * scaleX;
          const y = c.y0 * scaleY;
          const w = (c.x1 - c.x0) * scaleX;
          const h = (c.y1 - c.y0) * scaleY;
          ctx.fillStyle = "rgba(245,166,35,0.18)";
          ctx.strokeStyle = "rgba(245,166,35,1)";
          ctx.lineWidth = 2;
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        });

        // Convert canvas to PNG blob and add to zip
        const pngBlob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        const zipFilename =
          row.filename.replace(/\.pdf$/i, "") + "_markerad.png";
        zip.file(zipFilename, pngBlob);
      } catch (err) {
        console.error(`Kunde inte rendera ${row.filename}:`, err);
      }
    }

    // Generate and download the zip
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}_ritningar_markerade.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsDownloading(false);
    setDownloadProgress(null);
  }

  function toggleDrawing(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSelectAll() {
    setSelectedIds(
      selectedIds.length === projectDrawings.length
        ? []
        : projectDrawings.map((d) => d.id),
    );
  }

  function handleStart() {
    const codes = codesInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length === 0 || selectedIds.length === 0) return;
    onBatchScan(selectedIds, codes);
  }

  // ── Export helpers ────────────────────────────────────────────────────────
  function exportExcel() {
    if (!batchState?.results) return;
    const rows = Object.entries(batchState.results);
    const wb = XLSX.utils.book_new();

    // Sheet 1: Detaljer
    const detailRows = [["Ritning", "Komponentkod", "Antal"]];
    for (const [, row] of rows) {
      for (const [, variants] of Object.entries(row.breakdown || {})) {
        for (const [variant, count] of Object.entries(variants).sort()) {
          detailRows.push([row.filename, variant, count]);
        }
      }
    }
    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    wsDetail["!cols"] = [{ wch: 40 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detaljer");

    // Sheet 2: Summering
    const summary = buildSummary(rows);
    const summaryRows = [["Komponentkod", "Totalt antal"]];
    for (const [variant, count] of Object.entries(summary).sort()) {
      summaryRows.push([variant, count]);
    }
    summaryRows.push(
      ["", ""],
      ["TOTALT", Object.values(summary).reduce((s, n) => s + n, 0)],
    );
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summering");

    XLSX.writeFile(wb, `${projectName}_komponenter.xlsx`);
  }

  function exportPDF() {
    if (!batchState?.results) return;
    const rows = Object.entries(batchState.results);
    const summary = buildSummary(rows);
    const grandTotal = rows.reduce((s, [, r]) => s + r.total, 0);
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    let y = 18;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(projectName, 14, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("KalkylPal — Komponentöversikt", 14, y);
    doc.text(new Date().toLocaleDateString("sv-SE"), pw - 14, y, {
      align: "right",
    });
    doc.setTextColor(0);
    y += 8;

    for (const [, row] of rows) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(26, 34, 54);
      doc.rect(14, y - 4, pw - 28, 8, "F");
      doc.setTextColor(255);
      doc.text(row.filename, 16, y + 1);
      doc.text(`${row.total} st`, pw - 16, y + 1, { align: "right" });
      doc.setTextColor(0);
      y += 10;

      for (const [baseCode, variants] of Object.entries(row.breakdown || {})) {
        const baseTotal = Object.values(variants).reduce((s, n) => s + n, 0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60);
        doc.text(baseCode, 18, y);
        doc.text(String(baseTotal), pw - 16, y, { align: "right" });
        doc.setTextColor(0);
        y += 5;
        for (const [variant, count] of Object.entries(variants).sort()) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80);
          doc.text(`• ${variant}`, 24, y);
          doc.setTextColor(0);
          doc.text(String(count), pw - 16, y, { align: "right" });
          y += 5;
        }
        y += 2;
      }
      y += 4;
    }

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
      body: Object.entries(summary)
        .sort()
        .map(([v, c]) => [v, c]),
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

  function buildSummary(rows) {
    const summary = {};
    for (const [, row] of rows) {
      for (const [, variants] of Object.entries(row.breakdown || {})) {
        for (const [variant, count] of Object.entries(variants)) {
          summary[variant] = (summary[variant] || 0) + count;
        }
      }
    }
    return summary;
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const isRunning = batchState?.status === "running";
  const hasResults = batchState?.status === "done" && batchState?.results;
  const resultCodes = batchState?.codes || [];
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

      {isOpen && (
        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* ── Codes input ── */}
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

          {/* ── Start / Abort ── */}
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

          {/* ── Progress bar ── */}
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

          {/* ── Inline results ── */}
          {hasResults &&
            (() => {
              const allRows = Object.entries(batchState.results);
              const grandTotal = allRows.reduce((s, [, r]) => s + r.total, 0);
              const summary = buildSummary(allRows);
              const sortedVariants = Object.keys(summary).sort();

              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {/* Results header with export buttons */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      RESULTAT — {grandTotal} st
                    </div>
                  </div>
                  {/* Results header with export buttons */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      Ladda ner resultat som
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 10, padding: "2px 7px" }}
                        onClick={exportExcel}
                      >
                        Excel
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 10, padding: "2px 7px" }}
                        onClick={exportPDF}
                      >
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Bulk PNG download */}
                  <button
                    className="btn btn-ghost btn-full"
                    onClick={downloadAllDrawings}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <div
                          className="spinner"
                          style={{ width: 12, height: 12, borderWidth: 2 }}
                        />{" "}
                        Skapar bilder…
                      </>
                    ) : (
                      "↓ Ladda ner alla ritningar med markeringar"
                    )}
                  </button>

                  {/* Download progress bar */}
                  {isDownloading && downloadProgress && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-secondary)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        Bearbetar {downloadProgress.current} av{" "}
                        {downloadProgress.total}: {downloadProgress.filename}
                      </div>
                      <div
                        style={{
                          height: 3,
                          background: "var(--bg-3)",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.round((downloadProgress.current / downloadProgress.total) * 100)}%`,
                            background: "var(--ui-white)",
                            borderRadius: 2,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Scrollable results list */}
                  <div
                    style={{
                      maxHeight: 380,
                      overflowY: "auto",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  >
                    {/* Per-drawing rows */}
                    {allRows.map(([drawingId, row]) => {
                      const drawing = projectDrawings.find(
                        (d) => d.id === parseInt(drawingId),
                      );
                      return (
                        <div
                          key={drawingId}
                          style={{ borderBottom: "1px solid var(--border)" }}
                        >
                          {/* Drawing header — click to navigate + scan */}
                          <div
                            onClick={() =>
                              drawing && onSelectDrawing(drawing, resultCodes)
                            }
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "7px 10px",
                              background: "var(--bg-3)",
                              cursor: "pointer",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--ui-white-hover)")
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
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.filename}
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                color: "var(--text-secondary)",
                                flexShrink: 0,
                                marginLeft: 8,
                              }}
                            >
                              {row.total} st →
                            </span>
                          </div>

                          {/* Variant breakdown */}
                          {Object.entries(row.breakdown || {}).map(
                            ([baseCode, variants]) => (
                              <div
                                key={baseCode}
                                style={{ padding: "4px 10px 2px" }}
                              >
                                {/* Base code */}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "2px 0",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: 10,
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
                                      fontSize: 10,
                                      color: "var(--text-secondary)",
                                    }}
                                  >
                                    {Object.values(variants).reduce(
                                      (s, n) => s + n,
                                      0,
                                    )}
                                  </span>
                                </div>
                                {/* Variants */}
                                {Object.entries(variants)
                                  .sort()
                                  .map(([variant, count]) => (
                                    <div
                                      key={variant}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "2px 0 2px 8px",
                                        borderLeft: "1px solid var(--border)",
                                        marginLeft: 4,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontFamily: "var(--font-mono)",
                                          fontSize: 11,
                                          color: "var(--text-primary)",
                                        }}
                                      >
                                        <span
                                          style={{
                                            color: "var(--text-dim)",
                                            marginRight: 5,
                                          }}
                                        >
                                          •
                                        </span>
                                        {variant}
                                      </span>
                                      <span
                                        style={{
                                          fontFamily: "var(--font-mono)",
                                          fontSize: 12,
                                          fontWeight: 600,
                                          color: "var(--ui-white)",
                                        }}
                                      >
                                        {count}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            ),
                          )}
                        </div>
                      );
                    })}

                    {/* Summary section */}
                    <div style={{ padding: "8px 10px" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "var(--text-dim)",
                          marginBottom: 6,
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
                            padding: "3px 0",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--text-primary)",
                            }}
                          >
                            {variant}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--ui-white)",
                            }}
                          >
                            {summary[variant]}
                          </span>
                        </div>
                      ))}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          padding: "8px 0 0",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                          }}
                        >
                          Totalt
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 18,
                            fontWeight: 700,
                            color: "var(--ui-white)",
                          }}
                        >
                          {grandTotal}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
