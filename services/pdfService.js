const { PDFDocument } = require('pdf-lib');

/**
 * Overlay a PNG image (QR code) on a specific page of a PDF.
 * All inputs/outputs are Buffers — no filesystem needed.
 * @param {Buffer} pdfBuffer - source PDF buffer
 * @param {Buffer} imageBuffer - PNG image buffer to overlay
 * @param {number} pageIndex - which page (0-based)
 * @param {number} xPercent - x position as % of page width (from left)
 * @param {number} yPercent - y position as % of page height (from top)
 * @param {number} widthPercent - image width as % of page width
 * @returns {Buffer} modified PDF buffer
 */
async function overlayImageOnPdf(pdfBuffer, imageBuffer, pageIndex, xPercent, yPercent, widthPercent) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const image = await pdfDoc.embedPng(imageBuffer);

  const pageCount = pdfDoc.getPageCount();
  const safePageIndex = Math.max(0, Math.min(pageIndex, pageCount - 1));
  const page = pdfDoc.getPage(safePageIndex);
  const { width: pW, height: pH } = page.getSize();

  // Clamp values
  const wp = Math.max(5, Math.min(widthPercent, 50));
  const xp = Math.max(0, Math.min(xPercent, 100));
  const yp = Math.max(0, Math.min(yPercent, 100));

  const imgWidth = pW * (wp / 100);
  const imgHeight = imgWidth; // QR codes are square

  // Convert from top-left percentages to PDF bottom-left coordinates
  const x = pW * (xp / 100);
  const y = pH - (pH * (yp / 100)) - imgHeight;

  page.drawImage(image, { x, y, width: imgWidth, height: imgHeight });

  const modifiedPdfBytes = await pdfDoc.save();
  return Buffer.from(modifiedPdfBytes);
}

/**
 * Get the total page count of a PDF buffer.
 */
async function getPdfPageCount(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  return pdfDoc.getPageCount();
}

module.exports = { overlayImageOnPdf, getPdfPageCount };

