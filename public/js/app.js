// Upload page logic — drag-and-drop QR placement flow
// PDF preview is rendered CLIENT-SIDE using pdf.js (no server-side Puppeteer)
let currentFileId = null;
let totalPages = 0;
let currentPage = 0;
let qrPosition = { xPercent: 70, yPercent: 5 }; // default: top-right area
let qrSizePercent = 15;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let dragInitialized = false;
let pdfDoc = null; // pdf.js document instance

// STEP 1: Upload form
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const uploadError = document.getElementById('uploadError');
    const uploadLoading = document.getElementById('uploadLoading');
    const submitBtn = document.getElementById('submitBtn');

    uploadError.classList.add('d-none');
    uploadLoading.classList.remove('d-none');
    submitBtn.disabled = true;

    const formData = new FormData(uploadForm);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed.');
      }

      currentFileId = data.fileId;
      totalPages = data.totalPages;
      currentPage = 0;

      document.getElementById('fileNameBadge').textContent = data.fileName;

      // Show page navigation for multi-page documents
      const pageNav = document.getElementById('pageNavigation');
      if (totalPages > 1) {
        pageNav.classList.remove('d-none');
      } else {
        pageNav.classList.add('d-none');
      }

      // Load PDF for client-side rendering
      await loadPdfForPreview(currentFileId);

      // Render first page
      await renderPagePreview(0);

      // Switch to step 2
      document.getElementById('step1').classList.add('d-none');
      document.getElementById('step2').classList.remove('d-none');

      // Initialize drag handlers (once)
      if (!dragInitialized) {
        initDrag();
        dragInitialized = true;
      }

    } catch (err) {
      uploadError.textContent = err.message;
      uploadError.classList.remove('d-none');
    } finally {
      uploadLoading.classList.add('d-none');
      submitBtn.disabled = false;
    }
  });
}

// Load PDF from server for client-side rendering
async function loadPdfForPreview(fileId) {
  const url = '/api/upload/preview-pdf/' + encodeURIComponent(fileId);
  pdfDoc = await pdfjsLib.getDocument(url).promise;
}

// Render a specific page to canvas, then convert to image
async function renderPagePreview(pageIndex) {
  currentPage = pageIndex;
  if (!pdfDoc) return;

  const page = await pdfDoc.getPage(pageIndex + 1); // pdf.js is 1-indexed
  const viewport = page.getViewport({ scale: 1 });

  // Target A4-like dimensions
  const targetWidth = 794;
  const targetHeight = 1123;
  const scale = Math.min(targetWidth / viewport.width, targetHeight / viewport.height);
  const scaledViewport = page.getViewport({ scale });

  // Create an offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  const offsetX = (targetWidth - scaledViewport.width) / 2;
  const offsetY = (targetHeight - scaledViewport.height) / 2;
  ctx.translate(offsetX, offsetY);

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  // Convert to image and set as preview
  const pageImage = document.getElementById('pageImage');
  pageImage.onload = function () {
    updateQROverlay();
  };
  pageImage.src = canvas.toDataURL('image/png');

  document.getElementById('pageIndicator').textContent =
    'Page ' + (pageIndex + 1) + ' of ' + totalPages;
}

function prevPage() {
  if (currentPage > 0) renderPagePreview(currentPage - 1);
}

function nextPage() {
  if (currentPage < totalPages - 1) renderPagePreview(currentPage + 1);
}

// Update QR overlay size and position based on stored percentages
function updateQROverlay() {
  const overlay = document.getElementById('qrOverlay');
  const image = document.getElementById('pageImage');

  if (!image || !image.naturalWidth) return;

  var imgW = image.clientWidth;
  var imgH = image.clientHeight;

  var size = imgW * (qrSizePercent / 100);
  overlay.style.width = size + 'px';
  overlay.style.height = size + 'px';

  // Compute pixel position from percentages, clamped within bounds
  var x = imgW * (qrPosition.xPercent / 100);
  var y = imgH * (qrPosition.yPercent / 100);
  x = Math.max(0, Math.min(x, imgW - size));
  y = Math.max(0, Math.min(y, imgH - size));

  overlay.style.left = x + 'px';
  overlay.style.top = y + 'px';
}

