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
// SOUND HANDLER FOR GIFTS
// ============================================

const sounds = {
  common: new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"),
  uncommon: new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"),
  rare: new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"),
  epic: new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3"),
  legendary: new Audio("https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3"),
  mythic: new Audio("https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3"),
  admin: new Audio("https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3")
};

function playSfx(tier) {
  if (sounds[tier]) {
    sounds[tier].currentTime = 0; // Reset playback if triggered rapidly
    sounds[tier].play().catch(e =>
      console.log("Audio play blocked by browser. User must interact first.", e)
    );
  }
}

// ============================================
// STATE - SIMPLIFIED
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
// INITIALIZATION - SIMPLIFIED
// ============================================

function initChat() {
  console.log('💬 Starting chat initialization...');
  
  if (ChatState.isInitialized) {
    console.log('⚠️ Chat already initialized');
    return;
  }
  
  const storedUser = localStorage.getItem('pyramidUser');
  if (!storedUser) {
    console.error('❌ No user in localStorage');
    return;
  }
  
  ChatState.currentUser = storedUser;
  console.log('✅ Chat user set:', storedUser);
  
  setupMessageListener();
  setupInputHandlers();
  setupTypingIndicator();
  
  ChatState.isInitialized = true;
  console.log('✅✅✅ CHAT FULLY INITIALIZED ✅✅✅');
}

// ============================================
// MESSAGE LISTENER
// ============================================

function setupMessageListener() {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) {
    console.error('❌ chat-box element not found');
    return;
  }

  console.log('📨 Setting up message listener...');
  
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
        messages.reverse().forEach(msg => {
          const messageEl = createMessageElement(msg);
          chatBox.appendChild(messageEl);
        });
        if (chatBox.lastElementChild) {
          chatBox.lastElementChild.scrollIntoView({ behavior: 'smooth' });
        }
        console.log('📨 Messages updated:', messages.length);
      },
      (error) => {
        console.error('❌ Message listener error:', error);
        chatBox.innerHTML = '<div class="text-center text-red-500 py-4">Failed to load messages</div>';
      }
    );

  ChatState.messagesListener = unsubscribe;
  ChatState.unsubscribers.push(unsubscribe);
  console.log('✅ Message listener active');
}

function createMessageElement(message) {
  const messageDiv = document.createElement('div');
  const currentUser = ChatState.currentUser;
  
  if (message.type === 'GIFT') {
    return createGiftMessage(message);
  }
  
  if (message.user === 'SYSTEM') {
    return createSystemMessage(message);
  }
  
  const isOwn = message.user === currentUser;
  messageDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;
  
  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 mb-1';
  
  const userName = document.createElement('span');
  userName.className = `font-semibold text-sm ${isOwn ? 'text-purple-300' : 'text-white'}`;
  userName.textContent = message.user;
  
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
  
  const content = document.createElement('div');
  content.className = 'text-sm text-white break-words';
  content.textContent = message.text;
  
  messageDiv.appendChild(header);
  messageDiv.appendChild(content);
  
  return messageDiv;
}

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

function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// INPUT HANDLERS
// ============================================

function setupInputHandlers() {
  sendButton chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat'); // Matches your index.html ID
if (sendBtn) {
    sendBtn.onclick = sendMessage;
}
  if (!chatInput || !sendButton) {
    console.error('❌ Chat input elements not found');
    return;
  }
  
  console.log('⌨️ Setting up input handlers...');
  
  sendButton.addEventListener('click', handleSendMessage);
  
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  chatInput.addEventListener('input', () => {
    updateTypingStatus(true);
    clearTimeout(ChatState.typingTimer);
    ChatState.typingTimer = setTimeout(() => {
      updateTypingStatus(false);
    }, CHAT_CONFIG.typingTimeout);
  });
  
  console.log('✅ Input handlers ready');
}

function handleSendMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  
  const text = input.value.trim();
  
  if (!text) {
    console.log('⚠️ Empty message, ignoring');
    return;
  }
  
  if (text.length > CHAT_CONFIG.maxMessageLength) {
    showError(`Message too long. Maximum ${CHAT_CONFIG.maxMessageLength} characters.`);
    return;
  }
  
  if (!ChatState.currentUser) {
    console.error('❌ No current user!');
    showError('Please log in to send messages');
    return;
  }
  
  const now = Date.now();
  if (now - ChatState.lastMessageTime < CHAT_CONFIG.messageRateLimit) {
    showError('Please wait a moment before sending another message.');
    return;
  }
  
  console.log('📤 Sending message:', text);
  
  sendMessage(text)
    .then(() => {
      console.log('✅ Message sent successfully');
      input.value = '';
      ChatState.lastMessageTime = now;
      updateTypingStatus(false);
    })
    .catch(error => {
      console.error('❌ Send error:', error);
      showError(error.message || 'Failed to send message');
    });
}

