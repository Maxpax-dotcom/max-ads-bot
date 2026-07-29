(async function() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    window.location.href = '/api/auth/login';
    return;
  }

  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Duration type toggle
  document.getElementById('durationType').addEventListener('change', function() {
    document.getElementById('days').style.display = this.value === 'days' ? 'inline-block' : 'none';
  });

  // Boost button handler
  document.getElementById('boostBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('boostStatus');
    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating campaign...';
    const data = {
      adAccountId: document.getElementById('adAccountId').value.trim(),
      pageId: document.getElementById('pageId').value.trim(),
      postId: document.getElementById('postId').value.trim(),
      targetUrl: document.getElementById('targetUrl').value.trim(),
      cta: document.getElementById('cta').value,
      budget: parseFloat(document.getElementById('budget').value),
      durationType: document.getElementById('durationType').value,
      days: parseInt(document.getElementById('days').value) || 0,
      objective: document.getElementById('objective').value,
      gender: document.getElementById('gender').value,
      ageMin: parseInt(document.getElementById('ageMin').value) || 18,
      ageMax: parseInt(document.getElementById('ageMax').value) || 65,
      countries: document.getElementById('countries').value.split(',').map(c => c.trim()).filter(Boolean)
    };

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (res.ok) {
        statusDiv.innerHTML = `<span style="color: #10b981;">✅ Campaign created! ID: ${result.campaignId}</span>`;
      } else {
        statusDiv.innerHTML = `<span style="color: #ef4444;">❌ ${result.error || 'Failed to create campaign'}</span>`;
      }
    } catch (err) {
      statusDiv.innerHTML = `<span style="color: #ef4444;">❌ Network error: ${err.message}</span>`;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    window.location.href = '/api/auth/login';
  });
})();