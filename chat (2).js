/**
 * chat.js - Enhanced Chat & Gift System
 * 
 * Features:
 * - Real-time messaging with proper event handling
 * - Title badges in chat messages
 * - Gift sending with visual effects
 * - Typing indicators
 * - Message animations
 * 
 * @version 3.0.0
 */

'use strict';

// ============================================
// GIFT CATALOG
// ============================================

const GIFT_CATALOG = {
  Rose: { icon: '🌹', price: 1000, tier: 'common' },
  Bouquet: { icon: '💐', price: 2000, tier: 'common' },
  Phone: { icon: '📱', price: 5000, tier: 'uncommon' },
  Cycle: { icon: '🚲', price: 10000, tier: 'uncommon' },
  Scooty: { icon: '🛵', price: 20000, tier: 'rare' },
  Laptop: { icon: '💻', price: 30000, tier: 'rare' },
  Bike: { icon: '🏍️', price: 50000, tier: 'epic' },
  Car: { icon: '🚗', price: 75000, tier: 'epic' },
  Lamborghini: { icon: '🏎️', price: 100000, tier: 'legendary' },
  Ferrari: { icon: '🏎️', price: 125000, tier: 'legendary' },
  'Rolls Royce': { icon: '🚙', price: 150000, tier: 'legendary' },
  'Private Jet': { icon: '✈️', price: 300000, tier: 'mythic' },
  'Bag of Cash': { icon: '💰', price: 500000, tier: 'mythic' }
};

// Title tier colors
const TITLE_COLORS = {
  'Tycoon': 'bg-gradient-to-r from-yellow-400 to-orange-500',
  'Magnate': 'bg-gradient-to-r from-yellow-400 to-orange-500',
  'Legend': 'bg-gradient-to-r from-yellow-400 to-orange-500',
  'Elite': 'bg-gradient-to-r from-purple-500 to-pink-500',
  'Noble': 'bg-gradient-to-r from-cyan-500 to-blue-500',
  'Knight': 'bg-gradient-to-r from-cyan-500 to-blue-500',
  'Squire': 'bg-gradient-to-r from-gray-500 to-gray-600',
  'Commoner': 'bg-gradient-to-r from-gray-600 to-gray-700'
};

const CHAT_CONFIG = {
  maxMessageLength: 500,
  maxMessagesDisplay: 100,
  typingTimeout: 3000,
  messageRateLimit: 1000
};

// ============================================
// STATE MANAGEMENT
// ============================================

const ChatState = {
  currentUser: null,
  isInitialized: false,
  unsubscribers: [],
  lastMessageTime: 0,
  typingTimer: null,
  messagesListener: null
};

// ============================================
// INITIALIZATION
// ============================================

async function initChat() {
  if (ChatState.isInitialized) {
    console.warn('Chat already initialized');
    return;
  }
  
  if (typeof db === 'undefined') {
    console.error('Firebase not initialized');
    return;
  }
  
  ChatState.currentUser = localStorage.getItem('pyramidUser');
  
  if (!ChatState.currentUser) {
    console.warn('No user logged in');
  }
  
  try {
    await Promise.all([
      initializeMessageListener(),
      initializeInputHandlers(),
      initializeTypingIndicator()
    ]);
    
    ChatState.isInitialized = true;
    console.log('✅ Chat system initialized');
    
  } catch (error) {
    console.error('Chat initialization failed:', error);
  }
}

function cleanupChat() {
  ChatState.unsubscribers.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  });
  
  if (ChatState.messagesListener) {
    ChatState.messagesListener();
  }
  
  ChatState.unsubscribers = [];
  ChatState.isInitialized = false;
  
  console.log('Chat cleaned up');
}

// ============================================
// MESSAGE LISTENER
// ============================================

