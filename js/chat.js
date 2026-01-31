/** * js/chat.js - High-Fidelity Community Hub (Fixed & Optimized) */

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

function initChat() {
    const myName = localStorage.getItem('pyramidUser');
    if (!myName) return;

    // 1. TYPING INDICATOR
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('input', () => {
        db.collection("status").doc(myName).set({ typing: true, time: Date.now() });
    });

    db.collection("status").onSnapshot(snap => {
        const typers = [];
        snap.forEach(doc => { 
            if(doc.data().typing && doc.id !== myName && (Date.now() - doc.data().time < 4000)) {
                typers.push(doc.id);
            }
        });
        document.getElementById('typing-display').innerText = typers.length > 0 ? `${typers.join(', ')} is typing...` : "";
    });

    // 2. REAL-TIME MESSAGES
    let isInitialLoad = true;
    db.collection("messages").orderBy("time", "desc").limit(40).onSnapshot(snap => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = "";

        snap.docChanges().forEach(change => {
            if (change.type === "added" && !isInitialLoad) {
                const m = change.doc.data();
                if (m.type === "GIFT") handleGiftEffects(GIFT_LIST[m.giftName]);
                else if (m.user === "SYSTEM") sounds.system.play().catch(()=>{});
            }
        });

        snap.forEach(doc => renderMessage(doc.data(), chatBox));
        isInitialLoad = false;
    });
}

function handleGiftEffects(price) {
    if (!price) return;
    if (price <= 75000) sounds.normal.play().catch(()=>{});
    else if (price <= 125000) sounds.cool.play().catch(()=>{});
    else { sounds.legendary.play().catch(()=>{}); triggerScreenFlash(); }
}

function triggerScreenFlash() {
    const v = document.createElement('div');
    v.className = "fixed inset-0 bg-[#d4af37]/20 z-[99] pointer-events-none fade-in";
    document.body.appendChild(v);
    setTimeout(() => v.remove(), 500);
}

function renderMessage(m, container) {
    const isSystem = m.user === "SYSTEM";
    const isGift = m.type === "GIFT";
    const div = document.createElement('div');
    
    if (isGift) {
        div.className = "flex flex-col items-center my-6 p-4 border-y border-[#d4af37]/30 bg-[#d4af37]/5 fade-in";
        div.innerHTML = `
            <p class="text-[9px] tracking-[0.4em] text-[#d4af37] font-bold mb-1 uppercase">Sovereign Gift</p>
            <p class="text-xs text-white text-center">
                <span class="text-[#d4af37] font-bold">${m.user}</span> gifted 
                <span class="underline">${m.giftName}</span> to 
                <span class="text-[#d4af37] font-bold">${m.target}</span>
            </p>`;
    } else {
        div.className = "flex flex-col mb-4 fade-in";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-bold tracking-widest ${isSystem ? 'text-[#d4af37]' : 'text-zinc-500'}">${m.user}</span>
                <button onclick="openGiftMenu('${m.user}')" class="text-[8px] border border-[#d4af37]/50 px-2 py-0.5 text-[#d4af37] rounded-sm uppercase tracking-tighter">Gift</button>
            </div>
            <div class="p-3 ${isSystem ? 'bg-[#d4af37]/10 border-l-2 border-[#d4af37] text-white italic' : 'bg-zinc-900/60 border-l border-zinc-800 text-zinc-300'} text-sm">
                ${m.text}
            </div>`;
    }
    container.appendChild(div);
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    const myName = localStorage.getItem('pyramidUser');
    if(!text || !myName) return;

    await db.collection("messages").add({
        user: myName,
        text: text,
        type: "TEXT",
        time: Date.now()
    });
    input.value = "";
    // Reset typing status
    db.collection("status").doc(myName).set({ typing: false });
}

async function openGiftMenu(targetName) {
    const myName = localStorage.getItem('pyramidUser');
    if(targetName === myName) return alert("Self-gifting is forbidden.");
    
    let options = Object.entries(GIFT_LIST).map(([name, price]) => `${name}: ${price.toLocaleString()}`).join("\n");
    const choice = prompt(`ENTER GIFT NAME EXACTLY:\n\n${options}`);
    
    if (choice && GIFT_LIST[choice]) {
        await executeGift(myName, targetName, choice, GIFT_LIST[choice]);
    } else if (choice) {
        alert("Invalid gift. Please type the name exactly (e.g., Lamborghini).");
    }
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
