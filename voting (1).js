/**
 * voting.js - Enhanced Voting & Hierarchy System
 * 
 * Features:
 * - Vote casting with animations
 * - Gift button integration
 * - Last online status display
 * - Enhanced title visualization
 * - Real-time hierarchy updates
 * 
 * @version 3.0.0
 */

'use strict';

// ============================================
// CONFIGURATION
// ============================================

const VOTING_CONFIG = {
  maxVotesPerUser: 3,
  voteResetInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  selfVotingAllowed: false,
  voteReward: 100
};

// Title tier mappings
const TITLE_TIERS = {
  'Tycoon': 'legendary',
  'Magnate': 'legendary',
  'Legend': 'legendary',
  'Elite': 'epic',
  'Noble': 'rare',
  'Knight': 'rare',
  'Squire': 'common',
  'Commoner': 'common'
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

function initVoting() {
  loadUserVotes();
  console.log('✅ Voting system initialized');
}

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

function updateVotesDisplay() {
  const display = document.getElementById('votes-remaining-display');
  if (display) {
    display.textContent = VotingState.votesRemaining;
  }
}

// ============================================
// VOTING FUNCTIONS
// ============================================

async function voteFor(targetName) {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');

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

    await executeVote(currentUser, targetName);

    VotingState.votesRemaining = votesRemaining - 1;
    VotingState.lastVoteTime = Date.now();

    showVotingSuccess(`Vote recorded for ${targetName}! ${VotingState.votesRemaining} votes remaining.`);

    updateVotesDisplay();
    
    if (typeof loadHierarchy === 'function') {
      loadHierarchy();
    }

    if (typeof grantVotingReward === 'function') {
      grantVotingReward();
    }

    if (typeof updateUserTitle === 'function') {
      updateUserTitle(targetName);
    }

  } catch (error) {
    console.error('Voting error:', error);
    showVotingError(error.message || 'Failed to record vote. Please try again.');
  }
}

async function executeVote(voter, target) {
  const voterRef = db.collection('users').doc(voter);
  const targetRef = db.collection('users').doc(target);

  await db.runTransaction(async (transaction) => {
    const voterDoc = await transaction.get(voterRef);
    const targetDoc = await transaction.get(targetRef);

    if (!voterDoc.exists) {
      throw new Error('Voter account not found');
    }

    if (!targetDoc.exists) {
      throw new Error('Target user not found');
    }

    const voterData = voterDoc.data();
    const votesRemaining = voterData.votesRemaining ?? VOTING_CONFIG.maxVotesPerUser;

    if (votesRemaining <= 0) {
      throw new Error('No votes remaining');
    }

    transaction.update(voterRef, {
      votesRemaining: votesRemaining - 1,
      lastVoteTime: firebase.firestore.FieldValue.serverTimestamp(),
      totalVotesCast: firebase.firestore.FieldValue.increment(1)
    });

    transaction.update(targetRef, {
      totalVotesReceived: firebase.firestore.FieldValue.increment(1)
    });
  });

  await logVote(voter, target);
}

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