function initializeMessageListener() {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;

  // Listen to messages in real-time
  const unsubscribe = db.collection('messages')
    .orderBy('time', 'desc')
    .limit(CHAT_CONFIG.maxMessagesDisplay)
    .onSnapshot(
      (snapshot) => {
        chatBox.innerHTML = '';
        
        const messages = [];
        snapshot.forEach(doc => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        
        // Reverse to show oldest first
        messages.reverse().forEach(msg => {
          const messageEl = createMessageElement(msg);
          chatBox.appendChild(messageEl);
        });
        
        // Auto scroll to bottom
        chatBox.scrollTop = chatBox.scrollHeight;
      },
      (error) => {
        console.error('Message listener error:', error);
        chatBox.innerHTML = '<div class="text-center text-red-500 py-4">Failed to load messages</div>';
      }
    );

  ChatState.messagesListener = unsubscribe;
  ChatState.unsubscribers.push(unsubscribe);
}

/**
 * Create message element with enhanced styling
 */
function createMessageElement(message) {
  const messageDiv = document.createElement('div');
  const currentUser = ChatState.currentUser;
  
  // Message type handling
  if (message.type === 'GIFT') {
    return createGiftMessage(message);
  }
  
  if (message.user === 'SYSTEM') {
    return createSystemMessage(message);
  }
  
  // Regular message
  const isOwn = message.user === currentUser;
  messageDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;
  
  // Message header with title badge
  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 mb-1';
  
  const userName = document.createElement('span');
  userName.className = `font-semibold text-sm ${isOwn ? 'text-purple-300' : 'text-white'}`;
  userName.textContent = message.user;
  
  // Add title badge
  const titleBadge = document.createElement('span');
  const userTitle = message.title || 'Commoner';
  const titleColor = TITLE_COLORS[userTitle] || TITLE_COLORS['Commoner'];
  titleBadge.className = `${titleColor} text-white text-[8px] px-2 py-0.5 rounded-full font-bold uppercase`;
  titleBadge.textContent = userTitle;
  
  const timestamp = document.createElement('span');
  timestamp.className = 'text-[9px] text-zinc-500 ml-auto';
  timestamp.textContent = formatTime(message.time);
  
  header.appendChild(userName);
  header.appendChild(titleBadge);
  header.appendChild(timestamp);
  
  // Message content
  const content = document.createElement('div');
  content.className = 'text-sm text-white break-words';
  content.textContent = message.text;
  
  messageDiv.appendChild(header);
  messageDiv.appendChild(content);
  
  return messageDiv;
}

/**
 * Create system message element
 */
function createSystemMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message system';
  
  const icon = document.createElement('span');
  icon.className = 'text-lg mr-2';
  icon.textContent = '📢';
  
  const text = document.createElement('span');
  text.className = 'text-sm';
  text.textContent = message.text;
  
  messageDiv.appendChild(icon);
  messageDiv.appendChild(text);
  
  return messageDiv;
}

/**
 * Create gift message element
 */
function createGiftMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message gift';
  
  const giftData = GIFT_CATALOG[message.giftName];
  if (!giftData) {
    messageDiv.textContent = `${message.user} sent a gift to ${message.target}`;
    return messageDiv;
  }
  
  const icon = document.createElement('span');
  icon.className = 'text-3xl mr-2 animate-bounce';
  icon.textContent = giftData.icon;
  
  const text = document.createElement('div');
  text.className = 'text-sm';
  text.innerHTML = `
    <span class="font-bold">${sanitizeText(message.user)}</span>
    <span class="text-pink-300"> sent </span>
    <span class="font-bold text-yellow-300">${message.giftName}</span>
    <span class="text-pink-300"> to </span>
    <span class="font-bold">${sanitizeText(message.target)}</span>
  `;
  
  messageDiv.appendChild(icon);
  messageDiv.appendChild(text);
  
  return messageDiv;
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) {
    return '';
  }
}

/**
 * Sanitize text to prevent XSS
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// INPUT HANDLERS
// ============================================

function initializeInputHandlers() {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-chat');
  
  if (!chatInput || !sendButton) {
    console.warn('Chat UI elements not found');
    return;
  }
  
  // Send button click
  sendButton.addEventListener('click', handleSendMessage);
  
  // Enter key to send
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  // Typing indicator
  chatInput.addEventListener('input', () => {
    updateTypingStatus(true);
    
    clearTimeout(ChatState.typingTimer);
    ChatState.typingTimer = setTimeout(() => {
      updateTypingStatus(false);
    }, CHAT_CONFIG.typingTimeout);
  });
  
  console.log('✅ Input handlers initialized');
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  
  const text = input.value.trim();
  
  if (!text) return;
  
  if (text.length > CHAT_CONFIG.maxMessageLength) {
    showError(`Message too long. Maximum ${CHAT_CONFIG.maxMessageLength} characters.`);
    return;
  }
  
  // Rate limiting
  const now = Date.now();
  if (now - ChatState.lastMessageTime < CHAT_CONFIG.messageRateLimit) {
    showError('Please wait a moment before sending another message.');
    return;
  }
  
  try {
    await sendMessage(text);
    input.value = '';
    ChatState.lastMessageTime = now;
    updateTypingStatus(false);
  } catch (error) {
    console.error('Send message error:', error);
    showError(error.message || 'Failed to send message');
  }
}

/**
 * Send a message to Firestore
 */
