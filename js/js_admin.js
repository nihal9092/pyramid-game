/**
 * js/admin.js - Full-featured Admin Panel
 * Source: https://github.com/Nihal99999/pyramid-game/blob/45ccf71a29d90ca0a7df49ccf4c9387790f75330/js/admin.js
 *
 * Assumptions:
 * - global Firestore `db` is available
 * - optional global `loadHierarchy()` exists and is called when necessary
 * - optional `currentUserName` or similar to identify admin
 *
 * Key features:
 * - Secure entry (simple prompt; replace with real auth in production)
 * - Paginated user listing with search, sorting, and selection for bulk actions
 * - Per-user actions: edit credits/title/role/votes, suspend, ban, impersonate, export, delete
 * - Admin broadcast (SYSTEM messages)
 * - Reset (delete) all global messages in batched operations
 * - Admin action audit logging (adminActions collection)
 * - Auto-clear expired suspensions on panel load
 * - Input validation and XSS-safe escaping for all displayed content
 * - Robust error handling & user feedback
 *
 * Notes for integration:
 * - Replace prompt-based auth with proper admin auth for production.
 * - Server security rules must enforce actual permission checks; client-side code is not a security layer.
 */

(function () {
    // --- Utilities & helpers (kept local to avoid global pollution) ---
    function escapeHtml(s) {
        if (s === undefined || s === null) return '';
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, '&quot;');
    }
    function fmtDate(ms) {
        if (!ms) return '';
        try { return new Date(ms).toLocaleString(); } catch { return String(ms); }
    }
    function nowMs() { return Date.now(); }
    function noop() {}
    function showAlert(msg) { alert(msg); }
    function confirmOrCancel(msg) { return confirm(msg); }

    // Minimal debounce
    function debounce(fn, ms = 300) {
        let t;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // Current admin display name for logging
    function getCurrentAdminName() {
        try {
            if (typeof currentUserName !== 'undefined') return currentUserName;
            // if firebase auth used: return firebase?.auth()?.currentUser?.displayName || firebase?.auth()?.currentUser?.email
            return 'SOVEREIGN';
        } catch {
            return 'SOVEREIGN';
        }
    }

    // Admin action logging
    async function logAdminAction(actor, action, target, details = {}) {
        try {
            await db.collection('adminActions').add({
                actor: actor || getCurrentAdminName(),
                action,
                target,
                details,
                time: nowMs()
            });
        } catch (err) {
            console.warn('logAdminAction failed', err);
        }
    }

    // --- Core admin functions used by UI --- 

    async function updateUser(name, updates, description = '') {
        try {
            const admin = getCurrentAdminName();
            updates._lastModifiedBy = admin;
            updates._lastModifiedAt = nowMs();
            await db.collection('users').doc(name).set(updates, { merge: true });
            await logAdminAction(admin, 'update_user', name, { updates, description });
        } catch (err) {
            console.error('updateUser error', err);
            throw err;
        }
    }

    async function deleteUser(name) {
        try {
            await db.collection('users').doc(name).delete();
            await logAdminAction(getCurrentAdminName(), 'delete_user', name, { note: 'Deleted user via admin panel' });
        } catch (err) {
            console.error('deleteUser error', err);
            throw err;
        }
    }

    async function batchDeleteGlobalMessages() {
        const confirmPhrase = 'RESET GLOBAL MESSAGES';
        const typed = prompt(`Type "${confirmPhrase}" to confirm deletion of ALL global messages (irreversible):`);
        if (typed !== confirmPhrase) return showAlert('Aborted. Confirmation phrase did not match.');

        const admin = getCurrentAdminName();
        let totalDeleted = 0;
        try {
            while (true) {
                const snapshot = await db.collection('messages').where('isGlobal', '==', true).limit(500).get();
                if (snapshot.empty) break;
                const batch = db.batch();
                snapshot.forEach(d => batch.delete(d.ref));
                await batch.commit();
                totalDeleted += snapshot.size;
                // small throttle
                await new Promise(r => setTimeout(r, 150));
            }
            await logAdminAction(admin, 'reset_global_messages', 'ALL', { deletedCount: totalDeleted });
            showAlert(`Successfully deleted ${totalDeleted} global messages.`);
        } catch (err) {
            console.error('resetGlobalMessages error', err);
            await logAdminAction(admin, 'reset_global_messages_failed', 'ALL', { error: String(err) });
            showAlert('Failed to reset global messages. See console.');
        }
    }

    async function sendBroadcastMessage(text) {
        if (!text || !text.trim()) return showAlert('Please enter a message.');
        try {
            const msg = text.trim();
            await db.collection('messages').add({
                user: 'SYSTEM',
                text: msg.toUpperCase(),
                type: 'TEXT',
                time: nowMs(),
                isGlobal: true
            });
            await logAdminAction(getCurrentAdminName(), 'broadcast', 'ALL', { text: msg });
            // try a short non-blocking sound
            try {
                const sound = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
                sound.volume = 0.6;
                sound.play().catch(noop);
            } catch {}
            showAlert('Broadcast dispatched.');
        } catch (err) {
            console.error('sendBroadcastMessage error', err);
            showAlert('Failed to send broadcast.');
        }
    }

    // Clear expired suspensions (best-effort)
    async function clearExpiredSuspensions() {
        try {
            const q = await db.collection('users').where('suspendedUntil', '<=', nowMs()).get();
            if (q.empty) return;
            const batch = db.batch();
            q.forEach(doc => {
                const ref = db.collection('users').doc(doc.id);
                batch.update(ref, { suspendedUntil: null, suspendedReason: null, _lastModifiedBy: getCurrentAdminName(), _lastModifiedAt: nowMs() });
                logAdminAction(getCurrentAdminName(), 'auto_clear_suspension', doc.id, { note: 'Cleared expired suspension' });
            });
            await batch.commit();
        } catch (err) {
            console.warn('clearExpiredSuspensions failed', err);
        }
    }

    // Simple impersonation (client-side only)
    function impersonateUser(name) {
        if (!confirm(`Start impersonating ${name} on this browser session?`)) return;
        sessionStorage.setItem('adminImpersonate', name);
        showAlert(`Now impersonating ${name}. Reloading...`);
        location.reload();
    }

    // --- UI / Panel code ---
    // State for pagination & filters
    const state = {
        pageSize: 40,
        lastVisible: null,
        search: '',
        orderBy: 'credits',
        orderDir: 'desc',
        selected: new Set(), // selected user doc IDs for bulk actions
    };

    function buildAdminPanel() {
        // If already open, focus
        const existing = document.getElementById('admin-panel');
        if (existing) {
            existing.scrollIntoView();
            return;
        }

        if (prompt('SOVEREIGN OVERRIDE REQUIRED:') !== 'OWNER NG') {
            return alert('Unauthorized Access Detected.');
        }

        const panel = document.createElement('div');
        panel.id = 'admin-panel';
        panel.className = 'fixed inset-0 bg-black/95 z-[100] p-6 overflow-y-auto fade-in text-white';
        panel.style.overflowY = 'auto';
        panel.innerHTML = `
            <div class="max-w-7xl mx-auto">
                <div class="flex justify-between items-start gap-4 mb-6">
                    <div>
                        <h2 class="cinzel text-2xl text-[#d4af37]">Sovereign Control</h2>
                        <div class="text-xs text-zinc-400">Actions are audited to <code>adminActions</code></div>
                        <div class="text-[11px] text-zinc-500 mt-1">Admin: ${escapeHtml(getCurrentAdminName())}</div>
                    </div>

                    <div class="flex gap-2 items-center ml-auto">
                        <input id="admin-search" type="search" placeholder="Search name / title / role / email..." class="bg-zinc-900 p-2 text-sm outline-none" />
                        <select id="admin-order" class="bg-zinc-900 p-2 text-sm">
                            <option value="credits:desc">Credits ↓</option>
                            <option value="credits:asc">Credits ↑</option>
                            <option value="name:asc">Name A→Z</option>
                            <option value="name:desc">Name Z→A</option>
                            <option value="votes:desc">Votes ↓</option>
                        </select>
                        <button id="refresh-admin" class="bg-zinc-800 px-3 py-1 text-xs">REFRESH</button>
                        <button id="close-admin" class="bg-red-700 px-3 py-1 text-xs">EXIT</button>
                    </div>
                </div>

                <div class="mb-6 p-4 border border-[#d4af37] bg-black grid gap-3">
                    <div class="flex gap-2 items-center">
                        <input id="broadcast-msg" type="text" placeholder="Message to all subjects..." class="flex-1 bg-zinc-900 p-2 text-sm outline-none">
                        <button id="send-broadcast" class="bg-[#d4af37] text-black px-4 py-1 text-xs font-bold">SEND AS SYSTEM</button>
                        <button id="reset-global-messages" class="bg-red-700 text-white px-3 py-1 text-xs">RESET GLOBAL MSGS</button>
                    </div>
                    <div class="flex gap-2 text-xs text-zinc-500">
                        <div><strong>Bulk:</strong> select rows to perform actions</div>
                        <button id="bulk-ban" class="bg-zinc-800 px-2 py-1 text-xs">BAN SELECTED</button>
                        <button id="bulk-unban" class="bg-zinc-800 px-2 py-1 text-xs">UNBAN SELECTED</button>
                        <button id="bulk-reset-credits" class="bg-zinc-800 px-2 py-1 text-xs">RESET CREDITS</button>
                        <button id="bulk-grant-credits" class="bg-zinc-800 px-2 py-1 text-xs">GRANT CREDITS</button>
                    </div>
                </div>

                <div id="admin-user-list" class="space-y-2 bg-black p-2 rounded border border-zinc-800"></div>

                <div class="mt-4 flex justify-between items-center">
                    <div class="text-xs text-zinc-400">Showing up to ${state.pageSize} users per page</div>
                    <div class="flex gap-2 items-center">
                        <button id="prev-page" class="bg-zinc-800 px-3 py-1 text-xs">PREV</button>
                        <button id="next-page" class="bg-zinc-800 px-3 py-1 text-xs">NEXT</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Attach handlers
        document.getElementById('close-admin').onclick = () => panel.remove();
        document.getElementById('refresh-admin').onclick = () => loadAdminUserData(true);
        document.getElementById('send-broadcast').onclick = () => {
            const txt = document.getElementById('broadcast-msg').value;
            sendBroadcastMessage(txt);
            document.getElementById('broadcast-msg').value = '';
        };
        document.getElementById('admin-search').addEventListener('input', debounce((e) => {
            state.search = e.target.value || '';
            // reset pagination
            state.lastVisible = null;
            loadAdminUserData(true);
        }, 350));
        document.getElementById('admin-order').addEventListener('change', (e) => {
            const [field, dir] = e.target.value.split(':');
            state.orderBy = (field === 'votes' ? 'totalVotesReceived' : field);
            state.orderDir = dir || 'desc';
            state.lastVisible = null;
            loadAdminUserData(true);
        });

        // bulk buttons
        document.getElementById('bulk-ban').onclick = () => bulkSetBan(true);
        document.getElementById('bulk-unban').onclick = () => bulkSetBan(false);
        document.getElementById('bulk-reset-credits').onclick = () => bulkResetCredits();
        document.getElementById('bulk-grant-credits').onclick = () => bulkGrantCredits();

        // reset global messages
        document.getElementById('reset-global-messages').onclick = () => batchDeleteGlobalMessages();

        // pagination
        document.getElementById('next-page').onclick = () => loadAdminUserData(false, true);
        document.getElementById('prev-page').onclick = () => loadPrevPage();

        // init cleanup + load
        clearExpiredSuspensions();
        loadAdminUserData(true);
    }

    // --- Pagination helpers (simple forward-only with lastVisible stack) ---
    const pageStack = [];

    async function loadPrevPage() {
        if (pageStack.length <= 1) {
            pageStack.length = 0;
            state.lastVisible = null;
            loadAdminUserData(true);
            return;
        }
        // pop current page token
        pageStack.pop();
        const prevToken = pageStack.pop() || null;
        state.lastVisible = prevToken;
        loadAdminUserData(true);
    }

    // --- Load & render users ---
    async function loadAdminUserData(reset = false, nextPage = false) {
        const list = document.getElementById('admin-user-list');
        if (!list) return;
        list.innerHTML = '<div class="text-xs text-zinc-500 p-2">Loading users...</div>';

        try {
            let q = db.collection('users');

            // Basic ordering
            const dir = state.orderDir === 'asc' ? 'asc' : 'desc';
            try {
                q = q.orderBy(state.orderBy, dir);
            } catch (e) {
                // fallback if orderBy field missing in index/rules
                q = q.orderBy('credits', 'desc');
            }

            // apply search by simple client-side filter after fetching a page
            q = q.limit(state.pageSize);

            if (nextPage && state.lastVisible) {
                q = q.startAfter(state.lastVisible);
            }

            const snapshot = await q.get();
            if (snapshot.empty) {
                list.innerHTML = '<div class="text-xs text-zinc-500 p-2">No users found.</div>';
                return;
            }

            // store last visible for pagination
            const docs = [];
            snapshot.forEach(d => docs.push({ id: d.id, data: d.data() }));
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            if (lastDoc) {
                pageStack.push(state.lastVisible || null);
                state.lastVisible = lastDoc;
            }

            // Render header & rows
            const rows = [];
            rows.push(`
                <div class="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 mb-2 uppercase tracking-widest p-2 border-b border-zinc-900">
                    <div class="col-span-1"><input id="select-all" type="checkbox" /></div>
                    <div class="col-span-3">Name / Email</div>
                    <div class="col-span-1 text-right">Credits</div>
                    <div class="col-span-1 text-right">Votes</div>
                    <div class="col-span-2">Title / Role</div>
                    <div class="col-span-3">Status / Suspension</div>
                    <div class="col-span-1">Actions</div>
                </div>
            `);

            // iterate and filter by search (client-side)
            const searchLower = (state.search || '').toLowerCase();
            for (const item of docs) {
                const u = item.data || {};
                const id = item.id;
                const hay = `${u.name || ''} ${u.title || ''} ${u.role || ''} ${u.email || ''}`.toLowerCase();
                if (searchLower && !hay.includes(searchLower)) continue;

                const suspendedText = u.suspendedUntil ? `Suspended until ${fmtDate(u.suspendedUntil)}${u.suspendedReason ? ' - ' + escapeHtml(u.suspendedReason) : ''}` : '';
                const bannedText = u.banned ? `BANNED${u.banReason ? ' - ' + escapeHtml(u.banReason) : ''}` : '';

                rows.push(`
                    <div class="grid grid-cols-12 gap-2 items-center text-sm py-2 border-b border-zinc-900" data-name="${escapeAttr(id)}">
                        <div class="col-span-1"><input class="row-select" data-name="${escapeAttr(id)}" type="checkbox" ${state.selected.has(id) ? 'checked' : ''} /></div>
                        <div class="col-span-3">
                            <div class="font-bold">${escapeHtml(u.name || id)}</div>
                            <div class="text-[11px] text-zinc-500">${escapeHtml(u.email || '')}</div>
                        </div>
                        <div class="col-span-1 text-right font-mono text-green-500">${(u.credits || 0).toLocaleString()}</div>
                        <div class="col-span-1 text-right">${u.totalVotesReceived || 0}</div>
                        <div class="col-span-2 text-[#d4af37]">${escapeHtml(u.title || '')}${u.role ? ' / ' + escapeHtml(u.role) : ''}</div>
                        <div class="col-span-3 text-[12px]">
                            <div>${bannedText ? `<span class="text-red-400 font-bold">${escapeHtml(bannedText)}</span>` : '<span class="text-zinc-400">Active</span>'}</div>
                            <div class="text-[11px] text-red-500">${u.suspendedUntil ? escapeHtml(suspendedText) : ''}</div>
                        </div>
                        <div class="col-span-1">
                            <div class="flex flex-col gap-1">
                                <button class="admin-btn edit" data-name="${escapeAttr(id)}">EDIT</button>
                                <button class="admin-btn suspend" data-name="${escapeAttr(id)}">${u.suspendedUntil ? 'EXTEND' : 'SUSP'}</button>
                                <button class="admin-btn ban" data-name="${escapeAttr(id)}">${u.banned ? 'UNBAN' : 'BAN'}</button>
                                <button class="admin-btn more" data-name="${escapeAttr(id)}">MORE</button>
                            </div>
                        </div>
                    </div>
                `);
            }

            list.innerHTML = rows.join('');

            // select all handler
            document.getElementById('select-all').addEventListener('change', (e) => {
                const checked = !!e.target.checked;
                list.querySelectorAll('.row-select').forEach(inp => {
                    inp.checked = checked;
                    const name = inp.dataset.name;
                    if (checked) state.selected.add(name); else state.selected.delete(name);
                });
            });

            // row selects
            list.querySelectorAll('.row-select').forEach(inp => {
                inp.addEventListener('change', (e) => {
                    const nm = e.target.dataset.name;
                    if (e.target.checked) state.selected.add(nm); else state.selected.delete(nm);
                });
            });

            // delegate action buttons
            list.querySelectorAll('.admin-btn.edit').forEach(b => b.addEventListener('click', (e) => openEditMenu(e.target.dataset.name)));
            list.querySelectorAll('.admin-btn.suspend').forEach(b => b.addEventListener('click', (e) => openSuspendMenu(e.target.dataset.name)));
            list.querySelectorAll('.admin-btn.ban').forEach(b => b.addEventListener('click', (e) => toggleBan(e.target.dataset.name)));
            list.querySelectorAll('.admin-btn.more').forEach(b => b.addEventListener('click', (e) => openMoreMenu(e.target.dataset.name)));
        } catch (err) {
            console.error('loadAdminUserData failed', err);
            list.innerHTML = '<div class="text-xs text-red-500 p-2">Failed to load users. Check console.</div>';
        }
    }

    // --- Per-user interactive menus (prompt-based for now) ---
    async function openEditMenu(name) {
        try {
            const doc = await db.collection('users').doc(name).get();
            if (!doc.exists) return showAlert('User not found.');
            const u = doc.data();

            const action = prompt(
                `Edit ${u.name || name} - choose action number:\n` +
                `1: Set Title\n2: Set Role\n3: Set Credits\n4: Add Credits\n5: Set Votes\n6: Reset Votes\n7: Impersonate (client-side)\n8: View raw JSON\n9: Set Email\nChoose:`
            );
            if (!action) return;

            if (action === '1') {
                const val = prompt('New Title:', u.title || '');
                if (val === null) return;
                await updateUser(name, { title: val }, `Set title to "${val}"`);
            } else if (action === '2') {
                const val = prompt('New Role (user, mod, admin):', u.role || 'user');
                if (val === null) return;
                await updateUser(name, { role: val }, `Set role to "${val}"`);
            } else if (action === '3') {
                const val = prompt('Set Credits (integer):', String(u.credits || 0));
                if (val === null) return;
                const num = parseInt(val, 10);
                if (isNaN(num)) return showAlert('Invalid number.');
                await updateUser(name, { credits: num }, `Set credits to ${num}`);
            } else if (action === '4') {
                const val = prompt('Add Credits (positive or negative integer):', '0');
                if (val === null) return;
                const delta = parseInt(val, 10);
                if (isNaN(delta)) return showAlert('Invalid number.');
                const newCredits = (u.credits || 0) + delta;
                await updateUser(name, { credits: newCredits }, `Adjusted credits by ${delta} (now ${newCredits})`);
            } else if (action === '5') {
                const val = prompt('Set Votes Received (integer):', String(u.totalVotesReceived || 0));
                if (val === null) return;
                const num = parseInt(val, 10);
                if (isNaN(num)) return showAlert('Invalid number.');
                await updateUser(name, { totalVotesReceived: num }, `Set votes to ${num}`);
            } else if (action === '6') {
                if (!confirmOrCancel(`Reset ${u.name || name}'s votes to zero?`)) return;
                await updateUser(name, { totalVotesReceived: 0 }, 'Reset votes to 0');
            } else if (action === '7') {
                impersonateUser(name);
            } else if (action === '8') {
                alert(JSON.stringify(u, null, 2));
            } else if (action === '9') {
                const val = prompt('Set Email:', u.email || '');
                if (val === null) return;
                await updateUser(name, { email: val }, `Set email to ${val}`);
            } else {
                showAlert('Unknown action.');
            }

            // refresh list + hierarchy
            await loadAdminUserData(true);
            if (typeof loadHierarchy === 'function') loadHierarchy();
        } catch (err) {
            console.error('openEditMenu failed', err);
            showAlert('Failed to perform edit. See console.');
        }
    }

    async function openSuspendMenu(name) {
        try {
            const doc = await db.collection('users').doc(name).get();
            if (!doc.exists) return showAlert('User not found.');
            const u = doc.data();

            const existing = u.suspendedUntil ? `Currently suspended until ${fmtDate(u.suspendedUntil)}\n` : '';
            const mode = prompt(`${existing}Choose:\n1: Suspend for hours\n2: Suspend for days\n3: Clear suspension`);
            if (!mode) return;

            if (mode === '3') {
                await updateUser(name, { suspendedUntil: null, suspendedReason: null }, 'Cleared suspension');
                showAlert('Suspension cleared.');
                await loadAdminUserData(true);
                return;
            }

            const amount = prompt(mode === '1' ? 'Hours to suspend for:' : 'Days to suspend for:');
            if (!amount) return;
            const n = parseFloat(amount);
            if (isNaN(n) || n <= 0) return showAlert('Invalid duration.');

            const ms = (mode === '1') ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
            const until = nowMs() + ms;
            const reason = prompt('Reason for suspension (optional):') || 'No reason provided';

            await updateUser(name, { suspendedUntil: until, suspendedReason: reason }, `Suspended for ${n} ${mode === '1' ? 'hours' : 'days'} - ${reason}`);
            showAlert(`${name} suspended until ${fmtDate(until)}`);
            await loadAdminUserData(true);
            if (typeof loadHierarchy === 'function') loadHierarchy();
        } catch (err) {
            console.error('openSuspendMenu failed', err);
            showAlert('Failed to suspend user. See console.');
        }
    }

    async function toggleBan(name) {
        try {
            const doc = await db.collection('users').doc(name).get();
            if (!doc.exists) return showAlert('User not found.');
            const u = doc.data();
            const willBan = !u.banned;
            const reason = prompt(willBan ? 'Reason for Ban:' : 'Reason for Unban (optional):') || (willBan ? 'No reason provided' : 'Unbanned');
            await updateUser(name, { banned: willBan, banReason: willBan ? reason : null }, `${willBan ? 'Banned' : 'Unbanned'} - ${reason}`);
            showAlert(`${name} ${willBan ? 'banned' : 'unbanned'}.`);
            await loadAdminUserData(true);
            if (typeof loadHierarchy === 'function') loadHierarchy();
        } catch (err) {
            console.error('toggleBan failed', err);
            showAlert('Failed to toggle ban. See console.');
        }
    }

    async function openMoreMenu(name) {
        try {
            const choice = prompt(
                `More actions for ${name}:\n` +
                `1: Reset Credits to 0\n2: Export user JSON\n3: Delete user (IRREVERSIBLE)\n4: View recent admin actions on this user\n5: Grant temporary credits\nChoose number:`
            );
            if (!choice) return;

            if (choice === '1') {
                if (!confirmOrCancel(`Reset ${name}'s credits to 0?`)) return;
                await updateUser(name, { credits: 0 }, 'Reset credits to 0');
                showAlert('Credits reset.');
            } else if (choice === '2') {
                const doc = await db.collection('users').doc(name).get();
                if (!doc.exists) return showAlert('User not found.');
                prompt('User JSON (copy):', JSON.stringify(doc.data(), null, 2));
            } else if (choice === '3') {
                const confirmDel = prompt(`Type DELETE to permanently remove ${name}:`);
                if (confirmDel !== 'DELETE') return showAlert('Deletion aborted.');
                await deleteUser(name);
                showAlert('User deleted.');
            } else if (choice === '4') {
                const q = await db.collection('adminActions').where('target', '==', name).orderBy('time', 'desc').limit(50).get();
                const entries = [];
                q.forEach(d => entries.push(d.data()));
                if (entries.length === 0) return showAlert('No admin actions found for this user.');
                alert(JSON.stringify(entries, null, 2));
            } else if (choice === '5') {
                const amt = prompt('Amount of credits to grant (positive integer):', '100');
                if (amt === null) return;
                const n = parseInt(amt, 10);
                if (isNaN(n)) return showAlert('Invalid number.');
                const doc = await db.collection('users').doc(name).get();
                if (!doc.exists) return showAlert('User not found.');
                const newCredits = (doc.data().credits || 0) + n;
                await updateUser(name, { credits: newCredits }, `Granted temporary credits: ${n} (now ${newCredits})`);
                showAlert(`Granted ${n} credits to ${name}.`);
            } else {
                showAlert('Unknown option.');
            }
            await loadAdminUserData(true);
            if (typeof loadHierarchy === 'function') loadHierarchy();
        } catch (err) {
            console.error('openMoreMenu failed', err);
            showAlert('Action failed. See console.');
        }
    }

    // --- Bulk actions ---
    async function bulkSetBan(shouldBan) {
        if (state.selected.size === 0) return showAlert('No users selected.');
        const names = Array.from(state.selected);
        if (!confirm(`Are you sure you want to ${shouldBan ? 'BAN' : 'UNBAN'} ${names.length} users?`)) return;
        try {
            const batch = db.batch();
            const admin = getCurrentAdminName();
            for (const name of names) {
                const ref = db.collection('users').doc(name);
                batch.update(ref, { banned: shouldBan, banReason: shouldBan ? 'Bulk action by admin' : null, _lastModifiedBy: admin, _lastModifiedAt: nowMs() });
            }
            await batch.commit();
            await logAdminAction(admin, shouldBan ? 'bulk_ban' : 'bulk_unban', names.join(','), { count: names.length });
            showAlert(`Bulk ${shouldBan ? 'ban' : 'unban'} applied to ${names.length} users.`);
            state.selected.clear();
            await loadAdminUserData(true);
        } catch (err) {
            console.error('bulkSetBan failed', err);
            showAlert('Bulk action failed. See console.');
        }
    }

    async function bulkResetCredits() {
        if (state.selected.size === 0) return showAlert('No users selected.');
        if (!confirm(`Reset credits to 0 for ${state.selected.size} users?`)) return;
        try {
            const batch = db.batch();
            const admin = getCurrentAdminName();
            for (const name of Array.from(state.selected)) {
                const ref = db.collection('users').doc(name);
                batch.update(ref, { credits: 0, _lastModifiedBy: admin, _lastModifiedAt: nowMs() });
            }
            await batch.commit();
            await logAdminAction(admin, 'bulk_reset_credits', Array.from(state.selected).join(','), { count: state.selected.size });
            showAlert(`Reset credits for ${state.selected.size} users.`);
            state.selected.clear();
            await loadAdminUserData(true);
        } catch (err) {
            console.error('bulkResetCredits failed', err);
            showAlert('Bulk reset failed. See console.');
        }
    }

    async function bulkGrantCredits() {
        if (state.selected.size === 0) return showAlert('No users selected.');
        const amt = prompt('Amount of credits to GRANT to each selected user (positive integer):', '100');
        if (amt === null) return;
        const n = parseInt(amt, 10);
        if (isNaN(n)) return showAlert('Invalid number.');

        try {
            // Since we need current credits to compute new credits, do per-user update (not single batch of updates with unknown values)
            const admin = getCurrentAdminName();
            for (const name of Array.from(state.selected)) {
                const doc = await db.collection('users').doc(name).get();
                if (!doc.exists) continue;
                const u = doc.data();
                const newCredits = (u.credits || 0) + n;
                await db.collection('users').doc(name).set({ credits: newCredits, _lastModifiedBy: admin, _lastModifiedAt: nowMs() }, { merge: true });
                await logAdminAction(admin, 'grant_credits', name, { amount: n, now: newCredits });
            }
            showAlert(`Granted ${n} credits to ${state.selected.size} users.`);
            state.selected.clear();
            await loadAdminUserData(true);
        } catch (err) {
            console.error('bulkGrantCredits failed', err);
            showAlert('Bulk grant failed. See console.');
        }
    }

    // Expose main entry on global so double-tap or other triggers can call
    window.openAdminPower = function () {
        buildAdminPanel();
    };

    // Auto-run clearExpiredSuspensions once on load
    clearExpiredSuspensions();

    // If you want to auto-open on double-tap a specific element use:
    // document.getElementById('nihal-card').addEventListener('dblclick', openAdminPower);
})();