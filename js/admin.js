/** * js/admin.js - The Sovereign Command Center (enhanced)
 * Trigger: Double-tap Nihal's name card (unchanged)
 *
 * Notes:
 * - This file expects a global `db` Firestore instance and a global `loadHierarchy` function used elsewhere.
 * - Admin changes are written to a collection "adminActions" for audit logging.
 * - User documents are assumed to be addressed by their `name` (existing app pattern).
 */

async function openAdminPower() {
    const pass = prompt("SOVEREIGN OVERRIDE REQUIRED:");
    if (pass !== "OWNER NG") return alert("Unauthorized Access Detected.");

    // If already open, focus
    if (document.getElementById('admin-panel')) {
        document.getElementById('admin-panel').scrollIntoView();
        return;
    }

    // Create the Admin Panel UI on the fly
    const panel = document.createElement('div');
    panel.id = "admin-panel";
    panel.className = "fixed inset-0 bg-black/95 z-[100] p-6 overflow-y-auto fade-in text-white";
    panel.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="cinzel text-2xl text-[#d4af37]">Sovereign Control</h2>
                    <div class="text-xs text-zinc-400">Actions are audited to <code>adminActions</code></div>
                </div>
                <div class="flex gap-2 items-center">
                    <input id="admin-search" type="search" placeholder="Search name / title..." class="bg-zinc-900 p-2 text-sm outline-none" />
                    <button id="refresh-admin" class="bg-zinc-800 px-3 py-1 text-xs">REFRESH</button>
                    <button id="close-admin" class="bg-red-700 px-3 py-1 text-xs">EXIT</button>
                </div>
            </div>
            
            <div class="mb-6 p-4 border border-[#d4af37] bg-black">
                <h3 class="text-xs text-[#d4af37] mb-2 uppercase tracking-widest">Global Broadcast</h3>
                <div class="flex gap-2">
                    <input id="broadcast-msg" type="text" placeholder="Message to all subjects..." class="flex-1 bg-zinc-900 p-2 mb-2 text-sm outline-none">
                    <button id="send-broadcast" class="bg-[#d4af37] text-black px-4 py-1 text-xs font-bold">SEND AS SYSTEM</button>
                    <button id="reset-global-messages" class="bg-red-700 text-white px-3 py-1 text-xs">RESET GLOBAL MSGS</button>
                </div>
            </div>

            <div id="admin-user-list" class="space-y-2">
                <!-- user rows injected here -->
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // Attach simple handlers
    document.getElementById('close-admin').onclick = () => panel.remove();
    document.getElementById('refresh-admin').onclick = loadAdminUserData;
    document.getElementById('send-broadcast').onclick = sendBroadcast;
    document.getElementById('admin-search').addEventListener('input', debounce(loadAdminUserData, 300));
    document.getElementById('reset-global-messages').onclick = resetGlobalMessages;

    loadAdminUserData();
}

/**
 * Utility: debounce for search input
 */
function debounce(fn, ms) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
    };
}

/**
 * Load admin view of users with quick action buttons and search
 */
