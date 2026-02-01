/**
 * hierarchy-gift-buttons.js
 * 
 * This file adds gift buttons to the hierarchy display.
 * Include this after chat.js in your HTML.
 */

'use strict';

// Function to add gift buttons to hierarchy
function addGiftButtonsToHierarchy() {
  // Wait for hierarchy to be loaded
  const observer = new MutationObserver((mutations) => {
    const pyramidList = document.getElementById('pyramid-list');
    if (pyramidList && pyramidList.children.length > 0) {
      enhanceHierarchyWithGiftButtons();
    }
  });
  
  const pyramidList = document.getElementById('pyramid-list');
  if (pyramidList) {
    observer.observe(pyramidList, { childList: true, subtree: true });
    
    // Try to enhance immediately if already loaded
    if (pyramidList.children.length > 0) {
      enhanceHierarchyWithGiftButtons();
    }
  }
}

// Enhance each user card with gift button
function enhanceHierarchyWithGiftButtons() {
  const pyramidList = document.getElementById('pyramid-list');
  if (!pyramidList) return;
  
  const currentUser = localStorage.getItem('pyramidUser');
  if (!currentUser) return;
  
  // Get all user cards
  const userCards = pyramidList.querySelectorAll('.user-rank-card');
  
  userCards.forEach(card => {
    // Check if gift button already exists
    if (card.querySelector('.gift-btn')) return;
    
    // Get username from the card
    const nameElement = card.querySelector('.font-bold.text-lg, .font-bold.text-xl, h3, .text-white');
    if (!nameElement) return;
    
    const userName = nameElement.textContent.trim();
    
    // Don't add gift button to own card
    if (userName === currentUser) return;
    
    // Create gift button
    const giftButton = document.createElement('button');
    giftButton.className = 'gift-btn bg-gradient-to-r from-pink-500 to-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:from-pink-600 hover:to-purple-700 transition-all flex items-center gap-1.5 mt-2';
    giftButton.innerHTML = '🎁 <span>Send Gift</span>';
    giftButton.onclick = (e) => {
      e.stopPropagation();
      if (typeof openGiftModal === 'function') {
        openGiftModal(userName);
      } else {
        console.error('openGiftModal function not found');
      }
    };
    
    // Add button to card
    // Try to find the best location (usually after credits/stats)
    const creditsElement = card.querySelector('.font-mono, .credits, [class*="credit"]');
    if (creditsElement && creditsElement.parentElement) {
      creditsElement.parentElement.appendChild(giftButton);
    } else {
      // Fallback: add to end of card
      card.appendChild(giftButton);
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addGiftButtonsToHierarchy);
} else {
  addGiftButtonsToHierarchy();
}

// Re-add buttons when hierarchy is updated
window.addEventListener('hierarchyUpdated', enhanceHierarchyWithGiftButtons);

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addGiftButtonsToHierarchy,
    enhanceHierarchyWithGiftButtons
  };
}

// Make globally accessible
window.addGiftButtonsToHierarchy = addGiftButtonsToHierarchy;
window.enhanceHierarchyWithGiftButtons = enhanceHierarchyWithGiftButtons;

console.log('✅ Hierarchy gift buttons module loaded');