// QR size slider
var qrSizeSlider = document.getElementById('qrSizeSlider');
if (qrSizeSlider) {
  qrSizeSlider.addEventListener('input', function (e) {
    qrSizePercent = parseInt(e.target.value, 10);
    document.getElementById('qrSizeLabel').textContent = qrSizePercent + '%';
    updateQROverlay();
  });
}

// Drag and drop handlers
function initDrag() {
  var overlay = document.getElementById('qrOverlay');

  overlay.addEventListener('mousedown', startDrag);
  overlay.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchend', stopDrag);

  // Keep QR positioned correctly on window resize
  window.addEventListener('resize', updateQROverlay);
}

function startDrag(e) {
  e.preventDefault();
  isDragging = true;
  var overlay = document.getElementById('qrOverlay');
  var rect = overlay.getBoundingClientRect();
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  dragOffset.x = clientX - rect.left;
  dragOffset.y = clientY - rect.top;
  overlay.classList.add('dragging');
}

function onDrag(e) {
  if (!isDragging) return;
  e.preventDefault();

  var image = document.getElementById('pageImage');
  var overlay = document.getElementById('qrOverlay');
  var imageRect = image.getBoundingClientRect();

  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;

  var x = clientX - imageRect.left - dragOffset.x;
  var y = clientY - imageRect.top - dragOffset.y;

  var maxX = image.clientWidth - overlay.offsetWidth;
  var maxY = image.clientHeight - overlay.offsetHeight;

  x = Math.max(0, Math.min(x, maxX));
  y = Math.max(0, Math.min(y, maxY));

  overlay.style.left = x + 'px';
  overlay.style.top = y + 'px';

  // Store as percentages for the server
  qrPosition.xPercent = (x / image.clientWidth) * 100;
  qrPosition.yPercent = (y / image.clientHeight) * 100;
}

function stopDrag() {
  if (!isDragging) return;
  isDragging = false;
  var overlay = document.getElementById('qrOverlay');
  if (overlay) overlay.classList.remove('dragging');
}

// STEP 2: Generate QR Code & PDF
async function generatePdf() {
  if (!currentFileId) return;

  var generateBtn = document.getElementById('generateBtn');
  var generateLoading = document.getElementById('generateLoading');
  var generateError = document.getElementById('generateError');

  generateError.classList.add('d-none');
  generateLoading.classList.remove('d-none');
  generateBtn.disabled = true;

  try {
    var response = await fetch('/api/upload/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: currentFileId,
        page: currentPage,
        xPercent: qrPosition.xPercent,
        yPercent: qrPosition.yPercent,
        qrSize: qrSizePercent
      })
    });

    var data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Generation failed.');
    }

    // Show success — step 3
    document.getElementById('qrImage').src = data.qrImageUrl;
    document.getElementById('qrUrlText').textContent = data.qrUrl;
    document.getElementById('fileDetailsLink').href = '/file/' + data.fileId + '/view';

    document.getElementById('step2').classList.add('d-none');
    document.getElementById('step3').classList.remove('d-none');

  } catch (err) {
    generateError.textContent = err.message;
    generateError.classList.remove('d-none');
  } finally {
    generateLoading.classList.add('d-none');
    generateBtn.disabled = false;
  }
}

function resetToStep1() {
  currentFileId = null;
  totalPages = 0;
  currentPage = 0;
  pdfDoc = null;
  qrPosition = { xPercent: 70, yPercent: 5 };
  qrSizePercent = 15;
  isDragging = false;
  document.getElementById('step1').classList.remove('d-none');
  document.getElementById('step2').classList.add('d-none');
  document.getElementById('step3').classList.add('d-none');
  document.getElementById('uploadForm').reset();
  var slider = document.getElementById('qrSizeSlider');
  if (slider) {
    slider.value = 15;
    document.getElementById('qrSizeLabel').textContent = '15%';
  }
}