async function sendMessage(text) {
  if (!ChatState.currentUser) {
    throw new Error('Not authenticated');
  }
  
  if (!text || text.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  // Get user's title
  const userDoc = await db.collection('users').doc(ChatState.currentUser).get();
  const userTitle = userDoc.exists ? (userDoc.data().title || 'Commoner') : 'Commoner';
  
  await db.collection('messages').add({
    user: ChatState.currentUser,
    title: userTitle,
    text: sanitizeText(text),
    type: 'MSG',
    time: Date.now()
  });
  
  console.log('Message sent:', text);
}

// ============================================
// TYPING INDICATOR
// ============================================

function initializeTypingIndicator() {
  if (!ChatState.currentUser) return;
  
  // Listen for typing status from other users
  const unsubscribe = db.collection('status')
    .onSnapshot((snapshot) => {
      const typingUsers = [];
      
      snapshot.forEach(doc => {
        if (doc.id !== ChatState.currentUser) {
          const data = doc.data();
          if (data.typing && data.timestamp) {
            const timeDiff = Date.now() - data.timestamp.toMillis();
            if (timeDiff < CHAT_CONFIG.typingTimeout) {
              typingUsers.push(doc.id);
            }
          }
        }
      });
      
      updateTypingDisplay(typingUsers);
    });
  
  ChatState.unsubscribers.push(unsubscribe);
}

function updateTypingStatus(isTyping) {
  if (!ChatState.currentUser) return;
  
  db.collection('status')
    .doc(ChatState.currentUser)
    .set({
      typing: isTyping,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    .catch(error => {
      console.error('Update typing status error:', error);
    });
}

function updateTypingDisplay(users) {
  const indicator = document.getElementById('typing-indicator');
  if (!indicator) return;
  
  if (users.length > 0) {
    indicator.textContent = users.length === 1 
      ? `${users[0]} is typing...` 
      : `${users.length} people are typing...`;
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }
}

// ============================================
// GIFT SYSTEM
// ============================================

/**
 * Open gift modal for a user
 */
function openGiftModal(targetUser) {
  if (!ChatState.currentUser) {
    showError('You must be logged in to send gifts');
    return;
  }
  
  if (targetUser === ChatState.currentUser) {
    showError('You cannot send gifts to yourself');
    return;
  }
  
  createGiftModal(targetUser);
}

/**
 * Create gift selection modal
 */
function createGiftModal(targetUser) {
  // Remove existing modal if any
  const existing = document.getElementById('gift-modal-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'gift-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[10000] p-4';
  overlay.onclick = (e) => {
    if (e.target === overlay) closeGiftModal();
  };
  
  const modal = document.createElement('div');
  modal.className = 'glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-3xl';
  modal.onclick = (e) => e.stopPropagation();
  
  // Header
  const header = document.createElement('div');
  header.className = 'mb-6';
  header.innerHTML = `
    <div class="flex justify-between items-center">
      <div>
        <h2 class="cinzel text-2xl gradient-text font-bold">Send a Gift</h2>
        <p class="text-sm text-zinc-400 mt-1">To: <span class="font-bold text-white">${sanitizeText(targetUser)}</span></p>
      </div>
      <button onclick="closeGiftModal()" class="text-3xl text-zinc-400 hover:text-white transition-colors">×</button>
    </div>
  `;
  modal.appendChild(header);
  
  // Gift grid
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6';
  
  Object.entries(GIFT_CATALOG).forEach(([giftName, giftData]) => {
    const card = createGiftCard(giftName, giftData, targetUser);
    grid.appendChild(card);
  });
  
  modal.appendChild(grid);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/**
 * Create gift card element
 */
function createGiftCard(giftName, giftData, targetUser) {
  const card = document.createElement('button');
  card.className = 'glass-card p-4 rounded-2xl hover:border-[#FFD700] transition-all flex flex-col items-center gap-2 group';
  
  const icon = document.createElement('div');
  icon.className = 'text-5xl group-hover:scale-125 transition-transform';
  icon.textContent = giftData.icon;
  
  const name = document.createElement('div');
  name.className = 'font-bold text-sm text-white';
  name.textContent = giftName;
  
  const price = document.createElement('div');
  price.className = 'text-xs text-zinc-400';
  price.textContent = `${giftData.price.toLocaleString()} CR`;
  
  const tier = document.createElement('div');
  tier.className = 'text-[10px] uppercase tracking-wider font-bold';
  
  const tierColors = {
    common: 'text-gray-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
    mythic: 'text-red-400'
  };
  tier.className += ' ' + (tierColors[giftData.tier] || tierColors.common);
  tier.textContent = giftData.tier;
  
  card.appendChild(icon);
  card.appendChild(name);
  card.appendChild(price);
  card.appendChild(tier);
  
  card.onclick = () => confirmAndSendGift(ChatState.currentUser, targetUser, giftName, giftData.price);
  
  return card;
}

/**
 * Confirm and send gift
 */
async function confirmAndSendGift(sender, recipient, giftName, price) {
  const confirmed = confirm(
    `Send ${giftName} (${price.toLocaleString()} CR) to ${recipient}?\n\nThis cannot be undone.`
  );
  
  if (!confirmed) return;
  
  closeGiftModal();
  
  try {
    await executeGiftTransaction(sender, recipient, giftName, price);
    showSuccess(`Gift sent successfully!`);
  } catch (error) {
    console.error('Gift error:', error);
    showError(error.message || 'Failed to send gift');
  }
}

/**
 * Execute gift transaction
 */
async function executeGiftTransaction(sender, recipient, giftName, price) {
  const senderRef = db.collection('users').doc(sender);
  const recipientRef = db.collection('users').doc(recipient);
  
  await db.runTransaction(async (transaction) => {
    const senderDoc = await transaction.get(senderRef);
    const recipientDoc = await transaction.get(recipientRef);
    
    if (!senderDoc.exists) throw new Error('Sender not found');
    if (!recipientDoc.exists) throw new Error('Recipient not found');
    
    const senderCredits = senderDoc.data().credits || 0;
    const recipientCredits = recipientDoc.data().credits || 0;
    
    if (senderCredits < price) {
      throw new Error(`Insufficient credits. You have ${senderCredits.toLocaleString()}, need ${price.toLocaleString()}`);
    }
    
    transaction.update(senderRef, {
      credits: senderCredits - price,
      lastGiftSent: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    transaction.update(recipientRef, {
      credits: recipientCredits + price,
      lastGiftReceived: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  
  // Record gift in chat
  await db.collection('messages').add({
    user: sender,
    target: recipient,
    giftName: giftName,
    type: 'GIFT',
    time: Date.now()
  });
}

function closeGiftModal() {
  const overlay = document.getElementById('gift-modal-overlay');
  if (overlay) overlay.remove();
}

// ============================================
// NOTIFICATIONS
// ============================================

function showError(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-24 right-4 glass-card border-2 border-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] max-w-sm';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl">❌</span>
      <div class="text-sm">${sanitizeText(message)}</div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(400px)';
    
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function showSuccess(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-24 right-4 glass-card border-2 border-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] max-w-sm';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl">✅</span>
      <div class="text-sm">${sanitizeText(message)}</div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(400px)';
    
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// INITIALIZATION
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initChat().catch(error => {
      console.error('Chat init failed:', error);
    });
  });
} else {
  initChat().catch(error => {
    console.error('Chat init failed:', error);
  });
}

window.addEventListener('beforeunload', cleanupChat);

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initChat,
    cleanupChat,
    sendMessage,
    openGiftModal
  };
}

// Make functions globally accessible
window.openGiftModal = openGiftModal;
window.closeGiftModal = closeGiftModal;
window.sendMessage = sendMessage;
