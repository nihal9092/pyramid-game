/**
 * chat.js - Enhanced Chat & Gift System
 * 
 * Features:
 * - Real-time messaging with typing indicators
 * - Gift sending system with animations
 * - XSS prevention with proper sanitization
 * - Robust error handling and recovery
 * - Performance optimizations
 * - Accessibility improvements
 * - User voting status indicators
 * 
 * @version 2.0.0
 */

'use strict';

// ============================================
// CONFIGURATION & CONSTANTS
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

const SOUND_EFFECTS = {
  message: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  giftCommon: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  giftRare: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  system: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'
};

const CHAT_CONFIG = {
  maxMessageLength: 500,
  maxMessagesDisplay: 50,
  typingTimeout: 3000,
  statusUpdateDebounce: 500,
  messageRateLimit: 1000, // 1 message per second
  animationDuration: 300
};

// ============================================
// STATE MANAGEMENT
// ============================================

const ChatState = {
  currentUser: null,
  isInitialized: false,
  unsubscribers: [],
  lastMessageTime: 0,
  audioCache: new Map(),
  userCache: new Map(),
  typingTimer: null
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitize text input to prevent XSS attacks
 * @param {string} text - Raw text input
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate consistent color for user based on name
 * @param {string} name - User name
 * @returns {string} HSL color string
 */
function getUserColor(name) {
  if (!name || typeof name !== 'string') return '#9ca3af';
  if (name === 'SYSTEM') return '#d4af37';
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  const saturation = 70 + (Math.abs(hash % 20));
  const lightness = 55 + (Math.abs(hash % 15));
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Debounce function to limit execution rate
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format timestamp to readable time
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time string
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Time formatting error:', error);
    return '';
  }
}

/**
 * Create and cache audio element
 * @param {string} url - Audio file URL
 * @returns {HTMLAudioElement|null}
 */
function getAudioElement(url) {
  if (!url) return null;
  
  if (ChatState.audioCache.has(url)) {
    return ChatState.audioCache.get(url);
  }
  
  try {
    const audio = new Audio(url);
    audio.volume = 0.5;
    ChatState.audioCache.set(url, audio);
    return audio;
  } catch (error) {
    console.warn('Audio creation failed:', error);
    return null;
  }
}

/**
 * Play sound effect safely
 * @param {string} soundKey - Key from SOUND_EFFECTS
 */
function playSoundEffect(soundKey) {
  const url = SOUND_EFFECTS[soundKey];
  if (!url) return;
  
  const audio = getAudioElement(url);
  if (!audio) return;
  
  audio.currentTime = 0;
  audio.play().catch(error => {
    console.debug('Audio playback prevented:', error);
  });
}

/**
 * Check if user has required permissions
 * @returns {boolean}
 */
function hasPermissions() {
  return typeof db !== 'undefined' && ChatState.currentUser;
}

// ============================================
// CHAT INITIALIZATION
// ============================================

/**
 * Initialize chat system
 */
async function initChat() {
  if (ChatState.isInitialized) {
    console.warn('Chat already initialized');
    return;
  }
  
  // Verify dependencies
  if (typeof db === 'undefined') {
    console.error('Firebase Firestore not initialized. Ensure Firebase loads before chat.js');
    return;
  }
  
  // Get current user
  ChatState.currentUser = localStorage.getItem('pyramidUser');
  
  if (!ChatState.currentUser) {
    console.warn('No user logged in. Chat features limited.');
    // Still initialize UI for viewing
  }
  
  try {
    // Initialize components
    await Promise.all([
      initializeTypingIndicator(),
      initializeMessageListener(),
      initializeInputHandlers(),
      initializeGiftSystem()
    ]);
    
    ChatState.isInitialized = true;
    console.log('Chat system initialized successfully');
    
  } catch (error) {
    console.error('Chat initialization failed:', error);
    showError('Failed to initialize chat. Please refresh the page.');
  }
}

/**
 * Clean up chat resources
 */
