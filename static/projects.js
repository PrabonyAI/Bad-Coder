// Projects Management

function openProjectsOverlay() {
  const overlay = document.getElementById('projects-overlay');
  if (overlay) {
    overlay.classList.add('active');
    loadProjects('overlay');
  }
}

function closeProjectsOverlay() {
  const overlay = document.getElementById('projects-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function openProjectsSidebar() {
  const sidebar = document.getElementById('projects-sidebar');
  const appShell = document.getElementById('main-app');
  
  if (sidebar && appShell) {
    sidebar.classList.add('active');
    appShell.classList.add('sidebar-open');
    loadProjects('sidebar');
  }
}

function closeProjectsSidebar() {
  const sidebar = document.getElementById('projects-sidebar');
  const appShell = document.getElementById('main-app');
  
  if (sidebar && appShell) {
    sidebar.classList.remove('active');
    appShell.classList.remove('sidebar-open');
  }
}

async function loadProjects(location) {
  const listId = location === 'overlay' ? 'projects-list-overlay' : 'projects-list-sidebar';
  const listEl = document.getElementById(listId);
  
  if (!listEl) return;
  
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    
    if (data.error) {
      listEl.innerHTML = `<div class="empty-projects"><i class="fas fa-exclamation-circle"></i><p>Error loading projects</p></div>`;
      return;
    }
    
    if (!data.projects || data.projects.length === 0) {
      listEl.innerHTML = `
        <div class="empty-projects">
          <i class="fas fa-folder-open"></i>
          <p>No projects yet</p>
          <p style="font-size: 12px;">Create your first website to get started!</p>
        </div>
      `;
      return;
    }
    
    // Render projects - UPDATED with loadProjectWithFeedback
    listEl.innerHTML = data.projects.map(project => `
      <div class="project-item" onclick="loadProjectWithFeedback(${project.id}, '${location}')">
        <div class="project-item-name">${escapeHtml(project.name)}</div>
        <div class="project-item-preview">${escapeHtml(project.preview)}</div>
        <div class="project-item-date" data-date="${project.updated_at}">
          <i class="fas fa-clock"></i>
          ${formatDate(project.updated_at)}
        </div>
      </div>
    `).join('');
    
    // Start auto-refresh
    startTimestampUpdates();
    
  } catch (err) {
    console.error('Failed to load projects:', err);
    listEl.innerHTML = `<div class="empty-projects"><i class="fas fa-exclamation-circle"></i><p>Failed to load projects</p></div>`;
  }
}

// RACE CONDITION FIX: Add global flags
let isProjectLoading = false;
let projectLoadingTimeout = null;

// NEW: Show loading indicator
function showProjectLoadingIndicator() {
  const existing = document.getElementById('project-loading-indicator');
  if (existing) return; // Don't create duplicate
  
  const indicator = document.createElement('div');
  indicator.id = 'project-loading-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;
  indicator.innerHTML = `
    <div style="
      background: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    ">
      <div style="margin-bottom: 15px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #4a9eff;"></i>
      </div>
      <p style="margin: 0; font-size: 16px; font-weight: 500; color: #333;">Loading project...</p>
      <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">Please wait</p>
    </div>
  `;
  document.body.appendChild(indicator);
}

// NEW: Hide loading indicator
function hideProjectLoadingIndicator() {
  const indicator = document.getElementById('project-loading-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// NEW: Updated loadProject with race condition prevention
async function loadProjectWithFeedback(projectId, location) {
  try {
    // PREVENT RAPID SWITCHING: If already loading, ignore
    if (isProjectLoading) {
      console.log('⏳ Project already loading, ignoring rapid switch request');
      return;
    }
    
    isProjectLoading = true;
    showProjectLoadingIndicator();
    
    console.log(`🔄 Loading project ${projectId}...`);
    
    const res = await fetch(`/api/project/${projectId}`);
    const data = await res.json();
    
    if (data.error) {
      hideProjectLoadingIndicator();
      alert('Failed to load project: ' + data.error);
      isProjectLoading = false;
      return;
    }
    
    // Add project_id to the data before storing
    data.project.project_id = projectId;
    
    // Store project data in sessionStorage
    sessionStorage.setItem('loadedProject', JSON.stringify(data.project));
    
    // CRITICAL: Set the project_id in backend session BEFORE redirecting
    const setProjectRes = await fetch('/api/set-current-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId })
    });
    
    if (!setProjectRes.ok) {
      hideProjectLoadingIndicator();
      console.error('Failed to set current project on backend');
      isProjectLoading = false;
      return;
    }
    
    console.log(`✅ Set current project to ${projectId}`);
    
    // DELAY: Wait before redirecting to ensure backend is ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // If on landing page, redirect to main
    if (location === 'overlay') {
      window.location.href = '/main';
    } else {
      // Already on main page, reload with project data
      window.location.reload();
    }
    
    // Reset loading flag after timeout (safety measure)
    projectLoadingTimeout = setTimeout(() => {
      isProjectLoading = false;
      hideProjectLoadingIndicator();
    }, 5000);
    
  } catch (err) {
    hideProjectLoadingIndicator();
    console.error('Failed to load project:', err);
    alert('Failed to load project');
    isProjectLoading = false;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

// Auto-refresh timestamps every minute
function startTimestampUpdates() {
  setInterval(() => {
    document.querySelectorAll('.project-item-date').forEach(el => {
      const dateStr = el.getAttribute('data-date');
      if (dateStr) {
        el.innerHTML = `<i class="fas fa-clock"></i> ${formatDate(dateStr)}`;
      }
    });
  }, 60000);
}
