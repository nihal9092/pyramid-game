/**
 * auth.js - Authentication & User Management
 * 
 * Features:
 * - Secure user registration
 * - Login/logout functionality
 * - Session management
 * - Password hashing
 * - Input validation
 * - Duplicate prevention
 * 
 * @version 2.0.0
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
  defaultTitle: 'Commoner'
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

/**
 * Initialize authentication system
 */
function initAuth() {
  setupPasswordToggle();
  setupEventListeners();
  checkExistingSession();
  
  console.log('Authentication system initialized');
}

/**
 * Setup event listeners for auth forms
 */
function setupEventListeners() {
  // Register button
  const registerBtn = document.getElementById('register-btn');
  if (registerBtn) {
    registerBtn.addEventListener('click', handleRegister);
  }

  // Login button
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Enter key handling
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

/**
 * Setup password visibility toggle
 */
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

/**
 * Check for existing session on page load
 */
async function checkExistingSession() {
  const savedUser = localStorage.getItem(AUTH_CONFIG.sessionKey);
  
  if (!savedUser) return;

  try {
    // Verify user still exists in database
    const userDoc = await db.collection('users').doc(savedUser).get();
    
    if (userDoc.exists) {
      AuthState.currentUser = savedUser;
      AuthState.isAuthenticated = true;
      AuthState.userCache = userDoc.data();
      
      // Show welcome and enter app
      showWelcome(savedUser, 'Welcome back');
      await enterApplication();
    } else {
      // User deleted, clear session
      clearSession();
    }
  } catch (error) {
    console.error('Session verification error:', error);
    clearSession();
  }
}

// ============================================
// REGISTRATION
// ============================================

/**
 * Handle user registration
 */
async function handleRegister() {
  try {
    // Get form values
    const name = getInputValue('auth-name');
    const gender = getInputValue('auth-gender');
    const roll = getInputValue('auth-roll');
    const cls = getInputValue('auth-class');
    const sec = getInputValue('auth-sec').toUpperCase();
    const email = getInputValue('auth-email');
    const password = getInputValue('auth-pass');

    // Validate required fields
    if (!name || !gender || !roll || !cls || !sec || !password) {
      showAuthError('Please complete all required fields.');
      return;
    }

    // Validate password
    if (password.length < AUTH_CONFIG.minPasswordLength) {
      showAuthError(`Password must be at least ${AUTH_CONFIG.minPasswordLength} characters long.`);
      return;
    }

    if (password.length > AUTH_CONFIG.maxPasswordLength) {
      showAuthError(`Password is too long. Maximum ${AUTH_CONFIG.maxPasswordLength} characters.`);
      return;
    }

    // Validate email format if provided
    if (email && !isValidEmail(email)) {
      showAuthError('Please enter a valid email address.');
      return;
    }

    // Validate name format
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

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user document
    await userRef.set({
      name: sanitizeInput(name),
      gender: gender,
      rollNumber: roll,
      class: cls,
      section: sec,
      email: email ? sanitizeInput(email) : '',
      passwordHash: passwordHash,
      credits: AUTH_CONFIG.defaultCredits,
      title: AUTH_CONFIG.defaultTitle,
      totalVotesReceived: 0,
      votesRemaining: AUTH_CONFIG.defaultVotes,
      registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Set session
    setSession(name);

    // Show welcome
    showWelcome(name, 'Welcome to the Pyramid — your hierarchy awaits');

    // Enter application
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

/**
 * Handle user login
 */
async function handleLogin() {
  try {
    const name = getInputValue('login-name');
    const password = getInputValue('login-pass');

    // Validate input
    if (!name || !password) {
      showAuthError('Please enter your name and password.');
      return;
    }

    // Get user document
    const userRef = db.collection('users').doc(name);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      showAuthError('User not found. Please check your name or register.');
      return;
    }

    // Verify password
    const passwordHash = await hashPassword(password);
    const userData = userDoc.data();

    if (!userData.passwordHash || passwordHash !== userData.passwordHash) {
      showAuthError('Incorrect password.');
      return;
    }

    // Update last active
    await userRef.update({
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Set session
    setSession(name);
    AuthState.userCache = userData;

    // Show welcome
    showWelcome(name, 'Welcome back — may your status rise');

    // Enter application
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

/**
 * Handle user logout
 */
async function handleLogout() {
  const confirmed = confirm('Are you sure you want to logout?');
  if (!confirmed) return;

  try {
    // Update last active before logout
    if (AuthState.currentUser) {
      await db.collection('users')
        .doc(AuthState.currentUser)
        .update({
          lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // Clear session
    clearSession();

    // Cleanup
    if (typeof cleanupChat === 'function') {
      cleanupChat();
    }

    // Reload page
    window.location.reload();

  } catch (error) {
    console.error('Logout error:', error);
    // Force reload anyway
    window.location.reload();
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Set user session
 * @param {string} username - Username to store
 */
function setSession(username) {
  localStorage.setItem(AUTH_CONFIG.sessionKey, username);
  AuthState.currentUser = username;
  AuthState.isAuthenticated = true;
}

/**
 * Clear user session
 */
function clearSession() {
  localStorage.removeItem(AUTH_CONFIG.sessionKey);
  AuthState.currentUser = null;
  AuthState.isAuthenticated = false;
  AuthState.userCache = null;
}

/**
 * Get current user
 * @returns {string|null}
 */
function getCurrentUser() {
  return AuthState.currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
  return AuthState.isAuthenticated;
}

// ============================================
// APPLICATION ENTRY
// ============================================

/**
 * Enter main application
 */
async function enterApplication() {
  try {
    // Hide auth screen, show app screen
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');

    if (authScreen) authScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');

    // Load user data
    const userRef = db.collection('users').doc(AuthState.currentUser);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      AuthState.userCache = userData;

      // Update header
      updateUserHeader(userData);

      // Show admin FAB if authorized
      if (typeof isAdmin === 'function' && isAdmin()) {
        const adminFab = document.getElementById('admin-fab');
        if (adminFab) {
          adminFab.classList.remove('hidden');
        }
      }
    }

    // Initialize other systems
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

/**
 * Update user header information
 * @param {Object} userData - User data object
 */
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
// WELCOME OVERLAY
// ============================================

/**
 * Show welcome overlay
 * @param {string} name - Username
 * @param {string} subtitle - Subtitle message
 */
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
  }
}

/**
 * Close welcome overlay
 */
function closeWelcome() {
  const overlay = document.getElementById('welcome-overlay');
  if (overlay) {
    overlay.classList.remove('show');
  }
}

// Setup welcome proceed button
document.addEventListener('DOMContentLoaded', () => {
  const proceedBtn = document.getElementById('welcome-proceed');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', closeWelcome);
  }
});

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate name format
 * @param {string} name - Full name
 * @returns {boolean}
 */
function isValidName(name) {
  // Allow letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  return nameRegex.test(name) && name.trim().length >= 2;
}

/**
 * Sanitize user input
 * @param {string} input - Raw input
 * @returns {string}
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML.trim();
}

/**
 * Get input value safely
 * @param {string} id - Element ID
 * @returns {string}
 */
function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : '';
}

// ============================================
// PASSWORD HASHING
// ============================================

/**
 * Hash password using SHA-256
 * @param {string} password - Plain text password
 * @returns {Promise<string>}
 */
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

/**
 * Show authentication error
 * @param {string} message - Error message
 */
function showAuthError(message) {
  alert('⚠️ ' + message);
}

/**
 * Show authentication success
 * @param {string} message - Success message
 */
function showAuthSuccess(message) {
  alert('✅ ' + message);
}

// ============================================
// INITIALIZATION
// ============================================

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

// Export for external use
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

// Make functions globally accessible
window.handleRegister = handleRegister;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.closeWelcome = closeWelcome;
    