function cleanupChat() {
  // Unsubscribe from all listeners
  ChatState.unsubscribers.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  });
  
  // Clear state
  ChatState.unsubscribers = [];
  ChatState.isInitialized = false;
  ChatState.userCache.clear();
  ChatState.audioCache.clear();
  
  console.log('Chat cleaned up');
}

// ============================================
// TYPING INDICATOR
// ============================================

/**
 * Initialize typing indicator system
 */
function initializeTypingIndicator() {
  if (!ChatState.currentUser) return;
  
  const chatInput = document.getElementById('chat-input');
  if (!chatInput) return;
  
  // Debounced typing status update
  const updateTypingStatus = debounce((isTyping) => {
    if (!hasPermissions()) return;
    
    db.collection('status')
      .doc(ChatState.currentUser)
      .set({
        typing: isTyping,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      .catch(error => {
        console.error('Failed to update typing status:', error);
      });
  }, CHAT_CONFIG.statusUpdateDebounce);
  
  // Input event listener
  chatInput.addEventListener('input', () => {
    updateTypingStatus(true);
    
    // Clear existing timer
    if (ChatState.typingTimer) {
      clearTimeout(ChatState.typingTimer);
    }
    
    // Set timer to clear typing status
    ChatState.typingTimer = setTimeout(() => {
      updateTypingStatus(false);
    }, CHAT_CONFIG.typingTimeout);
  });
  
  // Clear typing on blur
  chatInput.addEventListener('blur', () => {
    updateTypingStatus(false);
    if (ChatState.typingTimer) {
      clearTimeout(ChatState.typingTimer);
    }
  });
  
  // Listen for other users typing
  const unsubscribe = db.collection('status').onSnapshot(snapshot => {
    const typingUsers = [];
    const now = Date.now();
    
    snapshot.forEach(doc => {
      if (doc.id === ChatState.currentUser) return;
      
      const data = doc.data();
      if (!data) return;
      
      const timestamp = data.timestamp?.toMillis() || 0;
      const isRecent = (now - timestamp) < CHAT_CONFIG.typingTimeout;
      
      if (data.typing && isRecent) {
        typingUsers.push(doc.id);
      }
    });
    
    // Update display
    const displayEl = document.getElementById('typing-indicator') || 
                      document.getElementById('typing-display');
    
    if (displayEl) {
      if (typingUsers.length === 0) {
        displayEl.textContent = '';
        displayEl.classList.add('hidden');
      } else {
        const names = typingUsers.slice(0, 3).join(', ');
        const extra = typingUsers.length > 3 ? ` and ${typingUsers.length - 3} more` : '';
        displayEl.textContent = `${names}${extra} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`;
        displayEl.classList.remove('hidden');
      }
    }
  }, error => {
    console.error('Typing status listener error:', error);
  });
  
  ChatState.unsubscribers.push(unsubscribe);
}

// ============================================
// MESSAGE HANDLING
// ============================================

/**
 * Initialize real-time message listener
 */
function initializeMessageListener() {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) {
    console.error('Chat box element not found');
    return;
  }
  
  let isFirstLoad = true;
  
  const unsubscribe = db.collection('messages')
    .orderBy('time', 'desc')
    .limit(CHAT_CONFIG.maxMessagesDisplay)
    .onSnapshot(snapshot => {
      // Handle new messages (skip on first load)
      if (!isFirstLoad) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            handleNewMessage(change.doc.data());
          }
        });
      }
      
      // Render all messages
      renderMessages(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
      
      isFirstLoad = false;
      
    }, error => {
      console.error('Message listener error:', error);
      showError('Failed to load messages. Please refresh the page.');
    });
  
  ChatState.unsubscribers.push(unsubscribe);
}

/**
 * Handle new incoming message
 * @param {Object} message - Message data
 */
function handleNewMessage(message) {
  if (!message) return;
  
  // Play appropriate sound
  if (message.type === 'GIFT') {
    const giftData = GIFT_CATALOG[message.giftName];
    const tier = giftData?.tier || 'common';
    
    if (['mythic', 'legendary'].includes(tier)) {
      playSoundEffect('giftRare');
    } else {
      playSoundEffect('giftCommon');
    }
    
    // Show gift notification
    if (giftData) {
      showGiftNotification(message);
    }
    
  } else if (message.user === 'SYSTEM') {
    playSoundEffect('system');
    
  } else if (message.user !== ChatState.currentUser) {
    playSoundEffect('message');
  }
}

