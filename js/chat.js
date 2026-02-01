/**
 * chat.js - Enhanced Chat & Gift System with Sounds & Animations
 * 
 * Features:
 * - Tier-based gift sounds and animations
 * - Real-time messaging with title badges
 * - Epic gift effects for all users
 * - Admin broadcast sounds
 * 
 * @version 4.0.0
 */

'use strict';

// ============================================
// GIFT CATALOG WITH SOUNDS
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

// ============================================
// SOUND EFFECTS BY TIER
// ============================================

const SOUND_EFFECTS = {
  // Gift sounds by tier
  common: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  uncommon: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
  rare: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  epic: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  legendary: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  mythic: 'https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3',
  
  // Other sounds
  message: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  adminBroadcast: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  system: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'
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
  messagesListener: null,
  audioCache: new Map()
};

// ============================================
// AUDIO SYSTEM
// ============================================

/**
 * Get or create cached audio element
 */
function getAudioElement(url) {
  if (!url) return null;
  
  if (ChatState.audioCache.has(url)) {
    return ChatState.audioCache.get(url);
  }
  
  try {
    const audio = new Audio(url);
    audio.volume = 0.7;
    ChatState.audioCache.set(url, audio);
    return audio;
  } catch (error) {
    console.warn('Audio creation failed:', error);
    return null;
  }
}

/**
 * Play sound effect
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
    console.log('✅ Chat system initialized with sounds & animations');
    
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
  ChatState.audioCache.clear();
  
  console.log('Chat cleaned up');
}

// ============================================
// MESSAGE LISTENER
// ============================================

function initializeMessageListener() {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;

  const unsubscribe = db.collection('messages')
    .orderBy('time', 'desc')
    .limit(CHAT_CONFIG.maxMessagesDisplay)
    .onSnapshot(
      (snapshot) => {
        // Track new messages for sound/animation
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const msg = { id: change.doc.id, ...change.doc.data() };
            
            // Play sounds and show animations for new messages
            if (msg.type === 'GIFT') {
              const giftData = GIFT_CATALOG[msg.giftName];
              if (giftData) {
                playSoundEffect(giftData.tier);
                triggerGiftAnimation(msg, giftData.tier);
              }
            } else if (msg.user === 'SYSTEM' && msg.text.includes('ADMIN ANNOUNCEMENT')) {
              playSoundEffect('adminBroadcast');
            }
          }
        });
        
        // Render all messages
        chatBox.innerHTML = '';
        
        const messages = [];
        snapshot.forEach(doc => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        
        messages.reverse().forEach(msg => {
          const messageEl = createMessageElement(msg);
          chatBox.appendChild(messageEl);
        });
        
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
    <span class="text-pink-300"> (${giftData.tier.toUpperCase()}) to </span>
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
// GIFT ANIMATIONS BY TIER
// ============================================

/**
 * Trigger gift animation based on tier
 */
function triggerGiftAnimation(message, tier) {
  const giftData = GIFT_CATALOG[message.giftName];
  if (!giftData) return;
  
  switch(tier) {
    case 'common':
    case 'uncommon':
      // Simple notification (sender/receiver only)
      if (ChatState.currentUser === message.user || ChatState.currentUser === message.target) {
        showSimpleGiftNotification(message, giftData);
      }
      break;
      
    case 'rare':
      // Medium animation (sender/receiver)
      if (ChatState.currentUser === message.user || ChatState.currentUser === message.target) {
        showRareGiftAnimation(message, giftData);
      }
      break;
      
    case 'epic':
      // Everyone sees it!
      showEpicGiftAnimation(message, giftData);
      break;
      
    case 'legendary':
      // Cooler animation for everyone
      showLegendaryGiftAnimation(message, giftData);
      break;
      
    case 'mythic':
      // COOLEST animation for everyone
      showMythicGiftAnimation(message, giftData);
      break;
  }
}

/**
 * Simple gift notification (common/uncommon)
 */
function showSimpleGiftNotification(message, giftData) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-24 right-4 glass-card border-2 border-pink-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9999] max-w-sm';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-4xl">${giftData.icon}</span>
      <div>
        <div class="font-bold text-sm">${message.user} → ${message.target}</div>
        <div class="text-xs text-pink-300">${message.giftName} (${giftData.price.toLocaleString()} CR)</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Rare gift animation (sender/receiver)
 */
