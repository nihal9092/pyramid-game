/**
 * voting.js - Voting & Hierarchy System
 * 
 * Features:
 * - Vote casting
 * - Vote limits management
 * - Hierarchy ranking
 * - Real-time updates
 * - Vote tracking
 * 
 * @version 2.0.0
 */

'use strict';

// ============================================
// CONFIGURATION
// ============================================

const VOTING_CONFIG = {
  maxVotesPerUser: 3,
  voteResetInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  selfVotingAllowed: false,
  voteReward: 100 // Credits reward for voting
};

// ============================================
// STATE MANAGEMENT
// ============================================

const VotingState = {
  votesRemaining: 3,
  lastVoteTime: 0,
  hierarchyCache: [],
  hierarchyCacheTime: 0,
  unsubscribe: null
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize voting system
 */
function initVoting() {
  loadUserVotes();
  console.log('Voting system initialized');
}

/**
 * Load user's remaining votes
 */
async function loadUserVotes() {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  if (!currentUser) return;

  try {
    const userDoc = await db.collection('users').doc(currentUser).get();
    
    if (userDoc.exists) {
      const data = userDoc.data();
      VotingState.votesRemaining = data.votesRemaining ?? VOTING_CONFIG.maxVotesPerUser;
      updateVotesDisplay();
    }
  } catch (error) {
    console.error('Load votes error:', error);
  }
}

/**
 * Update votes display in UI
 */
function updateVotesDisplay() {
  const display = document.getElementById('votes-remaining-display');
  if (display) {
    display.textContent = VotingState.votesRemaining;
  }
}

// ============================================
// VOTING FUNCTIONS
// ============================================

/**
 * Cast a vote for a user
 * @param {string} targetName - Username to vote for
 */
async function voteFor(targetName) {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');

  // Validation
  if (!currentUser) {
    showVotingError('You must be logged in to vote.');
    return;
  }

  if (!targetName) {
    showVotingError('Invalid target.');
    return;
  }

  if (!VOTING_CONFIG.selfVotingAllowed && targetName === currentUser) {
    showVotingError('Self-voting is prohibited.');
    return;
  }

  try {
    // Check votes remaining
    const currentUserRef = db.collection('users').doc(currentUser);
    const currentUserDoc = await currentUserRef.get();

    if (!currentUserDoc.exists) {
      showVotingError('User session expired. Please login again.');
      return;
    }

    const votesRemaining = currentUserDoc.data().votesRemaining ?? VOTING_CONFIG.maxVotesPerUser;

    if (votesRemaining <= 0) {
      showVotingError('You have no votes remaining. Votes reset weekly.');
      return;
    }

    // Execute vote transaction
    await executeVote(currentUser, targetName);

    // Update state
    VotingState.votesRemaining = votesRemaining - 1;
    VotingState.lastVoteTime = Date.now();

    // Show success
    showVotingSuccess(`Vote recorded for ${targetName}! ${VotingState.votesRemaining} votes remaining.`);

    // Update displays
    updateVotesDisplay();
    
    // Reload hierarchy
    if (typeof loadHierarchy === 'function') {
      loadHierarchy();
    }

    // Grant voting reward
    if (typeof grantVotingReward === 'function') {
      grantVotingReward();
    }

    // Update title based on new vote count
    if (typeof updateUserTitle === 'function') {
      updateUserTitle(targetName);
    }

  } catch (error) {
    console.error('Voting error:', error);
    showVotingError(error.message || 'Failed to record vote. Please try again.');
  }
}

/**
 * Execute vote transaction
 * @param {string} voter - Voter username
 * @param {string} target - Target username
 */
async function executeVote(voter, target) {
  const voterRef = db.collection('users').doc(voter);
  const targetRef = db.collection('users').doc(target);

  await db.runTransaction(async (transaction) => {
    // Get both documents
    const voterDoc = await transaction.get(voterRef);
    const targetDoc = await transaction.get(targetRef);

    // Validate existence
    if (!voterDoc.exists) {
      throw new Error('Voter account not found');
    }

    if (!targetDoc.exists) {
      throw new Error('Target user not found');
    }

    // Get data
    const voterData = voterDoc.data();
    const targetData = targetDoc.data();

    // Check votes
    const votesRemaining = voterData.votesRemaining ?? VOTING_CONFIG.maxVotesPerUser;

    if (votesRemaining <= 0) {
      throw new Error('No votes remaining');
    }

    // Update voter
    transaction.update(voterRef, {
      votesRemaining: votesRemaining - 1,
      lastVoteTime: firebase.firestore.FieldValue.serverTimestamp(),
      totalVotesCast: firebase.firestore.FieldValue.increment(1)
    });

    // Update target
    transaction.update(targetRef, {
      totalVotesReceived: firebase.firestore.FieldValue.increment(1)
    });
  });

  // Log vote
  await logVote(voter, target);
}

/**
 * Log vote to history
 * @param {string} voter - Voter username
 * @param {string} target - Target username
 */
async function logVote(voter, target) {
  try {
    await db.collection('votes').add({
      voter: voter,
      target: target,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Vote logging error:', error);
  }
}

// ============================================
// HIERARCHY MANAGEMENT
// ============================================

/**
 * Load and display the hierarchy
 */
function loadHierarchy() {
  const listContainer = document.getElementById('pyramid-list');
  if (!listContainer) return;

  // Cleanup existing listener
  if (VotingState.unsubscribe) {
    VotingState.unsubscribe();
  }

  // Listen for real-time updates
  VotingState.unsubscribe = db.collection('users')
    .orderBy('totalVotesReceived', 'desc')
    .onSnapshot((snapshot) => {
      listContainer.innerHTML = '';
      let rank = 1;

      snapshot.forEach((doc) => {
        const userData = doc.data();
        const card = createHierarchyCard(doc.id, userData, rank);
        listContainer.appendChild(card);
        rank++;
      });

      // Update cache
      VotingState.hierarchyCache = snapshot.docs.map(doc => ({
        username: doc.id,
        ...doc.data()
      }));
      VotingState.hierarchyCacheTime = Date.now();

    }, (error) => {
      console.error('Hierarchy load error:', error);
      listContainer.innerHTML = '<div class="text-center text-red-500 p-8">Failed to load hierarchy</div>';
    });
}

/**
 * Create hierarchy card element
 * @param {string} username - Username
 * @param {Object} userData - User data
 * @param {number} rank - User rank
 * @returns {HTMLElement}
 */
function createHierarchyCard(username, userData, rank) {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  const isCurrentUser = username === currentUser;
  const isTopRank = rank === 1;
  const hasBounty = userData.isBounty || false;

  const card = document.createElement('div');
  card.className = `user-card p-5 border rounded-lg flex justify-between items-center transition-all ${
    hasBounty
      ? 'bounty-target'
      : isTopRank
        ? 'border-[#d4af37] bg-[#d4af37]/5'
        : 'border-zinc-900 bg-zinc-900/30'
  }`;

  // Left side: Rank and user info
  const leftSection = document.createElement('div');
  leftSection.className = 'flex items-center gap-4';

  const rankSpan = document.createElement('span');
  rankSpan.className = `cinzel text-xl font-bold ${isTopRank ? 'text-[#d4af37]' : 'text-zinc-700'}`;
  rankSpan.textContent = `#${rank}`;

  const userInfo = document.createElement('div');

  const userName = document.createElement('p');
  userName.className = `font-bold ${isCurrentUser ? 'text-[#d4af37]' : 'text-white'}`;
  userName.textContent = username;

  const userTitle = document.createElement('p');
  userTitle.className = 'text-[9px] tracking-widest uppercase text-zinc-500';
  userTitle.textContent = isTopRank ? '👑 Popularity King' : (userData.title || 'Commoner');

  const userStats = document.createElement('p');
  userStats.className = 'text-[9px] text-zinc-600 mt-1';
  userStats.textContent = `⭐ ${userData.totalVotesReceived || 0} votes • 💰 ${(userData.credits || 0).toLocaleString()} CR`;

  userInfo.appendChild(userName);
  userInfo.appendChild(userTitle);
  userInfo.appendChild(userStats);

  leftSection.appendChild(rankSpan);
  leftSection.appendChild(userInfo);

  // Right side: Action buttons
  const rightSection = document.createElement('div');
  rightSection.className = 'flex gap-2';

  // Vote button
  if (!isCurrentUser) {
    const voteBtn = document.createElement('button');
    voteBtn.className = 'text-[9px] tracking-widest border border-zinc-700 px-4 py-2 rounded hover:border-[#d4af37] transition-all';
    voteBtn.textContent = 'VOTE';
    voteBtn.onclick = () => voteFor(username);
    rightSection.appendChild(voteBtn);
  }

  // Bounty button
  if (!isCurrentUser && typeof placeBounty === 'function') {
    const bountyBtn = document.createElement('button');
    bountyBtn.className = 'text-[9px] tracking-widest border border-red-900 px-4 py-2 rounded text-red-500 hover:bg-red-900/20 transition-all';
    bountyBtn.textContent = 'BOUNTY';
    bountyBtn.onclick = () => placeBounty(username);
    rightSection.appendChild(bountyBtn);
  }

  card.appendChild(leftSection);
  card.appendChild(rightSection);

  return card;
}

// ============================================
// VOTE RESET
// ============================================

/**
 * Reset all votes (admin function)
 */
async function resetAllVotes() {
  try {
    const snapshot = await db.collection('users').get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        votesRemaining: VOTING_CONFIG.maxVotesPerUser
      });
    });

    await batch.commit();

    // Reload user votes
    loadUserVotes();

    console.log('All votes reset successfully');
    return true;

  } catch (error) {
    console.error('Reset votes error:', error);
    throw error;
  }
}

