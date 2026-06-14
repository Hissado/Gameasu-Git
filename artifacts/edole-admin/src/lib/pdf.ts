/**
 * PDF export — uses html-to-image (browser-native CSS renderer via SVG
 * foreignObject) so oklch/oklab/modern CSS functions are fully supported.
 */

export async function saveDivAsPdf(el: HTMLElement, filename: string) {
  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("jspdf") as any,
  ]);

  const canvas = await toCanvas(el, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    skipAutoScale: false,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const totalH = (canvas.height / canvas.width) * pageW;

  let yMm = 0;
  let pi = 0;
  while (yMm < totalH) {
    if (pi > 0) pdf.addPage();
    const srcY = Math.round((yMm / pageW) * canvas.width);
    const srcH = Math.min(
      Math.round((pageH / pageW) * canvas.width),
      canvas.height - srcY,
    );
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = srcH;
    slice.getContext("2d")!.drawImage(
      canvas,
      0, srcY, canvas.width, srcH,
      0, 0,   canvas.width, srcH,
    );
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.97),
      "JPEG",
      0, 0,
      pageW,
      (srcH / canvas.width) * pageW,
    );
    yMm += pageH;
    pi++;
  }
  pdf.save(filename);
}