/**
 * Render messages to chat box
 * @param {Array} messages - Array of message objects
 */
function renderMessages(messages) {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;
  
  // Store scroll position
  const wasScrolledToBottom = 
    chatBox.scrollHeight - chatBox.scrollTop <= chatBox.clientHeight + 100;
  
  // Clear and render
  chatBox.innerHTML = '';
  
  // Reverse to show oldest first
  const sortedMessages = [...messages].reverse();
  
  sortedMessages.forEach(message => {
    const messageEl = createMessageElement(message);
    if (messageEl) {
      chatBox.appendChild(messageEl);
    }
  });
  
  // Auto-scroll to bottom if user was already there
  if (wasScrolledToBottom) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

/**
 * Create message DOM element
 * @param {Object} message - Message data
 * @returns {HTMLElement|null}
 */
function createMessageElement(message) {
  if (!message) return null;
  
  if (message.type === 'GIFT') {
    return createGiftMessageElement(message);
  } else {
    return createTextMessageElement(message);
  }
}

/**
 * Create text message element
 * @param {Object} message - Message data
 * @returns {HTMLElement}
 */
function createTextMessageElement(message) {
  const container = document.createElement('div');
  container.className = 'message-container flex flex-col mb-4';
  container.dataset.messageId = message.id || '';
  
  // Header (username + timestamp + actions)
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-2';
  
  const userInfo = document.createElement('div');
  userInfo.className = 'flex items-center gap-2';
  
  const username = document.createElement('span');
  username.className = 'font-bold text-xs uppercase tracking-wide';
  username.style.color = getUserColor(message.user);
  username.textContent = sanitizeText(message.user || 'Unknown');
  
  // Add voting star indicator
  if (message.user && message.user !== 'SYSTEM') {
    fetchUserVotingStatus(message.user).then(hasVoted => {
      if (hasVoted) {
        const star = document.createElement('span');
        star.textContent = '⭐';
        star.title = 'Has voted this week';
        star.className = 'text-xs';
        username.appendChild(star);
      }
    });
  }
  
  userInfo.appendChild(username);
  
  // Timestamp
  if (message.time) {
    const timestamp = document.createElement('span');
    timestamp.className = 'text-[10px] text-zinc-500';
    timestamp.textContent = formatTime(message.time);
    userInfo.appendChild(timestamp);
  }
  
  header.appendChild(userInfo);
  
  // Gift button (if not own message)
  if (message.user !== ChatState.currentUser && message.user !== 'SYSTEM') {
    const giftBtn = document.createElement('button');
    giftBtn.className = 'text-[10px] px-3 py-1 border border-zinc-700 rounded hover:border-[#d4af37] transition-all';
    giftBtn.textContent = '🎁 Gift';
    giftBtn.onclick = () => openGiftModal(message.user);
    header.appendChild(giftBtn);
  }
  
  container.appendChild(header);
  
  // Message content
  const content = document.createElement('div');
  content.className = 'px-3 py-2 rounded-lg';
  content.style.borderLeft = `4px solid ${getUserColor(message.user)}`;
  content.style.background = message.user === ChatState.currentUser 
    ? 'rgba(212, 175, 55, 0.1)' 
    : 'rgba(255, 255, 255, 0.05)';
  
  const text = document.createElement('div');
  text.className = 'text-sm text-zinc-200';
  text.textContent = sanitizeText(message.text || '');
  
  content.appendChild(text);
  container.appendChild(content);
  
  return container;
}

/**
 * Create gift message element
 * @param {Object} message - Gift message data
 * @returns {HTMLElement}
 */
function createGiftMessageElement(message) {
  const container = document.createElement('div');
  container.className = 'gift-message flex flex-col items-center my-6 p-4 border-y border-[#d4af37]/20';
  container.dataset.messageId = message.id || '';
  
  const giftData = GIFT_CATALOG[message.giftName];
  if (!giftData) return container;
  
  // Gift icon
  const icon = document.createElement('div');
  icon.className = 'text-4xl mb-2 animate-bounce';
  icon.textContent = giftData.icon;
  
  // Label
  const label = document.createElement('div');
  label.className = 'text-[10px] text-[#d4af37] uppercase font-bold tracking-widest mb-2';
  label.textContent = 'Sovereign Gift';
  
  // Gift details
  const details = document.createElement('div');
  details.className = 'text-sm text-center text-zinc-200';
  
  const sender = document.createElement('span');
  sender.style.color = getUserColor(message.user);
  sender.className = 'font-bold';
  sender.textContent = sanitizeText(message.user || 'Unknown');
  
  const giftName = document.createElement('span');
  giftName.className = 'font-bold text-[#d4af37] mx-1';
  giftName.textContent = sanitizeText(message.giftName);
  
  const recipient = document.createElement('span');
  recipient.style.color = getUserColor(message.target);
  recipient.className = 'font-bold';
  recipient.textContent = sanitizeText(message.target || 'Unknown');
  
  details.appendChild(sender);
  details.appendChild(document.createTextNode(' gifted '));
  details.appendChild(giftName);
  details.appendChild(document.createTextNode(' to '));
  details.appendChild(recipient);
  
  container.appendChild(icon);
  container.appendChild(label);
  container.appendChild(details);
  
  return container;
}

/**
 * Fetch user voting status (with caching)
 * @param {string} username - Username to check
 * @returns {Promise<boolean>}
 */
async function fetchUserVotingStatus(username) {
  if (!username || username === 'SYSTEM') return false;
  
  // Check cache first
  if (ChatState.userCache.has(username)) {
    const cached = ChatState.userCache.get(username);
    const age = Date.now() - cached.timestamp;
    
    // Use cache if less than 1 minute old
    if (age < 60000) {
      return cached.hasVoted;
    }
  }
  
  try {
    const userDoc = await db.collection('users').doc(username).get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    const votesRemaining = userData.votesRemaining ?? 3;
    const hasVoted = votesRemaining < 3;
    
    // Cache result
    ChatState.userCache.set(username, {
      hasVoted,
      timestamp: Date.now()
    });
    
    return hasVoted;
    
  } catch (error) {
    console.debug('Failed to fetch voting status:', error);
    return false;
  }
}

// ============================================
// INPUT HANDLING
// ============================================

/**
 * Initialize input handlers
 */
function initializeInputHandlers() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat') || 
                  document.getElementById('send-btn') ||
                  document.getElementById('sendButton');
  
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
}