/**
 * Check and auto-reset votes if needed (weekly)
 */
async function checkVoteReset() {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  if (!currentUser) return;

  try {
    const userDoc = await db.collection('users').doc(currentUser).get();
    
    if (!userDoc.exists) return;

    const data = userDoc.data();
    const lastReset = data.lastVoteReset?.toMillis() || 0;
    const now = Date.now();

    if (now - lastReset >= VOTING_CONFIG.voteResetInterval) {
      await db.collection('users').doc(currentUser).update({
        votesRemaining: VOTING_CONFIG.maxVotesPerUser,
        lastVoteReset: firebase.firestore.FieldValue.serverTimestamp()
      });

      loadUserVotes();
      showVotingSuccess('Your votes have been reset! You have 3 new votes.');
    }

  } catch (error) {
    console.error('Vote reset check error:', error);
  }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get user's voting statistics
 * @param {string} username - Username
 * @returns {Promise<Object>}
 */
async function getUserVotingStats(username) {
  try {
    const userDoc = await db.collection('users').doc(username).get();
    
    if (!userDoc.exists) return null;

    const data = userDoc.data();

    // Get votes cast by user
    const votesCast = await db.collection('votes')
      .where('voter', '==', username)
      .get();

    // Get votes received
    const votesReceived = await db.collection('votes')
      .where('target', '==', username)
      .get();

    return {
      votesRemaining: data.votesRemaining ?? VOTING_CONFIG.maxVotesPerUser,
      totalVotesCast: votesCast.size,
      totalVotesReceived: data.totalVotesReceived || 0,
      lastVoteTime: data.lastVoteTime
    };

  } catch (error) {
    console.error('Get voting stats error:', error);
    return null;
  }
}

/**
 * Get top voted users
 * @param {number} limit - Number of users
 * @returns {Promise<Array>}
 */
async function getTopVoted(limit = 10) {
  try {
    const snapshot = await db.collection('users')
      .orderBy('totalVotesReceived', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc, index) => ({
      rank: index + 1,
      username: doc.id,
      ...doc.data()
    }));

  } catch (error) {
    console.error('Get top voted error:', error);
    return [];
  }
}

