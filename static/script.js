// --- Globals ---
const landingPage = document.getElementById('landing-page');
const mainApp = document.getElementById('main-app');
const landingPromptInput = document.getElementById('landing-prompt');
const landingSubmitBtn = document.getElementById('landing-submit-btn');
const stripbox = document.getElementById('stripbox');
const preview = document.getElementById('preview');
const codeView = document.getElementById('code-view');
const previewContainer = document.getElementById('preview-container');
const codeContainer = document.getElementById('code-container');
const previewBtn = document.getElementById('preview-btn');
const codeBtn = document.getElementById('code-btn');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const sendBtn = document.getElementById('send');
const promptInput = document.getElementById('prompt');
const chatBox = document.querySelector('.left-content');
const newChatBtn = document.getElementById('new-chat');
const fileTreeEl = document.getElementById('file-tree');
const refreshFilesBtn = document.getElementById('refresh-files-btn');
const currentFileNameEl = document.getElementById('current-file-name');
const pageTitleInput = document.getElementById('page-title-input');
const openNewTabBtn = document.getElementById('open-new-tab-btn');

// Navigation buttons
const navBackBtn = document.getElementById('nav-back-btn');
const navForwardBtn = document.getElementById('nav-forward-btn');
const navReloadBtn = document.getElementById('nav-reload-btn');

// File search
const fileSearchInput = document.querySelector('.file-search-input');

let currentOpenFile = null;
let currentPreviewFile = 'index.html';
let isFirstPrompt = true;
let projectTitle = 'Untitled';

// Loading steps configuration
const LOADING_STEPS = [
  { icon: 'fa-solid fa-brain', label: 'Thinking', duration: 2000 },
  { icon: 'fa-chart-line', label: 'Analyzing', duration: 3000 },
  { icon: 'fa-code', label: 'Implementing', duration: 10000 },
  { icon: 'fa-shield-alt', label: 'Debugging', duration: 3000 },
  { icon: 'fa-microchip', label: 'Compiling Files', duration: 2000 }
];

// --- Dynamic Loading System ---
let currentLoadingSteps = [];
let loadingStartTime = 0;
let loadingInterval = null;
let filesGeneratedCount = 0;
let totalFilesToGenerate = 0;

function createLoadingStep(step, index) {
  const stepEl = document.createElement('div');
  stepEl.className = 'loading-step';
  stepEl.dataset.stepIndex = index;
  stepEl.innerHTML = `
    <div class="loading-step-icon">
      <i class="fas ${step.icon}"></i>
    </div>
    <div class="loading-step-content">
      <div class="loading-step-label">${step.label}</div>
      <div class="loading-step-time">Waiting...</div>
    </div>
    <div class="loading-step-status">
      <i class="fas fa-spinner fa-spin"></i>
    </div>
  `;
  return stepEl;
}


function createCompletionBox(projectName) {
  const box = document.createElement('div');
  box.className = 'completion-box';
  box.innerHTML = `
    <div class="completion-icon">
      <div class="completion-icon-inner">
        <img src="static/logo.png" alt="Completed" />
      </div>
    </div>
    <div class="completion-content">
      <div class="completion-title">${projectName}</div>
      <div class="completion-version">Compiled Files</div>
    </div>
    <button class="completion-download-btn" onclick="downloadAllFiles()">
      Download
    </button>
  `;
  return box;
}

function startLoadingAnimation(containerElement, userPrompt) {
  // Clear any existing loading
  stopLoadingAnimation();
  
  loadingStartTime = Date.now();
  let currentStepIndex = 0;
  filesGeneratedCount = 0;
  
  // Create all steps but hide them initially
  LOADING_STEPS.forEach((step, index) => {
    const stepEl = createLoadingStep(step, index);
    stepEl.style.display = 'none';
    containerElement.appendChild(stepEl);
    currentLoadingSteps.push({ element: stepEl, startTime: null, completed: false });
  });
  
  // Function to show next step
  function showNextStep() {
    if (currentStepIndex < LOADING_STEPS.length) {
      const stepData = currentLoadingSteps[currentStepIndex];
      stepData.element.style.display = 'flex';
      stepData.element.style.animation = 'slideIn 0.3s ease-out';
      stepData.startTime = Date.now();
      currentStepIndex++;
    }
  }
  
  // Function to complete a step
  function completeStep(index) {
    if (index < currentLoadingSteps.length && !currentLoadingSteps[index].completed) {
      const stepData = currentLoadingSteps[index];
      const elapsed = ((Date.now() - stepData.startTime) / 1000).toFixed(2);
      
      const statusIcon = stepData.element.querySelector('.loading-step-status i');
      statusIcon.className = 'fas fa-check';
      
      const timeEl = stepData.element.querySelector('.loading-step-time');
      timeEl.textContent = `Completed ${elapsed} sec`;
      
      stepData.completed = true;
    }
  }
  
  // Show first step immediately
  showNextStep();
  
  // Update timers and show steps progressively
  loadingInterval = setInterval(() => {
    // Update timers for active steps
    currentLoadingSteps.forEach((stepData, index) => {
      if (stepData.startTime && !stepData.completed) {
        const elapsed = ((Date.now() - stepData.startTime) / 1000).toFixed(2);
        const timeEl = stepData.element.querySelector('.loading-step-time');
        
        // Special handling for "Compiling Files" step
        if (index === LOADING_STEPS.length - 1 && filesGeneratedCount > 0) {
          timeEl.textContent = `${filesGeneratedCount}/${totalFilesToGenerate} files`;
        } else {
          timeEl.textContent = `${elapsed} sec`;
        }
        
        // Auto-complete step after its duration (except Compiling Files)
        if (index < LOADING_STEPS.length - 1 && Date.now() - stepData.startTime >= LOADING_STEPS[index].duration) {
          completeStep(index);
          // Show next step after completing current one
          if (index + 1 < LOADING_STEPS.length) {
            setTimeout(() => showNextStep(), 300);
          }
        }
      }
    });
  }, 100);
}