/**
 * Send a text message
 */
async function sendMessage() {
  if (!hasPermissions()) {
    showError('You must be logged in to send messages.');
    return;
  }
  
  const chatInput = document.getElementById('chat-input');
  if (!chatInput) return;
  
  const text = chatInput.value.trim();
  
  // Validation
  if (!text) return;
  
  if (text.length > CHAT_CONFIG.maxMessageLength) {
    showError(`Message too long. Maximum ${CHAT_CONFIG.maxMessageLength} characters.`);
    return;
  }
  
  // Rate limiting
  const now = Date.now();
  if (now - ChatState.lastMessageTime < CHAT_CONFIG.messageRateLimit) {
    showError('Please wait before sending another message.');
    return;
  }
  
  try {
    // Send message
    await db.collection('messages').add({
      user: ChatState.currentUser,
      text: sanitizeText(text),
      type: 'MSG',
      time: Date.now()
    });
    
    // Clear input
    chatInput.value = '';
    ChatState.lastMessageTime = now;
    
    // Clear typing status
    await db.collection('status')
      .doc(ChatState.currentUser)
      .set({ typing: false }, { merge: true });
    
  } catch (error) {
    console.error('Send message error:', error);
    showError('Failed to send message. Please try again.');
  }
}

// ============================================
// GIFT SYSTEM
// ============================================

/**
 * Initialize gift system
 */
function initializeGiftSystem() {
  // Expose global function for backwards compatibility
  window.openGiftMenu = openGiftModal;
}

/**
 * Open gift selection modal
 * @param {string} targetUser - Recipient username
 */
