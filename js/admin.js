/**
 * admin.js - Admin Control Panel
 * 
 * Features:
 * - User credit management
 * - System announcements
 * - User moderation (ban/unban)
 * - Reset voting system
 * - Statistics dashboard
 * - Bulk operations
 * 
 * @version 2.0.0
 * @restricted Admin access only
 */

'use strict';

// ============================================
// CONFIGURATION
// ============================================

const ADMIN_CONFIG = {
  authorizedUsers: ['Nihal Gupta'], // Add admin usernames here
  creditPresets: [1000, 5000, 10000, 50000, 100000, 500000],
  announcementCooldown: 60000 // 1 minute
};

// ============================================
// STATE MANAGEMENT
// ============================================

const AdminState = {
  isOpen: false,
  lastAnnouncement: 0,
  statsCache: null,
  statsCacheTime: 0
};

// ============================================
// AUTHORIZATION
// ============================================

/**
 * Check if current user is admin
 * @returns {boolean}
 */
function isAdmin() {
  const currentUser = localStorage.getItem('pyramidUser');
  return ADMIN_CONFIG.authorizedUsers.includes(currentUser);
}

/**
 * Verify admin access with error handling
 * @throws {Error} If user is not admin
 */
function requireAdmin() {
  if (!isAdmin()) {
    throw new Error('Unauthorized access. Admin privileges required.');
  }
}

// ============================================
// ADMIN PANEL UI
// ============================================

/**
 * Open admin control panel
 */
function openAdminPower() {
  try {
    requireAdmin();
  } catch (error) {
    alert('⚠️ ' + error.message);
    return;
  }

  if (AdminState.isOpen) {
    closeAdminPanel();
    return;
  }

  createAdminPanel();
  AdminState.isOpen = true;
}

/**
 * Create and display admin panel
 */
