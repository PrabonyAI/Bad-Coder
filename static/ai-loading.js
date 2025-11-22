/**
 * AI Loading Animation System
 * Real-time step progression based on actual events
 */

class AILoadingManager {
  constructor() {
    this.overlay = null;
    this.textEl = null;
    this.iconEl = null;
    this.progressBar = null;
    this.dots = null;
    this.currentStep = 0;
    this.startTime = null;
    this.dotAnimationInterval = null;
    this.isActive = false;
    
    // Real-time steps with approximate durations
    this.steps = [
      { 
        icon: '🔍', 
        text: 'Reading your prompt',
        minDuration: 800,
        color: '#8b5cf6'
      },
      { 
        icon: '🧠', 
        text: 'Understanding requirements',
        minDuration: 1200,
        color: '#3b82f6'
      },
      { 
        icon: '✨', 
        text: 'Generating HTML structure',
        minDuration: 2000,
        color: '#ec4899'
      },
      { 
        icon: '🎨', 
        text: 'Creating beautiful styles',
        minDuration: 1800,
        color: '#f59e0b'
      },
      { 
        icon: '⚡', 
        text: 'Adding interactivity',
        minDuration: 1500,
        color: '#10b981'
      },
      { 
        icon: '🔧', 
        text: 'Optimizing code',
        minDuration: 1000,
        color: '#06b6d4'
      },
      { 
        icon: '🚀', 
        text: 'Finalizing your project',
        minDuration: 1200,
        color: '#a855f7'
      }
    ];
    
    this.init();
  }
  
  init() {
    this.overlay = document.getElementById('ai-loading-overlay');
    this.textEl = document.getElementById('ai-loading-text');
    this.iconEl = this.overlay?.querySelector('.ai-loading-icon');
    this.progressBar = document.getElementById('ai-loading-progress');
    this.dots = this.overlay?.querySelectorAll('.ai-loading-dot');
  }
  
  /**
   * Start loading - begins from step 0
   */
  start() {
    if (!this.overlay) this.init();
    
    this.isActive = true;
    this.currentStep = 0;
    this.startTime = Date.now();
    
    this.overlay.classList.add('active');
    this.showStep(0);
    
    // Start animated dots
    this.startDotAnimation();
    
    // Auto-progress through early steps
    this.autoProgressSteps();
  }
  
  /**
   * Automatically progress through steps based on time
   */
  autoProgressSteps() {
    if (!this.isActive) return;
    
    const step = this.steps[this.currentStep];
    
    // Move to next step after minimum duration
    setTimeout(() => {
      if (this.isActive && this.currentStep < this.steps.length - 1) {
        this.nextStep();
      }
    }, step.minDuration);
  }
  
  /**
   * Manually trigger next step (can be called by actual events)
   */
  nextStep() {
    if (!this.isActive) return;
    
    this.currentStep++;
    
    if (this.currentStep < this.steps.length) {
      this.showStep(this.currentStep);
      this.autoProgressSteps();
    }
  }
  
  /**
   * Jump to specific step by name or index
   */
  goToStep(stepNameOrIndex) {
    if (!this.isActive) return;
    
    let stepIndex;
    
    if (typeof stepNameOrIndex === 'number') {
      stepIndex = stepNameOrIndex;
    } else {
      stepIndex = this.steps.findIndex(s => 
        s.text.toLowerCase().includes(stepNameOrIndex.toLowerCase())
      );
    }
    
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.currentStep = stepIndex;
      this.showStep(stepIndex);
    }
  }
  
  /**
   * Display specific step
   */
  showStep(index) {
    const step = this.steps[index];
    
    // Update text with typing effect
    this.typeText(step.text);
    
    // Update icon with animation
    if (this.iconEl) {
      this.iconEl.style.transform = 'scale(0.8)';
      this.iconEl.style.opacity = '0';
      
      setTimeout(() => {
        this.iconEl.textContent = step.icon;
        this.iconEl.style.backgroundColor = step.color + '20';
        this.iconEl.style.boxShadow = `0 0 40px ${step.color}40`;
        this.iconEl.style.transform = 'scale(1)';
        this.iconEl.style.opacity = '1';
      }, 150);
    }
    
    // Update progress bar
    const progress = ((index + 1) / this.steps.length) * 100;
    if (this.progressBar) {
      this.progressBar.style.width = progress + '%';
      this.progressBar.style.background = `linear-gradient(90deg, ${step.color}, ${this.steps[(index + 1) % this.steps.length].color})`;
      this.progressBar.style.boxShadow = `0 0 20px ${step.color}80`;
    }
    
    // Update dots
    if (this.dots) {
      this.dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
        if (i <= index) {
          dot.style.backgroundColor = this.steps[i].color;
        }
      });
    }
    
    // Update ring color
    const ring = this.overlay?.querySelector('.ai-loading-ring');
    if (ring) {
      ring.style.borderTopColor = step.color;
      ring.style.borderRightColor = this.steps[(index + 1) % this.steps.length].color;
    }
  }
  
  /**
   * Typing effect for text
   */
  typeText(text) {
    if (!this.textEl) return;
    
    this.textEl.textContent = '';
    let i = 0;
    
    const typeInterval = setInterval(() => {
      if (i < text.length) {
        this.textEl.textContent += text[i];
        i++;
      } else {
        clearInterval(typeInterval);
      }
    }, 30);
  }
  
  /**
   * Animated dots effect (...)
   */
  startDotAnimation() {
    this.stopDotAnimation();
    
    let dotCount = 0;
    this.dotAnimationInterval = setInterval(() => {
      if (!this.isActive) {
        this.stopDotAnimation();
        return;
      }
      
      dotCount = (dotCount + 1) % 4;
      const dots = '.'.repeat(dotCount);
      
      if (this.textEl) {
        const baseText = this.textEl.textContent.replace(/\.+$/, '');
        this.textEl.textContent = baseText + dots;
      }
    }, 500);
  }
  
  stopDotAnimation() {
    if (this.dotAnimationInterval) {
      clearInterval(this.dotAnimationInterval);
      this.dotAnimationInterval = null;
    }
  }
  
  /**
   * Update with custom message
   */
  setCustomMessage(message, icon = '⚡') {
    if (!this.isActive) return;
    
    if (this.iconEl) {
      this.iconEl.textContent = icon;
    }
    
    this.typeText(message);
  }
  
  /**
   * Complete and hide
   */
  complete() {
    this.isActive = false;
    this.stopDotAnimation();
    
    // Show completion state briefly
    this.showCompletionState();
    
    setTimeout(() => {
      this.hide();
    }, 800);
  }
  
  showCompletionState() {
    if (this.iconEl) {
      this.iconEl.textContent = '✅';
      this.iconEl.style.backgroundColor = '#10b98120';
      this.iconEl.style.boxShadow = '0 0 40px #10b98140';
    }
    
    if (this.textEl) {
      this.textEl.textContent = 'Ready!';
    }
    
    if (this.progressBar) {
      this.progressBar.style.width = '100%';
      this.progressBar.style.background = 'linear-gradient(90deg, #10b981, #06b6d4)';
    }
  }
  
  /**
   * Hide loading overlay
   */
  hide() {
    this.isActive = false;
    this.stopDotAnimation();
    
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
    
    this.currentStep = 0;
  }
  
  /**
   * Force hide immediately
   */
  forceHide() {
    this.isActive = false;
    this.stopDotAnimation();
    
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
  }
}

// Create global instance
window.aiLoading = new AILoadingManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AILoadingManager;
}