function openGiftModal(targetUser) {
  if (!hasPermissions()) {
    showError('You must be logged in to send gifts.');
    return;
  }
  
  if (targetUser === ChatState.currentUser) {
    showError('You cannot send gifts to yourself.');
    return;
  }
  
  // Prevent duplicate modals
  const existing = document.getElementById('gift-modal-overlay');
  if (existing) {
    existing.remove();
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'gift-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]';
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      closeGiftModal();
    }
  };
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'bg-[#0b1220] border border-[#d4af37]/20 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto';
  modal.onclick = (e) => e.stopPropagation();
  
  // Header
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  
  const title = document.createElement('h3');
  title.className = 'text-xl font-bold text-[#d4af37]';
  title.textContent = 'Send a Gift';
  
  const subtitle = document.createElement('span');
  subtitle.className = 'text-sm text-zinc-400 ml-2';
  subtitle.textContent = `to ${sanitizeText(targetUser)}`;
  
  title.appendChild(subtitle);
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-zinc-400 hover:text-white text-2xl leading-none';
  closeBtn.textContent = '×';
  closeBtn.onclick = closeGiftModal;
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);
  
  // Gift grid
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6';
  
  Object.entries(GIFT_CATALOG).forEach(([giftName, giftData]) => {
    const card = createGiftCard(giftName, giftData, targetUser);
    grid.appendChild(card);
  });
  
  modal.appendChild(grid);
  
  // Footer
  const footer = document.createElement('div');
  footer.className = 'flex justify-end gap-3';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'px-6 py-2 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-all';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = closeGiftModal;
  
  footer.appendChild(cancelBtn);
  modal.appendChild(footer);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/**
 * Create gift card element
 * @param {string} giftName - Name of the gift
 * @param {Object} giftData - Gift data object
 * @param {string} targetUser - Recipient username
 * @returns {HTMLElement}
 */
function createGiftCard(giftName, giftData, targetUser) {
  const card = document.createElement('button');
  card.className = 'p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-[#d4af37] transition-all flex flex-col items-center gap-2 group';
  
  const icon = document.createElement('div');
  icon.className = 'text-4xl group-hover:scale-110 transition-transform';
  icon.textContent = giftData.icon;
  
  const name = document.createElement('div');
  name.className = 'font-bold text-sm';
  name.textContent = giftName;
  
  const price = document.createElement('div');
  price.className = 'text-xs text-zinc-400';
  price.textContent = `${giftData.price.toLocaleString()} credits`;
  
  const tier = document.createElement('div');
  tier.className = 'text-[10px] uppercase tracking-wider';
  tier.textContent = giftData.tier;
  
  // Tier-specific styling
  const tierColors = {
    common: 'text-zinc-500',
    uncommon: 'text-green-500',
    rare: 'text-blue-500',
    epic: 'text-purple-500',
    legendary: 'text-yellow-500',
    mythic: 'text-red-500'
  };
  tier.className += ' ' + (tierColors[giftData.tier] || tierColors.common);
  
  card.appendChild(icon);
  card.appendChild(name);
  card.appendChild(price);
  card.appendChild(tier);
  
  card.onclick = () => confirmAndSendGift(ChatState.currentUser, targetUser, giftName, giftData.price);
  
  return card;
}

/**
 * Confirm and send gift
 * @param {string} sender - Sender username
 * @param {string} recipient - Recipient username
 * @param {string} giftName - Name of gift
 * @param {number} price - Gift price
 */
async function confirmAndSendGift(sender, recipient, giftName, price) {
  const confirmed = confirm(
    `Send ${giftName} (${price.toLocaleString()} credits) to ${recipient}?\n\nThis cannot be undone.`
  );
  
  if (!confirmed) return;
  
  closeGiftModal();
  
  try {
    await executeGiftTransaction(sender, recipient, giftName, price);
    showSuccess(`Gift sent successfully!`);
  } catch (error) {
    console.error('Gift sending failed:', error);
    showError(error.message || 'Failed to send gift. Please try again.');
  }
}

