(async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    localStorage.setItem('authToken', token);
    window.history.replaceState({}, document.title, '/dashboard');
  }
  const authToken = localStorage.getItem('authToken');

  // ১. মোবাইল মেনু
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // ২. লগইন করা না থাকলে লগইন বাটন দেখাও, রিডাইরেক্ট করো না
  if (!authToken) {
    showLoginScreen();
    return;
  }

  // ৩. লগইন করা থাকলে ড্যাশবোর্ড লোড করো
  await loadDashboardData();
  setupNavigation();
})();

function showLoginScreen() {
  const container = document.getElementById('dashboardContent');
  container.innerHTML = `
    <div class="card full-width" style="text-align:center; padding:3rem;">
      <i class="fas fa-chart-line" style="font-size:4rem; background: linear-gradient(135deg, #6C63FF, #FF6584); -webkit-background-clip:text; -webkit-text-fill-color:transparent;"></i>
      <h2 style="margin-top:1rem;">Welcome to Max Ads Bot</h2>
      <p style="color:var(--text-secondary); margin: 1rem 0 2rem;">Link your Facebook account to manage campaigns</p>
      <a href="/api/auth/login" style="display:inline-block; padding:0.8rem 2rem; background: linear-gradient(135deg, #6C63FF, #FF6584); color:white; text-decoration:none; border-radius:30px; font-weight:600; transition: transform 0.2s;">
        <i class="fab fa-facebook"></i> Login with Facebook
      </a>
    </div>
  `;
}

async function loadDashboardData() {
  const container = document.getElementById('dashboardContent');
  // আপাতত মক ডেটা
  const data = {
    activeCampaigns: 12,
    totalSpend: '$2,340.50',
    reach: '142K',
    impressions: '580K',
    clicks: '24.5K',
    ctr: '4.23%',
    cpc: '$0.10',
    cpm: '$4.03',
    campaigns: [
      { name: 'Summer Sale', status: 'ACTIVE', spend: '$890', reach: '45K', ctr: '4.8%' },
      { name: 'Product Launch', status: 'PAUSED', spend: '$1,200', reach: '67K', ctr: '3.9%' },
      { name: 'Retargeting', status: 'REJECTED', spend: '$250', reach: '12K', ctr: '5.1%' }
    ]
  };

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Active Campaigns</span><i class="fas fa-bullhorn"></i></div>
      <div class="card-value">${data.activeCampaigns}</div>
    </div>
    <div class="card">
      <div class="card-header"><span>Total Spend</span><i class="fas fa-dollar-sign"></i></div>
      <div class="card-value">${data.totalSpend}</div>
    </div>
    <div class="card">
      <div class="card-header"><span>Reach</span><i class="fas fa-users"></i></div>
      <div class="card-value">${data.reach}</div>
    </div>
    <div class="card">
      <div class="card-header"><span>Impressions</span><i class="fas fa-eye"></i></div>
      <div class="card-value">${data.impressions}</div>
    </div>
    <div class="card">
      <div class="card-header"><span>Clicks</span><i class="fas fa-mouse-pointer"></i></div>
      <div class="card-value">${data.clicks}</div>
    </div>
    <div class="card">
      <div class="card-header"><span>CTR</span><i class="fas fa-percent"></i></div>
      <div class="card-value">${data.ctr}</div>
    </div>
    <div class="card">
      <div class="card-header"><span>CPC</span><i class="fas fa-coins"></i></div>
      <div class="card-value">${data.cpc}</div>
    </div>
    <div class="card">
      <div class="card-header"><span>CPM</span><i class="fas fa-chart-bar"></i></div>
      <div class="card-value">${data.cpm}</div>
    </div>
    <div class="card full-width">
      <h3 style="margin-bottom:1rem">Recent Campaigns</h3>
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Spend</th><th>Reach</th><th>CTR</th></tr></thead>
        <tbody>
          ${data.campaigns.map(c => `
            <tr>
              <td>${c.name}</td>
              <td><span class="status-badge status-${c.status.toLowerCase()}">${c.status}</span></td>
              <td>${c.spend}</td>
              <td>${c.reach}</td>
              <td>${c.ctr}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('pageTitle').textContent = item.querySelector('span').textContent;
    });
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    window.location.href = '/dashboard';
  });
}