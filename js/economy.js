/**
 * economy.js - Economic System & Credit Management
 * 
 * Features:
 * - Credit transactions
 * - Balance management
 * - Transaction history
 * - Economic events
 * - Leaderboard updates
 * 
 * @version 2.0.0
 */

'use strict';

// ============================================
// CONFIGURATION
// ============================================

const ECONOMY_CONFIG = {
  dailyBonus: 1000,
  loginBonus: 500,
  votingReward: 100,
  minTransfer: 100,
  maxTransfer: 1000000,
  transactionFee: 0.05 // 5% fee
};

// ============================================
// STATE MANAGEMENT
// ============================================

const EconomyState = {
  currentBalance: 0,
  lastUpdate: 0,
  transactionHistory: []
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize economy system
 */
function initEconomy() {
  setupEconomyListeners();
  loadUserBalance();
  
  console.log('Economy system initialized');
}

/**
 * Setup real-time balance listeners
 */
function setupEconomyListeners() {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  if (!currentUser) return;

  // Listen for balance changes
  db.collection('users')
    .doc(currentUser)
    .onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        updateBalanceDisplay(data.credits || 0);
        updateTitleDisplay(data.title || 'Commoner');
      }
    }, error => {
      console.error('Balance listener error:', error);
    });
}

/**
 * Load user balance
 */
async function loadUserBalance() {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  if (!currentUser) return;

  try {
    const userDoc = await db.collection('users').doc(currentUser).get();
    
    if (userDoc.exists) {
      const data = userDoc.data();
      EconomyState.currentBalance = data.credits || 0;
      updateBalanceDisplay(EconomyState.currentBalance);
    }
  } catch (error) {
    console.error('Load balance error:', error);
  }
}

// ============================================
// BALANCE DISPLAY
// ============================================

/**
 * Update balance display
 * @param {number} credits - Credit amount
 */
function updateBalanceDisplay(credits) {
  EconomyState.currentBalance = credits;
  
  const display = document.getElementById('my-credits-display');
  if (display) {
    // Animate number change
    animateNumber(display, parseInt(display.textContent.replace(/,/g, '') || 0), credits);
  }
}

/**
 * Update title display
 * @param {string} title - User title
 */
function updateTitleDisplay(title) {
  const display = document.getElementById('my-title-display');
  if (display) {
    display.textContent = title;
  }
}

/**
 * Animate number change
 * @param {HTMLElement} element - Display element
 * @param {number} start - Start value
 * @param {number} end - End value
 */
function animateNumber(element, start, end) {
  if (start === end) {
    element.textContent = end.toLocaleString();
    return;
  }

  const duration = 500;
  const startTime = Date.now();
  const difference = end - start;

  function update() {
    const now = Date.now();
    const progress = Math.min((now - startTime) / duration, 1);
    const current = Math.floor(start + (difference * progress));
    
    element.textContent = current.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = end.toLocaleString();
    }
  }

  update();
}

// ============================================
// CREDIT TRANSACTIONS
// ============================================

/**
 * Transfer credits to another user
 * @param {string} recipient - Recipient username
 * @param {number} amount - Amount to transfer
 * @returns {Promise<boolean>}
 */
