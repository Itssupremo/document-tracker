const QRCode = require('qrcode');
const sharp = require('sharp');

/**
 * Generate a QR code PNG buffer with the file ID label below it.
 * Uses sharp for image composition — no Puppeteer needed.
 */
async function generateQRCode(fileId, baseUrl) {
  const url = `${baseUrl}/file/${fileId}/view`;

  // Generate QR code as PNG buffer (300x300)
  const qrBuffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });

  // Create an SVG text label
  const labelHeight = 36;
  const totalWidth = 320; // small padding around qr
  const escapedId = fileId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const labelSvg = Buffer.from(`<svg width="${totalWidth}" height="${labelHeight}">
    <rect width="${totalWidth}" height="${labelHeight}" fill="white"/>
    <text x="${totalWidth / 2}" y="${labelHeight / 2 + 6}" font-family="Montserrat, Arial, sans-serif"
          font-size="16" font-weight="bold" fill="black" text-anchor="middle">${escapedId}</text>
  </svg>`);

  // Compose: white background + QR code centered + label below
  const totalHeight = 300 + labelHeight + 20; // 10px padding top/bottom
  const composedBuffer = await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([
      { input: await sharp(qrBuffer).resize(300, 300).toBuffer(), top: 10, left: 10 },
      { input: labelSvg, top: 310, left: 0 }
    ])
    .png()
    .toBuffer();

  return { qrImageBuffer: composedBuffer, qrUrl: url };
}

async function generateQRCodeBuffer(fileId, baseUrl) {
  const { qrImageBuffer } = await generateQRCode(fileId, baseUrl);
  return qrImageBuffer;
}

module.exports = { generateQRCode, generateQRCodeBuffer };

