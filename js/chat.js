/** * js/chat.js - Soul Colors & Headline Flex Notifications */

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

// 1. GENERATE UNIQUE NEON COLOR FROM NAME
function getSoulColor(name) {
    if (name === "SYSTEM") return "#d4af37"; // Gold for System
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 80%, 60%)`; // Bright Neon Colors
}

function initChat() {
    const myName = localStorage.getItem('pyramidUser');
    if (!myName) return;

    // Typing Logic
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('input', () => {
        db.collection("status").doc(myName).set({ typing: true, time: Date.now() });
    });

    db.collection("status").onSnapshot(snap => {
        const typers = [];
        snap.forEach(doc => { 
            if(doc.data().typing && doc.id !== myName && (Date.now() - doc.data().time < 4000)) typers.push(doc.id);
        });
        document.getElementById('typing-display').innerText = typers.length > 0 ? `${typers.join(', ')} is typing...` : "";
    });

    // Message Listener
    let isInitialLoad = true;
    db.collection("messages").orderBy("time", "desc").limit(40).onSnapshot(snap => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = "";

        snap.docChanges().forEach(change => {
            if (change.type === "added" && !isInitialLoad) {
                const m = change.doc.data();
                if (m.type === "GIFT") {
                    handleGiftEffects(m.giftName, GIFT_LIST[m.giftName]);
                    // TRIGGER TOP NOTIFICATION
                    showTopNotification(m.user, m.target, m.giftName);
                }
                else if (m.user === "SYSTEM") sounds.system.play().catch(()=>{});
            }
        });

        snap.forEach(doc => renderMessage(doc.data(), chatBox));
        isInitialLoad = false;
    });
}

// 2. NEW NOTIFICATION SYSTEM
function showTopNotification(sender, target, giftName) {
    const icon = GIFT_ICONS[giftName] || "🎁";
    const notif = document.createElement('div');
    notif.className = "fixed top-0 left-0 w-full bg-black/90 border-b border-[#d4af37] z-[100] p-4 flex items-center justify-center gap-4 shadow-[0_0_30px_#d4af37] animate-slideDown";
    
    notif.innerHTML = `
        <span class="text-4xl animate-bounce">${icon}</span>
        <div class="text-center">
            <p class="text-[#d4af37] text-[10px] tracking-[0.3em] font-bold uppercase">Sovereign Transaction</p>
            <p class="text-white text-xs mt-1">
                <span style="color:${getSoulColor(sender)}">${sender}</span> sent 
                <span class="font-bold text-[#d4af37]">${giftName}</span> to 
                <span style="color:${getSoulColor(target)}">${target}</span>
            </p>
        </div>
    `;

    document.body.appendChild(notif);
    setTimeout(() => {
        notif.style.opacity = "0";
        notif.style.transform = "translateY(-100%)";
        setTimeout(() => notif.remove(), 500);
    }, 5000); // Stays for 5 seconds
}

function handleGiftEffects(name, price) {
    if (!price) return;
    if (price <= 75000) sounds.normal.play().catch(()=>{});
    else if (price <= 125000) sounds.cool.play().catch(()=>{});
    else { sounds.legendary.play().catch(()=>{}); }
}

function renderMessage(m, container) {
    const isSystem = m.user === "SYSTEM";
    const isGift = m.type === "GIFT";
    const userColor = getSoulColor(m.user); // Get Unique Color
    const div = document.createElement('div');
    
    if (isGift) {
        const icon = GIFT_ICONS[m.giftName] || "🎁";
        div.className = "flex flex-col items-center my-6 p-4 border-y border-[#d4af37]/30 bg-[#d4af37]/5 fade-in";
        div.innerHTML = `
            <div class="text-2xl mb-2">${icon}</div>
            <p class="text-[9px] tracking-[0.4em] text-[#d4af37] font-bold mb-1 uppercase">Sovereign Gift</p>
            <p class="text-xs text-white text-center">
                <span style="color:${userColor}" class="font-bold drop-shadow-[0_0_5px_${userColor}]">${m.user}</span> 
                gifted <span class="underline text-white">${m.giftName}</span> to 
                <span style="color:${getSoulColor(m.target)}" class="font-bold">${m.target}</span>
            </p>`;
    } else {
        // COLORED BUBBLE LOGIC
        div.className = "flex flex-col mb-4 fade-in";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span style="color:${userColor}; text-shadow: 0 0 10px ${userColor}40;" class="text-[10px] font-bold tracking-widest uppercase">
                    ${m.user}
                </span>
                <button onclick="openGiftMenu('${m.user}')" class="text-[8px] border border-zinc-800 px-2 py-0.5 text-zinc-500 hover:text-[#d4af37] rounded-sm uppercase tracking-tighter">Gift</button>
            </div>
            <div style="border-left-color:${userColor}" class="p-3 bg-zinc-900/60 border-l-2 text-zinc-300 text-sm">
                ${m.text}
            </div>`;
    }
    container.appendChild(div);
}
async function executeGift(sender, target, giftName, price) {
    const senderRef = db.collection("users").doc(sender);
    const targetRef = db.collection("users").doc(target);

    try {
        await db.runTransaction(async (t) => {
            // 1. PERFORM ALL READS FIRST (Fixing the error)
            const sDoc = await t.get(senderRef);
            const tDoc = await t.get(targetRef);

            if (!sDoc.exists) throw "Sender data missing.";
            if (!tDoc.exists) throw "Target user does not exist.";
            
            const senderData = sDoc.data();
            const targetData = tDoc.data();

            if (senderData.credits < price) {
                throw "Insufficient credits for this flex.";
            }

            // 2. PERFORM WRITES AFTER
            t.update(senderRef, { credits: senderData.credits - price });
            t.update(targetRef, { credits: (targetData.credits || 0) + price });
        });

        // 3. LOG THE MESSAGE (Only if transaction succeeds)
        await db.collection("messages").add({
            user: sender,
            target: target,
            giftName: giftName,
            type: "GIFT",
            time: Date.now()
        });

        // Play sound immediately for the sender
        handleGiftEffects(price); 

    } catch (e) {
        alert("Transaction Failed: " + e);
    }
}

// ... (Keep sendMessage, openGiftMenu, and executeGift EXACTLY as they were before) ...
// Copy the executeGift I fixed for you in the previous step here!
