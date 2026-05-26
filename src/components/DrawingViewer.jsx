/**
 * DrawingViewer.jsx — Center panel: PDF page image + highlight overlay.
 *
 * How the highlight positioning works:
 *   - Backend renders the PDF page as a PNG image at 150 DPI
 *   - Component coordinates (x0,y0,x1,y1) are in PDF points (72 DPI base)
 *   - To position highlights as percentages, divide by the PDF page dimensions:
 *       left%   = x0 / pageWidth  * 100
 *       top%    = y0 / pageHeight * 100
 *       width%  = (x1-x0) / pageWidth  * 100
 *       height% = (y1-y0) / pageHeight * 100
 *   - The zoom/DPI factor cancels out — only page dimensions matter.
 *
 * Props:
 *   drawingId     — currently selected drawing id
 *   pageNumber    — which page to show (1-indexed)
 *   pageCount     — total pages in drawing
 *   pageDimensions— { width, height } of PDF page in points (from backend)
 *   components    — array of component instances to highlight
 *   warnings      — array of truncation warnings
 *   manualItems   — array of manually added items { code, x0, y0, x1, y1, page }
 *   highlightCode — which base_code is currently selected (highlighted in amber)
 *   onPageChange  — callback(newPageNumber)
 */
import { useState, useEffect } from "react";
import { getPageImageUrl } from "../api";

// How much padding to add around each highlight box (in % of page dimension).
// Makes small labels easier to click.
const BOX_PADDING_PCT = 0.3;

export default function DrawingViewer({
  drawingId = null,
  pageNumber = 1,
  pageCount = 1,
  pageDimensions = null,
  components = [],
  warnings = [],
  manualItems = [],
  highlightCode = null,
  onPageChange,
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hoveredBox, setHoveredBox] = useState(null); // { code, x, y }

  // Reset image-loaded state when the drawing or page changes
  useEffect(() => {
    setImageLoaded(false);
  }, [drawingId, pageNumber]);

  if (!drawingId) {
    return (
      <div className="viewer">
        <div className="viewer-empty">
          <div className="viewer-empty-icon">📐</div>
          <div>Välj en ritning för att börja</div>
          <div style={{ color: "var(--text-dim)", fontSize: 11 }}>
            Ladda upp ritningar till vänster
          </div>
        </div>
      </div>
    );
  }

  const imageUrl = getPageImageUrl(drawingId, pageNumber, 150);
  const { width: pageW, height: pageH } = pageDimensions || {
    width: 1,
    height: 1,
  };

  /**
   * Converts PDF point coordinates to CSS percentage strings.
   * The small padding makes narrow text labels easier to see and click.
   */
  function toStyle(x0, y0, x1, y1) {
    const pad = BOX_PADDING_PCT;
    return {
      left: `${Math.max(0, (x0 / pageW) * 100 - pad)}%`,
      top: `${Math.max(0, (y0 / pageH) * 100 - pad)}%`,
      width: `${((x1 - x0) / pageW) * 100 + pad * 2}%`,
      height: `${((y1 - y0) / pageH) * 100 + pad * 2}%`,
    };
  }

  // Only show components on the current page
  const visibleComponents = components.filter((c) => c.page === pageNumber);
  const visibleWarnings = warnings.filter((w) => w.page === pageNumber);
  const visibleManual = (manualItems || []).filter(
    (m) => m.page === pageNumber,
  );

  return (
    <div className="viewer">
      {/* Toolbar with page navigation */}
      <div className="viewer-toolbar">
        <button
          className="btn btn-ghost"
          disabled={pageNumber <= 1}
          onClick={() => onPageChange(pageNumber - 1)}
        >
          ← Föregående
        </button>
        <button
          className="btn btn-ghost"
          disabled={pageNumber >= pageCount}
          onClick={() => onPageChange(pageNumber + 1)}
        >
          Nästa →
        </button>
        <span className="viewer-page-info">
          Sida {pageNumber} / {pageCount || "?"}
          {" · "}
          {visibleComponents.length} Komponenter
          {visibleWarnings.length > 0 && (
            <span style={{ color: "var(--red)", marginLeft: 6 }}>
              ⚠ {visibleWarnings.length} warning
              {visibleWarnings.length > 1 ? "s" : ""}
            </span>
          )}
        </span>
      </div>

      {/* Drawing + overlay */}
      <div className="drawing-wrap">
        {/* Loading indicator while image fetches */}
        {!imageLoaded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-1)",
              minWidth: 400,
              minHeight: 300,
            }}
          >
            <div className="spinner" />
          </div>
        )}

        <img
          src={imageUrl}
          alt={`Drawing page ${pageNumber}`}
          onLoad={() => setImageLoaded(true)}
          style={{ display: imageLoaded ? "block" : "none" }}
        />

        {imageLoaded && pageDimensions && (
          <div className="highlight-layer">
            {/* ── Detected component highlights ── */}
            {visibleComponents.map((c, i) => {
              const isActive = !highlightCode || c.base_code === highlightCode;
              return (
                <div
                  key={`det-${i}`}
                  className="highlight-box detected"
                  style={{
                    ...toStyle(c.x0, c.y0, c.x1, c.y1),
                    opacity: isActive ? 1 : 0.2,
                  }}
                  onMouseEnter={() =>
                    setHoveredBox({
                      code: c.code,
                      raw: c.raw_text,
                      index: `det-${i}`,
                    })
                  }
                  onMouseLeave={() => setHoveredBox(null)}
                >
                  {hoveredBox?.index === `det-${i}` && (
                    <div className="highlight-tooltip">
                      {c.raw_text !== c.code
                        ? `${c.raw_text} → ${c.code}`
                        : c.code}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Warning highlights (truncated/broken labels) ── */}
            {visibleWarnings.map((w, i) => (
              <div
                key={`warn-${i}`}
                className="highlight-box warning"
                style={toStyle(w.x0, w.y0, w.x1, w.y1)}
                onMouseEnter={() =>
                  setHoveredBox({ code: `⚠ ${w.fragment}`, index: `warn-${i}` })
                }
                onMouseLeave={() => setHoveredBox(null)}
              >
                {hoveredBox?.index === `warn-${i}` && (
                  <div
                    className="highlight-tooltip"
                    style={{ color: "var(--red)" }}
                  >
                    ⚠ Possible truncated label: {w.fragment}
                  </div>
                )}
              </div>
            ))}

            {/* ── Manually added component highlights ── */}
            {visibleManual.map((m, i) => (
              <div
                key={`man-${i}`}
                className="highlight-box manual"
                style={toStyle(m.x0, m.y0, m.x1, m.y1)}
                onMouseEnter={() =>
                  setHoveredBox({ code: `+ ${m.code}`, index: `man-${i}` })
                }
                onMouseLeave={() => setHoveredBox(null)}
              >
                {hoveredBox?.index === `man-${i}` && (
                  <div
                    className="highlight-tooltip"
                    style={{ color: "var(--green)" }}
                  >
                    + Manual: {m.code}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
