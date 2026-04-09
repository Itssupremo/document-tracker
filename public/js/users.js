// User management page logic
document.addEventListener('DOMContentLoaded', loadUsers);

async function loadUsers() {
  try {
    var res = await fetch('/api/users');
    if (res.status === 403) {
      window.location.href = '/dashboard';
      return;
    }
    if (!res.ok) throw new Error('Failed to load users');
    var users = await res.json();

    var tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(function(u) {
      return '<tr>' +
        '<td><i class="bi bi-person-circle me-2"></i>' + escapeHtml(u.username) + '</td>' +
        '<td>' + escapeHtml(u.fullName || '\u2014') + '</td>' +
        '<td>' + escapeHtml(u.email || '\u2014') + '</td>' +
        '<td><span class="badge-role ' + u.role + '">' + u.role + '</span></td>' +
        '<td>' + new Date(u.createdAt).toLocaleDateString() + '</td>' +
        '<td>' +
        '  <button class="btn-action me-1" onclick="editUser(\'' + escapeAttr(u.id) + '\', \'' + escapeAttr(u.username) + '\', \'' + escapeAttr(u.fullName || '') + '\', \'' + escapeAttr(u.email || '') + '\', \'' + u.role + '\')" title="Edit">' +
        '    <i class="bi bi-pencil"></i>' +
        '  </button>' +
        '  <button class="btn-action danger" onclick="deleteUser(\'' + escapeAttr(u.id) + '\', \'' + escapeAttr(u.username) + '\')" title="Delete">' +
        '    <i class="bi bi-trash"></i>' +
        '  </button>' +
        '</td>' +
        '</tr>';
    }).join('');
  } catch (err) {
    document.getElementById('usersTableBody').innerHTML =
      '<tr><td colspan="6" class="text-center py-4 text-danger">Error loading users.</td></tr>';
  }
}

function showAddUser() {
  document.getElementById('modalTitle').textContent = 'Add User';
  document.getElementById('editUserId').value = '';
  document.getElementById('modalUsername').value = '';
  document.getElementById('modalPassword').value = '';
  document.getElementById('modalFullName').value = '';
  document.getElementById('modalEmail').value = '';
  document.getElementById('modalRole').value = 'user';
  document.getElementById('modalPassword').required = true;
  document.getElementById('passwordHint').textContent = 'Minimum 6 characters';
  document.getElementById('modalError').classList.add('d-none');
  document.getElementById('userModal').style.display = 'flex';
}

function editUser(id, username, fullName, email, role) {
  document.getElementById('modalTitle').textContent = 'Edit User';
  document.getElementById('editUserId').value = id;
  document.getElementById('modalUsername').value = username;
  document.getElementById('modalPassword').value = '';
  document.getElementById('modalFullName').value = fullName;
  document.getElementById('modalEmail').value = email;
  document.getElementById('modalRole').value = role;
  document.getElementById('modalPassword').required = false;
  document.getElementById('passwordHint').textContent = 'Leave blank to keep current password';
  document.getElementById('modalError').classList.add('d-none');
  document.getElementById('userModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('userModal').style.display = 'none';
}

document.getElementById('userForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var errorEl = document.getElementById('modalError');
  errorEl.classList.add('d-none');
  var btn = document.getElementById('modalSubmitBtn');
  btn.disabled = true;

  var userId = document.getElementById('editUserId').value;
  var body = {
    username: document.getElementById('modalUsername').value.trim(),
    fullName: document.getElementById('modalFullName').value.trim(),
    email: document.getElementById('modalEmail').value.trim(),
    role: document.getElementById('modalRole').value
  };
  var pw = document.getElementById('modalPassword').value;
  if (pw) body.password = pw;

  try {
    var url = userId ? '/api/users/' + userId : '/api/users';
    var method = userId ? 'PUT' : 'POST';

    var res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Operation failed.');

    closeModal();
    loadUsers();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
});

async function deleteUser(id, username) {
  if (!confirm('Delete user "' + username + '"? This cannot be undone.')) return;

  try {
    var res = await fetch('/api/users/' + id, { method: 'DELETE' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed.');
    loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function escapeAttr(text) {
  return (text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
