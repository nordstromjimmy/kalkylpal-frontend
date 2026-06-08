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
import { getPageImageUrl, getAnnotatedPdf } from "../api";

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
  onOpenChat = null,
  onRemoveComponent = null,
  onRemoveComponents = null,
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hoveredBox, setHoveredBox] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const selectionStartRef = useRef(null); // { x, y } client coords — ref avoids stale closures
  const selectionCurrentRef = useRef(null);
  const [selectionTick, setSelectionTick] = useState(0); // incremented on mousemove to force re-render
  const isSelecting = useRef(false);
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
    setSelectedBox(null);
    setSelectedComponents([]);
    selectionStartRef.current = null;
    selectionCurrentRef.current = null;
    isSelecting.current = false;
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

  // ── Screen → PDF coordinate conversion ───────────────────────────────────
  function screenToPDF(clientX, clientY) {
    if (!wrapRef.current || !pageDimensions) return { x: 0, y: 0 };
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * pageDimensions.width,
      y: ((clientY - rect.top) / rect.height) * pageDimensions.height,
    };
  }

  function overlaps(comp, sel) {
    return !(
      comp.x1 < sel.x0 ||
      comp.x0 > sel.x1 ||
      comp.y1 < sel.y0 ||
      comp.y0 > sel.y1
    );
  }

  // ── Mouse down → start panning or selection ───────────────────────────────
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    if (e.shiftKey) {
      e.preventDefault();
      isSelecting.current = true;
      selectionStartRef.current = { x: e.clientX, y: e.clientY };
      selectionCurrentRef.current = { x: e.clientX, y: e.clientY };
      setSelectedComponents([]);
      setSelectionTick(0);
      return;
    }
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.currentTarget.style.cursor = "grabbing";
  }

  function handleMouseMove(e) {
    if (isSelecting.current) {
      selectionCurrentRef.current = { x: e.clientX, y: e.clientY };
      setSelectionTick((t) => t + 1);
      return;
    }
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
  }

  function handleMouseUp(e) {
    if (isSelecting.current) {
      isSelecting.current = false;
      const start = selectionStartRef.current;
      const current = selectionCurrentRef.current;
      selectionStartRef.current = null;
      selectionCurrentRef.current = null;
      setSelectionTick(0);
      if (start && current && wrapRef.current && pageDimensions) {
        const s = screenToPDF(start.x, start.y);
        const c = screenToPDF(current.x, current.y);
        const selBox = {
          x0: Math.min(s.x, c.x),
          y0: Math.min(s.y, c.y),
          x1: Math.max(s.x, c.x),
          y1: Math.max(s.y, c.y),
        };
        if (selBox.x1 - selBox.x0 > 3 && selBox.y1 - selBox.y0 > 3) {
          const hit = visibleComponents.filter((c) => overlaps(c, selBox));
          if (hit.length > 0) setSelectedComponents(hit);
        }
      }
      return;
    }
    isPanning.current = false;
    e.currentTarget.style.cursor = "grab";
  }

  function handleMouseLeave(e) {
    if (isSelecting.current) {
      isSelecting.current = false;
      selectionStartRef.current = null;
      selectionCurrentRef.current = null;
      setSelectionTick(0);
      return;
    }
    isPanning.current = false;
    e.currentTarget.style.cursor = "grab";
  }

  async function handleDownload() {
    if (!drawingId) return;
    setIsDownloading(true);
    try {
      const boxes = visibleComponents.map((c) => ({
        x0: c.x0,
        y0: c.y0,
        x1: c.x1,
        y1: c.y1,
      }));
      const blob = await getAnnotatedPdf(drawingId, pageNumber, boxes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ritning_sida_${pageNumber}_markerad.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
          className="btn btn-ghost"
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
            "Ladda ner ritning"
          )}
        </button>
        {onOpenChat && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11 }}
            onClick={onOpenChat}
            title="Öppna AI-assistent"
          >
            💬 AI-assistent
          </button>
        )}
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
        onClick={(e) => {
          if (e.shiftKey) return;
          setSelectedBox(null);
          setSelectedComponents([]);
        }}
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
                  const isSelected = selectedComponents.some(
                    (s) => s.x0 === c.x0 && s.y0 === c.y0,
                  );
                  const isSingleSelected = selectedBox === `det-${i}`;
                  return (
                    <div
                      key={`det-${i}`}
                      className="highlight-box detected"
                      style={{
                        ...toStyle(c.x0, c.y0, c.x1, c.y1),
                        opacity: isActive ? 1 : 0.15,
                        outline: isSelected
                          ? "2px solid var(--red)"
                          : isSingleSelected
                            ? "2px solid var(--red)"
                            : undefined,
                        cursor: "pointer",
                      }}
                      onMouseDown={(e) => {
                        if (!e.shiftKey) e.stopPropagation();
                      }}
                      onClick={(e) => {
                        if (e.shiftKey) return;
                        e.stopPropagation();
                        setSelectedBox(isSingleSelected ? null : `det-${i}`);
                        setSelectedComponents([]);
                      }}
                      onMouseEnter={() => setHoveredBox({ index: `det-${i}` })}
                      onMouseLeave={() => setHoveredBox(null)}
                    >
                      {(isSelected || isSingleSelected) && onRemoveComponent ? (
                        <button
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            background: "var(--red)",
                            border: "none",
                            borderRadius: "50%",
                            width: 18,
                            height: 18,
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1,
                            zIndex: 10,
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveComponent(c);
                            setSelectedBox(null);
                            setSelectedComponents((prev) =>
                              prev.filter(
                                (s) => !(s.x0 === c.x0 && s.y0 === c.y0),
                              ),
                            );
                          }}
                        >
                          ×
                        </button>
                      ) : (
                        hoveredBox?.index === `det-${i}` &&
                        !isSingleSelected && (
                          <div className="highlight-tooltip">
                            {c.raw_text !== c.code
                              ? `${c.raw_text} → ${c.code}`
                              : c.code}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}

                {/* Shift+drag selection box — reads from refs, re-renders via selectionTick */}
                {selectionTick >= 0 &&
                  isSelecting.current &&
                  selectionStartRef.current &&
                  selectionCurrentRef.current &&
                  (() => {
                    const s = screenToPDF(
                      selectionStartRef.current.x,
                      selectionStartRef.current.y,
                    );
                    const c = screenToPDF(
                      selectionCurrentRef.current.x,
                      selectionCurrentRef.current.y,
                    );
                    return (
                      <div
                        style={{
                          ...toStyle(
                            Math.min(s.x, c.x),
                            Math.min(s.y, c.y),
                            Math.max(s.x, c.x),
                            Math.max(s.y, c.y),
                          ),
                          position: "absolute",
                          border: "2px dashed var(--red)",
                          background: "rgba(255,80,80,0.08)",
                          pointerEvents: "none",
                          zIndex: 20,
                        }}
                      />
                    );
                  })()}

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

      {/* Floating multi-delete button — shown when shift+drag selects components */}
      {selectedComponents.length > 0 && onRemoveComponents && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg-2)",
            border: "1px solid var(--red)",
            borderRadius: "var(--radius)",
            padding: "8px 14px",
            zIndex: 30,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
            }}
          >
            {selectedComponents.length}{" "}
            {selectedComponents.length === 1
              ? "markering vald"
              : "markeringar valda"}
          </span>
          <button
            className="btn"
            style={{
              fontSize: 11,
              background: "var(--red)",
              color: "#fff",
              border: "none",
              padding: "4px 14px",
            }}
            onClick={() => {
              onRemoveComponents(selectedComponents);
              setSelectedComponents([]);
            }}
          >
            Ta bort
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "4px 10px" }}
            onClick={() => setSelectedComponents([])}
          >
            Avbryt
          </button>
        </div>
      )}
    </div>
  );
}
