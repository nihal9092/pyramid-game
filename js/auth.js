/**
 * auth.js - Authentication & User Management with Referral System
 * 
 * Features:
 * - Secure user registration
 * - Login/logout functionality
 * - Referral system (25K for new user, 50K for referrer)
 * - Session management
 * - Password hashing
 * 
 * @version 4.0.0
 */

'use strict';

// ============================================
// CONFIGURATION
// ============================================

const AUTH_CONFIG = {
  minPasswordLength: 8,
  maxPasswordLength: 128,
  sessionKey: 'pyramidUser',
  defaultCredits: 100000,
  defaultVotes: 3,
  defaultTitle: 'Commoner',
  referralBonusNew: 25000,      // New user gets 25K
  referralBonusReferrer: 50000   // Referrer gets 50K
};

// ============================================
// STATE MANAGEMENT
// ============================================

const AuthState = {
  currentUser: null,
  isAuthenticated: false,
  userCache: null
};

// ============================================
// INITIALIZATION
// ============================================

function initAuth() {
  setupPasswordToggle();
  setupEventListeners();
  checkExistingSession();
  
  console.log('✅ Authentication system initialized with referral system');
}

function setupEventListeners() {
  const registerBtn = document.getElementById('register-btn');
  if (registerBtn) {
    registerBtn.addEventListener('click', handleRegister);
  }

  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const loginPassInput = document.getElementById('login-pass');
  if (loginPassInput) {
    loginPassInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleLogin();
      }
    });
  }

  const authPassInput = document.getElementById('auth-pass');
  if (authPassInput) {
    authPassInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleRegister();
      }
    });
  }
}

function setupPasswordToggle() {
  const toggleBtn = document.getElementById('toggle-pass');
  const passwordInput = document.getElementById('auth-pass');

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = 'Hide';
      } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = 'Show';
      }
    });
  }
}

async function checkExistingSession() {
  const savedUser = localStorage.getItem(AUTH_CONFIG.sessionKey);
  
  if (!savedUser) return;

  try {
    const userDoc = await db.collection('users').doc(savedUser).get();
    
    if (userDoc.exists) {
      AuthState.currentUser = savedUser;
      AuthState.isAuthenticated = true;
      AuthState.userCache = userDoc.data();
      
      showWelcome(savedUser, 'Welcome back');
      await enterApplication();
    } else {
      clearSession();
    }
  } catch (error) {
    console.error('Session verification error:', error);
    clearSession();
  }
}

// ============================================
// REGISTRATION WITH REFERRAL
// ============================================