async function loadAdminUserData() {
    const list = document.getElementById('admin-user-list');
    const search = document.getElementById('admin-search')?.value?.toLowerCase() || '';

    // header row
    list.innerHTML = `<div class="grid grid-cols-6 text-[10px] text-zinc-500 mb-2 uppercase tracking-widest gap-2">
        <span class="col-span-2">Name</span><span>Credits</span><span>Votes</span><span>Title / Role</span><span>Actions</span>
    </div>`;

    try {
        const snapshot = await db.collection("users").orderBy("credits", "desc").get();

        snapshot.forEach(doc => {
            const u = doc.data();
            const key = doc.id; // name as ID per app
            // basic search filter
            if (search) {
                const hay = `${u.name} ${u.title || ''} ${u.role || ''}`.toLowerCase();
                if (!hay.includes(search)) return;
            }

            const row = document.createElement('div');
            row.className = `grid grid-cols-6 text-xs py-2 border-b border-zinc-900 items-center gap-2 ${u.banned ? 'opacity-40' : ''}`;
            row.innerHTML = `
                <div class="col-span-2">
                    <div class="font-bold">${escapeHtml(u.name)}</div>
                    <div class="text-[10px] text-zinc-500">${u.email ? escapeHtml(u.email) : ''}</div>
                </div>
                <div class="font-mono text-green-500">${(u.credits || 0).toLocaleString()}</div>
                <div>${u.totalVotesReceived || 0}</div>
                <div class="text-[#d4af37]">${escapeHtml(u.title || '')}${u.role ? ' / ' + escapeHtml(u.role) : ''}${u.suspendedUntil ? '<div class="text-[10px] text-red-500">SUSPENDED UNTIL: ' + new Date(u.suspendedUntil).toLocaleString() + '</div>' : ''}</div>
                <div class="flex gap-2">
                    <button class="admin-btn edit" data-name="${escapeAttr(key)}">EDIT</button>
                    <button class="admin-btn suspend" data-name="${escapeAttr(key)}">${u.suspendedUntil ? 'EXTEND' : 'SUSP'}</button>
                    <button class="admin-btn ban" data-name="${escapeAttr(key)}">${u.banned ? 'UNBAN' : 'BAN'}</button>
                    <button class="admin-btn more" data-name="${escapeAttr(key)}">MORE</button>
                </div>
            `;
            list.appendChild(row);
        });

        // delegate event listeners for buttons (fewer bindings)
        list.querySelectorAll('.admin-btn.edit').forEach(b => b.onclick = (e) => openEditMenu(e.target.dataset.name));
        list.querySelectorAll('.admin-btn.suspend').forEach(b => b.onclick = (e) => openSuspendMenu(e.target.dataset.name));
        list.querySelectorAll('.admin-btn.ban').forEach(b => b.onclick = (e) => toggleBan(e.target.dataset.name));
        list.querySelectorAll('.admin-btn.more').forEach(b => b.onclick = (e) => openMoreMenu(e.target.dataset.name));
    } catch (err) {
        console.error("Failed to load admin users", err);
        alert("Failed to load users. Check console for details.");
    }
}

/**
 * Escape helpers to avoid injecting raw content into admin panel
 */
function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

/**
 * Open a small edit menu for the user with common admin modifications.
 */
async function openEditMenu(name) {
    const doc = await db.collection("users").doc(name).get();
    if (!doc.exists) return alert("User not found.");
    const u = doc.data();

    const action = prompt(
        `Edit ${u.name} - choose action number:\n` +
        `1: Set Title\n2: Set Role\n3: Set Credits\n4: Add Credits\n5: Set Votes\n6: Reset Votes\n7: Impersonate (client-side)\n8: View raw JSON`
    );
    if (!action) return;

    try {
        if (action === "1") {
            const val = prompt("New Title:", u.title || "");
            if (val === null) return;
            await updateUser(name, { title: val }, `Set title to "${val}"`);
        } else if (action === "2") {
            const val = prompt("New Role (e.g., user, mod, admin):", u.role || "user");
            if (val === null) return;
            await updateUser(name, { role: val }, `Set role to "${val}"`);
        } else if (action === "3") {
            const val = prompt("Set Credits (integer):", String(u.credits || 0));
            if (val === null) return;
            const num = parseInt(val, 10) || 0;
            await updateUser(name, { credits: num }, `Set credits to ${num}`);
        } else if (action === "4") {
            const val = prompt("Add Credits (integer, positive or negative):", "0");
            if (val === null) return;
            const delta = parseInt(val, 10) || 0;
            const newCredits = (u.credits || 0) + delta;
            await updateUser(name, { credits: newCredits }, `Adjusted credits by ${delta} (now ${newCredits})`);
        } else if (action === "5") {
            const val = prompt("Set Votes Received (integer):", String(u.totalVotesReceived || 0));
            if (val === null) return;
            const num = parseInt(val, 10) || 0;
            await updateUser(name, { totalVotesReceived: num }, `Set votes to ${num}`);
        } else if (action === "6") {
            const confirmReset = confirm(`Reset ${u.name}'s votes to zero? This cannot be undone.`);
            if (!confirmReset) return;
            await updateUser(name, { totalVotesReceived: 0 }, `Reset votes to 0`);
        } else if (action === "7") {
            impersonateUser(name);
        } else if (action === "8") {
            alert(JSON.stringify(u, null, 2));
        } else {
            alert("Unknown action.");
        }
        loadAdminUserData();
        if (typeof loadHierarchy === "function") loadHierarchy();
    } catch (err) {
        console.error(err);
        alert("Failed to update user. See console.");
    }
}

/**
 * Open suspend menu to set a suspension until a future time.
 */
