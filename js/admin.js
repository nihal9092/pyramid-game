/** * js/admin.js - The Sovereign Command Center
 * Trigger: Double-tap Nihal's name card
 */

async function openAdminPower() {
    const pass = prompt("SOVEREIGN OVERRIDE REQUIRED:");
    if (pass !== "OWNER NG") return alert("Unauthorized Access Detected.");

    // Create the Admin Panel UI on the fly
    const panel = document.createElement('div');
    panel.id = "admin-panel";
    panel.className = "fixed inset-0 bg-black/95 z-[100] p-6 overflow-y-auto fade-in";
    panel.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <div class="flex justify-between items-center mb-8">
                <h2 class="cinzel text-2xl text-[#d4af37]">Sovereign Control</h2>
                <button onclick="document.getElementById('admin-panel').remove()" class="text-white">EXIT</button>
            </div>
            
            <div class="mb-8 p-4 border border-[#d4af37] bg-black">
                <h3 class="text-xs text-[#d4af37] mb-2 uppercase">Global Broadcast</h3>
                <input id="broadcast-msg" type="text" placeholder="Message to all subjects..." class="w-full bg-zinc-900 p-2 mb-2 text-sm outline-none">
                <button onclick="sendBroadcast()" class="bg-[#d4af37] text-black px-4 py-1 text-xs font-bold">SEND AS SYSTEM</button>
            </div>

            <div id="admin-user-list" class="space-y-2">
                </div>
        </div>
    `;
    document.body.appendChild(panel);
    loadAdminUserData();
}

async function loadAdminUserData() {
    const list = document.getElementById('admin-user-list');
    const snapshot = await db.collection("users").get();
    
    list.innerHTML = `<div class="grid grid-cols-5 text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">
        <span>Name</span><span>Credits</span><span>Votes</span><span>Title</span><span>Actions</span>
    </div>`;

    snapshot.forEach(doc => {
        const u = doc.data();
        const row = document.createElement('div');
        row.className = `grid grid-cols-5 text-xs py-2 border-b border-zinc-900 items-center ${u.banned ? 'opacity-30' : ''}`;
        row.innerHTML = `
            <span class="font-bold">${u.name}</span>
            <span class="font-mono text-green-500">${u.credits.toLocaleString()}</span>
            <span>${u.totalVotesReceived}</span>
            <span class="text-[#d4af37]">${u.title}</span>
            <div class="flex gap-2">
                <button onclick="quickEdit('${u.name}')" class="text-blue-500">EDIT</button>
                <button onclick="banUser('${u.name}')" class="text-red-600">${u.banned ? 'UNBAN' : 'BAN'}</button>
            </div>
        `;
        list.appendChild(row);
    });
}

async function quickEdit(name) {
    const field = prompt("1: Title | 2: Credits | 3: Votes");
    const val = prompt("Enter new value:");
    const updates = {};
    if (field === "1") updates.title = val;
    if (field === "2") updates.credits = parseInt(val);
    if (field === "3") updates.totalVotesReceived = parseInt(val);
    
    await db.collection("users").doc(name).update(updates);
    loadAdminUserData();
    loadHierarchy(); // Refresh main UI
}
async function sendBroadcast() {
    const msg = document.getElementById('broadcast-msg').value;
    if(!msg) return;
    
    await db.collection("messages").add({
        user: "SYSTEM",
        text: msg.toUpperCase(),
        type: "TEXT",
        time: Date.now(),
        isGlobal: true
    });
    // Add a specific notification sound for broadcasts
    const broadcastSound = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
    broadcastSound.play();
    alert("Broadcast dispatched.");
}

async function banUser(name) {
    const reason = prompt("Reason for Ban/Suspension:");
    const current = await db.collection("users").doc(name).get();
    await db.collection("users").doc(name).update({ banned: !current.data().banned, banReason: reason });
    alert("Subject status modified.");
    loadAdminUserData();
}

async function sendBroadcast() {
    const msg = document.getElementById('broadcast-msg').value;
    await db.collection("messages").add({
        user: "SYSTEM",
        text: msg,
        time: Date.now(),
        isGlobal: true
    });
    alert("Broadcast dispatched.");
}