function updateCompilingFilesProgress(current, total) {
  filesGeneratedCount = current;
  totalFilesToGenerate = total;
  
  // Update the Compiling Files step if it exists
  const compilingStepIndex = LOADING_STEPS.length - 1;
  if (currentLoadingSteps[compilingStepIndex]) {
    const stepData = currentLoadingSteps[compilingStepIndex];
    const timeEl = stepData.element.querySelector('.loading-step-time');
    if (timeEl) {
      timeEl.textContent = `${current}/${total} files`;
    }
  }
}

function stopLoadingAnimation() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  currentLoadingSteps = [];
}

function completeAllLoadingSteps() {
  // Complete any remaining steps instantly
  currentLoadingSteps.forEach((stepData, index) => {
    if (!stepData.completed && stepData.startTime) {
      const elapsed = ((Date.now() - stepData.startTime) / 1000).toFixed(2);
      const statusIcon = stepData.element.querySelector('.loading-step-status i');
      statusIcon.className = 'fas fa-check';
      const timeEl = stepData.element.querySelector('.loading-step-time');
      
      // For Compiling Files, show final count
      if (index === LOADING_STEPS.length - 1 && filesGeneratedCount > 0) {
        timeEl.textContent = `Completed ${filesGeneratedCount} files`;
      } else {
        timeEl.textContent = `Completed ${elapsed} sec`;
      }
      
      stepData.completed = true;
    }
  });
  
  stopLoadingAnimation();
}

function collapseLoadingSteps(containerElement) {
  const allSteps = containerElement.querySelectorAll('.loading-step');
  const completionBox = containerElement.querySelector('.completion-box');
  
  if (allSteps.length === 0) return;
  
  // Prevent clicks on completion box from toggling
  if (completionBox) {
    completionBox.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  // Add collapsed class to container
  containerElement.classList.add('loading-collapsed');
  
  // Hide all steps except show them stacked
  allSteps.forEach((step, index) => {
    if (index === 0) {
      // First step stays visible
      step.style.position = 'relative';
      step.style.transform = 'translateY(0) scale(1)';
      step.style.zIndex = '5';
    } else {
      // Other steps stack behind
      step.style.position = 'absolute';
      step.style.top = (20 + (index * 3)) + 'px';
      step.style.left = '20px';
      step.style.right = '20px';
      step.style.width = 'calc(100% - 40px)';
      step.style.transform = `scale(${1 - (index * 0.03)})`;
      step.style.zIndex = (5 - index).toString();
      step.style.pointerEvents = 'none';
    }
  });
  
  // Add expand icon to first step
  const firstStep = allSteps[0];
  if (firstStep && !firstStep.querySelector('.expand-indicator')) {
    const expandIcon = document.createElement('div');
    expandIcon.className = 'expand-indicator';
    expandIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';
    firstStep.appendChild(expandIcon);
  }
  
  // Add click handler to toggle expansion
  const toggleHandler = (e) => {
    if (e.target.closest('.completion-box')) return;
    
    const isCollapsed = containerElement.classList.contains('loading-collapsed');
    
    if (isCollapsed) {
      // Expand
      containerElement.classList.remove('loading-collapsed');
      allSteps.forEach((step, index) => {
        step.style.position = 'relative';
        step.style.top = 'auto';
        step.style.left = 'auto';
        step.style.right = 'auto';
        step.style.width = 'auto';
        step.style.transform = 'translateY(0) scale(1)';
        step.style.zIndex = 'auto';
        step.style.pointerEvents = 'auto';
        step.style.marginBottom = '12px';
      });
    } else {
      // Collapse
      containerElement.classList.add('loading-collapsed');
      allSteps.forEach((step, index) => {
        if (index === 0) {
          step.style.position = 'relative';
          step.style.transform = 'translateY(0) scale(1)';
          step.style.zIndex = '5';
        } else {
          step.style.position = 'absolute';
          step.style.top = (20 + (index * 3)) + 'px';
          step.style.left = '20px';
          step.style.right = '20px';
          step.style.width = 'calc(100% - 40px)';
          step.style.transform = `scale(${1 - (index * 0.03)})`;
          step.style.zIndex = (5 - index).toString();
          step.style.pointerEvents = 'none';
        }
      });
    }
  };
  
  containerElement.removeEventListener('click', containerElement._toggleHandler);
  containerElement._toggleHandler = toggleHandler;
  containerElement.addEventListener('click', toggleHandler);
  
  if (firstStep) {
    firstStep.style.cursor = 'pointer';
  }
}

function typeProjectName(text, element) {
  element.value = '';
  let index = 0;
  
  const typeInterval = setInterval(() => {
    if (index < text.length) {
      element.value += text[index];
      index++;
    } else {
      clearInterval(typeInterval);
    }
  }, 50); // 50ms per character
}

// --- Page Title Editing ---
if (pageTitleInput) {
  pageTitleInput.addEventListener('blur', async () => {
    const newName = pageTitleInput.value.trim() || 'Untitled';
    
    if (newName !== projectTitle) {
      projectTitle = newName;
      pageTitleInput.value = projectTitle;
      
      // Save to localStorage
      localStorage.setItem('currentProjectName', projectTitle);
      
      // Save to database
      try {
        const response = await fetch('/api/update-project-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectTitle })
        });
        
        const data = await response.json();
        if (data.success) {
          console.log('✅ Project name updated:', projectTitle);
        }
      } catch (error) {
        console.error('Failed to update project name:', error);
      }
    }
  });

  pageTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pageTitleInput.blur();
    }
  });

  pageTitleInput.addEventListener('focus', () => {
    pageTitleInput.select();
  });
}

// --- Preview Navigation Controls ---
if (preview) {
  preview.addEventListener('load', () => {
    try {
      const iframeWindow = preview.contentWindow;
      if (navBackBtn) {
        navBackBtn.disabled = false;
      }
      if (navForwardBtn) {
        navForwardBtn.disabled = false;
      }
    } catch (e) {
      // Cross-origin restrictions
    }
  });
}

