// ===============================
// GITHUB INTEGRATION JAVASCRIPT
// ===============================

const githubBtn = document.getElementById('github-btn');
const githubModal = document.getElementById('github-modal');
const githubAuthBtn = document.getElementById('github-auth-btn');
const pushBtn = document.getElementById('push-btn');
const repoNameInput = document.getElementById('repo-name-input');
const commitMessageInput = document.getElementById('commit-message-input');

// Open GitHub Modal
if (githubBtn) {
  githubBtn.addEventListener('click', () => {
    checkGithubStatus();
    githubModal.style.display = 'flex';
  });
}

// Close GitHub Modal
function closeGithubModal() {
  githubModal.style.display = 'none';
}

// Close on background click
githubModal.addEventListener('click', (e) => {
  if (e.target === githubModal) {
    closeGithubModal();
  }
});

// Check GitHub Status
async function checkGithubStatus() {
  try {
    const res = await fetch('/api/github-status');
    const data = await res.json();
    
    if (data.linked) {
      // Show linked state
      document.getElementById('github-not-linked').style.display = 'none';
      document.getElementById('github-linked').style.display = 'flex';
      document.getElementById('github-username-display').textContent = data.username;
      
      // Update button styling
      githubBtn.classList.add('linked');
    } else {
      // Show not linked state
      document.getElementById('github-not-linked').style.display = 'flex';
      document.getElementById('github-linked').style.display = 'none';
      githubBtn.classList.remove('linked');
    }
  } catch (err) {
    console.error('Error checking GitHub status:', err);
  }
}

// GitHub Auth Button
if (githubAuthBtn) {
  githubAuthBtn.addEventListener('click', () => {
    window.location.href = '/login/github';
  });
}

// Push to GitHub
if (pushBtn) {
  pushBtn.addEventListener('click', async () => {
    const repoName = repoNameInput.value.trim();
    const commitMessage = commitMessageInput.value.trim();
    
    if (!repoName) {
      alert('Please enter a repository name');
      return;
    }
    
    // Show loading state
    const originalHTML = pushBtn.innerHTML;
    pushBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing...';
    pushBtn.disabled = true;
    
    try {
      const res = await fetch('/api/push-to-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_name: repoName,
          commit_message: commitMessage
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Show success message
        document.getElementById('github-result').style.display = 'block';
        document.getElementById('github-message').textContent = data.message;
        document.getElementById('github-repo-link').href = data.repo_url;
        
        pushBtn.innerHTML = '<i class="fas fa-check"></i> Pushed Successfully!';
        
        // Reset after 3 seconds
        setTimeout(() => {
          closeGithubModal();
          checkGithubStatus();
        }, 3000);
      } else {
        alert('Error: ' + (data.error || 'Failed to push to GitHub'));
        pushBtn.innerHTML = originalHTML;
        pushBtn.disabled = false;
      }
    } catch (err) {
      console.error('Push error:', err);
      alert('Error pushing to GitHub: ' + err.message);
      pushBtn.innerHTML = originalHTML;
      pushBtn.disabled = false;
    }
  });
} 

// Auto-fill repo name from project title
const repoInput = document.getElementById('repo-name-input');
const currentProjectName = localStorage.getItem('currentProjectName') || projectTitle;
if (repoInput && currentProjectName !== 'Untitled') {
  repoInput.value = currentProjectName;
}

// Check status on page load
window.addEventListener('DOMContentLoaded', () => {
  checkGithubStatus();
});