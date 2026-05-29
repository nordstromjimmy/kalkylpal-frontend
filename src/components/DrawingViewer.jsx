/**
 * DrawingViewer.jsx — Center panel: PDF page with highlight overlay.
 *
 * Zoom & pan:
 *   - Scroll wheel     → zoom in/out centered on mouse position
 *   - Left mouse drag  → pan
 *   - Double click     → reset zoom and position
 *
 * Highlight positioning:
 *   Coordinates from backend (x0,y0,x1,y1) are in PDF points.
 *   We convert them to percentages of the page size:
 *     left%   = x0 / pageWidth  * 100
 *     top%    = y0 / pageHeight * 100
 *   The zoom/DPI factor cancels out — only page dimensions matter.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { getPageImageUrl } from "../api";

const BOX_PADDING_PCT = 0.05;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.12;

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
  onPrevDrawing = null,
  onNextDrawing = null,
  hasPrevDrawing = false,
  hasNextDrawing = false,
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hoveredBox, setHoveredBox] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // ── Zoom & pan state ──────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const wrapRef = useRef(null);

  // Reset zoom/pan when drawing or page changes
  useEffect(() => {
    setImageLoaded(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [drawingId, pageNumber]);

  // ── Scroll → zoom centered on mouse position ──────────────────────────────
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();

      const container = containerRef.current;
      const wrap = wrapRef.current;
      if (!container || !wrap) return;

      const rect = wrap.getBoundingClientRect();

      // Mouse position relative to the transformed element
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * delta));
      const zoomRatio = newZoom / zoom;

      // Adjust pan so the point under the mouse stays fixed after zoom
      setPan((prev) => ({
        x: mouseX - zoomRatio * (mouseX - prev.x),
        y: mouseY - zoomRatio * (mouseY - prev.y),
      }));
      setZoom(newZoom);
    },
    [zoom],
  );

  // Attach wheel listener with passive: false so we can call preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Mouse down → start panning ────────────────────────────────────────────
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.currentTarget.style.cursor = "grabbing";
  }

  function handleMouseMove(e) {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
  }

  function handleMouseUp(e) {
    isPanning.current = false;
    e.currentTarget.style.cursor = "grab";
  }

  function handleMouseLeave(e) {
    isPanning.current = false;
    e.currentTarget.style.cursor = "grab";
  }

  // ── Download page as PNG with highlight boxes painted on ─────────────────────
  async function handleDownload() {
    if (!pageDimensions) return;
    setIsDownloading(true);
    try {
      // Fetch a fresh high-DPI copy of the page (200 DPI gives sharp downloads)
      const url = getPageImageUrl(drawingId, pageNumber, 200);
      const resp = await fetch(url);
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(blob);

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);

      // Scale factor: PDF points → canvas pixels
      const scaleX = bitmap.width / pageDimensions.width;
      const scaleY = bitmap.height / pageDimensions.height;

      // Draw all component highlight boxes on top
      visibleComponents.forEach((c) => {
        const isActive =
          highlightCode !== "__none__" &&
          (!highlightCode ||
            c.base_code === highlightCode ||
            c.code === highlightCode);
        const x = c.x0 * scaleX;
        const y = c.y0 * scaleY;
        const w = (c.x1 - c.x0) * scaleX;
        const h = (c.y1 - c.y0) * scaleY;
        ctx.fillStyle = isActive
          ? "rgba(245,166,35,0.18)"
          : "rgba(245,166,35,0.04)";
        ctx.strokeStyle = isActive
          ? "rgba(245,166,35,1)"
          : "rgba(245,166,35,0.3)";
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      });

      // Trigger browser download
      canvas.toBlob((dlBlob) => {
        const dlUrl = URL.createObjectURL(dlBlob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = `ritning_sida_${pageNumber}_markerad.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
      }, "image/png");
    } catch (err) {
      console.error("Nedladdning misslyckades:", err);
    } finally {
      setIsDownloading(false);
    }
  }

  // ── Double click → reset view ─────────────────────────────────────────────
  function handleDoubleClick() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  if (!drawingId) {
    return (
      <div className="viewer">
        <div className="viewer-empty">
          <div className="viewer-empty-icon">📐</div>
          <div>Välj ett projekt för att börja</div>
        </div>
      </div>
    );
  }

  const imageUrl = getPageImageUrl(drawingId, pageNumber, 150);
  const { width: pageW, height: pageH } = pageDimensions || {
    width: 1,
    height: 1,
  };

  function toStyle(x0, y0, x1, y1) {
    const pad = BOX_PADDING_PCT;
    return {
      left: `${Math.max(0, (x0 / pageW) * 100 - pad)}%`,
      top: `${Math.max(0, (y0 / pageH) * 100 - pad)}%`,
      width: `${((x1 - x0) / pageW) * 100 + pad * 2}%`,
      height: `${((y1 - y0) / pageH) * 100 + pad * 2}%`,
    };
  }

  const visibleComponents = components.filter((c) => c.page === pageNumber);
  const visibleWarnings = warnings.filter((w) => w.page === pageNumber);
  const visibleManual = manualItems.filter((m) => m.page === pageNumber);
  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="viewer">
      {/* ── Toolbar ── */}
      <div className="viewer-toolbar">
        <button
          className="btn btn-ghost"
          disabled={!hasPrevDrawing}
          onClick={onPrevDrawing}
          title="Föregående ritning"
        >
          ← Föregående
        </button>
        <button
          className="btn btn-ghost"
          disabled={!hasNextDrawing}
          onClick={onNextDrawing}
          title="Nästa ritning"
        >
          Nästa →
        </button>

        {/* Zoom controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginLeft: 8,
          }}
        >
          <button
            className="btn btn-ghost"
            style={{ padding: "4px 8px" }}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.15))}
          >
            −
          </button>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-secondary)",
              minWidth: 40,
              textAlign: "center",
            }}
          >
            {zoomPct}%
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: "4px 8px" }}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.15))}
          >
            +
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: "4px 8px", fontSize: 10 }}
            title="Återställ vy"
            onClick={handleDoubleClick}
          >
            ↺
          </button>
          <span
            style={{ color: "var(--text-dim)", marginLeft: 8, fontSize: 10 }}
          >
            Dubbelklick = återställ zoom
          </span>
        </div>

        <button
          className="btn"
          style={{ marginLeft: "auto" }}
          onClick={handleDownload}
          disabled={!imageLoaded || isDownloading}
          title="Ladda ner ritning med markeringar"
        >
          {isDownloading ? (
            <div
              className="spinner"
              style={{ width: 12, height: 12, borderWidth: 2 }}
            />
          ) : (
            "Ladda ner"
          )}
        </button>

        <span className="viewer-page-info" style={{ marginLeft: 8 }}>
          {visibleComponents.length} komponenter
          {/*           {visibleWarnings.length > 0 && (
            <span style={{ color: "var(--red)", marginLeft: 6 }}>
              ⚠ {visibleWarnings.length} varning
              {visibleWarnings.length > 1 ? "ar" : ""}
            </span>
          )} */}
        </span>
      </div>

      {/* Loading spinner — centered in the viewer area, outside the drawing wrap */}
      {!imageLoaded && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="spinner"
            style={{ width: 32, height: 32, borderWidth: 3 }}
          />
        </div>
      )}

      {/* ── Zoom/pan container ── */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "hidden",
          width: "100%",
          cursor: "grab",
          userSelect: "none",
          display: imageLoaded ? "block" : "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
        {/* Transformed layer — zoom + pan applied here */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            display: "inline-block",
            padding: 24,
          }}
        >
          <div className="drawing-wrap" ref={wrapRef} style={{ margin: 0 }}>
            <img
              src={imageUrl}
              alt={`Ritning sida ${pageNumber}`}
              onLoad={() => setImageLoaded(true)}
              style={{ display: "block", pointerEvents: "none" }}
              draggable={false}
            />

            {imageLoaded && pageDimensions && (
              <div className="highlight-layer">
                {/* Detected components */}
                {visibleComponents.map((c, i) => {
                  const isActive =
                    highlightCode !== "__none__" &&
                    (!highlightCode ||
                      c.base_code === highlightCode ||
                      c.code === highlightCode);
                  return (
                    <div
                      key={`det-${i}`}
                      className="highlight-box detected"
                      style={{
                        ...toStyle(c.x0, c.y0, c.x1, c.y1),
                        opacity: isActive ? 1 : 0.15,
                      }}
                      onMouseEnter={() => setHoveredBox({ index: `det-${i}` })}
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

                {/* Warnings */}
                {visibleWarnings.map((w, i) => (
                  <div
                    key={`warn-${i}`}
                    className="highlight-box warning"
                    style={toStyle(w.x0, w.y0, w.x1, w.y1)}
                    onMouseEnter={() => setHoveredBox({ index: `warn-${i}` })}
                    onMouseLeave={() => setHoveredBox(null)}
                  >
                    {hoveredBox?.index === `warn-${i}` && (
                      <div
                        className="highlight-tooltip"
                        style={{ color: "var(--red)" }}
                      >
                        ⚠ Möjlig trunkerad etikett: {w.fragment}
                      </div>
                    )}
                  </div>
                ))}

                {/* Manually added */}
                {visibleManual.map((m, i) => (
                  <div
                    key={`man-${i}`}
                    className="highlight-box manual"
                    style={toStyle(m.x0, m.y0, m.x1, m.y1)}
                    onMouseEnter={() => setHoveredBox({ index: `man-${i}` })}
                    onMouseLeave={() => setHoveredBox(null)}
                  >
                    {hoveredBox?.index === `man-${i}` && (
                      <div
                        className="highlight-tooltip"
                        style={{ color: "var(--green)" }}
                      >
                        + Manuell: {m.code}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