if (navBackBtn) {
  navBackBtn.addEventListener('click', () => {
    if (preview && preview.contentWindow) {
      preview.contentWindow.history.back();
    }
  });
}

if (navForwardBtn) {
  navForwardBtn.addEventListener('click', () => {
    if (preview && preview.contentWindow) {
      preview.contentWindow.history.forward();
    }
  });
}

if (navReloadBtn) {
  navReloadBtn.addEventListener('click', () => {
    if (preview) {
      loadPreview(currentPreviewFile);
    }
  });
}

// --- File Search Functionality ---
if (fileSearchInput) {
  fileSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const fileTreeEl = document.getElementById('file-tree');
    const allItems = fileTreeEl.querySelectorAll('li');
    
    if (searchTerm === '') {
      // Show all items when search is cleared
      allItems.forEach(item => {
        item.style.display = '';
      });
      return;
    }
    
    // Hide all first
    allItems.forEach(item => item.style.display = 'none');
    
    // Show matching files and their parent folders
    allItems.forEach(item => {
      const filename = item.getAttribute('data-filename');
      if (filename && filename.toLowerCase().includes(searchTerm)) {
        // Show the file
        item.style.display = '';
        
        // Show all parent elements
        let parent = item.parentElement;
        while (parent && parent.id !== 'file-tree') {
          if (parent.tagName === 'UL') {
            parent.classList.add('active'); // Expand folders
          }
          if (parent.tagName === 'LI') {
            parent.style.display = '';
          }
          parent = parent.parentElement;
        }
      }
    });
  });
}

// --- Landing Page to Main App Transition ---
function transitionToMainApp() {
  landingPage.style.display = 'none';
  mainApp.style.display = 'flex';
  isFirstPrompt = false;
}

// Auto-resize landing textarea
if (landingPromptInput) {
  landingPromptInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
  
  landingPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleLandingSubmit();
    }
  });
}

// Auto-resize main prompt textarea
if (promptInput) {
  promptInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
  });
}

if (landingSubmitBtn) {
  landingSubmitBtn.addEventListener('click', handleLandingSubmit);
}

async function handleLandingSubmit() {
  const prompt = landingPromptInput.value.trim();
  if (!prompt) return;
  stripbox.style.display = 'none';

  // Clear previous project code when starting from landing page
  window.lastGeneratedCode = '';
  
  transitionToMainApp();
  promptInput.value = prompt;
  await generatePrompt();
}

// --- View Toggles ---
function showPreview() {
  previewContainer.style.display = 'block';
  codeContainer.style.display = 'none';
  previewBtn.classList.add('active');
  codeBtn.classList.remove('active');
  
  previewBtn.innerHTML = '<i class="fas fa-eye"></i><span>Preview</span>';
  codeBtn.innerHTML = '<i class="fas fa-code"></i><span>Code</span>';
  
  if (currentPreviewFile) {
    loadPreview(currentPreviewFile);
  }
}

function showCode() {
  previewContainer.style.display = 'none';
  codeContainer.style.display = 'flex';
  previewBtn.classList.remove('active');
  codeBtn.classList.add('active');
  
  previewBtn.innerHTML = '<i class="fas fa-eye"></i><span>Preview</span>';
  codeBtn.innerHTML = '<i class="fas fa-code"></i><span>Code</span>';
  
  fetchAndRenderFiles();
}

// --- Markdown & History ---
function renderMarkdownBlocks() {
  document.querySelectorAll('.md-block[data-md]').forEach(el => {
    try {
      const md = JSON.parse(el.getAttribute('data-md') || '""');
      el.innerHTML = marked.parse(md || '');
    } catch (e) {
      el.textContent = el.getAttribute('data-md') || '';
    }
  });

  document.querySelectorAll('.md-block:not([data-md])').forEach(el => {
    if (el.dataset.isHtml) return;
    try {
      const text = el.textContent || '';
      el.innerHTML = marked.parse(text);
    } catch (e) {
      // Keep as text
    }
  });
}

function createUserBubble(text) {
  const t = (text || '').trim();
  if (!t) return null;
 
  const item = document.createElement('div');
  item.className = 'history-item';
  item.tabIndex = 0;
  item.innerHTML = `
    <div class="history-meta">🧠 You: <span class="prompt-text"></span></div>
    <div class="history-body"><div class="md-block"></div></div>
    <pre class="hidden-code" style="display:none;"></pre>
  `;
  item.querySelector('.prompt-text').textContent = t;
  item.querySelector('.md-block').textContent = t; 

  chatBox.appendChild(item);
  item.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return item;
}

function createBotMessage(text) {
  const bot = document.createElement('div');
  bot.className = 'history-item';
  bot.innerHTML = `<div class="history-body"><div class="md-block"></div></div><pre class="hidden-code" style="display:none;"></pre>`;
  const mdBlock = bot.querySelector('.md-block');
  
  mdBlock.textContent = text;
  try {
    mdBlock.innerHTML = marked.parse(text);
  } catch(e) {
    mdBlock.textContent = text;
  }
  
  chatBox.appendChild(bot);
  bot.scrollIntoView({ behavior: 'smooth', block: 'end' });
  
  return bot;
}

function createLoadingContainer() {
  const container = document.createElement('div');
  container.className = 'history-item loading-container';
  chatBox.appendChild(container);
  container.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return container;
}

function wireHistoryLoaders() {
  document.querySelectorAll('.history-item').forEach(item => {
    item.removeEventListener('click', item._vcListener);
    const listener = () => {
      const hidden = item.querySelector('.hidden-code');
      const code = hidden ? hidden.textContent : '';
      if (code) {
        codeView.textContent = code;
        loadPreview('index.html');
        showPreview();

        document.querySelectorAll('#file-tree li').forEach(li => {
          li.classList.toggle('active-file', li.dataset.filename === 'index.html');
        });
        currentOpenFile = 'index.html';
      }
    };
    item.addEventListener('click', listener);
    item._vcListener = listener;
  });
}