/**
 * Execute gift transaction
 * @param {string} sender - Sender username
 * @param {string} recipient - Recipient username
 * @param {string} giftName - Name of gift
 * @param {number} price - Gift price
 */
async function executeGiftTransaction(sender, recipient, giftName, price) {
  if (!hasPermissions()) {
    throw new Error('Not authenticated');
  }
  
  const senderRef = db.collection('users').doc(sender);
  const recipientRef = db.collection('users').doc(recipient);
  
  await db.runTransaction(async (transaction) => {
    // Get both user documents
    const senderDoc = await transaction.get(senderRef);
    const recipientDoc = await transaction.get(recipientRef);
    
    // Validate documents exist
    if (!senderDoc.exists) {
      throw new Error('Sender account not found');
    }
    
    if (!recipientDoc.exists) {
      throw new Error('Recipient account not found');
    }
    
    // Get current credits
    const senderData = senderDoc.data();
    const recipientData = recipientDoc.data();
    
    const senderCredits = senderData.credits || 0;
    const recipientCredits = recipientData.credits || 0;
    
    // Validate sufficient funds
    if (senderCredits < price) {
      throw new Error(`Insufficient credits. You have ${senderCredits.toLocaleString()}, need ${price.toLocaleString()}`);
    }
    
    // Update credits
    transaction.update(senderRef, {
      credits: senderCredits - price,
      lastGiftSent: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    transaction.update(recipientRef, {
      credits: recipientCredits + price,
      lastGiftReceived: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  
  // Record gift message
  await db.collection('messages').add({
    user: sender,
    target: recipient,
    giftName: giftName,
    type: 'GIFT',
    time: Date.now()
  });
  
  console.log('Gift transaction completed:', { sender, recipient, giftName, price });
}

/**
 * Close gift modal
 */
function closeGiftModal() {
  const overlay = document.getElementById('gift-modal-overlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Show gift notification banner
 * @param {Object} giftMessage - Gift message data
 */
function showGiftNotification(giftMessage) {
  const giftData = GIFT_CATALOG[giftMessage.giftName];
  if (!giftData) return;
  
  // Create notification
  const notification = document.createElement('div');
  notification.className = 'fixed top-0 left-0 right-0 bg-gradient-to-r from-[#d4af37] to-[#f0c85a] text-black p-4 flex items-center justify-center gap-4 z-[9999] shadow-2xl';
  notification.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
  notification.style.transform = 'translateY(-100%)';
  
  const icon = document.createElement('div');
  icon.className = 'text-4xl animate-bounce';
  icon.textContent = giftData.icon;
  
  const content = document.createElement('div');
  content.className = 'text-center';
  
  const label = document.createElement('div');
  label.className = 'text-xs font-bold uppercase tracking-widest mb-1';
  label.textContent = '🎁 Sovereign Transaction';
  
  const details = document.createElement('div');
  details.className = 'text-sm font-medium';
  details.innerHTML = `
    <span class="font-bold">${sanitizeText(giftMessage.user)}</span>
    sent
    <span class="font-bold">${sanitizeText(giftMessage.giftName)}</span>
    to
    <span class="font-bold">${sanitizeText(giftMessage.target)}</span>
  `;
  
  content.appendChild(label);
  content.appendChild(details);
  
  notification.appendChild(icon);
  notification.appendChild(content);
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
  }, 10);
  
  // Animate out and remove
  setTimeout(() => {
    notification.style.transform = 'translateY(-100%)';
    notification.style.opacity = '0';
    
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// ============================================
// USER FEEDBACK
// ============================================

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
  // In production, use a proper toast/notification system
  alert('❌ ' + message);
}

/**
 * Show success message
 * @param {string} message - Success message
 */
function showSuccess(message) {
  // In production, use a proper toast/notification system
  alert('✅ ' + message);
}

// ============================================
// INITIALIZATION
// ============================================

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initChat().catch(error => {
      console.error('Chat initialization failed:', error);
    });
  });
} else {
  // DOM already loaded
  initChat().catch(error => {
    console.error('Chat initialization failed:', error);
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupChat);

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initChat,
    cleanupChat,
    sendMessage,
    openGiftModal
  };
}