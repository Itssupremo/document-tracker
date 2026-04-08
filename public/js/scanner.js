// QR Scanner page logic
let html5QrCode = null;
let cameraRunning = false;

document.addEventListener('DOMContentLoaded', () => {
  // Image upload scanner
  const qrImageInput = document.getElementById('qrImageInput');
  if (qrImageInput) {
    qrImageInput.addEventListener('change', handleImageUpload);
  }

  // Enter key on manual input
  const manualInput = document.getElementById('manualFileId');
  if (manualInput) {
    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') goToFile();
    });
  }
});

function startCamera() {
  const readerDiv = document.getElementById('reader');
  readerDiv.style.display = 'block';
  document.getElementById('startCameraBtn').style.display = 'none';
  document.getElementById('stopCameraBtn').style.display = 'block';
  document.getElementById('scanError').classList.add('d-none');

  html5QrCode = new Html5Qrcode('reader');

  Html5Qrcode.getCameras().then(cameras => {
    if (cameras && cameras.length > 0) {
      const cameraId = cameras[cameras.length - 1].id;
      return html5QrCode.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {} // ignore continuous scan failures
      );
    } else {
      throw new Error('No cameras found.');
    }
  }).then(() => {
    cameraRunning = true;
  }).catch(err => {
    console.warn('Camera error:', err);
    showScanError('Camera not available. Try uploading a QR code image or entering the File ID manually.');
    stopCamera();
  });
}

function stopCamera() {
  if (html5QrCode && cameraRunning) {
    html5QrCode.stop().catch(() => {});
    cameraRunning = false;
  }
  document.getElementById('reader').style.display = 'none';
  document.getElementById('startCameraBtn').style.display = 'block';
  document.getElementById('stopCameraBtn').style.display = 'none';
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('scanError').classList.add('d-none');
  document.getElementById('scanResult').classList.add('d-none');

  const tempScanner = new Html5Qrcode('reader');
  tempScanner.scanFile(file, true)
    .then(decodedText => {
      onScanSuccess(decodedText);
    })
    .catch(err => {
      console.warn('Image scan failed:', err);
      showScanError('Could not detect a QR code in the uploaded image. Please try a clearer image.');
    });
}

function onScanSuccess(decodedText) {
  if (cameraRunning) {
    stopCamera();
  }

  const scanResult = document.getElementById('scanResult');
  const scannedUrl = document.getElementById('scannedUrl');
  const scannedUrlText = document.getElementById('scannedUrlText');

  let targetUrl = decodedText;

  // Check if it's our file URL pattern
  if (decodedText.includes('/file/')) {
    try {
      const url = new URL(decodedText);
      // Redirect to the view page on our domain
      targetUrl = url.pathname + (url.pathname.endsWith('/view') ? '' : '/view');
    } catch (_e) {
      // If URL parsing fails, use relative path extraction
      const match = decodedText.match(/\/file\/([^/]+)/);
      if (match) {
        targetUrl = '/file/' + match[1] + '/view';
      }
    }
    scannedUrl.textContent = 'Open File Details';
  } else {
    scannedUrl.textContent = 'Open Link';
  }

  scannedUrlText.textContent = decodedText;
  scannedUrl.href = targetUrl;
  scanResult.classList.remove('d-none');
  document.getElementById('scanError').classList.add('d-none');
}

function showScanError(message) {
  document.getElementById('scanErrorText').textContent = message;
  document.getElementById('scanError').classList.remove('d-none');
  document.getElementById('scanResult').classList.add('d-none');
}

function goToFile() {
  const fileId = document.getElementById('manualFileId').value.trim();
  if (fileId) {
    window.location.href = '/file/' + encodeURIComponent(fileId) + '/view';
  }
}