// ============================================
// UI FEEDBACK
// ============================================

/**
 * Show voting error message
 * @param {string} message - Error message
 */
function showVotingError(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-900 border border-red-500 text-white px-6 py-3 rounded-lg shadow-2xl z-[9999]';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl">⚠️</span>
      <div class="text-sm">${message}</div>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    notification.style.opacity = '0';
    notification.style.transform = 'translate(-50%, -20px)';

    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

/**
 * Show voting success message
 * @param {string} message - Success message
 */
function showVotingSuccess(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-900 border border-green-500 text-white px-6 py-3 rounded-lg shadow-2xl z-[9999]';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl">✅</span>
      <div class="text-sm">${message}</div>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    notification.style.opacity = '0';
    notification.style.transform = 'translate(-50%, -20px)';

    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// ============================================
// CLEANUP
// ============================================

/**
 * Cleanup voting system
 */
function cleanupVoting() {
  if (VotingState.unsubscribe) {
    VotingState.unsubscribe();
    VotingState.unsubscribe = null;
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupVoting);

// ============================================
// INITIALIZATION
// ============================================

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initVoting();
    checkVoteReset();
  });
} else {
  initVoting();
  checkVoteReset();
}

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    voteFor,
    loadHierarchy,
    resetAllVotes,
    getUserVotingStats,
    getTopVoted,
    initVoting
  };
}

// Make functions globally accessible
window.voteFor = voteFor;
window.loadHierarchy = loadHierarchy;
window.handleVote = voteFor; // Alias for compatibility
window.resetAllVotes = resetAllVotes;
window.getUserVotingStats = getUserVotingStats;
window.getTopVoted = getTopVoted;