async function openSuspendMenu(name) {
    const doc = await db.collection("users").doc(name).get();
    if (!doc.exists) return alert("User not found.");
    const u = doc.data();

    const existing = u.suspendedUntil ? `Currently suspended until ${new Date(u.suspendedUntil).toLocaleString()}\n` : '';
    const mode = prompt(`${existing}Choose:\n1: Suspend for hours\n2: Suspend for days\n3: Clear suspension`);
    if (!mode) return;

    if (mode === "3") {
        await updateUser(name, { suspendedUntil: null, suspendedReason: null }, `Cleared suspension`);
        alert("Suspension cleared.");
        loadAdminUserData();
        return;
    }

    const amount = prompt(mode === "1" ? "Hours to suspend for:" : "Days to suspend for:");
    if (!amount) return;
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return alert("Invalid duration.");

    const ms = (mode === "1") ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
    const until = Date.now() + ms;
    const reason = prompt("Reason for suspension (optional):") || "No reason provided";

    await updateUser(name, { suspendedUntil: until, suspendedReason: reason }, `Suspended for ${n} ${mode === "1" ? "hours" : "days"} - ${reason}`);
    alert(`${name} suspended until ${new Date(until).toLocaleString()}`);
    loadAdminUserData();
    if (typeof loadHierarchy === "function") loadHierarchy();
}

/**
 * Toggle ban/unban and capture reason
 */
async function toggleBan(name) {
    const doc = await db.collection("users").doc(name).get();
    if (!doc.exists) return alert("User not found.");
    const u = doc.data();
    const willBan = !u.banned;
    const reason = prompt(willBan ? "Reason for Ban/Suspension:" : "Reason for Unban (optional):") || (willBan ? "No reason provided" : "Unbanned");

    await updateUser(name, { banned: willBan, banReason: willBan ? reason : null }, `${willBan ? 'Banned' : 'Unbanned'} - ${reason}`);
    alert(`${name} ${willBan ? 'banned' : 'unbanned'}.`);
    loadAdminUserData();
    if (typeof loadHierarchy === "function") loadHierarchy();
}

/**
 * Additional actions menu: reset credits, delete user (warning), export user JSON, view admin log for user
 */
async function openMoreMenu(name) {
    const choice = prompt(
        `More actions for ${name}:\n` +
        `1: Reset Credits to 0\n2: Export user JSON\n3: Delete user (IRREVERSIBLE)\n4: View recent admin actions on this user\n5: Grant temporary credits\nChoose number:`
    );
    if (!choice) return;

    try {
        if (choice === "1") {
            const confirmReset = confirm(`Reset ${name}'s credits to 0?`);
            if (!confirmReset) return;
            await updateUser(name, { credits: 0 }, `Reset credits to 0`);
            alert("Credits reset.");
        } else if (choice === "2") {
            const doc = await db.collection("users").doc(name).get();
            if (!doc.exists) return alert("User not found.");
            const json = JSON.stringify(doc.data(), null, 2);
            // Simple way to let admin copy: show in prompt-like dialog
            prompt("User JSON (copy):", json);
        } else if (choice === "3") {
            const confirmDel = prompt(`Type DELETE to permanently remove ${name}:`);
            if (confirmDel !== "DELETE") return alert("Deletion aborted.");
            await db.collection("users").doc(name).delete();
            await logAdminAction(getCurrentAdminName(), "delete_user", name, { note: "Deleted user via admin panel" });
            alert("User deleted.");
        } else if (choice === "4") {
            // fetch adminActions for user
            const q = await db.collection("adminActions").where("target", "==", name).orderBy("time", "desc").limit(20).get();
            const entries = [];
            q.forEach(d => entries.push(d.data()));
            if (entries.length === 0) return alert("No admin actions found for this user.");
            alert(JSON.stringify(entries, null, 2));
        } else if (choice === "5") {
            const amt = prompt("Amount of credits to grant (positive integer):", "100");
            if (amt === null) return;
            const n = parseInt(amt, 10) || 0;
            const doc = await db.collection("users").doc(name).get();
            if (!doc.exists) return alert("User not found.");
            const newCredits = (doc.data().credits || 0) + n;
            await updateUser(name, { credits: newCredits }, `Granted temporary credits: ${n} (now ${newCredits})`);
            alert(`Granted ${n} credits to ${name}.`);
        } else {
            alert("Unknown option.");
        }
        loadAdminUserData();
        if (typeof loadHierarchy === "function") loadHierarchy();
    } catch (err) {
        console.error(err);
        alert("Action failed. See console.");
    }
}

/**
 * Helper: update user document and log the action to adminActions collection
 */
async function updateUser(name, updates, description = "") {
    try {
        const admin = getCurrentAdminName();
        updates._lastModifiedBy = admin;
        updates._lastModifiedAt = Date.now();
        await db.collection("users").doc(name).set(updates, { merge: true });
        await logAdminAction(admin, "update_user", name, { updates, description });
    } catch (err) {
        console.error("updateUser error", err);
        throw err;
    }
}

