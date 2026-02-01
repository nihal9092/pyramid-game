/**
 * js/admin.js - The Sovereign Core
 * Level 99 Administrative Privileges
 */

async function openAdminPower() {
    const me = localStorage.getItem('pyramidUser');
    if (me !== "Nihal Gupta") {
        console.error("Unauthorized terminal access detected.");
        return;
    }

    const menu = `--- 👑 SOVEREIGN COMMAND CONSOLE ---
1. BAN (Terminate Subject)
2. GIFT (Grant Credits)
3. WIPE (Clear Chat)
4. DECREE (System Broadcast)
5. TAX (Collect 10% from everyone)
6. STATUS (Change User Title/Aura)
7. VANISH (Wipe User Data)
8. ECONOMY (Freeze/Unfreeze Voting)
Enter Command Number:`;

    const choice = prompt(menu);

    switch (choice) {
        case "1":
            const bName = prompt("Target Name:");
            await db.collection("users").doc(bName).update({ banned: true });
            alert("Subject Expelled.");
            break;

        case "2":
            const gName = prompt("Recipient:");
            const amt = parseInt(prompt("Amount:"));
            await db.collection("users").doc(gName).update({
                credits: firebase.firestore.FieldValue.increment(amt)
            });
            alert("Wealth Distributed.");
            break;

        case "3":
            if(confirm("Silence the Grand Hall?")) {
                const snaps = await db.collection("messages").get();
                const batch = db.batch();
                snaps.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            break;

        case "4":
            const msg = prompt("Broadcast Message:");
            db.collection("messages").add({
                user: "SYSTEM",
                text: `📜 DECREE: ${msg.toUpperCase()}`,
                time: Date.now(),
                isDecree: true 
            });
            break;

        case "5": // THE GREAT TAX
            if(confirm("Collect 10% tax from every subject?")) {
                const users = await db.collection("users").get();
                const batch = db.batch();
                let totalTax = 0;
                users.forEach(u => {
                    if(u.id !== "Nihal Gupta") {
                        const tax = Math.floor(u.data().credits * 0.10);
                        totalTax += tax;
                        batch.update(u.ref, { credits: u.data().credits - tax });
                    }
                });
                batch.update(db.collection("users").doc("Nihal Gupta"), {
                    credits: firebase.firestore.FieldValue.increment(totalTax)
                });
                await batch.commit();
                alert(`Taxation complete. Collected ${totalTax.toLocaleString()} Cr.`);
            }
            break;

        case "6": // AURA & TITLE MANIPULATION
            const tUser = prompt("Target Name:");
            const newTitle = prompt("New Title (e.g., The Traitor, The Elite):");
            const aura = prompt("Aura (aura-gold, aura-rainbow, or none):");
            await db.collection("users").doc(tUser).update({
                title: newTitle,
                aura: aura
            });
            alert("Identity Rewritten.");
            break;

        case "7": // TOTAL VANISH
            const vName = prompt("Name of user to ERASE from history:");
            if(confirm(`Are you sure you want to delete all traces of ${vName}?`)) {
                await db.collection("users").doc(vName).delete();
                alert("Memory Purged.");
                location.reload();
            }
            break;

        case "8": // ECONOMY LOCK
            const status = confirm("Lock the Economy? (OK for Lock, Cancel for Unlock)");
            await db.collection("settings").doc("economy").set({
                locked: status,
                lockedBy: "Nihal Gupta",
                time: Date.now()
            });
            alert(status ? "Economy Frozen." : "Economy Restored.");
            break;

        default:
            alert("Command not recognized.");
    }
                }
