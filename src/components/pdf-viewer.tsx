"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ActionForm } from "./action-form";
export function PdfViewer({ id, status }: { id: string; status: string }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null),
    document = useRef<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1),
    [pages, setPages] = useState(0),
    [zoom, setZoom] = useState(1),
    [retry, setRetry] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (status !== "ready") return;
    let disposed = false;
    let task: { destroy: () => Promise<void> } | undefined;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const pdf = await import("pdfjs-dist");
        pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loader = pdf.getDocument({
          url: `/api/submissions/${id}/file`,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
        });
        task = loader;
        const doc = await loader.promise;
        if (disposed) {
          await loader.destroy();
          return;
        }
        document.current = doc;
        setPages(doc.numPages);
        setPage(1);
        setLoading(false);
      } catch {
        if (!disposed) {
          setError(
            "The PDF could not be loaded. Please retry or contact the administrator.",
          );
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      disposed = true;
      document.current = null;
      void task?.destroy();
    };
  }, [id, status, retry]);
  useEffect(() => {
    let disposed = false;
    let render: RenderTask | undefined;
    async function draw() {
      if (!document.current || !canvas.current) return;
      try {
        const slide = await document.current.getPage(page);
        if (disposed) return;
        const viewport = slide.getViewport({ scale: 1.4 * zoom });
        const el = canvas.current;
        if (!el) return;
        el.width = viewport.width;
        el.height = viewport.height;
        render = slide.render({ canvas: el, viewport });
        await render.promise;
      } catch (e) {
        if (
          !disposed &&
          e instanceof Error &&
          e.name !== "RenderingCancelledException"
        )
          setError("This slide could not be rendered. Retry the preview.");
      }
    }
    void draw();
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [page, pages, zoom, retry]);
  return (
    <section className="card viewer" ref={container}>
      <div className="table-heading">
        <h2 style={{ margin: 0 }}>Presentation</h2>
        <span className="muted">Private preview</span>
      </div>
      <div className="viewer-stage">
        {status !== "ready" ? (
          <div className="empty">
            <h3>
              {status === "failed"
                ? "Preview unavailable"
                : "Preparing your presentation…"}
            </h3>
            <p>
              {status === "failed"
                ? "Conversion could not complete. Retry or ask the administrator to check the conversion service."
                : "PowerPoint conversion runs in the background. Refresh to check progress."}
            </p>
            {status === "failed" ? (
              <ActionForm
                endpoint={`/api/submissions/${id}`}
                action="preview-retry"
              >
                <button>Retry conversion</button>
              </ActionForm>
            ) : (
              <button onClick={() => window.location.reload()}>
                Refresh status
              </button>
            )}
          </div>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => setRetry((v) => v + 1)}>
              Retry preview
            </button>
          </div>
        ) : (
          <>
            {loading && <p className="muted">Loading slides…</p>}
            <canvas
              ref={canvas}
              aria-label={`Presentation slide ${page} of ${pages}`}
              style={{ display: loading ? "none" : "block" }}
            />
          </>
        )}
      </div>
      {status === "ready" && (
        <div className="viewer-controls">
          <button
            className="secondary"
            aria-label="Previous slide"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span>
            {page} / {pages || "—"}
          </span>
          <button
            className="secondary"
            aria-label="Next slide"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
          <button
            className="secondary"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="secondary"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          >
            +
          </button>
          <button
            className="secondary"
            onClick={() => {
              void container.current
                ?.requestFullscreen()
                .catch(() =>
                  setError("Full-screen mode is unavailable in this browser."),
                );
            }}
          >
            Full screen
          </button>
        </div>
      )}
      <p className="muted" style={{ padding: "0 20px", fontSize: 11 }}>
        Converted slides may differ from PowerPoint. Animations and embedded
        media are not included.
      </p>
    </section>
  );
}
