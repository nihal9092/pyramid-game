/** js/chat.js - Chat + Gift handling (robust) */

const GIFT_ICONS = {
  "Rose": "🌹", "Bouquet": "💐", "Phone": "📱", "Cycle": "🚲",
  "Scooty": "🛵", "Laptop": "💻", "Bike": "🏍️", "Car": "🚗",
  "Lamborghini": "🏎️", "Ferrari": "🏎️", "Rolls Royce": "🚙",
  "Private Jet": "✈️", "Bag of Cash": "💰"
};

const GIFT_LIST = {
  "Rose": 1000, "Bouquet": 2000, "Phone": 5000, "Cycle": 10000,
  "Scooty": 20000, "Laptop": 30000, "Bike": 50000, "Car": 75000,
  "Lamborghini": 100000, "Ferrari": 125000, "Rolls Royce": 150000,
  "Private Jet": 300000, "Bag of Cash": 500000
};

const sounds = {
  normal: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
  cool: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'),
  legendary: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),
  system: new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3')
};

function getSoulColor(name) {
  if (!name) return '#9ca3af';
  if (name === "SYSTEM") return "#d4af37";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 80%, 60%)`;
}

/* --------- Messaging / Chat init --------- */
function initChat() {
  // Ensure db (Firestore) exists
  if (typeof db === 'undefined') {
    console.error('Firestore "db" not found. Ensure Firebase is initialized before chat.js');
    return;
  }

  const myName = localStorage.getItem('pyramidUser');
  if (!myName) {
    console.warn('pyramidUser not set in localStorage. Chat disabled until login.');
    // Still bind send controls if present so user sees UI behaviour
  }

  // Typing indicator
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      if (!myName) return;
      db.collection("status").doc(myName).set({ typing: true, time: Date.now() }).catch(err => {
        console.error('Failed to write typing status:', err);
      });
    });
  }

  db.collection("status").onSnapshot(snap => {
    const typers = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (data && data.typing && (Date.now() - (data.time || 0) < 4000)) {
        if (doc.id !== myName) typers.push(doc.id);
      }
    });
    const el = document.getElementById('typing-display');
    if (el) el.innerText = typers.length ? `${typers.join(', ')} is typing...` : "";
  }, err => console.error('status onSnapshot error:', err));

  // Message listener (realtime)
  let isInitialLoad = true;
  db.collection("messages").orderBy("time", "desc").limit(40)
    .onSnapshot(snap => {
      const chatBox = document.getElementById('chat-box');
      if (!chatBox) {
        console.error('chat-box element not found.');
        return;
      }
      // Clear then re-render
      chatBox.innerHTML = "";

      snap.docChanges().forEach(change => {
        if (change.type === "added" && !isInitialLoad) {
          const m = change.doc.data();
          if (!m) return;
          if (m.type === "GIFT") {
            handleGiftEffects(m.giftName, GIFT_LIST[m.giftName]);
            showTopNotification(m.user, m.target, m.giftName);
          } else if (m.user === "SYSTEM") {
            sounds.system.play().catch(()=>{});
          }
        }
      });

      snap.forEach(doc => renderMessage(doc.data(), chatBox));
      isInitialLoad = false;
    }, err => console.error('messages onSnapshot error:', err));

  // Bind send controls
  bindSendControls();
}

/* --------- Notifications & Effects --------- */
function showTopNotification(sender, target, giftName) {
  const icon = GIFT_ICONS[giftName] || "🎁";
  const notif = document.createElement('div');
  notif.className = "fixed top-0 left-0 w-full bg-black/90 border-b border-[#d4af37] z-[100] p-4 flex items-center justify-center gap-4 shadow-[0_0_30px_#d4af37]";
  notif.style.transition = 'transform .4s, opacity .4s';
  notif.innerHTML = `
    <span style="font-size:32px; animation: bounce 1s infinite">${icon}</span>
    <div style="text-align:center">
      <p style="color:#d4af37; font-size:10px; letter-spacing:2px; font-weight:700; text-transform:uppercase">Sovereign Transaction</p>
      <p style="color:white; font-size:12px; margin-top:4px;">
        <span style="color:${getSoulColor(sender)}">${sender}</span> sent
        <span style="color:#d4af37; font-weight:700"> ${giftName} </span> to
        <span style="color:${getSoulColor(target)}">${target}</span>
      </p>
    </div>
  `;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateY(-100%)';
    setTimeout(() => notif.remove(), 500);
  }, 5000);
}

function handleGiftEffects(name, price) {
  if (!price) return;
  if (price <= 75000) sounds.normal.play().catch(()=>{});
  else if (price <= 125000) sounds.cool.play().catch(()=>{});
  else sounds.legendary.play().catch(()=>{});
}

/* --------- Render messages & Gift handlers --------- */
function renderMessage(m, container) {
  if (!m || !container) return;
  const isGift = m.type === "GIFT";
  const userColor = getSoulColor(m.user || 'Unknown');
  const div = document.createElement('div');

  if (isGift) {
    const icon = GIFT_ICONS[m.giftName] || "🎁";
    div.className = "flex flex-col items-center my-6 p-4 border-y";
    div.innerHTML = `
      <div style="font-size:20px;margin-bottom:6px">${icon}</div>
      <p style="font-size:10px;color:#d4af37;text-transform:uppercase;font-weight:700">Sovereign Gift</p>
      <p style="color:white;font-size:12px;text-align:center;margin-top:6px">
        <span style="color:${userColor};font-weight:700">${m.user}</span>
        gifted <span style="text-decoration:underline">${m.giftName}</span> to
        <span style="color:${getSoulColor(m.target)};font-weight:700">${m.target}</span>
      </p>`;
  } else {
    div.className = "flex flex-col mb-4";
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '6px';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = m.user || 'Unknown';
    nameSpan.style.color = userColor;
    nameSpan.style.fontWeight = '700';
    nameSpan.style.fontSize = '11px';
    nameSpan.style.textTransform = 'uppercase';

    const giftBtn = document.createElement('button');
    giftBtn.textContent = 'Gift';
    giftBtn.style.fontSize = '10px';
    giftBtn.dataset.user = m.user || '';
    giftBtn.className = 'gift-btn';

    giftBtn.addEventListener('click', (e) => {
      const target = e.currentTarget.dataset.user;
      if (typeof window.openGiftMenu === 'function') {
        try { window.openGiftMenu(target); } catch (err) {
          console.error('openGiftMenu threw:', err);
          fallbackOpenGiftMenu(target);
        }
      } else {
        fallbackOpenGiftMenu(target);
      }
    });

    header.appendChild(nameSpan);
    header.appendChild(giftBtn);

    const msgDiv = document.createElement('div');
    msgDiv.style.borderLeft = `4px solid ${userColor}`;
    msgDiv.style.padding = '8px';
    msgDiv.style.background = 'rgba(17,24,39,0.6)';
    msgDiv.style.color = '#d1d5db';
    msgDiv.style.fontSize = '13px';
    msgDiv.innerHTML = m.text || '';

    div.appendChild(header);
    div.appendChild(msgDiv);
  }

  container.appendChild(div);
}

/* --------- Fallback Gift UI (useful for testing) --------- */
function fallbackOpenGiftMenu(targetUser) {
  const myName = localStorage.getItem('pyramidUser');
  if (!myName) {
    alert('You must be logged in to send gifts.');
    return;
  }
  const giftNames = Object.keys(GIFT_LIST);
  const choice = prompt(`Send gift to ${targetUser}\nAvailable: ${giftNames.join(', ')}\nEnter gift name exactly:`);
  if (!choice) return;
  const giftName = choice.trim();
  if (!GIFT_LIST[giftName]) {
    alert('Invalid gift name.');
    return;
  }
  const price = GIFT_LIST[giftName];
  if (!confirm(`Send ${giftName} (${price} credits) to ${targetUser}?`)) return;
  executeGift(myName, targetUser, giftName, price);
}

/* --------- Execute Gift (transaction) --------- */
async function executeGift(sender, target, giftName, price) {
  if (typeof db === 'undefined') {
    alert('Database not initialized.');
    return;
  }
  const senderRef = db.collection("users").doc(sender);
  const targetRef = db.collection("users").doc(target);

  try {
    await db.runTransaction(async (t) => {
      const sDoc = await t.get(senderRef);
      const tDoc = await t.get(targetRef);
      if (!sDoc.exists) throw "Sender missing";
      if (!tDoc.exists) throw "Target missing";

      const sData = sDoc.data() || {};
      const tData = tDoc.data() || {};
      if ((sData.credits || 0) < price) throw "Insufficient credits";

      t.update(senderRef, { credits: (sData.credits || 0) - price });
      t.update(targetRef, { credits: (tData.credits || 0) + price });
    });

    await db.collection("messages").add({
      user: sender,
      target,
      giftName,
      type: "GIFT",
      time: Date.now()
    });

    console.log('Gift sent:', sender, '->', target, giftName, price);
    handleGiftEffects(giftName, price);
  } catch (err) {
    console.error('executeGift error:', err);
    alert('Gift failed: ' + err);
  }
}

/* --------- Sending plain chat messages --------- */
function sendMessage() {
  if (typeof db === 'undefined') {
    alert('Database not initialized.');
    return;
  }
  const myName = localStorage.getItem('pyramidUser');
  if (!myName) {
    alert('You must be logged in to send messages.');
    return;
  }
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) return;
  db.collection('messages').add({
    user: myName,
    text,
    type: 'MSG',
    time: Date.now()
  }).then(() => {
    input.value = '';
  }).catch(err => {
    console.error('sendMessage failed:', err);
    alert('Send failed: ' + err.message);
  });
}

function bindSendControls() {
  const sendBtn = document.getElementById('send-btn') || document.getElementById('sendButton') || document.getElementById('send');
  const input = document.getElementById('chat-input');
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
}

/* --------- Attempt to expose openGiftMenu if defined elsewhere --------- */
if (typeof openGiftMenu === 'function') window.openGiftMenu = openGiftMenu;

/* --------- Init on DOM ready (ensures firebase script runs first) --------- */
document.addEventListener('DOMContentLoaded', () => {
  try { initChat(); } catch (err) { console.error('initChat failed:', err); }
});
