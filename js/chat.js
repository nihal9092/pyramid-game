/** * js/chat.js - Premium Community Hub with Tiered Audio & Visuals 
 */

const GIFT_LIST = {
    "Rose": 1000, "Bouquet": 2000, "Phone": 5000, "Cycle": 10000,
    "Scooty": 20000, "Laptop": 30000, "Bike": 50000, "Car": 75000,
    "Lamborghini": 100000, "Ferrari": 125000, "Rolls Royce": 150000,
    "Private Jet": 300000, "Bag of Cash": 500000
};

// PRE-LOAD SOUND EFFECTS
const sounds = {
    normal: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'), // Tiers up to 75k
    cool: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'),   // Tiers up to 125k
    legendary: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'), // Tiers above 125k
    system: new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3')   // Admin Broadcasts
};

function initChat() {
    const myName = localStorage.getItem('pyramidUser');
    
    // 1. TYPING INDICATOR LISTENER
    db.collection("status").onSnapshot(snap => {
        const typers = [];
        snap.forEach(doc => { 
            if(doc.data().typing && doc.id !== myName && (Date.now() - doc.data().time < 5000)) {
                typers.push(doc.id);
            }
        });
        document.getElementById('typing-display').innerText = typers.length > 0 ? `${typers.join(', ')} is typing...` : "";
    });

    // 2. REAL-TIME MESSAGE & AUDIO LISTENER
    let isInitialLoad = true;
    db.collection("messages").orderBy("time", "desc").limit(40).onSnapshot(snap => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = "";

        snap.docChanges().forEach(change => {
            if (change.type === "added" && !isInitialLoad) {
                const m = change.doc.data();
                if (m.type === "GIFT") {
                    handleGiftEffects(GIFT_LIST[m.giftName]);
                } else if (m.user === "SYSTEM") {
                    sounds.system.play().catch(() => {});
                }
            }
        });

        snap.forEach(doc => {
            renderMessage(doc.data(), chatBox);
        });
        isInitialLoad = false;
    });
}

// 3. AUDIO & VISUAL LOGIC
function handleGiftEffects(price) {
    // Reset and Play Audio Tiers
    Object.values(sounds).forEach(s => { s.pause(); s.currentTime = 0; });

    if (price <= 75000) {
        sounds.normal.play().catch(() => {});
    } else if (price <= 125000) {
        sounds.cool.play().catch(() => {});
    } else {
        sounds.legendary.play().catch(() => {});
        triggerScreenFlash(); // Visual "Flex" for Legendary gifts
    }
}

function triggerScreenFlash() {
    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 bg-[#d4af37]/20 z-[99] pointer-events-none fade-in";
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 500);
}

// 4. MESSAGE RENDERING
function renderMessage(m, container) {
    const isSystem = m.user === "SYSTEM";
    const isGift = m.type === "GIFT";
    const div = document.createElement('div');
    
    if (isGift) {
        div.className = "flex flex-col items-center my-6 p-4 border-y border-[#d4af37]/30 bg-[#d4af37]/5 fade-in";
        div.innerHTML = `
            <p class="text-[9px] tracking-[0.4em] text-[#d4af37] font-bold mb-1">SOVEREIGN GIFT RECEIVED</p>
            <p class="text-xs text-white text-center">
                <span class="text-[#d4af37] font-bold">${m.user}</span> gifted 
                <span class="underline decoration-[#d4af37]">${m.giftName}</span> to 
                <span class="text-[#d4af37] font-bold">${m.target}</span>
            </p>
        `;
    } else {
        div.className = "group flex flex-col mb-4 fade-in";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-bold tracking-widest ${isSystem ? 'text-[#d4af37]' : 'text-zinc-500'}">${m.user}</span>
                <button onclick="openGiftMenu('${m.user}')" class="opacity-0 group-hover:opacity-100 text-[9px] text-[#d4af37] border border-[#d4af37] px-2 rounded-sm transition-all">GIFT</button>
            </div>
            <div class="p-3 ${isSystem ? 'bg-[#d4af37]/10 border-l-2 border-[#d4af37] text-white italic' : 'bg-zinc-900/40 border-l border-zinc-800 text-zinc-300'} text-sm">
                ${m.text}
            </div>
        `;
    }
    container.appendChild(div);
}

// 5. TRANSACTIONAL LOGIC
async function executeGift(sender, target, giftName, price) {
    const senderRef = db.collection("users").doc(sender);
    const targetRef = db.collection("users").doc(target);

    try {
        await db.runTransaction(async (t) => {
            const sDoc = await t.get(senderRef);
            if (sDoc.data().credits < price) throw "Insufficient credits for this flex.";

            t.update(senderRef, { credits: sDoc.data().credits - price });
            const tDoc = await t.get(targetRef);
            t.update(targetRef, { credits: (tDoc.data().credits || 0) + price });

            db.collection("messages").add({
                user: sender,
                target: target,
                giftName: giftName,
                type: "GIFT",
                time: Date.now()
            });
        });
    } catch (e) { alert(e); }
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text) return;

    await db.collection("messages").add({
        user: localStorage.getItem('pyramidUser'),
        text: text,
        type: "TEXT",
        time: Date.now()
    });
    input.value = "";
}

async function openGiftMenu(targetName) {
    const myName = localStorage.getItem('pyramidUser');
    if(targetName === myName) return alert("Self-gifting is forbidden.");
    
    let options = Object.entries(GIFT_LIST).map(([name, price]) => `${name}: ${price.toLocaleString()}`).join("\n");
    const choice = prompt(`Select Gift for ${targetName}:\n\n${options}`);
    
    if (GIFT_LIST[choice]) {
        await executeGift(myName, targetName, choice, GIFT_LIST[choice]);
    } else if (choice) {
        alert("Invalid gift selection.");
    }
}