async function transferCredits(recipient, amount) {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  if (currentUser === recipient) {
    throw new Error('Cannot transfer to yourself');
  }

  if (amount < ECONOMY_CONFIG.minTransfer) {
    throw new Error(`Minimum transfer amount is ${ECONOMY_CONFIG.minTransfer.toLocaleString()}`);
  }

  if (amount > ECONOMY_CONFIG.maxTransfer) {
    throw new Error(`Maximum transfer amount is ${ECONOMY_CONFIG.maxTransfer.toLocaleString()}`);
  }

  const senderRef = db.collection('users').doc(currentUser);
  const recipientRef = db.collection('users').doc(recipient);

  try {
    await db.runTransaction(async (transaction) => {
      const senderDoc = await transaction.get(senderRef);
      const recipientDoc = await transaction.get(recipientRef);

      if (!senderDoc.exists) {
        throw new Error('Sender account not found');
      }

      if (!recipientDoc.exists) {
        throw new Error('Recipient account not found');
      }

      const senderCredits = senderDoc.data().credits || 0;
      const recipientCredits = recipientDoc.data().credits || 0;

      if (senderCredits < amount) {
        throw new Error(`Insufficient credits. You have ${senderCredits.toLocaleString()}`);
      }

      // Calculate fee
      const fee = Math.floor(amount * ECONOMY_CONFIG.transactionFee);
      const netAmount = amount - fee;

      // Update balances
      transaction.update(senderRef, {
        credits: senderCredits - amount,
        lastTransaction: firebase.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(recipientRef, {
        credits: recipientCredits + netAmount,
        lastTransaction: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // Log transaction
    await logTransaction(currentUser, recipient, amount);

    return true;

  } catch (error) {
    console.error('Transfer error:', error);
    throw error;
  }
}

/**
 * Log transaction to history
 * @param {string} sender - Sender username
 * @param {string} recipient - Recipient username
 * @param {number} amount - Transaction amount
 */
async function logTransaction(sender, recipient, amount) {
  try {
    await db.collection('transactions').add({
      sender: sender,
      recipient: recipient,
      amount: amount,
      fee: Math.floor(amount * ECONOMY_CONFIG.transactionFee),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      type: 'transfer'
    });
  } catch (error) {
    console.error('Transaction logging error:', error);
  }
}

// ============================================
// REWARDS & BONUSES
// ============================================

/**
 * Grant daily bonus to user
 * @returns {Promise<boolean>}
 */
async function claimDailyBonus() {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  if (!currentUser) return false;

  try {
    const userRef = db.collection('users').doc(currentUser);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return false;

    const data = userDoc.data();
    const lastClaim = data.lastDailyBonus?.toMillis() || 0;
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (now - lastClaim < dayInMs) {
      const hoursLeft = Math.ceil((dayInMs - (now - lastClaim)) / (60 * 60 * 1000));
      throw new Error(`Daily bonus already claimed. Available in ${hoursLeft} hours`);
    }

    await userRef.update({
      credits: firebase.firestore.FieldValue.increment(ECONOMY_CONFIG.dailyBonus),
      lastDailyBonus: firebase.firestore.FieldValue.serverTimestamp()
    });

    showEconomyNotification(`Daily Bonus: +${ECONOMY_CONFIG.dailyBonus.toLocaleString()} credits!`);

    return true;

  } catch (error) {
    console.error('Daily bonus error:', error);
    throw error;
  }
}

/**
 * Grant login bonus to new users
 * @param {string} username - Username
 */
async function grantLoginBonus(username) {
  try {
    const userRef = db.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return;

    const data = userDoc.data();
    
    // Only grant once
    if (data.loginBonusGranted) return;

    await userRef.update({
      credits: firebase.firestore.FieldValue.increment(ECONOMY_CONFIG.loginBonus),
      loginBonusGranted: true
    });

    showEconomyNotification(`Welcome Bonus: +${ECONOMY_CONFIG.loginBonus.toLocaleString()} credits!`);

  } catch (error) {
    console.error('Login bonus error:', error);
  }
}

/**
 * Grant voting reward
 */
async function grantVotingReward() {
  const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
  if (!currentUser) return;

  try {
    await db.collection('users')
      .doc(currentUser)
      .update({
        credits: firebase.firestore.FieldValue.increment(ECONOMY_CONFIG.votingReward)
      });

    showEconomyNotification(`Voting Reward: +${ECONOMY_CONFIG.votingReward.toLocaleString()} credits!`);

  } catch (error) {
    console.error('Voting reward error:', error);
  }
}

// ============================================
// TITLE MANAGEMENT
// ============================================

/**
 * Update user title based on votes/credits
 * @param {string} username - Username to update
 */
async function updateUserTitle(username) {
  try {
    const userRef = db.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return;

    const data = userDoc.data();
    const votes = data.totalVotesReceived || 0;
    const credits = data.credits || 0;

    let newTitle = 'Commoner';

    // Title hierarchy based on votes
    if (votes >= 100) newTitle = 'Legend';
    else if (votes >= 50) newTitle = 'Elite';
    else if (votes >= 25) newTitle = 'Noble';
    else if (votes >= 10) newTitle = 'Knight';
    else if (votes >= 5) newTitle = 'Squire';

    // Bonus titles for wealth
    if (credits >= 1000000) newTitle = 'Tycoon';
    else if (credits >= 500000 && newTitle === 'Legend') newTitle = 'Magnate';

    // Only update if changed
    if (newTitle !== data.title) {
      await userRef.update({ title: newTitle });
      
      // Notify if current user
      const currentUser = getCurrentUser ? getCurrentUser() : localStorage.getItem('pyramidUser');
      if (username === currentUser) {
        showEconomyNotification(`Title Updated: ${newTitle}!`);
      }
    }

  } catch (error) {
    console.error('Update title error:', error);
  }
}

// ============================================
// LEADERBOARD
// ============================================

/**
 * Get top users by credits
 * @param {number} limit - Number of users to fetch
 * @returns {Promise<Array>}
 */
async function getWealthLeaderboard(limit = 10) {
  try {
    const snapshot = await db.collection('users')
      .orderBy('credits', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      username: doc.id,
      ...doc.data()
    }));

  } catch (error) {
    console.error('Leaderboard error:', error);
    return [];
  }
}

/**
 * Get user rank by credits
 * @param {string} username - Username
 * @returns {Promise<number>}
 */
async function getUserRank(username) {
  try {
    const userDoc = await db.collection('users').doc(username).get();
    
    if (!userDoc.exists) return -1;

    const userCredits = userDoc.data().credits || 0;

    const snapshot = await db.collection('users')
      .where('credits', '>', userCredits)
      .get();

    return snapshot.size + 1;

  } catch (error) {
    console.error('Get rank error:', error);
    return -1;
  }
}

// ============================================
// UI NOTIFICATIONS
// ============================================

/**
 * Show economy notification
 * @param {string} message - Notification message
 */
function showEconomyNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-20 right-4 bg-gradient-to-r from-[#d4af37] to-[#f0c85a] text-black px-6 py-3 rounded-lg shadow-2xl z-[9999] font-bold';
  notification.style.minWidth = '250px';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl">💰</span>
      <div class="text-sm">${message}</div>
    </div>
  `;

  document.body.appendChild(notification);

  // Animate in
  notification.style.transform = 'translateX(400px)';
  notification.style.transition = 'transform 0.3s ease';
  
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);

  // Auto-remove
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Format credits with commas
 * @param {number} amount - Amount to format
 * @returns {string}
 */
function formatCredits(amount) {
  return amount.toLocaleString();
}

/**
 * Calculate transaction fee
 * @param {number} amount - Transaction amount
 * @returns {number}
 */
function calculateFee(amount) {
  return Math.floor(amount * ECONOMY_CONFIG.transactionFee);
}

// ============================================
// INITIALIZATION
// ============================================

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEconomy);
} else {
  initEconomy();
}

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    transferCredits,
    claimDailyBonus,
    grantLoginBonus,
    grantVotingReward,
    updateUserTitle,
    getWealthLeaderboard,
    getUserRank,
    initEconomy
  };
}

// Make functions globally accessible
window.transferCredits = transferCredits;
window.claimDailyBonus = claimDailyBonus;
window.grantVotingReward = grantVotingReward;
window.updateUserTitle = updateUserTitle;
window.formatCredits = formatCredits;
