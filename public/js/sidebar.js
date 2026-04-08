// Shared sidebar component — loaded on all authenticated pages
(function() {
  var currentPath = window.location.pathname;

  // Fetch user info
  fetch('/api/auth/me')
    .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function(user) { buildSidebar(user); })
    .catch(function() {
      // Not logged in
      if (currentPath === '/scanner' || currentPath.match(/^\/file\/.+\/view$/)) {
        buildPublicHeader();
      } else if (currentPath !== '/login') {
        window.location.href = '/login';
      }
    });

  function buildSidebar(user) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    var isAdmin = user.role === 'admin';
    var initial = (user.fullName || user.username || '?')[0].toUpperCase();

    var html = '';
    html += '<div class="sidebar-brand">';
    html += '  <h4><img src="/logo-transparent.png" alt="Logo" style="height:28px;vertical-align:middle;margin-right:6px"><span class="accent">Document</span></h4>';
    html += '  <small>Tracker System</small>';
    html += '</div>';

    html += '<div class="sidebar-section">OVERVIEW</div>';
    html += '<ul class="sidebar-nav">';
    html += '  <li><a href="/dashboard" class="' + (currentPath === '/dashboard' ? 'active' : '') + '">';
    html += '    <i class="bi bi-grid-1x2-fill"></i> Dashboard';
    html += '  </a></li>';
    html += '</ul>';

    html += '<div class="sidebar-section">DOCUMENT TRACKER</div>';
    html += '<ul class="sidebar-nav">';
    html += '  <li><a href="/upload" class="' + (currentPath === '/upload' ? 'active' : '') + '">';
    html += '    <i class="bi bi-cloud-arrow-up-fill"></i> Upload Document';
    html += '  </a></li>';
    html += '  <li><a href="/scanner" class="' + (currentPath === '/scanner' ? 'active' : '') + '">';
    html += '    <i class="bi bi-qr-code-scan"></i> Scanner';
    html += '  </a></li>';
    html += '</ul>';

    if (isAdmin) {
      html += '<div class="sidebar-section">MANAGEMENT</div>';
      html += '<ul class="sidebar-nav">';
      html += '  <li><a href="/users" class="' + (currentPath === '/users' ? 'active' : '') + '">';
      html += '    <i class="bi bi-people-fill"></i> User Management';
      html += '  </a></li>';
      html += '</ul>';
    }

    html += '<div class="sidebar-spacer"></div>';

    html += '<div class="sidebar-user">';
    html += '  <div class="user-info" onclick="openProfileModal()" style="cursor:pointer;" title="Edit Account">';
    html += '    <div class="user-avatar">' + escHtml(initial) + '</div>';
    html += '    <div style="flex:1;min-width:0;">';
    html += '      <div class="user-name">' + escHtml(user.fullName || user.username) + '</div>';
    html += '      <span class="user-role ' + escHtml(user.role) + '">' + escHtml(user.role) + '</span>';
    html += '    </div>';
    html += '    <i class="bi bi-gear" style="color:var(--sidebar-text);font-size:16px;opacity:0.7;"></i>';
    html += '  </div>';
    html += '  <button class="btn-logout" onclick="sidebarLogout()" style="width:100%;">';
    html += '    <i class="bi bi-box-arrow-left"></i> Logout';
    html += '  </button>';
    html += '</div>';

    sidebar.innerHTML = html;

    // Inject profile modal if not already present
    if (!document.getElementById('profileModal')) {
      var modal = document.createElement('div');
      modal.id = 'profileModal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = '<div class="modal-box">' +
        '<h3>Edit Account</h3>' +
        '<form id="profileForm">' +
        '<div class="mb-3">' +
        '  <label class="form-label fw-semibold">Username</label>' +
        '  <input type="text" class="form-control" id="profileUsername" disabled>' +
        '</div>' +
        '<div class="mb-3">' +
        '  <label class="form-label fw-semibold">Full Name</label>' +
        '  <input type="text" class="form-control" id="profileFullName" maxlength="100">' +
        '</div>' +
        '<div class="mb-3">' +
        '  <label class="form-label fw-semibold">Email</label>' +
        '  <input type="email" class="form-control" id="profileEmail" maxlength="200" placeholder="your@email.com">' +
        '</div>' +
        '<div class="mb-3">' +
        '  <label class="form-label fw-semibold">New Password</label>' +
        '  <input type="password" class="form-control" id="profilePassword" minlength="6" placeholder="Leave blank to keep current">' +
        '  <div class="form-text">Minimum 6 characters</div>' +
        '</div>' +
        '<div id="profileError" class="alert alert-danger py-2 d-none"></div>' +
        '<div id="profileSuccess" class="alert alert-success py-2 d-none"></div>' +
        '<div class="d-flex gap-2 justify-content-end">' +
        '  <button type="button" class="btn btn-secondary" onclick="closeProfileModal()">Cancel</button>' +
        '  <button type="submit" class="btn btn-primary">Save Changes</button>' +
        '</div>' +
        '</form>' +
        '</div>';
      document.body.appendChild(modal);

      document.getElementById('profileForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var errEl = document.getElementById('profileError');
        var sucEl = document.getElementById('profileSuccess');
        errEl.classList.add('d-none');
        sucEl.classList.add('d-none');

        var body = {};
        var fn = document.getElementById('profileFullName').value.trim();
        var em = document.getElementById('profileEmail').value.trim();
        var pw = document.getElementById('profilePassword').value;
        if (fn !== (window.__user.fullName || '')) body.fullName = fn;
        if (em !== (window.__user.email || '')) body.email = em;
        if (pw) body.password = pw;

        if (Object.keys(body).length === 0) {
          errEl.textContent = 'No changes to save.';
          errEl.classList.remove('d-none');
          return;
        }

        try {
          var res = await fetch('/api/auth/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          var data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Update failed.');
          sucEl.textContent = 'Account updated successfully.';
          sucEl.classList.remove('d-none');
          document.getElementById('profilePassword').value = '';
          setTimeout(function() { window.location.reload(); }, 1000);
        } catch(err) {
          errEl.textContent = err.message;
          errEl.classList.remove('d-none');
        }
      });
    }

    // Set page title in header
    var headerTitle = document.getElementById('pageTitle');
    if (headerTitle && !headerTitle.textContent.trim()) {
      var titles = {
        '/dashboard': 'Dashboard',
        '/upload': 'Upload Document',
        '/scanner': 'Scanner',
        '/users': 'User Management'
      };
      headerTitle.textContent = titles[currentPath] || 'Document Tracker';
    }

    // Set welcome text in header
    var welcomeText = document.getElementById('welcomeText');
    if (welcomeText) {
      welcomeText.textContent = 'Welcome, ' + (user.fullName || user.username);
    }

    // Store user globally for other scripts
    window.__user = user;
    document.dispatchEvent(new CustomEvent('userLoaded', { detail: user }));
  }

  function buildPublicHeader() {
    // On scanner page when not logged in — hide sidebar, show public header
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'none';

    var mainArea = document.querySelector('.main-area');
    if (mainArea) mainArea.style.marginLeft = '0';

    var header = document.querySelector('.main-header');
    if (header) {
      header.className = 'public-header';
      header.innerHTML = '<div class="brand"><img src="/logo-transparent.png" alt="Logo" style="height:24px;vertical-align:middle;margin-right:6px"><span class="accent">Document Tracker</span></div>' +
        '<a href="/login" class="btn-login-nav">Login</a>';
    }
  }

  function escHtml(text) {
    var d = document.createElement('div');
    d.textContent = text || '';
    return d.innerHTML;
  }

  // Global functions
  window.toggleSidebar = function() {
    var sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('open');
  };

  window.sidebarLogout = async function() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  window.openProfileModal = function() {
    var modal = document.getElementById('profileModal');
    if (!modal) return;
    document.getElementById('profileUsername').value = window.__user ? window.__user.username : '';
    document.getElementById('profileFullName').value = window.__user ? (window.__user.fullName || '') : '';
    document.getElementById('profileEmail').value = window.__user ? (window.__user.email || '') : '';
    document.getElementById('profilePassword').value = '';
    document.getElementById('profileError').classList.add('d-none');
    document.getElementById('profileSuccess').classList.add('d-none');
    modal.style.display = 'flex';
  };

  window.closeProfileModal = function() {
    var modal = document.getElementById('profileModal');
    if (modal) modal.style.display = 'none';
  };
})();
