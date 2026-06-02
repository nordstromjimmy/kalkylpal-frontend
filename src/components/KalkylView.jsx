/**
 * KalkylView.jsx — Steg 2: Kalkylering
 *
 * Aggregates all scanned variants across all drawings and lets the user
 * enter price (kr) and installation time (h) per unit for each variant.
 * Calculates totals and exports to PDF or Excel.
 */
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function KalkylView({
  projectName = "Projekt",
  batchState = null,
  kalkylData = {},
  onKalkylChange,
}) {
  // Build a flat list of all variants across all drawings from batchState
  const variantMap = buildVariantMap(batchState);
  const variants = Object.keys(variantMap).sort();

  function buildVariantMap(bs) {
    if (!bs?.results) return {};
    const map = {};
    for (const row of Object.values(bs.results)) {
      for (const variants of Object.values(row.breakdown || {})) {
        for (const [variant, count] of Object.entries(variants)) {
          map[variant] = (map[variant] || 0) + count;
        }
      }
    }
    return map;
  }

  function getVal(variant, field) {
    return kalkylData[variant]?.[field] ?? "";
  }

  function handleChange(variant, field, value) {
    // Allow empty string or valid number string
    if (value !== "" && isNaN(Number(value))) return;
    onKalkylChange(variant, field, value);
  }

  function num(variant, field) {
    const v = parseFloat(kalkylData[variant]?.[field]);
    return isNaN(v) ? 0 : v;
  }

  // Totals
  const grandTotalPrice = variants.reduce(
    (s, v) => s + num(v, "price") * variantMap[v],
    0,
  );
  const grandTotalHours = variants.reduce(
    (s, v) => s + (num(v, "minutes") * variantMap[v]) / 60,
    0,
  );
  const grandTotalCount = variants.reduce((s, v) => s + variantMap[v], 0);

  function fmtPrice(n) {
    return n.toLocaleString("sv-SE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  function fmtHours(n) {
    return n.toLocaleString("sv-SE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // ── Export Excel ────────────────────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const rows = [
      [
        "Komponent",
        "Antal",
        "Pris/st (kr)",
        "Tid/st (h)",
        "Totalpris (kr)",
        "Total tid (h)",
      ],
      ...variants.map((v) => [
        kalkylData[v]?.label || v,
        variantMap[v],
        num(v, "price") || "",
        num(v, "minutes") || "",
        num(v, "price") ? fmtPrice(num(v, "price") * variantMap[v]) : "",
        num(v, "minutes")
          ? fmtHours((num(v, "minutes") * variantMap[v]) / 60)
          : "",
      ]),
      [],
      [
        "TOTALT",
        grandTotalCount,
        "",
        "",
        fmtPrice(grandTotalPrice),
        fmtHours(grandTotalHours),
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 24 },
      { wch: 8 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Kalkyl");
    XLSX.writeFile(wb, `${projectName}_kalkyl.xlsx`);
  }

  // ── Export PDF ──────────────────────────────────────────────────────────────
  function exportPDF() {
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
    doc.text("KalkylPal — Kalkylunderlag", 14, y);
    doc.text(new Date().toLocaleDateString("sv-SE"), pw - 14, y, {
      align: "right",
    });
    doc.setTextColor(0);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Komponent",
          "Antal",
          "Pris/st (kr)",
          "Tid/st (h)",
          "Totalpris (kr)",
          "Total tid (h)",
        ],
      ],
      body: variants.map((v) => [
        kalkylData[v]?.label || v,
        variantMap[v],
        num(v, "price") ? fmtPrice(num(v, "price")) : "—",
        num(v, "minutes") ? `${num(v, "minutes")} min` : "—",
        num(v, "price") ? fmtPrice(num(v, "price") * variantMap[v]) : "—",
        num(v, "minutes")
          ? fmtHours((num(v, "minutes") * variantMap[v]) / 60)
          : "—",
      ]),
      foot: [
        [
          "TOTALT",
          grandTotalCount,
          "",
          "",
          fmtPrice(grandTotalPrice),
          fmtHours(grandTotalHours),
        ],
      ],
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
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });

    doc.save(`${projectName}_kalkyl.pdf`);
  }

  if (!batchState?.results || variants.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📋</div>
        <div style={styles.emptyText}>
          Inga skannade komponenter att kalkulera
        </div>
        <div style={styles.emptyHint}>
          Gå tillbaka till Steg 1 och skanna ritningarna först
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerLabel}>STEG 2 — KALKYLERING</div>
          <div style={styles.headerProject}>{projectName}</div>
        </div>
        <div style={styles.headerActions}>
          <button
            className="btn btn-ghost"
            style={styles.exportBtn}
            onClick={exportExcel}
          >
            ↓ Excel
          </button>
          <button
            className="btn btn-ghost"
            style={styles.exportBtn}
            onClick={exportPDF}
          >
            ↓ PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Komponent</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Antal</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Pris/st (kr)</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Tid/st (min)</th>
              <th style={{ ...styles.th, textAlign: "right" }}>
                Totalpris (kr)
              </th>
              <th style={{ ...styles.th, textAlign: "right" }}>
                Total tid (h)
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => {
              const count = variantMap[v];
              const price = num(v, "price");
              const minutes = num(v, "minutes");
              const totalPrice = price * count;
              const totalHours = (minutes * count) / 60;
              return (
                <tr
                  key={v}
                  style={{
                    background:
                      i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <td style={styles.td}>
                    <input
                      style={{
                        ...styles.input,
                        width: 220,
                        textAlign: "left",
                        color: "var(--text-primary)",
                      }}
                      type="text"
                      placeholder={v}
                      value={
                        kalkylData[v]?.label !== undefined
                          ? kalkylData[v].label
                          : v
                      }
                      onChange={(e) =>
                        onKalkylChange(v, "label", e.target.value)
                      }
                    />
                  </td>
                  <td
                    style={{
                      ...styles.td,
                      textAlign: "right",
                      color: "var(--ui-white)",
                      fontWeight: 600,
                    }}
                  >
                    {count}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="—"
                      value={getVal(v, "price")}
                      onChange={(e) => handleChange(v, "price", e.target.value)}
                    />
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="—"
                      value={getVal(v, "minutes")}
                      onChange={(e) =>
                        handleChange(v, "minutes", e.target.value)
                      }
                    />
                  </td>
                  <td
                    style={{
                      ...styles.td,
                      textAlign: "right",
                      color: price ? "var(--ui-white)" : "var(--text-dim)",
                    }}
                  >
                    {price ? fmtPrice(totalPrice) : "—"}
                  </td>
                  <td
                    style={{
                      ...styles.td,
                      textAlign: "right",
                      color: minutes ? "var(--ui-white)" : "var(--text-dim)",
                    }}
                  >
                    {minutes ? fmtHours(totalHours) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals footer */}
      <div style={styles.footer}>
        <div style={styles.footerItem}>
          <span style={styles.footerLabel}>Antal komponenter</span>
          <span style={styles.footerValue}>{grandTotalCount}</span>
        </div>
        <div style={styles.footerDivider} />
        <div style={styles.footerItem}>
          <span style={styles.footerLabel}>Total tid</span>
          <span style={styles.footerValue}>{fmtHours(grandTotalHours)} h</span>
        </div>
        <div style={styles.footerDivider} />
        <div style={styles.footerItem}>
          <span style={styles.footerLabel}>Totalt materialpris</span>
          <span
            style={{
              ...styles.footerValue,
              fontSize: 22,
              color: "var(--amber)",
            }}
          >
            {fmtPrice(grandTotalPrice)} kr
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--bg-0)",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "var(--text-dim)",
    fontFamily: "var(--font-mono)",
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: "var(--text-secondary)" },
  emptyHint: { fontSize: 11 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 24px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-1)",
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    letterSpacing: "0.14em",
    color: "var(--text-dim)",
    marginBottom: 4,
  },
  headerProject: {
    fontSize: 18,
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    color: "var(--ui-white)",
    letterSpacing: "0.04em",
  },
  headerActions: {
    display: "flex",
    gap: 8,
  },
  exportBtn: {
    fontSize: 11,
    padding: "4px 12px",
  },
  tableWrap: {
    flex: 1,
    overflowY: "auto",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontFamily: "var(--font-mono)",
  },
  th: {
    padding: "10px 16px",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-1)",
    position: "sticky",
    top: 0,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 16px",
    fontSize: 12,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  },
  code: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--text-primary)",
  },
  input: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "4px 8px",
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    width: 90,
    textAlign: "right",
    outline: "none",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: 32,
    padding: "16px 24px",
    borderTop: "2px solid var(--border)",
    background: "var(--bg-1)",
    flexShrink: 0,
  },
  footerItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  footerLabel: {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.1em",
    color: "var(--text-dim)",
    textTransform: "uppercase",
  },
  footerValue: {
    fontSize: 18,
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    color: "var(--ui-white)",
  },
  footerDivider: {
    width: 1,
    height: 40,
    background: "var(--border)",
  },
};
