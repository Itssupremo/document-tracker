// Dashboard page logic
var allFiles = [];
document.addEventListener('DOMContentLoaded', function() {
  loadDashboard();
  document.getElementById('searchInput').addEventListener('input', function() {
    renderFiles(filterFiles(this.value));
  });
});

function filterFiles(query) {
  if (!query || !query.trim()) return allFiles;
  var q = query.trim().toLowerCase();
  return allFiles.filter(function(f) {
    return (f.fileId && f.fileId.toLowerCase().includes(q)) ||
           (f.fileName && f.fileName.toLowerCase().includes(q)) ||
           (f.uploaderName && f.uploaderName.toLowerCase().includes(q));
  });
}

async function loadDashboard() {
  try {
    var res = await fetch('/file/');
    if (!res.ok) throw new Error('Failed to load files');
    allFiles = await res.json();

    document.getElementById('statTotal').textContent = allFiles.length;
    document.getElementById('statCompleted').textContent = allFiles.filter(function(f) { return f.status === 'completed'; }).length;
    document.getElementById('statPending').textContent = allFiles.filter(function(f) { return f.status === 'pending'; }).length;

    renderFiles(allFiles);
  } catch (err) {
    document.getElementById('filesTableBody').innerHTML =
      '<tr><td colspan="6" class="text-center py-4 text-danger">Error loading files.</td></tr>';
  }
}

function renderFiles(files) {
  var tbody = document.getElementById('filesTableBody');

  if (files.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No documents found.</td></tr>';
    return;
  }

  tbody.innerHTML = files.map(function(f) {
    var actions = '';
    if (f.status === 'completed') {
      actions = '<a href="/file/' + f.fileId + '/view" class="btn-action me-1" title="View"><i class="bi bi-eye"></i></a>' +
        '<a href="/file/' + f.fileId + '/download" class="btn-action me-1" title="Download"><i class="bi bi-download"></i></a>' +
        '<button class="btn-action danger" onclick="deleteFile(\'' + f.fileId + '\', \'' + escapeHtml(f.fileName).replace(/'/g, "\\'") + '\')" title="Delete"><i class="bi bi-trash"></i></button>';
    } else {
      actions = '<span class="text-muted small">Processing...</span>' +
        '<button class="btn-action danger ms-1" onclick="deleteFile(\'' + f.fileId + '\', \'' + escapeHtml(f.fileName).replace(/'/g, "\\'") + '\')" title="Delete"><i class="bi bi-trash"></i></button>';
    }
    var shortId = f.fileId;
    return '<tr>' +
      '<td><code title="' + escapeHtml(f.fileId) + '">' + escapeHtml(shortId) + '</code></td>' +
      '<td><i class="bi bi-file-earmark-pdf text-danger me-2"></i>' + escapeHtml(f.fileName) + '</td>' +
      '<td>' + escapeHtml(f.uploaderName) + '</td>' +
      '<td>' + new Date(f.uploadDate).toLocaleDateString() + '</td>' +
      '<td><span class="badge-status ' + f.status + '">' + f.status + '</span></td>' +
      '<td>' + actions + '</td>' +
      '</tr>';
  }).join('');
}

async function deleteFile(fileId, fileName) {
  if (!confirm('Delete "' + fileName + '"? This cannot be undone.')) return;
  try {
    var res = await fetch('/file/' + encodeURIComponent(fileId), { method: 'DELETE' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed.');
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