function showRareGiftAnimation(message, giftData) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none';
  overlay.style.background = 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%)';
  
  overlay.innerHTML = `
    <div class="text-center animate-pulse">
      <div class="text-9xl mb-4" style="animation: bounce 0.5s ease-in-out 3;">${giftData.icon}</div>
      <div class="text-2xl font-bold text-cyan-400 mb-2">${message.giftName}</div>
      <div class="text-lg text-white">
        <span class="font-bold">${sanitizeText(message.user)}</span>
        <span class="text-cyan-300"> → </span>
        <span class="font-bold">${sanitizeText(message.target)}</span>
      </div>
      <div class="text-sm text-cyan-400 mt-2">${giftData.price.toLocaleString()} Credits</div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 500);
  }, 2500);
}

/**
 * Epic gift animation (EVERYONE sees)
 */
function showEpicGiftAnimation(message, giftData) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none';
  overlay.style.background = 'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, rgba(236, 72, 153, 0.2) 50%, transparent 100%)';
  
  overlay.innerHTML = `
    <div class="text-center">
      <div class="text-6xl mb-4 font-bold text-purple-400 animate-pulse">✨ EPIC GIFT ✨</div>
      <div class="text-[120px] mb-6" style="animation: scaleIn 0.5s ease-out, bounce 0.5s ease-in-out 4;">${giftData.icon}</div>
      <div class="text-3xl font-black text-white mb-3 gradient-text">${message.giftName}</div>
      <div class="text-xl text-white">
        <span class="font-bold text-purple-300">${sanitizeText(message.user)}</span>
        <span class="text-pink-300"> sent to </span>
        <span class="font-bold text-purple-300">${sanitizeText(message.target)}</span>
      </div>
      <div class="text-lg text-purple-400 mt-3 font-bold">${giftData.price.toLocaleString()} CR</div>
      <div class="flex justify-center gap-4 mt-6">
        <div class="w-32 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        <div class="w-32 h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Screen flash effect
  document.body.style.animation = 'flashPurple 0.3s ease-in-out 2';
  
  setTimeout(() => {
    overlay.style.transition = 'opacity 0.7s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      document.body.style.animation = '';
    }, 700);
  }, 3000);
}

/**
 * Legendary gift animation (COOLER for everyone)
 */
function showLegendaryGiftAnimation(message, giftData) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none';
  overlay.style.background = 'radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, rgba(255, 165, 0, 0.2) 50%, transparent 100%)';
  
  overlay.innerHTML = `
    <div class="text-center relative">
      <!-- Sparkles -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-6xl animate-ping" style="animation-duration: 1.5s;">✨</div>
      </div>
      
      <div class="text-7xl mb-4 font-black cinzel animate-pulse" style="background: linear-gradient(135deg, #FFD700, #FFA500); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 30px rgba(255, 215, 0, 0.8);">
        ⭐ LEGENDARY GIFT ⭐
      </div>
      
      <div class="text-[140px] mb-6 relative z-10" style="animation: scaleIn 0.6s ease-out, bounce 0.6s ease-in-out 5, rotate 3s linear infinite;">
        ${giftData.icon}
      </div>
      
      <div class="text-4xl font-black mb-4" style="background: linear-gradient(135deg, #FFD700, #FFA500); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        ${message.giftName}
      </div>
      
      <div class="text-2xl text-white mb-3">
        <span class="font-black text-yellow-300">${sanitizeText(message.user)}</span>
        <span class="text-yellow-500"> ⇨ </span>
        <span class="font-black text-yellow-300">${sanitizeText(message.target)}</span>
      </div>
      
      <div class="text-2xl font-black text-yellow-400 mb-6">${giftData.price.toLocaleString()} CREDITS</div>
      
      <!-- Decorative lines -->
      <div class="flex justify-center gap-6">
        <div class="w-40 h-2 bg-gradient-to-r from-transparent via-yellow-500 to-transparent animate-pulse"></div>
        <div class="w-40 h-2 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-pulse"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Golden screen flash
  document.body.style.animation = 'flashGold 0.4s ease-in-out 3';
  
  setTimeout(() => {
    overlay.style.transition = 'opacity 1s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      document.body.style.animation = '';
    }, 1000);
  }, 4000);
}

/**
 * Mythic gift animation (COOLEST for everyone)
 */
function showMythicGiftAnimation(message, giftData) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none overflow-hidden';
  overlay.style.background = 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(220, 38, 38, 0.3) 30%, rgba(147, 51, 234, 0.2) 60%, transparent 100%)';
  
  overlay.innerHTML = `
    <div class="text-center relative">
      <!-- Cosmic background effect -->
      <div class="absolute inset-0">
        <div class="absolute top-1/4 left-1/4 w-32 h-32 bg-red-500 rounded-full blur-3xl animate-pulse opacity-50"></div>
        <div class="absolute top-1/3 right-1/4 w-40 h-40 bg-purple-500 rounded-full blur-3xl animate-pulse opacity-50" style="animation-delay: 0.5s;"></div>
        <div class="absolute bottom-1/4 left-1/3 w-36 h-36 bg-pink-500 rounded-full blur-3xl animate-pulse opacity-50" style="animation-delay: 1s;"></div>
      </div>
      
      <!-- Main content -->
      <div class="relative z-10">
        <div class="text-8xl mb-6 font-black cinzel animate-pulse" style="background: linear-gradient(135deg, #EF4444, #DC2626, #9333EA, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 40px rgba(239, 68, 68, 1), 0 0 80px rgba(147, 51, 234, 0.8); animation: glowPulse 2s ease-in-out infinite;">
          🌟 MYTHIC GIFT 🌟
        </div>
        
        <div class="text-[160px] mb-8 drop-shadow-2xl" style="animation: scaleIn 0.8s ease-out, bounce 0.7s ease-in-out 6, rotate360 4s ease-in-out infinite; filter: drop-shadow(0 0 40px rgba(239, 68, 68, 0.8));">
          ${giftData.icon}
        </div>
        
        <div class="text-5xl font-black mb-6 t