// --- Preview Loading ---
function loadPreview(filename) {
  const timestamp = new Date().getTime();
  preview.src = `/preview/${filename}?t=${timestamp}`;
  currentPreviewFile = filename;
  
  if (navBackBtn) navBackBtn.disabled = false;
  if (navForwardBtn) navForwardBtn.disabled = false;
}

// --- Download All Files as ZIP ---
async function downloadAllFiles() {
  try {
    const checkRes = await fetch('/api/files');
    if (!checkRes.ok) throw new Error('Failed to check files');
    const checkData = await checkRes.json();
    
    if (!checkData.files || checkData.files.length === 0) {
      alert('No files to download. Generate a website first!');
      return;
    }
    
    const originalHTML = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    downloadBtn.disabled = true;
    
    const response = await fetch('/api/download-zip');
    
    if (!response.ok) {
      throw new Error('Download failed');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibe_labs_project_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    downloadBtn.innerHTML = originalHTML;
    downloadBtn.disabled = false;
    
    createBotMessage('✅ Project downloaded as ZIP! Extract the files and open index.html in your browser.');
    
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed: ' + err.message);
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    downloadBtn.disabled = false;
  }
}

// --- Button Actions ---
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    try {
      const code = codeView.textContent || '';
      if (!code) return; 
      await navigator.clipboard.writeText(code);
      const prev = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => copyBtn.innerHTML = prev, 1500);
    } catch (e) {
      console.error('Copy failed', e);
    }
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', downloadAllFiles);
}

if (previewBtn) {
  previewBtn.addEventListener('click', showPreview);
}

if (codeBtn) {
  codeBtn.addEventListener('click', showCode);
}