/**
 * Write an audit record of admin actions
 */
async function logAdminAction(actor, action, target, details = {}) {
    try {
        await db.collection("adminActions").add({
            actor: actor || "unknown",
            action,
            target,
            details,
            time: Date.now()
        });
    } catch (err) {
        console.warn("Failed to write admin action log", err);
    }
}

/**
 * Simple helper to get the current admin name for logging.
 * Adjust to integrate with your auth flow; falls back to "SOVEREIGN".
 */
function getCurrentAdminName() {
    try {
        // if you use firebase auth, return firebase.auth().currentUser.displayName || email
        if (typeof currentUserName !== "undefined") return currentUserName;
        return "SOVEREIGN";
    } catch {
        return "SOVEREIGN";
    }
}

/**
 * Impersonate (client-side): store a marker in sessionStorage and reload UI
 * Note: This is only client-side and does NOT bypass server-side security.
 */
function impersonateUser(name) {
    if (!confirm(`Start impersonating ${name} on this browser session? You will appear as them until you end impersonation.`)) return;
    sessionStorage.setItem('adminImpersonate', name);
    alert(`Now impersonating ${name}. Reloading...`);
    location.reload();
}

/**
 * Broadcast message to all users as SYSTEM (single function, unified)
 */
async function sendBroadcast() {
    const msgEl = document.getElementById('broadcast-msg');
    const msg = msgEl?.value?.trim();
    if (!msg) return alert("Enter a message to broadcast.");
    try {
        await db.collection("messages").add({
            user: "SYSTEM",
            text: msg.toUpperCase(),
            type: "TEXT",
            time: Date.now(),
            isGlobal: true
        });
        await logAdminAction(getCurrentAdminName(), "broadcast", "ALL", { text: msg });
        // Play a sound to highlight broadcast (non-blocking)
        try {
            const broadcastSound = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
            broadcastSound.volume = 0.6;
            broadcastSound.play().catch(()=>{/* ignore autoplay errors */});
        } catch {}
        msgEl.value = '';
        alert("Broadcast dispatched.");
    } catch (err) {
        console.error("sendBroadcast error", err);
        alert("Failed to send broadcast.");
    }
}

/**
 * Reset (delete) all global messages (isGlobal == true).
 * Uses batched deletes (500 docs per batch) and repeats until none remain.
 * Requires typing a confirmation phrase to avoid accidents.
 */
async function resetGlobalMessages() {
    const confirmPhrase = "RESET GLOBAL MESSAGES";
    const typed = prompt(`Type "${confirmPhrase}" to confirm deletion of ALL global messages (this is irreversible):`);
    if (typed !== confirmPhrase) return alert("Aborted. Confirmation phrase did not match.");

    const admin = getCurrentAdminName();
    let totalDeleted = 0;
    try {
        // Loop: fetch up to 500 docs, delete in batch, repeat until none remain
        while (true) {
            const snapshot = await db.collection("messages").where("isGlobal", "==", true).limit(500).get();
            if (snapshot.empty) break;
            const batch = db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            totalDeleted += snapshot.size;
            // small delay to avoid hammering (optional)
            await new Promise(r => setTimeout(r, 200));
        }
        await logAdminAction(admin, "reset_global_messages", "ALL", { deletedCount: totalDeleted });
        alert(`Successfully deleted ${totalDeleted} global messages.`);
    } catch (err) {
        console.error("resetGlobalMessages error", err);
        alert("Failed to reset global messages. See console for details.");
        await logAdminAction(admin, "reset_global_messages_failed", "ALL", { error: String(err) });
    }
}

/**
 * Small convenience: attempt to auto-clear expired suspensions (run at admin panel load)
 * This doesn't replace server rules; it's a helper that will clear suspendedUntil if it's passed.
 */
async function clearExpiredSuspensions() {
    try {
        const now = Date.now();
        const q = await db.collection("users").where("suspendedUntil", "<=", now).get();
        const batch = db.batch();
        q.forEach(doc => {
            const ref = db.collection("users").doc(doc.id);
            batch.update(ref, { suspendedUntil: null, suspendedReason: null });
            logAdminAction(getCurrentAdminName(), "auto_clear_suspension", doc.id, { note: "Cleared expired suspension" });
        });
        if (!q.empty) await batch.commit();
    } catch (err) {
        // do not fail silently in console
        console.warn("clearExpiredSuspensions failed", err);
    }
}

// Run a quick cleanup pass
clearExpiredSuspensions();
