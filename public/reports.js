// Tab switching
const reportTabs = document.querySelectorAll('.report-tab');
const reportSections = document.querySelectorAll('.report-section');

reportTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active tab
    reportTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active section
    reportSections.forEach(s => s.classList.remove('active'));
    document.getElementById(`${tabName}Report`).classList.add('active');
  });
});

// Check authentication status
fetch('/current-user')
  .then(response => response.json())
  .then(data => {
    if (data.loggedIn) {
      document.getElementById('userInfo').style.display = 'flex';
      document.getElementById('currentUsername').textContent = data.username;
      document.getElementById('userAuthNotice').style.display = 'none';
    } else {
      document.getElementById('userAuthNotice').style.display = 'block';
      document.getElementById('userInfo').style.display = 'none';
    }
  });

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
  fetch('/logout', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        window.location.href = '/login';
      }
    });
});

// Load video reports
function loadVideoReports() {
  fetch('/reports/by-video')
    .then(response => response.json())
    .then(data => {
      const tbody = document.getElementById('videoReportBody');

      if (data.reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No watch data available yet</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      data.reports.forEach(report => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${escapeHtml(report.video_filename)}</td>
          <td>${report.unique_viewers}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="progress-bar" style="flex: 1;">
                <div class="progress-fill" style="width: ${report.avg_percentage}%"></div>
              </div>
              <span style="min-width: 50px;">${Math.round(report.avg_percentage)}%</span>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="progress-bar" style="flex: 1;">
                <div class="progress-fill" style="width: ${report.max_percentage}%"></div>
              </div>
              <span style="min-width: 50px;">${Math.round(report.max_percentage)}%</span>
            </div>
          </td>
          <td><span class="badge badge-sync">${report.sync_watches}</span></td>
          <td><span class="badge badge-async">${report.async_watches}</span></td>
        `;
        tbody.appendChild(row);
      });
    })
    .catch(error => {
      console.error('Error loading video reports:', error);
      document.getElementById('videoReportBody').innerHTML =
        '<tr><td colspan="6" class="empty-state">Error loading reports</td></tr>';
    });
}

// Load user reports
function loadUserReports() {
  fetch('/reports/by-user')
    .then(response => response.json())
    .then(data => {
      const tbody = document.getElementById('userReportBody');

      if (data.reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No user data available yet</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      data.reports.forEach(report => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${escapeHtml(report.username)}</td>
          <td>${report.videos_watched || 0}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="progress-bar" style="flex: 1;">
                <div class="progress-fill" style="width: ${report.avg_percentage || 0}%"></div>
              </div>
              <span style="min-width: 50px;">${Math.round(report.avg_percentage || 0)}%</span>
            </div>
          </td>
          <td><span class="badge badge-sync">${report.sync_watches || 0}</span></td>
          <td><span class="badge badge-async">${report.async_watches || 0}</span></td>
        `;
        tbody.appendChild(row);
      });
    })
    .catch(error => {
      console.error('Error loading user reports:', error);
      document.getElementById('userReportBody').innerHTML =
        '<tr><td colspan="5" class="empty-state">Error loading reports</td></tr>';
    });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load reports on page load
loadVideoReports();
loadUserReports();

// Refresh reports every 30 seconds
setInterval(() => {
  loadVideoReports();
  loadUserReports();
}, 30000);