function loadHierarchy() {
  const listContainer = document.getElementById('pyramid-list');
  if (!listContainer) return;

  if (VotingState.unsubscribe) {
    VotingState.unsubscribe();
  }

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
 * Create enhanced hierarchy card with gift button and last online
 */
function createHierarchyCard(username, userData, rank) {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  const isCurrentUser = username === currentUser;
  const isTopRank = rank === 1;
  const hasBounty = userData.isBounty || false;

  const card = document.createElement('div');
  card.className = `user-rank-card glass-card p-5 rounded-xl flex justify-between items-center transition-all ${
    hasBounty
      ? 'bounty-target'
      : isTopRank
        ? 'rank-1'
        : rank === 2
          ? 'rank-2'
          : rank === 3
            ? 'rank-3'
            : ''
  }`;

  // Left section
  const leftSection = document.createElement('div');
  leftSection.className = 'flex items-center gap-4';

  // Rank badge
  const rankBadge = document.createElement('div');
  rankBadge.className = 'flex flex-col items-center';
  
  const rankNumber = document.createElement('span');
  rankNumber.className = `cinzel text-2xl font-black ${
    isTopRank ? 'gradient-text' : rank === 2 ? 'text-[#C0C0C0]' : rank === 3 ? 'text-[#CD7F32]' : 'text-zinc-700'
  }`;
  rankNumber.textContent = `#${rank}`;
  
  const rankIcon = document.createElement('div');
  rankIcon.className = 'text-lg mt-1';
  rankIcon.textContent = isTopRank ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
  
  rankBadge.appendChild(rankNumber);
  if (rankIcon.textContent) rankBadge.appendChild(rankIcon);

  // User info
  const userInfo = document.createElement('div');

  const userName = document.createElement('p');
  userName.className = `font-bold text-lg ${isCurrentUser ? 'gradient-text' : 'text-white'}`;
  userName.textContent = username;

  // Enhanced title badge
  const userTitle = document.createElement('span');
  const titleText = userData.title || 'Commoner';
  const titleTier = TITLE_TIERS[titleText] || 'common';
  userTitle.className = `title-badge title-${titleTier}`;
  userTitle.textContent = titleText.toUpperCase();

  // Status and last online
  const statusRow = document.createElement('div');
  statusRow.className = 'flex items-center gap-2 mt-2';
  
  const statusDot = document.createElement('span');
  const lastActive = userData.lastActive?.toMillis() || 0;
  const isOnline = (Date.now() - lastActive) < 5 * 60 * 1000; // 5 minutes
  statusDot.className = isOnline ? 'status-online' : 'status-offline';
  
  const lastOnlineText = document.createElement('span');
  lastOnlineText.className = 'last-online';
  lastOnlineText.textContent = formatLastOnline(lastActive);
  
  statusRow.appendChild(statusDot);
  statusRow.appendChild(lastOnlineText);

  // Stats
  const userStats = document.createElement('p');
  userStats.className = 'text-[10px] text-zinc-500 mt-2 flex items-center gap-3';
  userStats.innerHTML = `
    <span class="flex items-center gap-1">
      <span>⭐</span>
      <span class="font-semibold">${userData.totalVotesReceived || 0}</span>
      <span>votes</span>
    </span>
    <span class="flex items-center gap-1">
      <span>💰</span>
      <span class="font-semibold">${(userData.credits || 0).toLocaleString()}</span>
      <span>CR</span>
    </span>
  `;

  userInfo.appendChild(userName);
  userInfo.appendChild(userTitle);
  userInfo.appendChild(statusRow);
  userInfo.appendChild(userStats);

  leftSection.appendChild(rankBadge);
  leftSection.appendChild(userInfo);

  // Right section - Action buttons
  const rightSection = document.createElement('div');
  rightSection.className = 'flex flex-col sm:flex-row gap-2';

  if (!isCurrentUser) {
    // Vote button
    const voteBtn = document.createElement('button');
    voteBtn.className = 'btn-secondary text-[10px] px-4 py-2';
    voteBtn.innerHTML = '⭐ VOTE';
    voteBtn.onclick = () => voteFor(username);
    rightSection.appendChild(voteBtn);

    // Gift button
    const giftBtn = document.createElement('button');
    giftBtn.className = 'btn-secondary btn-gift text-[10px] px-4 py-2';
    giftBtn.innerHTML = '🎁 GIFT';
    giftBtn.onclick = () => {
      if (typeof openGiftModal === 'function') {
        openGiftModal(username);
      } else {
        console.warn('Gift system not loaded');
      }
    };
    rightSection.appendChild(giftBtn);

    // Bounty button
    if (typeof placeBounty === 'function') {
      const bountyBtn = document.createElement('button');
      bountyBtn.className = 'text-[10px] px-4 py-2 border-2 border-red-600 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all font-bold uppercase';
      bountyBtn.textContent = '⚠ BOUNTY';
      bountyBtn.onclick = () => placeBounty(username);
      rightSection.appendChild(bountyBtn);
    }
  } else {
    // Current user indicator
    const youBadge = document.createElement('div');
    youBadge.className = 'px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-[10px] font-bold uppercase';
    youBadge.textContent = '← YOU';
    rightSection.appendChild(youBadge);
  }

  card.appendChild(leftSection);
  card.appendChild(rightSection);

  return card;
}

/**
 * Format last online time
 */
function formatLastOnline(timestamp) {
  if (!timestamp) return 'Never';
  
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// VOTE RESET
// ============================================

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
    loadUserVotes();

    console.log('All votes reset successfully');
    return true;

  } catch (error) {
    console.error('Reset votes error:', error);
    throw error;
  }
}

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

async function getUserVotingStats(username) {
  try {
    const userDoc = await db.collection('users').doc(username).get();
    
    if (!userDoc.exists) return null;

    const data = userDoc.data();
    const votesCast = await db.collection('votes')
      .where('voter', '==', username)
      .get();

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

function showVotingError(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 glass-card border-2 border-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] max-w-md';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-3xl">⚠️</span>
      <div>
        <div class="font-bold text-sm">Vote Error</div>
        <div class="text-sm text-red-300 mt-1">${message}</div>
      </div>
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

function showVotingSuccess(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 glass-card border-2 border-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] max-w-md';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-3xl">✅</span>
      <div>
        <div class="font-bold text-sm">Success!</div>
        <div class="text-sm text-green-300 mt-1">${message}</div>
      </div>
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

function cleanupVoting() {
  if (VotingState.unsubscribe) {
    VotingState.unsubscribe();
    VotingState.unsubscribe = null;
  }
}

window.addEventListener('beforeunload', cleanupVoting);

// ============================================
// INITIALIZATION
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initVoting();
    checkVoteReset();
  });
} else {
  initVoting();
  checkVoteReset();
}

// Export functions
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
window.handleVote = voteFor;
window.resetAllVotes = resetAllVotes;
window.getUserVotingStats = getUserVotingStats;
window.getTopVoted = getTopVoted;