function createAdminPanel() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'admin-panel-overlay';
  overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10000] p-4';
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      closeAdminPanel();
    }
  };

  // Create panel
  const panel = document.createElement('div');
  panel.id = 'admin-panel';
  panel.className = 'bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0a] border-2 border-[#d4af37] rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl';
  panel.style.boxShadow = '0 0 50px rgba(212, 175, 55, 0.3)';
  panel.onclick = (e) => e.stopPropagation();

  panel.innerHTML = `
    <!-- Header -->
    <div class="bg-gradient-to-r from-[#d4af37] to-[#f0c85a] p-4 flex justify-between items-center">
      <div class="flex items-center gap-3">
        <span class="text-3xl">👑</span>
        <div>
          <h2 class="text-black font-bold text-xl cinzel tracking-wider">ADMIN CONTROL PANEL</h2>
          <p class="text-black/70 text-xs">Sovereign Authority Interface</p>
        </div>
      </div>
      <button onclick="closeAdminPanel()" class="text-black hover:text-red-600 text-3xl font-bold transition-colors">×</button>
    </div>

    <!-- Content -->
    <div class="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
      <!-- Tabs -->
      <div class="flex gap-2 mb-6 border-b border-zinc-800 pb-2">
        <button onclick="switchAdminTab('credits')" id="tab-credits" class="admin-tab active px-4 py-2 rounded-t text-sm font-bold">
          💰 Credits
        </button>
        <button onclick="switchAdminTab('users')" id="tab-users" class="admin-tab px-4 py-2 rounded-t text-sm font-bold">
          👥 Users
        </button>
        <button onclick="switchAdminTab('system')" id="tab-system" class="admin-tab px-4 py-2 rounded-t text-sm font-bold">
          ⚙️ System
        </button>
        <button onclick="switchAdminTab('stats')" id="tab-stats" class="admin-tab px-4 py-2 rounded-t text-sm font-bold">
          📊 Stats
        </button>
      </div>

      <!-- Tab Content -->
      <div id="admin-tab-content"></div>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Load default tab
  switchAdminTab('credits');
}

/**
 * Close admin panel
 */
function closeAdminPanel() {
  const overlay = document.getElementById('admin-panel-overlay');
  if (overlay) {
    overlay.remove();
  }
  AdminState.isOpen = false;
}

/**
 * Switch admin panel tab
 * @param {string} tabName - Tab identifier
 */
function switchAdminTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  const activeTab = document.getElementById(`tab-${tabName}`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  // Load tab content
  const content = document.getElementById('admin-tab-content');
  if (!content) return;

  switch (tabName) {
    case 'credits':
      content.innerHTML = getCreditsTabContent();
      break;
    case 'users':
      content.innerHTML = getUsersTabContent();
      loadUsersList();
      break;
    case 'system':
      content.innerHTML = getSystemTabContent();
      break;
    case 'stats':
      content.innerHTML = getStatsTabContent();
      loadStats();
      break;
  }
}

// ============================================
// TAB CONTENT GENERATORS
// ============================================

/**
 * Generate credits tab content
 * @returns {string} HTML content
 */
function getCreditsTabContent() {
  return `
    <div class="space-y-6">
      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h3 class="text-lg font-bold text-[#d4af37] mb-4">💰 Credit Management</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-zinc-400 mb-2">Target User</label>
            <input 
              id="credit-target-user" 
              type="text" 
              placeholder="Enter username"
              class="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white focus:border-[#d4af37] outline-none"
            />
          </div>

          <div>
            <label class="block text-sm text-zinc-400 mb-2">Credit Amount</label>
            <input 
              id="credit-amount" 
              type="number" 
              placeholder="Enter amount"
              class="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white focus:border-[#d4af37] outline-none"
            />
            <div class="flex gap-2 mt-2 flex-wrap">
              ${ADMIN_CONFIG.creditPresets.map(amount => `
                <button 
                  onclick="document.getElementById('credit-amount').value=${amount}" 
                  class="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs hover:border-[#d4af37] transition-all"
                >
                  ${amount.toLocaleString()}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="flex gap-3">
            <button 
              onclick="adminAddCredits()" 
              class="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded transition-all"
            >
              ✅ Add Credits
            </button>
            <button 
              onclick="adminRemoveCredits()" 
              class="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-all"
            >
              ❌ Remove Credits
            </button>
          </div>
        </div>
      </div>

      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h3 class="text-lg font-bold text-[#d4af37] mb-4">🎁 Bulk Operations</h3>
        
        <div class="space-y-3">
          <button 
            onclick="adminGrantAllCredits()" 
            class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded transition-all"
          >
            Grant Credits to All Users
          </button>
          <button 
            onclick="adminResetAllCredits()" 
            class="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded transition-all"
          >
            Reset All Credits to 100,000
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate users tab content
 * @returns {string} HTML content
 */
function getUsersTabContent() {
  return `
    <div class="space-y-6">
      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h3 class="text-lg font-bold text-[#d4af37] mb-4">👥 User Management</h3>
        
        <div class="mb-4">
          <input 
            id="user-search" 
            type="text" 
            placeholder="Search users..."
            class="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white focus:border-[#d4af37] outline-none"
            oninput="filterUsersList(this.value)"
          />
        </div>

        <div id="users-list" class="space-y-2 max-h-96 overflow-y-auto">
          <div class="text-center text-zinc-500 py-8">Loading users...</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate system tab content
 * @returns {string} HTML content
 */
function getSystemTabContent() {
  return `
    <div class="space-y-6">
      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h3 class="text-lg font-bold text-[#d4af37] mb-4">📢 System Announcements</h3>
        
        <div class="space-y-4">
          <textarea 
            id="announcement-text" 
            placeholder="Enter announcement message..."
            class="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white focus:border-[#d4af37] outline-none resize-none"
            rows="4"
          ></textarea>

          <button 
            onclick="sendSystemAnnouncement()" 
            class="w-full py-3 bg-[#d4af37] hover:bg-[#f0c85a] text-black font-bold rounded transition-all"
          >
            📣 Send Announcement
          </button>
        </div>
      </div>

      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h3 class="text-lg font-bold text-[#d4af37] mb-4">🔄 System Controls</h3>
        
        <div class="space-y-3">
          <button 
            onclick="adminResetVotes()" 
            class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-all"
          >
            Reset All Votes (Set to 3)
          </button>
          <button 
            onclick="adminClearChat()" 
            class="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-all"
          >
            Clear Chat Messages
          </button>
          <button 
            onclick="adminClearBounties()" 
            class="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded transition-all"
          >
            Clear All Active Bounties
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate stats tab content
 * @returns {string} HTML content
 */
function getStatsTabContent() {
  return `
    <div class="space-y-6">
      <div id="stats-content" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 text-center">
          <div class="text-4xl mb-2">⏳</div>
          <div class="text-zinc-400 text-sm">Loading statistics...</div>
        </div>
      </div>
      
      <button 
        onclick="loadStats()" 
        class="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded transition-all"
      >
        🔄 Refresh Stats
      </button>
    </div>
  `;
}

// ============================================
// CREDIT MANAGEMENT
// ============================================

/**
 * Add credits to user
 */
async function adminAddCredits() {
  try {
    requireAdmin();

    const username = document.getElementById('credit-target-user').value.trim();
    const amount = parseInt(document.getElementById('credit-amount').value);

    if (!username) {
      alert('⚠️ Please enter a username');
      return;
    }

    if (!amount || amount <= 0) {
      alert('⚠️ Please enter a valid amount');
      return;
    }

    const userRef = db.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      alert('⚠️ User not found');
      return;
    }

    await userRef.update({
      credits: firebase.firestore.FieldValue.increment(amount)
    });

    alert(`✅ Added ${amount.toLocaleString()} credits to ${username}`);

    // Clear inputs
    document.getElementById('credit-target-user').value = '';
    document.getElementById('credit-amount').value = '';

  } catch (error) {
    console.error('Add credits error:', error);
    alert('❌ Failed to add credits: ' + error.message);
  }
}

/**
 * Remove credits from user
 */
async function adminRemoveCredits() {
  try {
    requireAdmin();

    const username = document.getElementById('credit-target-user').value.trim();
    const amount = parseInt(document.getElementById('credit-amount').value);

    if (!username || !amount || amount <= 0) {
      alert('⚠️ Please enter valid username and amount');
      return;
    }

    const userRef = db.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      alert('⚠️ User not found');
      return;
    }

    const currentCredits = userDoc.data().credits || 0;
    if (currentCredits < amount) {
      alert(`⚠️ User only has ${currentCredits.toLocaleString()} credits`);
      return;
    }

    await userRef.update({
      credits: firebase.firestore.FieldValue.increment(-amount)
    });

    alert(`✅ Removed ${amount.toLocaleString()} credits from ${username}`);

    // Clear inputs
    document.getElementById('credit-target-user').value = '';
    document.getElementById('credit-amount').value = '';

  } catch (error) {
    console.error('Remove credits error:', error);
    alert('❌ Failed to remove credits: ' + error.message);
  }
}

/**
 * Grant credits to all users
 */
async function adminGrantAllCredits() {
  try {
    requireAdmin();

    const amount = prompt('Enter amount to grant to ALL users:');
    if (!amount) return;

    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('⚠️ Invalid amount');
      return;
    }

    const confirmed = confirm(`Grant ${parsedAmount.toLocaleString()} credits to ALL users?`);
    if (!confirmed) return;

    const snapshot = await db.collection('users').get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        credits: firebase.firestore.FieldValue.increment(parsedAmount)
      });
    });

    await batch.commit();

    alert(`✅ Granted ${parsedAmount.toLocaleString()} credits to ${snapshot.size} users`);

  } catch (error) {
    console.error('Grant all credits error:', error);
    alert('❌ Operation failed: ' + error.message);
  }
}

/**
 * Reset all credits to default
 */
async function adminResetAllCredits() {
  try {
    requireAdmin();

    const confirmed = confirm('Reset ALL users to 100,000 credits?\n\nThis cannot be undone!');
    if (!confirmed) return;

    const snapshot = await db.collection('users').get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, { credits: 100000 });
    });

    await batch.commit();

    alert(`✅ Reset ${snapshot.size} users to 100,000 credits`);

  } catch (error) {
    console.error('Reset credits error:', error);
    alert('❌ Operation failed: ' + error.message);
  }
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Load and display users list
 */
async function loadUsersList() {
  try {
    const container = document.getElementById('users-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-zinc-500 py-8">Loading...</div>';

    const snapshot = await db.collection('users')
      .orderBy('credits', 'desc')
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<div class="text-center text-zinc-500 py-8">No users found</div>';
      return;
    }

    container.innerHTML = '';

    snapshot.forEach(doc => {
      const user = doc.data();
      const userCard = createUserCard(doc.id, user);
      container.appendChild(userCard);
    });

  } catch (error) {
    console.error('Load users error:', error);
    const container = document.getElementById('users-list');
    if (container) {
      container.innerHTML = '<div class="text-center text-red-500 py-8">Failed to load users</div>';
    }
  }
}

/**
 * Create user card element
 * @param {string} username - Username
 * @param {Object} userData - User data
 * @returns {HTMLElement}
 */
function createUserCard(username, userData) {
  const card = document.createElement('div');
  card.className = 'bg-zinc-800/50 border border-zinc-700 rounded p-3 hover:border-[#d4af37] transition-all user-card';
  card.dataset.username = username.toLowerCase();

  card.innerHTML = `
    <div class="flex justify-between items-center">
      <div class="flex-1">
        <div class="font-bold text-white">${sanitizeText(username)}</div>
        <div class="text-xs text-zinc-400 space-x-3">
          <span>💰 ${(userData.credits || 0).toLocaleString()} CR</span>
          <span>🗳️ ${userData.votesRemaining || 0} votes</span>
          <span>⭐ ${userData.totalVotesReceived || 0} popularity</span>
        </div>
      </div>
      <div class="flex gap-2">
        <button 
          onclick="quickEditUser('${username}')" 
          class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-all"
        >
          Edit
        </button>
      </div>
    </div>
  `;

  return card;
}

/**
 * Filter users list
 * @param {string} searchTerm - Search term
 */
function filterUsersList(searchTerm) {
  const cards = document.querySelectorAll('.user-card');
  const term = searchTerm.toLowerCase();

  cards.forEach(card => {
    const username = card.dataset.username;
    if (username.includes(term)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

/**
 * Quick edit user
 * @param {string} username - Username to edit
 */
function quickEditUser(username) {
  document.getElementById('credit-target-user').value = username;
  switchAdminTab('credits');
}

// ============================================
// SYSTEM CONTROLS
// ============================================

/**
 * Send system announcement
 */
async function sendSystemAnnouncement() {
  try {
    requireAdmin();

    const text = document.getElementById('announcement-text').value.trim();

    if (!text) {
      alert('⚠️ Please enter an announcement message');
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - AdminState.lastAnnouncement < ADMIN_CONFIG.announcementCooldown) {
      const remaining = Math.ceil((ADMIN_CONFIG.announcementCooldown - (now - AdminState.lastAnnouncement)) / 1000);
      alert(`⚠️ Please wait ${remaining} seconds before sending another announcement`);
      return;
    }

    await db.collection('messages').add({
      user: 'SYSTEM',
      text: `📢 ADMIN ANNOUNCEMENT: ${text}`,
      type: 'MSG',
      time: Date.now()
    });

    AdminState.lastAnnouncement = now;

    alert('✅ Announcement sent successfully');
    document.getElementById('announcement-text').value = '';

  } catch (error) {
    console.error('Send announcement error:', error);
    alert('❌ Failed to send announcement: ' + error.message);
  }
}

/**
 * Reset all votes
 */
async function adminResetVotes() {
  try {
    requireAdmin();

    const confirmed = confirm('Reset all users to 3 votes?');
    if (!confirmed) return;

    const snapshot = await db.collection('users').get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, { votesRemaining: 3 });
    });

    await batch.commit();

    alert(`✅ Reset votes for ${snapshot.size} users`);

  } catch (error) {
    console.error('Reset votes error:', error);
    alert('❌ Operation failed: ' + error.message);
  }
}

/**
 * Clear all chat messages
 */
async function adminClearChat() {
  try {
    requireAdmin();

    const confirmed = confirm('Delete ALL chat messages?\n\nThis cannot be undone!');
    if (!confirmed) return;

    const snapshot = await db.collection('messages').get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    alert(`✅ Deleted ${snapshot.size} messages`);

  } catch (error) {
    console.error('Clear chat error:', error);
    alert('❌ Operation failed: ' + error.message);
  }
}

/**
 * Clear all active bounties
 */
async function adminClearBounties() {
  try {
    requireAdmin();

    const confirmed = confirm('Clear all active bounties?');
    if (!confirmed) return;

    const snapshot = await db.collection('users')
      .where('isBounty', '==', true)
      .get();

    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        isBounty: false,
        bountyPlacer: firebase.firestore.FieldValue.delete(),
        bountyTime: firebase.firestore.FieldValue.delete()
      });
    });

    await batch.commit();

    alert(`✅ Cleared ${snapshot.size} bounties`);

    if (typeof loadHierarchy === 'function') {
      loadHierarchy();
    }

  } catch (error) {
    console.error('Clear bounties error:', error);
    alert('❌ Operation failed: ' + error.message);
  }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Load and display statistics
 */
async function loadStats() {
  try {
    const container = document.getElementById('stats-content');
    if (!container) return;

    container.innerHTML = '<div class="col-span-2 text-center text-zinc-500 py-8">Loading statistics...</div>';

    const usersSnapshot = await db.collection('users').get();
    const messagesSnapshot = await db.collection('messages').get();

    let totalCredits = 0;
    let totalVotes = 0;
    let maxCredits = { user: '', amount: 0 };
    let maxVotes = { user: '', amount: 0 };

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      totalCredits += data.credits || 0;
      totalVotes += data.totalVotesReceived || 0;

      if ((data.credits || 0) > maxCredits.amount) {
        maxCredits = { user: doc.id, amount: data.credits || 0 };
      }

      if ((data.totalVotesReceived || 0) > maxVotes.amount) {
        maxVotes = { user: doc.id, amount: data.totalVotesReceived || 0 };
      }
    });

    container.innerHTML = `
      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 text-center">
        <div class="text-4xl mb-2">👥</div>
        <div class="text-2xl font-bold text-white">${usersSnapshot.size}</div>
        <div class="text-zinc-400 text-sm">Total Users</div>
      </div>

      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 text-center">
        <div class="text-4xl mb-2">💰</div>
        <div class="text-2xl font-bold text-[#d4af37]">${totalCredits.toLocaleString()}</div>
        <div class="text-zinc-400 text-sm">Total Credits</div>
      </div>

      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 text-center">
        <div class="text-4xl mb-2">💬</div>
        <div class="text-2xl font-bold text-white">${messagesSnapshot.size}</div>
        <div class="text-zinc-400 text-sm">Total Messages</div>
      </div>

      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 text-center">
        <div class="text-4xl mb-2">⭐</div>
        <div class="text-2xl font-bold text-white">${totalVotes}</div>
        <div class="text-zinc-400 text-sm">Total Votes</div>
      </div>

      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <div class="text-lg font-bold text-[#d4af37] mb-2">🏆 Richest User</div>
        <div class="text-white font-bold">${sanitizeText(maxCredits.user)}</div>
        <div class="text-zinc-400 text-sm">${maxCredits.amount.toLocaleString()} credits</div>
      </div>

      <div class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <div class="text-lg font-bold text-[#d4af37] mb-2">⭐ Most Popular</div>
        <div class="text-white font-bold">${sanitizeText(maxVotes.user)}</div>
        <div class="text-zinc-400 text-sm">${maxVotes.amount} votes</div>
      </div>
    `;

  } catch (error) {
    console.error('Load stats error:', error);
    const container = document.getElementById('stats-content');
    if (container) {
      container.innerHTML = '<div class="col-span-2 text-center text-red-500 py-8">Failed to load statistics</div>';
    }
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitize text to prevent XSS
 * @param {string} text - Text to sanitize
 * @returns {string}
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// STYLES
// ============================================

const adminStyles = document.createElement('style');
adminStyles.textContent = `
  .admin-tab {
    color: #9ca3af;
    transition: all 0.3s;
  }

  .admin-tab:hover {
    color: #d4af37;
    background: rgba(212, 175, 55, 0.1);
  }

  .admin-tab.active {
    color: #d4af37;
    background: rgba(212, 175, 55, 0.2);
    border-bottom: 2px solid #d4af37;
  }
`;
document.head.appendChild(adminStyles);

// ============================================
// EXPORT
// ============================================

// Make functions globally accessible
window.openAdminPower = openAdminPower;
window.closeAdminPanel = closeAdminPanel;
window.switchAdminTab = switchAdminTab;
window.adminAddCredits = adminAddCredits;
window.adminRemoveCredits = adminRemoveCredits;
window.adminGrantAllCredits = adminGrantAllCredits;
window.adminResetAllCredits = adminResetAllCredits;
window.loadUsersList = loadUsersList;
window.filterUsersList = filterUsersList;
window.quickEditUser = quickEditUser;
window.sendSystemAnnouncement = sendSystemAnnouncement;
window.adminResetVotes = adminResetVotes;
window.adminClearChat = adminClearChat;
window.adminClearBounties = adminClearBounties;
window.loadStats = loadStats;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    openAdminPower,
    isAdmin
  };
}