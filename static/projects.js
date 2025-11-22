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
    
    // Render projects
    listEl.innerHTML = data.projects.map(project => `
      <div class="project-item" onclick="loadProject(${project.id}, '${location}')">
        <div class="project-item-name">${escapeHtml(project.name)}</div>
        <div class="project-item-preview">${escapeHtml(project.preview)}</div>
        <div class="project-item-date">
          <i class="fas fa-clock"></i>
          ${formatDate(project.updated_at)}
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Failed to load projects:', err);
    listEl.innerHTML = `<div class="empty-projects"><i class="fas fa-exclamation-circle"></i><p>Failed to load projects</p></div>`;
  }
}

async function loadProject(projectId, location) {
  try {
    const res = await fetch(`/api/project/${projectId}`);
    const data = await res.json();
    
    if (data.error) {
      alert('Failed to load project: ' + data.error);
      return;
    }
    
    // Add project_id to the data before storing
    data.project.project_id = projectId;
    
    // Store project data in sessionStorage
    sessionStorage.setItem('loadedProject', JSON.stringify(data.project));
    
    // If on landing page, redirect to main
    if (location === 'overlay') {
      window.location.href = '/main';
    } else {
      // Already on main page, reload with project data
      window.location.reload();
    }
    
  } catch (err) {
    console.error('Failed to load project:', err);
    alert('Failed to load project');
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
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}