async function handleRegister() {
  try {
    const name = getInputValue('auth-name');
    const gender = getInputValue('auth-gender');
    const roll = getInputValue('auth-roll');
    const cls = getInputValue('auth-class');
    const sec = getInputValue('auth-sec').toUpperCase();
    const email = getInputValue('auth-email');
    const password = getInputValue('auth-pass');
    const referredBy = getInputValue('auth-referral'); // Optional referral code

    if (!name || !gender || !roll || !cls || !sec || !password) {
      showAuthError('Please complete all required fields.');
      return;
    }

    if (password.length < AUTH_CONFIG.minPasswordLength) {
      showAuthError(`Password must be at least ${AUTH_CONFIG.minPasswordLength} characters long.`);
      return;
    }

    if (password.length > AUTH_CONFIG.maxPasswordLength) {
      showAuthError(`Password is too long. Maximum ${AUTH_CONFIG.maxPasswordLength} characters.`);
      return;
    }

    if (email && !isValidEmail(email)) {
      showAuthError('Please enter a valid email address.');
      return;
    }

    if (!isValidName(name)) {
      showAuthError('Please enter a valid full name (letters and spaces only).');
      return;
    }

    // Check for existing user
    const userRef = db.collection('users').doc(name);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      showAuthError('A user with this name already exists. Please login or use a different name.');
      return;
    }

    // Check for duplicate roll number
    const rollQuery = await db.collection('users')
      .where('rollNumber', '==', roll)
      .get();

    if (!rollQuery.empty) {
      showAuthError('This roll number has already been registered.');
      return;
    }

    const passwordHash = await hashPassword(password);

    // Calculate credits with referral bonus
    let initialCredits = AUTH_CONFIG.defaultCredits;
    let referralBonus = 0;
    let referrerExists = false;

    // Check if referral code is valid
    if (referredBy && referredBy.trim()) {
      const referrerRef = db.collection('users').doc(referredBy.trim());
      const referrerDoc = await referrerRef.get();
      
      if (referrerDoc.exists) {
        referrerExists = true;
        referralBonus = AUTH_CONFIG.referralBonusNew;
        initialCredits += referralBonus;
      }
    }

    // Create user document
    await userRef.set({
      name: sanitizeInput(name),
      gender: gender,
      rollNumber: roll,
      class: cls,
      section: sec,
      email: email ? sanitizeInput(email) : '',
      passwordHash: passwordHash,
      credits: initialCredits,
      title: AUTH_CONFIG.defaultTitle,
      totalVotesReceived: 0,
      votesRemaining: AUTH_CONFIG.defaultVotes,
      referredBy: referrerExists ? referredBy.trim() : '',
      totalReferrals: 0,
      registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    // If referred, reward the referrer
    if (referrerExists) {
      const referrerRef = db.collection('users').doc(referredBy.trim());
      
      await referrerRef.update({
        credits: firebase.firestore.FieldValue.increment(AUTH_CONFIG.referralBonusReferrer),
        totalReferrals: firebase.firestore.FieldValue.increment(1)
      });

      // Send notification to chat
      await db.collection('messages').add({
        user: 'SYSTEM',
        text: `🎉 ${name} joined using ${referredBy.trim()}'s referral code! Both earned bonus credits!`,
        type: 'MSG',
        time: Date.now()
      });
    }

    setSession(name);

    // Show welcome with referral info
    const welcomeMessage = referrerExists 
      ? `Welcome! You received ${referralBonus.toLocaleString()} bonus credits from referral!`
      : 'Welcome to the Pyramid — your hierarchy awaits';
    
    showWelcome(name, welcomeMessage);

    await enterApplication();

    console.log('User registered successfully:', name);

  } catch (error) {
    console.error('Registration error:', error);
    showAuthError('Registration failed. Please try again.');
  }
}

// ============================================
// LOGIN
// ============================================

async function handleLogin() {
  try {
    const name = getInputValue('login-name');
    const password = getInputValue('login-pass');

    if (!name || !password) {
      showAuthError('Please enter your name and password.');
      return;
    }

    const userRef = db.collection('users').doc(name);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      showAuthError('User not found. Please check your name or register.');
      return;
    }

    const passwordHash = await hashPassword(password);
    const userData = userDoc.data();

    if (!userData.passwordHash || passwordHash !== userData.passwordHash) {
      showAuthError('Incorrect password.');
      return;
    }

    await userRef.update({
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    setSession(name);
    AuthState.userCache = userData;

    showWelcome(name, 'Welcome back — may your status rise');

    await enterApplication();

    console.log('User logged in successfully:', name);

  } catch (error) {
    console.error('Login error:', error);
    showAuthError('Login failed. Please try again.');
  }
}

// ============================================
// LOGOUT
// ============================================

async function handleLogout() {
  const confirmed = confirm('Are you sure you want to logout?');
  if (!confirmed) return;

  try {
    if (AuthState.currentUser) {
      await db.collection('users')
        .doc(AuthState.currentUser)
        .update({
          lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    clearSession();

    if (typeof cleanupChat === 'function') {
      cleanupChat();
    }

    window.location.reload();

  } catch (error) {
    console.error('Logout error:', error);
    window.location.reload();
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function setSession(username) {
  localStorage.setItem(AUTH_CONFIG.sessionKey, username);
  AuthState.currentUser = username;
  AuthState.isAuthenticated = true;
}

function clearSession() {
  localStorage.removeItem(AUTH_CONFIG.sessionKey);
  AuthState.currentUser = null;
  AuthState.isAuthenticated = false;
  AuthState.userCache = null;
}

function getCurrentUser() {
  return AuthState.currentUser;
}

function isAuthenticated() {
  return AuthState.isAuthenticated;
}

// ============================================
// APPLICATION ENTRY
// ============================================

async function enterApplication() {
  try {
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');

    if (authScreen) authScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');

    const userRef = db.collection('users').doc(AuthState.currentUser);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      AuthState.userCache = userData;

      updateUserHeader(userData);

      if (typeof isAdmin === 'function' && isAdmin()) {
        const adminFab = document.getElementById('admin-fab');
        if (adminFab) {
          adminFab.classList.remove('hidden');
        }
      }
      
      // Show referral code to user
      showReferralInfo(AuthState.currentUser, userData.totalReferrals || 0);
    }

    if (typeof loadHierarchy === 'function') {
      loadHierarchy();
    }

    if (typeof initChat === 'function') {
      initChat();
    }

    console.log('Application entered successfully');

  } catch (error) {
    console.error('App initialization error:', error);
    showAuthError('Failed to load application. Please try again.');
  }
}

function updateUserHeader(userData) {
  const nameDisplay = document.getElementById('my-name-display');
  const creditsDisplay = document.getElementById('my-credits-display');
  const titleDisplay = document.getElementById('my-title-display');

  if (nameDisplay) {
    nameDisplay.textContent = AuthState.currentUser;
  }

  if (creditsDisplay) {
    creditsDisplay.textContent = (userData.credits || 0).toLocaleString();
  }

  if (titleDisplay) {
    titleDisplay.textContent = userData.title || AUTH_CONFIG.defaultTitle;
  }
}

// ============================================
// REFERRAL SYSTEM UI
// ============================================

function showReferralInfo(username, totalReferrals) {
  // Create referral info card
  setTimeout(() => {
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-24 right-4 glass-card border-2 border-purple-500 text-white px-6 py-4 rounded-2xl shadow-2xl z-[9998] max-w-sm';
    notification.innerHTML = `
      <div class="text-center">
        <div class="text-2xl mb-2">🎁 Referral Program</div>
        <div class="text-sm mb-3">
          <div class="font-bold text-lg text-purple-300 mb-1">Your Referral Code:</div>
          <div class="bg-black/40 px-4 py-2 rounded-lg font-mono text-lg text-yellow-300 mb-2">${username}</div>
          <div class="text-xs text-zinc-400 mb-2">Share your name as referral code!</div>
        </div>
        <div class="text-xs border-t border-zinc-700 pt-2 mt-2">
          <div class="flex justify-between mb-1">
            <span>New users get:</span>
            <span class="text-green-400 font-bold">+25,000 CR</span>
          </div>
          <div class="flex justify-between mb-1">
            <span>You get per referral:</span>
            <span class="text-yellow-400 font-bold">+50,000 CR</span>
          </div>
          <div class="flex justify-between font-bold text-purple-300">
            <span>Your referrals:</span>
            <span>${totalReferrals}</span>
          </div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="mt-3 text-xs text-zinc-500 hover:text-white transition-colors">Close</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      notification.style.transition = 'opacity 0.5s ease';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 500);
    }, 10000);
  }, 2000);
}

// ============================================
// WELCOME OVERLAY
// ============================================

function showWelcome(name, subtitle) {
  const overlay = document.getElementById('welcome-overlay');
  const title = document.getElementById('welcome-title');
  const sub = document.getElementById('welcome-sub');

  if (title) {
    title.textContent = `Greetings, ${sanitizeInput(name)}`;
  }

  if (sub) {
    sub.textContent = subtitle;
  }

  if (overlay) {
    overlay.classList.add('show');
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
  }
}

function closeWelcome() {
  const overlay = document.getElementById('welcome-overlay');
  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const proceedBtn = document.getElementById('welcome-proceed');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', closeWelcome);
  }
});

// ============================================
// VALIDATION UTILITIES
// ============================================

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidName(name) {
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  return nameRegex.test(name) && name.trim().length >= 2;
}

function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML.trim();
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : '';
}

// ============================================
// PASSWORD HASHING
// ============================================

async function hashPassword(password) {
  if (!password) return '';

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to secure password');
  }
}

// ============================================
// USER FEEDBACK
// ============================================

function showAuthError(message) {
  alert('⚠️ ' + message);
}

function showAuthSuccess(message) {
  alert('✅ ' + message);
}

// ============================================
// INITIALIZATION
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleRegister,
    handleLogin,
    handleLogout,
    getCurrentUser,
    isAuthenticated,
    initAuth
  };
}

window.handleRegister = handleRegister;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.closeWelcome = closeWelcome;
