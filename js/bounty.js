/** * js/bounty.js - The Sovereign Execution Protocol */

const BOUNTY_SOUND = new Audio('https://assets.mixkit.co/active_storage/sfx/1001/1001-preview.mp3'); // Heavy Alarm

async function placeBounty(targetName) {
    const me = localStorage.getItem('pyramidUser');
    const cost = 50000;

    if (targetName === me) return alert("You cannot place a hit on yourself.");

    // MESMERIZING CONFIRMATION
    const confirmHit = confirm(`EXECUTE CONTRACT?\n\nTarget: ${targetName.toUpperCase()}\nCost: ${cost.toLocaleString()} Cr\n\nThis will mark them for 1 hour.`);
    
    if (!confirmHit) return;

    try {
        await db.runTransaction(async (t) => {
            const myRef = db.collection("users").doc(me);
            const targetRef = db.collection("users").doc(targetName);
            const mDoc = await t.get(myRef);

            if (!mDoc.exists || mDoc.data().credits < cost) throw "Insufficient funds for this execution.";

            t.update(myRef, { credits: mDoc.data().credits - cost });
            t.update(targetRef, { 
                isBounty: true, 
                bountyPlacer: me,
                bountyTime: Date.now() 
            });

            // LOG TO GLOBAL BROADCAST
            db.collection("messages").add({
                user: "SYSTEM",
                text: `🛑 CONTRACT OPEN: A BOUNTY HAS BEEN PLACED ON ${targetName.toUpperCase()}!`,
                type: "TEXT",
                time: Date.now(),
                isBountyAlert: true
            });
        });

        // TRIGGER THE VISUALS
        triggerBountyCinematic(targetName);

    } catch (e) {
        alert("Execution Failed: " + e);
    }
}

function triggerBountyCinematic(target) {
    BOUNTY_SOUND.play().catch(()=>{});

    // 1. Create a "Red Glitch" Overlay
    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 z-[200] pointer-events-none flex items-center justify-center flex-col bg-red-900/20";
    overlay.innerHTML = `
        <div class="glitch-text cinzel text-4xl text-white font-bold tracking-[0.5em] animate-pulse">WANTED</div>
        <div class="text-[#ff0000] text-6xl mt-4 drop-shadow-[0_0_15px_red]">${target.toUpperCase()}</div>
        <div class="mt-8 text-white/50 text-[10px] tracking-widest uppercase">Target successfully marked in hierarchy</div>
    `;
    document.body.appendChild(overlay);

    // 2. Shake the screen
    document.body.classList.add('shake-anim');

    // 3. Remove after 4 seconds
    setTimeout(() => {
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 1s ease";
        setTimeout(() => {
            overlay.remove();
            document.body.classList.remove('shake-anim');
            loadHierarchy(); // Refresh the list
        }, 1000);
    }, 3000);
}