async function sendMessage(text) {
  if (!ChatState.currentUser) {
    throw new Error('Not authenticated');
  }
  
  if (!text || text.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  try {
    const userDoc = await db.collection('users').doc(ChatState.currentUser).get();
    const userTitle = userDoc.exists ? (userDoc.data().title || 'Commoner') : 'Commoner';
    
    await db.collection('messages').add({
      user: ChatState.currentUser,
      title: userTitle,
      text: sanitizeText(text),
      type: 'MSG',
      time: Date.now()
    });
    
    console.log('✅ Message added to Firestore');
  } catch (error) {
    console.error('❌ Firestore error:', error);
    throw error;
  }
}

// ============================================
// TYPING INDICATOR
// ============================================

function setupTypingIndicator() {
  if (!ChatState.currentUser) return;
  
  console.log('⌨️ Setting up typing indicator...');
  
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
  console.log('✅ Typing indicator active');
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
      console.error('Typing status error:', error);
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
// GIFT SYSTEM - SIMPLIFIED
// ============================================

function openGiftModal(targetUser) {
  console.log('🎁🎁🎁 OPEN GIFT MODAL CALLED 🎁🎁🎁');
  console.log('🎁 Target user:', targetUser);
  console.log('🎁 Current user:', ChatState.currentUser);
  
  if (!ChatState.currentUser) {
    console.error('❌ No current user');
    showError('You must be logged in to send gifts');
    return;
  }
  
  if (!targetUser) {
    console.error('❌ No target user');
    showError('Invalid recipient');
    return;
  }
  
  if (targetUser === ChatState.currentUser) {
    console.error('❌ Cannot send to self');
    showError('You cannot send gifts to yourself');
    return;
  }
  
  console.log('✅ Creating gift modal...');
  createGiftModal(targetUser);
}

function createGiftModal(targetUser) {
  console.log('🎨 Building modal DOM...');
  
  const existing = document.getElementById('gift-modal-overlay');
  if (existing) {
    console.log('🗑️ Removing existing modal');
    existing.remove();
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'gift-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[10000] p-4';
  overlay.style.display = 'flex';
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      console.log('🚪 Closing modal (clicked overlay)');
      closeGiftModal();
    }
  };
  
  const modal = document.createElement('div');
  modal.className = 'glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-3xl';
  modal.onclick = (e) => e.stopPropagation();
  
  const headerDiv = document.createElement('div');
  headerDiv.className = 'mb-6 flex justify-between items-center';
  
  const titleDiv = document.createElement('div');
  titleDiv.innerHTML = `
    <h2 class="cinzel text-2xl gradient-text font-bold">Send a Gift</h2>
    <p class="text-sm text-zinc-400 mt-1">To: <span class="font-bold text-white">${sanitizeText(targetUser)}</span></p>
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-3xl text-zinc-400 hover:text-white transition-colors';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => {
    console.log('🚪 Closing modal (clicked X)');
    closeGiftModal();
  };
  
  headerDiv.appendChild(titleDiv);
  headerDiv.appendChild(closeBtn);
  modal.appendChild(headerDiv);
  
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
  
  Object.entries(GIFT_CATALOG).forEach(([giftName, giftData]) => {
    const card = createGiftCard(giftName, giftData, targetUser);
    grid.appendChild(card);
  });
  
  modal.appendChild(grid);
  overlay.appendChild(modal);
  
  document.body.appendChild(overlay);
  
  console.log('✅✅✅ MODAL ADDED TO PAGE ✅✅✅');
  console.log('Modal element:', overlay);
  console.log('Modal visible:', overlay.style.display);
}

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
  const tierColors = {
    common: 'text-gray-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
    mythic: 'text-red-400'
  };
  tier.className = `text-[10px] uppercase tracking-wider font-bold ${tierColors[giftData.tier] || tierColors.common}`;
  tier.textContent = giftData.tier;
  
  card.appendChild(icon);
  card.appendChild(name);
  card.appendChild(price);
  card.appendChild(tier);
  
  card.onclick = () => {
    console.log('🎁 Gift selected:', giftName);
    confirmAndSendGift(ChatState.currentUser, targetUser, giftName, giftData.price, giftData.tier);
  };
  
  return card;
}

async function confirmAndSendGift(sender, recipient, giftName, price, tier) {
  const confirmed = confirm(
    `Send ${giftName} (${price.toLocaleString()} CR) to ${recipient}?\n\nThis cannot be undone.`
  );
  
  if (!confirmed) {
    console.log('❌ Gift cancelled by user');
    return;
  }
  
  closeGiftModal();
  
  console.log('💸 Processing gift transaction...');
  
  try {
    await executeGiftTransaction(sender, recipient, giftName, price, tier);
    console.log('✅ Gift sent successfully!');
    showSuccess(`Gift sent successfully!`);
  } catch (error) {
    console.error('❌ Gift error:', error);
    showError(error.message || 'Failed to send gift');
  }
}

async function executeGiftTransaction(sender, recipient, giftName, price, tier) {
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
  
  await db.collection('messages').add({
    user: sender,
    target: recipient,
    giftName: giftName,
    type: 'GIFT',
    time: Date.now()
  });
  
  console.log('✅ Gift transaction complete');
  playSfx(tier);
}

function closeGiftModal() {
  const overlay = document.getElementById('gift-modal-overlay');
  if (overlay) {
    overlay.remove();
    console.log('✅ Modal closed and removed');
  }
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
      <div class="text-sm">${sanitizeText(message)}<
