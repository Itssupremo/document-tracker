// File details page logic
let currentFileId = null;

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  // Extract fileId from URL: /file/:id/view or /file/:id
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2 && pathParts[0] === 'file') {
    currentFileId = pathParts[1];
  }

  if (!currentFileId) {
    showError('No file ID provided in URL.');
    return;
  }

  try {
    const response = await fetch('/api/file/' + encodeURIComponent(currentFileId));

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'File not found.');
    }

    const data = await response.json();

    // Populate details
    document.getElementById('fileName').textContent = data.fileName || '';
    document.getElementById('uploaderName').textContent = data.uploaderName || '';
    document.getElementById('fileId').textContent = data.fileId || '';
    document.getElementById('uploadDate').textContent = data.uploadDate
      ? new Date(data.uploadDate).toLocaleString()
      : '';

    if (data.uploaderEmail) {
      document.getElementById('uploaderEmail').textContent = data.uploaderEmail;
    } else {
      document.getElementById('emailRow').classList.add('d-none');
    }

    document.getElementById('loadingSection').classList.add('d-none');
    document.getElementById('detailsSection').classList.remove('d-none');
  } catch (err) {
    showError(err.message);
  }
}

function showError(message) {
  document.getElementById('loadingSection').classList.add('d-none');
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorSection').classList.remove('d-none');
}

function viewPdf() {
  if (!currentFileId) return;
  window.open('/api/file/' + encodeURIComponent(currentFileId) + '/pdf', '_blank');
}

function downloadPdf() {
  if (!currentFileId) return;
  var a = document.createElement('a');
  a.href = '/api/file/' + encodeURIComponent(currentFileId) + '/download';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}
