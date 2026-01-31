// js/chat.js

// Function to render message with programmatic gift handlers
function renderMessage(message) {
    const messageContainer = document.createElement('div');
    messageContainer.textContent = message;
    document.getElementById('chat').appendChild(messageContainer);
}

// Function to handle gift selection
function openGiftMenu() {
    const giftPicker = document.getElementById('giftPicker');
    giftPicker.style.display = giftPicker.style.display === 'none' ? 'block' : 'none';
}

// Fallback inline gift picker
if (!window.giftPicker) {
    window.giftPicker = openGiftMenu;
}

// Function to send message
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value;
    if (message) {
        renderMessage(message);
        messageInput.value = '';
    }
}

// Binding send button and Enter key to sendMessage
document.getElementById('sendButton').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Exposing openGiftMenu globally
window.openGiftMenu = openGiftMenu;