// --- Greeting Detection & Responses ---
function detectGreeting(prompt) {
  const greetings = [
    'hi', 'hello', 'hey', 'hii', 'hiii', 'heya', 'heyy', 'heyyy',
    'yo', 'sup', 'wassup', 'whats up', "what's up", 'howdy',
    'greetings', 'good morning', 'good afternoon', 'good evening',
    'hola', 'namaste', 'bonjour', 'ciao', 'aloha'
  ];
  
  const promptLower = prompt.toLowerCase().trim();
  
  // Check if prompt is ONLY a greeting (or with punctuation)
  const cleanPrompt = promptLower.replace(/[!?.,']/g, '').trim();
  
  if (greetings.includes(cleanPrompt)) {
    return true;
  }
  
  // Check if prompt starts with greeting and nothing else meaningful
  const words = cleanPrompt.split(' ');
  if (words.length <= 2 && greetings.some(g => words[0] === g)) {
    return true;
  }
  
  return false;
}

function getGreetingResponse() {
  const responses = [
    "Hey there!  I'm Bad Coder, Tell me what kind of website you'd like to create!",
    "Hello! Ready to build something awesome? Describe your dream website and I'll bring it to life!",
    "Hi! I'm here to help you create stunning websites. What would you like to build today?",
    "Hey! Let's create something amazing together. What kind of website are you thinking about?",
    "Hello! I can build any website you imagine. Just tell me what you need!",
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function detectCommonQuery(prompt) {
  const promptLower = prompt.toLowerCase().trim();
  
  // Help/How queries
  if (promptLower.match(/^(how|what|can you|help|guide)/)) {
    if (promptLower.includes('work') || promptLower.includes('use') || promptLower.includes('help')) {
      return {
        type: 'help',
        response: `I'm Bad Coder, Here's how I work:

**How to use me:**
1. Describe the website you want (e.g., "Create a modern portfolio website")
2. I'll generate a complete multi-page website with HTML, CSS, and JavaScript
3. Preview it live, edit the code, or download all files
4. Make changes by chatting with me (e.g., "Add a contact form")

**Tips:**
- Be specific about design, colors, and features
- I can create: landing pages, portfolios, e-commerce, blogs, apps, and more
- Each generation costs 1 credit

**Ready to build?** Just tell me what you need! 🚀`
      };
    }
  }
  
  // Credits query
  if (promptLower.includes('credit') && (promptLower.includes('how many') || promptLower.includes('left') || promptLower.includes('remaining'))) {
    const creditsEl = document.getElementById('credits');
    const currentCredits = creditsEl ? creditsEl.textContent : 'unknown';
    return {
      type: 'credits',
      response: `You currently have **${currentCredits} credits** remaining. Each website generation costs 1 credit. 💳`
    };
  }
  
  // Pricing query
  if (promptLower.includes('price') || promptLower.includes('cost') || (promptLower.includes('how much') && promptLower.includes('credit'))) {
    return {
      type: 'pricing',
      response: `Each website generation costs **1 credit**. Modifications to existing projects also cost 1 credit. You start with 10 free credits! 💰`
    };
  }
  
  return null;
}

async function generatePrompt() {
  const prompt = promptInput.value.trim();
  if (!prompt) return; 

  // === CHECK FOR GREETINGS FIRST ===
  if (detectGreeting(prompt)) {
    const userItem = createUserBubble(prompt);
    promptInput.value = '';
    
    // Create bot response immediately (no loading, no AI call)
    setTimeout(() => {
      createBotMessage(getGreetingResponse());
    }, 500); // Small delay for natural feel
    
    return; // Exit early, don't call AI
  }

  // Check for common queries
  const commonQuery = detectCommonQuery(prompt);
  if (commonQuery) {
    const userItem = createUserBubble(prompt);
    promptInput.value = '';
    
    setTimeout(() => {
      createBotMessage(commonQuery.response);
    }, 500);
    
    return;
  }

  // Check if this is truly a new project (no code AND no visible history)
const hasExistingHistory = chatBox.querySelectorAll('.history-item .prompt-text').length > 0;

// Clear everything if no code exists OR if coming from landing page
if (!window.lastGeneratedCode || !hasExistingHistory) {
  chatBox.innerHTML = '';
  preview.src = '';
  codeView.textContent = '';
  projectTitle = 'Untitled';
  if (pageTitleInput) pageTitleInput.value = 'Untitled';
  fileTreeEl.innerHTML = '';
  currentOpenFile = null;
  currentPreviewFile = 'index.html';
  window.lastGeneratedCode = ''; // Clear it
}

  const userItem = createUserBubble(prompt);
  promptInput.value = '';
  promptInput.focus();

  // Show loading state on submit button
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');
  const arrowIcon = sendBtn.querySelector('i');
  arrowIcon.className = 'fas fa-circle-notch';

  // Create loading container
  const loadingContainer = createLoadingContainer();
  startLoadingAnimation(loadingContainer, prompt);

  try {
    const newProjectKeywords = [
      'create new', 'build new', 'generate new', 'start fresh',
      'new project', 'new website', 'new app', 'from scratch'
    ];
    
    const promptLower = prompt.toLowerCase();
    
    // If we have previous code AND user didn't explicitly ask for new project, it's a modification
    const isModification = window.window.lastGeneratedCode && 
                      !newProjectKeywords.some(kw => promptLower.includes(kw));

    const payload = {
  prompt: prompt,
  is_modification: isModification,
  previous_code: isModification ? window.lastGeneratedCode : null
};

console.log('🔍 DEBUG:', {
  isModification,
  hasLastCode: !!window.lastGeneratedCode,
  promptPreview: prompt.substring(0, 50)
});
    
    // Add images if any
    if (selectedImageFiles.length > 0) {
      selectedImageFiles.forEach((file, index) => {
        formData.append('images', file);
      });
    }

    const res = await fetch('/generate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    let data;
    try { 
      data = await res.json(); 
    } catch (e) { 
      data = { error: `HTTP ${res.status} ${res.statusText}` }; 
    }

    // Complete all loading steps
    completeAllLoadingSteps();

    if (!res.ok || data.error) {
      const errMsg = data && data.error ? data.error : `Request failed: ${res.status}`;
      loadingContainer.remove();
      createBotMessage('⚠️ ' + errMsg);
      
      // Re-enable button before returning
      sendBtn.disabled = false;
      sendBtn.classList.remove('loading');
      arrowIcon.className = 'fas fa-arrow-up';
      return;
    }

    // Clear selected images after successful generation
    selectedImageFiles = [];

    const creditsEl = document.getElementById('credits');
    if (creditsEl && data.credits !== undefined) {
      creditsEl.textContent = data.credits;
    }

    // Update project name with typing animation
    if (data.project_name && pageTitleInput) {
      projectTitle = data.project_name;
      typeProjectName(data.project_name, pageTitleInput);
      // Save to localStorage for persistence
      localStorage.setItem('currentProjectName', data.project_name);
    }

    
    
    // Store code
    window.lastGeneratedCode = data.code || '';
    window.window.lastGeneratedCode = window.lastGeneratedCode; // ADD THIS LINE

    // ADD THIS: Show description immediately
    if (data.description) {
      const descriptionDiv = document.createElement('div');
      descriptionDiv.className = 'ai-description';
      descriptionDiv.style.cssText = `
        margin: 15px 20px;
        padding: 15px;
        background: rgba(74, 158, 255, 0.1);
        border-left: 3px solid #4a9eff;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.6;
      `;
      
      const mdBlock = document.createElement('div');
      mdBlock.className = 'md-block';
      try {
        mdBlock.innerHTML = marked.parse(data.description);
      } catch(e) {
        mdBlock.textContent = data.description;
      }
      
      descriptionDiv.appendChild(mdBlock);
      loadingContainer.appendChild(descriptionDiv);
    }

    const hidden = loadingContainer.querySelector('.hidden-code');
    if (!hidden) {
      const hiddenCode = document.createElement('pre');
      hiddenCode.className = 'hidden-code';
      hiddenCode.style.display = 'none';
      hiddenCode.textContent = window.lastGeneratedCode;
      loadingContainer.appendChild(hiddenCode);
    }

    // Update code view
    codeView.textContent = window.lastGeneratedCode;
    
    // Refresh file list and track progress
    const createdFiles = data.created_files || ['index.html'];
    totalFilesToGenerate = createdFiles.length;
    
    // Simulate file generation progress for Compiling Files step
    let fileIndex = 0;
    const fileInterval = setInterval(() => {
      if (fileIndex < createdFiles.length) {
        fileIndex++;
        updateCompilingFilesProgress(fileIndex, createdFiles.length);
      } else {
        clearInterval(fileInterval);
        
        // Complete the Compiling Files step
        const compilingStepIndex = LOADING_STEPS.length - 1;
        if (currentLoadingSteps[compilingStepIndex]) {
          const stepData = currentLoadingSteps[compilingStepIndex];
          if (!stepData.completed) {
            const elapsed = ((Date.now() - stepData.startTime) / 1000).toFixed(2);
            const statusIcon = stepData.element.querySelector('.loading-step-status i');
            statusIcon.className = 'fas fa-check';
            const timeEl = stepData.element.querySelector('.loading-step-time');
            timeEl.textContent = `Completed ${createdFiles.length} files`;
            stepData.completed = true;
          }
        }
        
        // Add completion box after all files are done
        setTimeout(() => {
          const boxTitle = projectTitle || 'Your Project'; // Use global projectTitle
          const completionBox = createCompletionBox(boxTitle);
          loadingContainer.appendChild(completionBox);
          completionBox.style.animation = 'slideIn 0.4s ease-out';
  
          // Collapse the loading steps after completion box appears
          setTimeout(() => {
            collapseLoadingSteps(loadingContainer);
        }, 800);
      }, 300);
      }
    }, 200); // Add files every 200ms for visual effect
    
    await fetchAndRenderFiles();
    
    // Load preview
    loadPreview('index.html');
    
    // Set active file
    document.querySelectorAll('#file-tree li').forEach(li => {
      li.classList.toggle('active-file', li.dataset.filename === 'index.html');
    });
    currentOpenFile = 'index.html';
    if (currentFileNameEl) {
      currentFileNameEl.textContent = 'index.html';
    }
    
    showPreview();
    wireHistoryLoaders();

  } catch (err) {
    completeAllLoadingSteps();
    if (loadingContainer && loadingContainer.parentNode) {
      loadingContainer.remove();
    }
    createBotMessage('⚠️ Network error: ' + (err.message || String(err)));
    console.error('Network error:', err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.classList.remove('loading');
    arrowIcon.className = 'fas fa-arrow-up';
  } 

}

async function resetChat() {
  try {
    // Call new_chat endpoint which handles everything properly
    const res = await fetch('/new_chat', { method: 'POST' });
    const data = await res.json();
    
    // Clear chat UI
    chatBox.innerHTML = `
      <div class="history-item">
        <div class="history-body">
          <div class="md-block" data-md='"Welcome to Bad Coder – describe the website you want. Example: **create a modern tech startup landing page with hero, features, and pricing sections**"'></div>
        </div>
      </div>
    `;
    
    renderMarkdownBlocks();
    
    // Clear preview and code
    preview.src = '';
    codeView.textContent = '';
    
    // Update credits without resetting
    const creditsEl = document.getElementById('credits');
    if (creditsEl && data.credits !== undefined) {
      creditsEl.textContent = data.credits;
    }

    
    
    // Clear other state
    currentOpenFile = null;
    currentPreviewFile = 'index.html';
    window.lastGeneratedCode = '';
    projectTitle = 'Untitled';
    if (pageTitleInput) pageTitleInput.value = 'Untitled';
    
    // Disable navigation
    if (navBackBtn) navBackBtn.disabled = true;
    if (navForwardBtn) navForwardBtn.disabled = true;
    
    // Clear file search
    if (fileSearchInput) fileSearchInput.value = '';
    
    // Refresh file list
    await fetchAndRenderFiles();
    
    // Clear prompt
    promptInput.value = "";
    promptInput.focus();

    // Clear project name
    localStorage.removeItem('currentProjectName');
    
  } catch (e) { 
    console.error('Reset failed:', e); 
  }
}

if (newChatBtn) {
  newChatBtn.addEventListener('click', resetChat);
}

async function newChat() {
    try {
        const res = await fetch('/new_chat', {
            method: "POST"
        });
        const data = await res.json();

        chatBox.innerHTML = `
            <div class="history-item">
                <div class="history-body">
                    <div class="md-block" data-md='"Welcome to Bad Coder – describe the website you want."' ></div>
                </div>
            </div>
        `;
        
        promptInput.value = "";

        const creditsEl = document.getElementById("credits");
        if (creditsEl && data.credits !== undefined) {
            creditsEl.textContent = data.credits;
        }

        window.lastGeneratedCode = "";
        isFirstPrompt = false;
        projectTitle = 'Untitled';
        if (pageTitleInput) pageTitleInput.value = 'Untitled';

        preview.src = "";
        codeView.textContent = "";
        
        if (navBackBtn) navBackBtn.disabled = true;
        if (navForwardBtn) navForwardBtn.disabled = true;
        
        fetchAndRenderFiles();
        renderMarkdownBlocks();
    } catch (err) {
        console.error("New Chat failed:", err);
    }
}

// --- File Manager ---
// NEW FUNCTION - Add this!
async function restoreProjectFiles(project, projectId) {
  try {
    // STEP 1: Clear all previous state FIRST
    console.log('🧹 Clearing previous project state...');
    window.lastGeneratedCode = '';
    currentOpenFile = null;
    currentPreviewFile = 'index.html';
    
    // STEP 2: Clear preview immediately
    const previewFrame = document.getElementById('preview');
    if (previewFrame) {
      previewFrame.src = 'about:blank';
    }
    
    // STEP 3: Clear code view
    const codeView = document.getElementById('code-view');
    if (codeView) {
      codeView.textContent = '';
    }
    
    // STEP 4: Show loading in file tree
    const fileTreeEl = document.getElementById('file-tree');
    if (fileTreeEl) {
      fileTreeEl.innerHTML = '<li><i class="fas fa-spinner fa-spin"></i> Loading files...</li>';
    }
    
    // STEP 5: Send files to backend
    console.log('📤 Sending files to backend...');
    const response = await fetch('/api/restore-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        files: project.files,
        project_id: projectId 
      })
    });
    
    if (!response.ok) {
      console.error('Failed to restore files');
      alert('Failed to load project. Please try again.');
      return;
    }
    
    console.log('✅ Files restored to backend');
    
    // STEP 6: Update project name
    if (project.name) {
      localStorage.setItem('currentProjectName', project.name);
      const pageTitleInput = document.getElementById('page-title-input');
      if (pageTitleInput) {
        pageTitleInput.value = project.name;
        window.projectTitle = project.name;
      }
    }
    
    // STEP 7: Wait for backend to write files
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // STEP 8: Now load the NEW project preview
    console.log('🎨 Loading new project preview...');
    if (typeof loadPreview === 'function') {
      loadPreview('index.html');
    }
    
    // STEP 9: Refresh file tree with NEW files
    if (typeof fetchAndRenderFiles === 'function') {
      await fetchAndRenderFiles();
    }
    
    console.log('✅ Project switch complete!');
    
  } catch (err) {
    console.error('Error restoring files:', err);
    alert('Error loading project: ' + err.message);
  }
}


async function fetchAndRenderFiles() {
    const res = await fetch('/api/files');
    const data = await res.json();

    const files = data.files;
    const tree = {};

    // Build directory tree in JS
    files.forEach(item => {
        const parts = item.path.split('/');
        let pointer = tree;

        parts.forEach((part, index) => {
            if (!pointer[part]) {
                pointer[part] = {
                    __meta: index === parts.length - 1 ? item : null,
                    __children: {}
                };
            }
            pointer = pointer[part].__children;
        });
    });

    const fileTreeEl = document.getElementById("file-tree");
    fileTreeEl.innerHTML = "";

    function renderNode(node, parentEl, fullPath = "") {
        Object.keys(node).forEach(key => {
            const current = node[key];
            const li = document.createElement("li");

            const isFile = current.__meta && !current.__meta.is_dir;
            const newPath = fullPath ? `${fullPath}/${key}` : key;

            if (isFile) {
                // ADD THIS: Set data-filename attribute for search
                li.setAttribute('data-filename', newPath);
                
                let icon = 'fa-file-code';
                if (key.endsWith('.html')) icon = 'fa-file-code';
                else if (key.endsWith('.css')) icon = 'fa-file-code';
                else if (key.endsWith('.js')) icon = 'fa-file-code';
                else if (key.endsWith('.json')) icon = 'fa-file-code';
                else if (key.match(/\.(png|jpg|jpeg|gif|svg)$/)) icon = 'fa-file-image';
                
                li.innerHTML = `<i class="fas ${icon}"></i> <span>${key}</span>`;
                li.onclick = () => openFile(newPath);
            } else {
                li.innerHTML = `<span class="folder-item">📁 ${key}</span>`;
                const ul = document.createElement("ul");
                ul.classList.add("nested");
                li.appendChild(ul);

                li.querySelector(".folder-item").onclick = (e) => {
                    e.stopPropagation();
                    ul.classList.toggle("active");
                };

                renderNode(current.__children, ul, newPath);
            }

            parentEl.appendChild(li);
        });
    }

    renderNode(tree, fileTreeEl);
}


async function openFile(filename) {
  try {
    const res = await fetch(`/api/file?filename=${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const code = data.content || '';
    codeView.textContent = code;
    
    if (currentFileNameEl) {
      currentFileNameEl.textContent = filename;
    }
    
    if (filename.endsWith('.html')) {
      currentPreviewFile = filename;
      if (previewContainer.style.display !== 'none') {
        loadPreview(filename);
      }
    }
    
    document.querySelectorAll('#file-tree li').forEach(li => {
      li.classList.toggle('active-file', li.dataset.filename === filename);
    });
    currentOpenFile = filename;
    
  } catch (err) {
    console.error('Failed to open file:', err);
    createBotMessage('⚠️ Error opening file: ' + err.message);
  }
}

function addFileToFileTree(filename, setActive = false) {
  if (!fileTreeEl) return;
  
  const noFilesEl = fileTreeEl.querySelector('li > .fa-info-circle');
  if (noFilesEl) {
    noFilesEl.parentElement.remove();
  }
  
  const existingLi = fileTreeEl.querySelector(`li[data-filename="${filename}"]`);
  if (existingLi) {
    if (setActive) {
      document.querySelectorAll('#file-tree li').forEach(item => {
        item.classList.remove('active-file');
      });
      existingLi.classList.add('active-file');
      currentOpenFile = filename;
    }
    return;
  }

  const li = document.createElement('li');
  li.dataset.filename = filename;
  
  let icon = 'fa-file-code';
  if (filename.endsWith('.html')) icon = 'fa-file-code';
  else if (filename.endsWith('.css')) icon = 'fa-file-code';
  else if (filename.endsWith('.js')) icon = 'fa-file-code';
  else if (filename.endsWith('.json')) icon = 'fa-file-code';
  else if (filename.match(/\.(png|jpg|jpeg|gif|svg)$/)) icon = 'fa-file-image';
  
  li.innerHTML = `<i class="fas ${icon}"></i> <span>${filename}</span>`;
  li.addEventListener('click', () => openFile(filename));
  
  fileTreeEl.appendChild(li);
  
  if (setActive) {
    document.querySelectorAll('#file-tree li').forEach(item => {
      item.classList.remove('active-file');
    });
    li.classList.add('active-file');
    currentOpenFile = filename;
    if (currentFileNameEl) {
      currentFileNameEl.textContent = filename;
    }
  }
}

// Auto-load preview if files exist
async function autoLoadPreviewIfFilesExist() {
  try {
    const filesResponse = await fetch('/api/files');
    if (filesResponse.ok) {
      const filesData = await filesResponse.json();
      
      if (filesData.files && filesData.files.length > 0) {
        console.log('✅ Files detected, auto-loading preview...');
        
        // Load preview and files
        loadPreview('index.html');
        await fetchAndRenderFiles();
        showPreview();
        
        // Set active file
        document.querySelectorAll('#file-tree li').forEach(li => {
          li.classList.toggle('active-file', li.dataset.filename === 'index.html');
        });
        currentOpenFile = 'index.html';
        if (currentFileNameEl) {
          currentFileNameEl.textContent = 'index.html';
        }
      }
    }
  } catch (error) {
    console.log('ℹ️ No files to auto-load');
  }
}

// --- Attach Menu & File Upload ---
const attachBtn = document.getElementById("attach-btn");
const attachMenu = document.getElementById("attach-menu");
const imageInput = document.getElementById("image-input");
const figmaURLInput = document.getElementById("figma-url-input");
const figmaSubmitBtn = document.getElementById("figma-submit-btn");

let uploadedImages = [];
let selectedImageFiles = [];

// Toggle attach menu
if (attachBtn) {
  attachBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = attachMenu.style.display === "block";
    attachMenu.style.display = isVisible ? "none" : "block";
  });
}

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  if (attachMenu && !attachMenu.contains(e.target) && e.target !== attachBtn) {
    attachMenu.style.display = "none";
  }
});

// --- Image Upload Handler ---
if (imageInput) {
  imageInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    
    if (selectedImageFiles.length + files.length > 3) {
      alert("Maximum 3 images allowed!");
      imageInput.value = ""; // Reset input
      return;
    }
    
    // Add to selected files
    selectedImageFiles.push(...files.slice(0, 3 - selectedImageFiles.length));
    
    // Update prompt to show attachment count
    const currentPrompt = promptInput.value.trim();
    const imageCount = selectedImageFiles.length;
    const attachmentText = `\n[📎 ${imageCount} image${imageCount > 1 ? 's' : ''} attached]`;
    
    // Remove old attachment text if exists
    const cleanPrompt = currentPrompt.replace(/\n\[📎 \d+ images? attached\]/g, '');
    promptInput.value = cleanPrompt + attachmentText;
    
    // Close menu after selection
    attachMenu.style.display = "none";
    
    // Reset file input for next selection
    imageInput.value = "";
  });
}

// --- Figma URL Handler ---
if (figmaSubmitBtn) {
  figmaSubmitBtn.addEventListener("click", async () => {
    const url = figmaURLInput.value.trim();
    if (!url) {
      alert("Please enter a Figma URL");
      return;
    }
    
    // Validate Figma URL
    if (!url.includes("figma.com")) {
      alert("Please enter a valid Figma URL");
      return;
    }
    
    try {
      const res = await fetch("/api/figma-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figma_url: url })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update prompt
        const currentPrompt = promptInput.value.trim();
        const figmaText = `\n[🎨 Figma: ${url}]`;
        
        // Remove old Figma text if exists
        const cleanPrompt = currentPrompt.replace(/\n\[🎨 Figma:.*?\]/g, '');
        promptInput.value = cleanPrompt + figmaText;
        
        figmaURLInput.value = "";
        attachMenu.style.display = "none";
        
        alert("Figma URL added successfully!");
      }
    } catch (err) {
      console.error("Error saving Figma URL:", err);
      alert("Failed to save Figma URL");
    }
  });
}



// --- Voice Input Handler ---
const voiceBtn = document.getElementById('voice-btn');
let recognition;
let isRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  if (voiceBtn) {
    voiceBtn.addEventListener("click", () => {
      if (isRecording) {
        // Stop recording
        recognition.stop();
        isRecording = false;
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      } else {
        // Start recording
        try {
          recognition.start();
          isRecording = true;
          voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
          voiceBtn.style.background = '#ef4444';
        } catch (err) {
          console.error("Speech recognition error:", err);
          alert("Microphone access denied or already in use");
        }
      }
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      
      // Append to prompt input
      const currentText = promptInput.value.trim();
      promptInput.value = currentText ? `${currentText} ${transcript}` : transcript;
      
      // Auto-resize textarea
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 150) + 'px';
      
      // Reset button
      isRecording = false;
      voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      voiceBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      isRecording = false;
      voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      voiceBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      
      if (event.error === 'not-allowed') {
        alert("Microphone access denied. Please enable microphone permissions.");
      } else if (event.error === 'no-speech') {
        alert("No speech detected. Please try again.");
      }
    };

    recognition.onend = () => {
      isRecording = false;
      voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      voiceBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    };
  }
} else {
  // Browser doesn't support speech recognition
  if (voiceBtn) {
    voiceBtn.disabled = true;
    voiceBtn.title = "Voice input not supported in this browser";
    voiceBtn.style.opacity = '0.5';
  }
}



// --- Init ---
window.addEventListener('DOMContentLoaded', async () => {
  

  // Restore project name from localStorage
  const savedProjectName = localStorage.getItem('currentProjectName');
  if (savedProjectName && pageTitleInput) {
    projectTitle = savedProjectName;
    pageTitleInput.value = savedProjectName;
  }

  renderMarkdownBlocks();
  wireHistoryLoaders();
  
  const hasHistory = document.querySelector('.history-item .prompt-text');
  if (hasHistory) {
    transitionToMainApp();
    showPreview();
    fetchAndRenderFiles();
  }
  
  if (refreshFilesBtn) {
    refreshFilesBtn.addEventListener('click', fetchAndRenderFiles);
  }

// Auto-load preview if files exist
  setTimeout(autoLoadPreviewIfFilesExist, 400);
});

// Separate event listeners that should always work
if (promptInput) {
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      generatePrompt(); 
    }
  });
}

if (sendBtn) {
  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    generatePrompt();
  });
}

// ADD THIS HERE - Open in new tab functionality
if (openNewTabBtn) {
  openNewTabBtn.addEventListener('click', () => {
    const fileToOpen = currentPreviewFile || 'index.html';
    const url = `/preview/${fileToOpen}?t=${new Date().getTime()}`;
    window.open(url, '_blank');
  });
}

// ADD THIS HERE - Open in new tab functionality
if (openNewTabBtn) {
  openNewTabBtn.addEventListener('click', () => {
    const fileToOpen = currentPreviewFile || 'index.html';
    const url = `/preview/${fileToOpen}?t=${new Date().getTime()}`;
    window.open(url, '_blank');
  });
}

// ADD THE RESPONSIVE BUTTON CODE HERE:
// Responsive viewport switcher
if (document.getElementById('responsive-btn')) {
  const responsiveBtn = document.getElementById('responsive-btn');
  let currentView = 'desktop'; // desktop, tablet, mobile
  
  responsiveBtn.addEventListener('click', () => {
    // Cycle through views: desktop → tablet → mobile → desktop
    if (currentView === 'desktop') {
      currentView = 'tablet';
      preview.className = 'preview-frame tablet-view';
      responsiveBtn.innerHTML = '<i class="fas fa-tablet-alt"></i>';
      responsiveBtn.title = 'Tablet view';
    } else if (currentView === 'tablet') {
      currentView = 'mobile';
      preview.className = 'preview-frame mobile-view';
      responsiveBtn.innerHTML = '<i class="fas fa-mobile-alt"></i>';
      responsiveBtn.title = 'Mobile view';
    } else {
      currentView = 'desktop';
      preview.className = 'preview-frame desktop-view';
      responsiveBtn.innerHTML = '<i class="fas fa-desktop"></i>';
      responsiveBtn.title = 'Desktop view';
    }
  });
}


// Make downloadAllFiles globally accessible for completion box button
window.downloadAllFiles = downloadAllFiles;
