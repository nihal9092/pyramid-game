/**
 * bounty.js - Sovereign Execution Protocol
 * 
 * Features:
 * - Bounty placement system with time limits
 * - Cinematic visual effects
 * - Transaction safety and validation
 * - Auto-expiration system
 * - Security and abuse prevention
 * 
 * @version 2.0.0
 */

'use strict';

// ============================================
// CONFIGURATION
// ============================================

const BOUNTY_CONFIG = {
  cost: 50000,
  duration: 3600000, // 1 hour in milliseconds
  cooldown: 600000, // 10 minutes cooldown per user
  maxActiveBounties: 3, // Maximum active bounties at once
  soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1001/1001-preview.mp3'
};

// ============================================
// STATE MANAGEMENT
// ============================================

const BountyState = {
  audio: null,
  lastBountyTime: 0,
  activeBounties: new Set(),
  expirationTimers: new Map()
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize bounty system
 */
function initBountySystem() {
  try {
    // Initialize audio
    BountyState.audio = new Audio(BOUNTY_CONFIG.soundUrl);
    BountyState.audio.volume = 0.6;
    BountyState.audio.preload = 'auto';
  } catch (error) {
    console.warn('Bounty audio initialization failed:', error);
    BountyState.audio = null;
  }

  // Start bounty expiration monitor
  startBountyMonitor();

  console.log('Bounty system initialized');
}

/**
 * Monitor and expire bounties automatically
 */
function startBountyMonitor() {
  if (typeof db === 'undefined') return;

  // Listen for active bounties
  db.collection('users')
    .where('isBounty', '==', true)
    .onSnapshot(snapshot => {
      const now = Date.now();
      
      snapshot.forEach(async doc => {
        const data = doc.data();
        const bountyTime = data.bountyTime || 0;
        const timeElapsed = now - bountyTime;
        
        // Check if bounty expired
        if (timeElapsed >= BOUNTY_CONFIG.duration) {
          await expireBounty(doc.id);
        } else {
          // Set timer for automatic expiration
          const remainingTime = BOUNTY_CONFIG.duration - timeElapsed;
          scheduleExpiration(doc.id, remainingTime);
        }
      });
    }, error => {
      console.error('Bounty monitor error:', error);
    });
}

/**
 * Schedule bounty expiration
 * @param {string} username - Target username
 * @param {number} delay - Delay in milliseconds
 */
function scheduleExpiration(username, delay) {
  // Clear existing timer
  if (BountyState.expirationTimers.has(username)) {
    clearTimeout(BountyState.expirationTimers.get(username));
  }

  // Set new timer
  const timer = setTimeout(async () => {
    await expireBounty(username);
    BountyState.expirationTimers.delete(username);
  }, delay);

  BountyState.expirationTimers.set(username, timer);
}

/**
 * Expire a bounty
 * @param {string} username - Target username
 */
async function expireBounty(username) {
  if (typeof db === 'undefined') return;

  try {
    const userRef = db.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return;

    const data = userDoc.data();
    if (!data.isBounty) return;

    // Remove bounty status
    await userRef.update({
      isBounty: false,
      bountyPlacer: firebase.firestore.FieldValue.delete(),
      bountyTime: firebase.firestore.FieldValue.delete()
    });

    // Notify in chat
    await db.collection('messages').add({
      user: 'SYSTEM',
      text: `⏰ Bounty contract on ${username} has EXPIRED`,
      type: 'MSG',
      time: Date.now()
    });

    console.log('Bounty expired:', username);

    // Reload hierarchy if available
    if (typeof loadHierarchy === 'function') {
      loadHierarchy();
    }

  } catch (error) {
    console.error('Bounty expiration error:', error);
  }
}

// ============================================
// BOUNTY PLACEMENT
// ============================================

/**
 * Place a bounty on a target user
 * @param {string} targetName - Target username
 */
async function placeBounty(targetName) {
  const currentUser = localStorage.getItem('pyramidUser');

  // Validation
  if (!currentUser) {
    showBountyError('You must be logged in to place bounties.');
    return;
  }

  if (!targetName) {
    showBountyError('Invalid target.');
    return;
  }

  if (targetName === currentUser) {
    showBountyError('You cannot place a bounty on yourself.');
    return;
  }

  // Check cooldown
  const now = Date.now();
  const timeSinceLastBounty = now - BountyState.lastBountyTime;
  
  if (timeSinceLastBounty < BOUNTY_CONFIG.cooldown) {
    const remainingSeconds = Math.ceil((BOUNTY_CONFIG.cooldown - timeSinceLastBounty) / 1000);
    showBountyError(`Cooldown active. Wait ${remainingSeconds} seconds before placing another bounty.`);
    return;
  }

  // Check active bounties limit
  if (BountyState.activeBounties.size >= BOUNTY_CONFIG.maxActiveBounties) {
    showBountyError(`Maximum ${BOUNTY_CONFIG.maxActiveBounties} active bounties reached. Wait for existing bounties to expire.`);
    return;
  }

  // Show confirmation dialog
  const confirmed = await showBountyConfirmation(targetName);
  if (!confirmed) return;

  try {
    await executeBountyTransaction(currentUser, targetName);
    
    // Update state
    BountyState.lastBountyTime = now;
    BountyState.activeBounties.add(targetName);

    // Show cinematic
    triggerBountyCinematic(targetName);

    // Schedule expiration
    scheduleExpiration(targetName, BOUNTY_CONFIG.duration);

  } catch (error) {
    console.error('Bounty placement error:', error);
    showBountyError(error.message || 'Failed to place bounty. Please try again.');
  }
}

/**
 * Execute bounty transaction
 * @param {string} placer - Bounty placer username
 * @param {string} target - Target username
 */
async function executeBountyTransaction(placer, target) {
  if (typeof db === 'undefined') {
    throw new Error('Database not initialized');
  }

  const placerRef = db.collection('users').doc(placer);
  const targetRef = db.collection('users').doc(target);

  await db.runTransaction(async (transaction) => {
    // Get both documents
    const placerDoc = await transaction.get(placerRef);
    const targetDoc = await transaction.get(targetRef);

    // Validate existence
    if (!placerDoc.exists) {
      throw new Error('Your account not found');
    }

    if (!targetDoc.exists) {
      throw new Error('Target user not found');
    }

    // Get data
    const placerData = placerDoc.data();
    const targetData = targetDoc.data();

    // Check if target already has a bounty
    if (targetData.isBounty) {
      throw new Error('Target already has an active bounty');
    }

    // Check funds
    const placerCredits = placerData.credits || 0;
    if (placerCredits < BOUNTY_CONFIG.cost) {
      throw new Error(`Insufficient funds. You have ${placerCredits.toLocaleString()}, need ${BOUNTY_CONFIG.cost.toLocaleString()} credits`);
    }

    // Deduct credits
    transaction.update(placerRef, {
      credits: placerCredits - BOUNTY_CONFIG.cost,
      lastBountyPlaced: firebase.firestore.FieldValue.serverTimestamp(),
      totalBountiesPlaced: firebase.firestore.FieldValue.increment(1)
    });

    // Mark target
    transaction.update(targetRef, {
      isBounty: true,
      bountyPlacer: placer,
      bountyTime: Date.now()
    });
  });

  // Broadcast to chat
  await db.collection('messages').add({
    user: 'SYSTEM',
    text: `🛑 CONTRACT OPEN: A bounty has been placed on ${target.toUpperCase()}! Duration: 1 hour`,
    type: 'MSG',
    time: Date.now()
  });

  console.log('Bounty placed:', { placer, target, cost: BOUNTY_CONFIG.cost });
}

// ============================================
// USER INTERFACE
// ============================================

/**
 * Show bounty confirmation dialog
 * @param {string} targetName - Target username
 * @returns {Promise<boolean>}
 */
function showBountyConfirmation(targetName) {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'bg-gradient-to-br from-red-950 to-black border-2 border-red-500 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl';
    modal.style.boxShadow = '0 0 50px rgba(239, 68, 68, 0.3)';
    
    modal.innerHTML = `
      <div class="text-center">
        <div class="text-6xl mb-4 animate-pulse">⚠️</div>
        <h2 class="text-2xl font-bold text-red-500 mb-2 uppercase tracking-wider">Execute Contract?</h2>
        <div class="bg-black/50 border border-red-500/30 rounded p-4 mb-6 space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-zinc-400 text-sm">Target:</span>
            <span class="text-white font-bold">${sanitizeHTML(targetName.toUpperCase())}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-zinc-400 text-sm">Cost:</span>
            <span class="text-red-500 font-bold">${BOUNTY_CONFIG.cost.toLocaleString()} CR</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-zinc-400 text-sm">Duration:</span>
            <span class="text-yellow-500 font-bold">1 Hour</span>
          </div>
        </div>
        <p class="text-xs text-zinc-500 mb-6">
          This will mark ${sanitizeHTML(targetName)} as a high-priority target in the hierarchy.
          The bounty will automatically expire after 1 hour.
        </p>
        <div class="flex gap-3">
          <button id="bounty-confirm" class="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-all uppercase tracking-wider">
            Confirm
          </button>
          <button id="bounty-cancel" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded transition-all uppercase tracking-wider">
            Cancel
          </button>
        </div>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Event handlers
    const confirmBtn = modal.querySelector('#bounty-confirm');
    const cancelBtn = modal.querySelector('#bounty-cancel');
    
    confirmBtn.onclick = () => {
      overlay.remove();
      resolve(true);
    };
    
    cancelBtn.onclick = () => {
      overlay.remove();
      resolve(false);
    };
    
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    };
  });
}

/**
 * Show bounty error message
 * @param {string} message - Error message
 */
function showBountyError(message) {
  // Create notification
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-900 border border-red-500 text-white px-6 py-3 rounded-lg shadow-2xl z-[10000]';
  notification.style.minWidth = '300px';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl">⚠️</span>
      <div>
        <div class="font-bold text-sm">Bounty Error</div>
        <div class="text-xs text-red-200">${sanitizeHTML(message)}</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    notification.style.opacity = '0';
    notification.style.transform = 'translate(-50%, -20px)';
    
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 4000);
}

/**
 * Trigger bounty cinematic effect
 * @param {string} targetName - Target username
 */
function triggerBountyCinematic(targetName) {
  // Play sound
  if (BountyState.audio) {
    BountyState.audio.currentTime = 0;
    BountyState.audio.play().catch(error => {
      console.debug('Audio playback prevented:', error);
    });
  }

  // Create cinematic overlay
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[9998] flex items-center justify-center flex-col pointer-events-none';
  overlay.style.background = 'radial-gradient(circle, rgba(139, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.8) 100%)';
  overlay.style.animation = 'fadeIn 0.3s ease-out';
  
  overlay.innerHTML = `
    <div class="relative">
      <!-- Red alert lines -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-full h-1 bg-red-500" style="animation: expandWidth 0.5s ease-out;"></div>
      </div>
      
      <!-- Main content -->
      <div class="text-center space-y-6 p-8">
        <!-- Warning symbol -->
        <div class="text-8xl animate-pulse" style="text-shadow: 0 0 30px rgba(239, 68, 68, 0.8);">
          ⚠️
        </div>
        
        <!-- Wanted text -->
        <div class="space-y-2">
          <div class="text-white text-5xl font-bold tracking-[0.5em] cinzel glitch-text">
            WANTED
          </div>
          <div class="text-red-500 text-7xl font-black tracking-wider drop-shadow-[0_0_20px_rgba(239,68,68,1)]" style="animation: scaleIn 0.4s ease-out;">
            ${sanitizeHTML(targetName.toUpperCase())}
          </div>
        </div>
        
        <!-- Subtext -->
        <div class="space-y-1">
          <div class="text-yellow-500 text-sm uppercase tracking-[0.3em] font-bold">
            Contract Active
          </div>
          <div class="text-white/50 text-xs tracking-widest uppercase">
            Target marked in hierarchy for 1 hour
          </div>
        </div>
        
        <!-- Decorative elements -->
        <div class="flex justify-center gap-8 mt-6">
          <div class="w-20 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
          <div class="w-20 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add screen shake
  document.body.style.animation = 'shake 0.5s ease-in-out';
  
  // Fade out and remove
  setTimeout(() => {
    overlay.style.transition = 'opacity 1s ease-out';
    overlay.style.opacity = '0';
    
    setTimeout(() => {
      overlay.remove();
      document.body.style.animation = '';
      
      // Reload hierarchy
      if (typeof loadHierarchy === 'function') {
        loadHierarchy();
      }
    }, 1000);
  }, 3500);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitize HTML to prevent XSS
 * @param {string} text - Text to sanitize
 * @returns {string}
 */
function sanitizeHTML(text) {
  if (!text || typeof text !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// ANIMATIONS (CSS in JS)
// ============================================

// Inject animation styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes scaleIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  
  @keyframes expandWidth {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  
  .glitch-text {
    position: relative;
    animation: glitch 0.5s infinite;
  }
  
  @keyframes glitch {
    0%, 100% { 
      text-shadow: 
        2px 0 #ff0000,
        -2px 0 #00ffff,
        0 0 10px rgba(255, 255, 255, 0.5);
    }
    25% { 
      text-shadow: 
        -2px 0 #ff0000,
        2px 0 #00ffff,
        0 0 15px rgba(255, 255, 255, 0.7);
    }
    50% { 
      text-shadow: 
        2px 2px #ff0000,
        -2px -2px #00ffff,
        0 0 20px rgba(255, 255, 255, 0.9);
    }
    75% { 
      text-shadow: 
        -2px 2px #ff0000,
        2px -2px #00ffff,
        0 0 15px rgba(255, 255, 255, 0.7);
    }
  }
`;
document.head.appendChild(styleSheet);

// ============================================
// INITIALIZATION
// ============================================

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBountySystem);
} else {
  initBountySystem();
}

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    placeBounty,
    expireBounty,
    initBountySystem
  };
}

// Make placeBounty globally accessible
window.placeBounty = placeBounty;