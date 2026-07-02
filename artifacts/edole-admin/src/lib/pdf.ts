/**
 * PDF export — uses html-to-image (browser-native CSS renderer) + jsPDF.
 *
 * Key improvements vs previous version:
 * - Forces element to A4-equivalent width (794 px) before capture so the
 *   rendered layout matches the PDF column width exactly.
 * - Removes overflow clipping so content below the viewport is fully captured.
 * - Adds 10 mm page margins so nothing is flush against the paper edge.
 * - Slices multi-page content correctly with proper mm ↔ px math.
 */

const A4_CONTENT_PX = 794;   // 210 mm at 96 dpi (inner content width target)
const PAGE_MARGIN_MM = 10;   // uniform page margin

export async function saveDivAsPdf(el: HTMLElement, filename: string) {
  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("jspdf") as any,
  ]);

  // ── 1. Force A4-width layout & disable overflow clipping ─────────────────
  const prev = {
    width:     el.style.width,
    maxWidth:  el.style.maxWidth,
    overflow:  el.style.overflow,
    overflowX: el.style.overflowX,
    overflowY: el.style.overflowY,
    height:    el.style.height,
    maxHeight: el.style.maxHeight,
  };

  el.style.width     = `${A4_CONTENT_PX}px`;
  el.style.maxWidth  = `${A4_CONTENT_PX}px`;
  el.style.overflow  = "visible";
  el.style.overflowX = "visible";
  el.style.overflowY = "visible";
  el.style.height    = "auto";
  el.style.maxHeight = "none";

  // Two animation frames to let the browser reflow into the new width.
  await new Promise<void>(r =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  );

  // ── 2. Capture ────────────────────────────────────────────────────────────
  const canvas = await toCanvas(el, {
    pixelRatio:    2,
    backgroundColor: "#ffffff",
    skipAutoScale: false,
    width:         A4_CONTENT_PX,
  });

  // ── 3. Restore original styles ───────────────────────────────────────────
  el.style.width     = prev.width;
  el.style.maxWidth  = prev.maxWidth;
  el.style.overflow  = prev.overflow;
  el.style.overflowX = prev.overflowX;
  el.style.overflowY = prev.overflowY;
  el.style.height    = prev.height;
  el.style.maxHeight = prev.maxHeight;

  // ── 4. Build PDF with proper margins ─────────────────────────────────────
  const pdf     = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW   = pdf.internal.pageSize.getWidth();   // 210 mm
  const pageH   = pdf.internal.pageSize.getHeight();  // 297 mm
  const cW      = pageW  - 2 * PAGE_MARGIN_MM;        // content width  in mm
  const cH      = pageH  - 2 * PAGE_MARGIN_MM;        // content height in mm
  const mmPerPx = cW / canvas.width;                  // mm per canvas pixel
  const pxPerPage = Math.round(cH / mmPerPx);         // canvas pixels that fit one page

  let srcY = 0;
  let page = 0;

  while (srcY < canvas.height) {
    if (page > 0) pdf.addPage();

    const sliceH = Math.min(pxPerPage, canvas.height - srcY);
    const slice  = document.createElement("canvas");
    slice.width  = canvas.width;
    slice.height = sliceH;
    slice.getContext("2d")!.drawImage(
      canvas,
      0, srcY, canvas.width, sliceH,
      0, 0,    canvas.width, sliceH,
    );

    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.97),
      "JPEG",
      PAGE_MARGIN_MM,
      PAGE_MARGIN_MM,
      cW,
      sliceH * mmPerPx,
    );

    srcY += sliceH;
    page++;
  }

  pdf.save(filename);
}
