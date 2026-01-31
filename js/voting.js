/**
 * js/voting.js - Handles the Weekly Voting Mechanics
 *
 * Requirements implemented:
 * - Users get 3 votes per voting week (Sunday -> next Sunday).
 * - Voting is disabled outside the weekly voting window.
 * - Users cannot vote for themselves.
 * - Users cannot vote for the same target more than 2 times in a week.
 * - Each vote grants the voter +25,000 credits and a star on their profile.
 * - Votes are tracked on both sender and receiver so leaderboard can show who voted for whom.
 * - Provides helpers to get leaderboard and format messages with a star after voter name.
 *
 * Assumes `db` is a Firestore instance and `firebase` is available globally.
 */

const VOTES_PER_WEEK = 3;
const VOTING_CREDIT_REWARD = 25000;
const MAX_VOTES_PER_TARGET_PER_WEEK = 2;

/**
 * Returns true if the current time is inside the voting window:
 * from Sunday (00:00 local) inclusive to the next Sunday (00:00 local) exclusive.
 */
function isVotingOpen(now = new Date()) {
    // Determine most recent Sunday 00:00:00 local time
    const day = now.getDay(); // 0 = Sunday
    const diffToSunday = day; // days since Sunday
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - diffToSunday); // last Sunday (today if Sunday)
    // End is next Sunday 00:00:00 local
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return now >= start && now < end;
}

/**
 * castVote - cast one vote from current user (myName) to targetUserName.
 * Enforces:
 * - Self-vote prevention
 * - Voting window
 * - Per-week vote limit (3)
 * - Per-target-per-week limit (2)
 * - Awards credits, adds star, updates both sender and receiver maps for leaderboard transparency
 */
async function castVote(targetUserName) {
    const myName = localStorage.getItem('pyramidName');
    if (!myName) {
        alert("You are not signed in (pyramidName not found).");
        return;
    }

    if (myName === targetUserName) {
        alert("In the Pyramid, you cannot vote for yourself.");
        return;
    }

    if (!isVotingOpen()) {
        alert("Voting is currently closed. Voting runs Sunday to Sunday.");
        return;
    }

    const myRef = db.collection("users").doc(myName);
    const targetRef = db.collection("users").doc(targetUserName);
    const FieldValue = firebase.firestore.FieldValue;

    try {
        await db.runTransaction(async (transaction) => {
            const myDoc = await transaction.get(myRef);
            if (!myDoc.exists) {
                throw new Error("Your user document was not found.");
            }

            const myData = myDoc.data() || {};
            const votesLeft = typeof myData.votesRemaining === "number" ? myData.votesRemaining : VOTES_PER_WEEK;
            if (votesLeft <= 0) {
                throw new Error("You have used all " + VOTES_PER_WEEK + " of your weekly votes.");
            }

            const votesGivenMap = myData.votesGiven || {}; // { targetUserName: count }
            const givenToTarget = votesGivenMap[targetUserName] || 0;
            if (givenToTarget >= MAX_VOTES_PER_TARGET_PER_WEEK) {
                throw new Error("You cannot vote for the same person more than " + MAX_VOTES_PER_TARGET_PER_WEEK + " times this week.");
            }

            // Prepare updates on sender
            const senderUpdate = {
                votesRemaining: votesLeft - 1,
                credits: FieldValue.increment(VOTING_CREDIT_REWARD),
                hasStar: true,
                // increment nested map value votesGiven.<targetUserName>
                [`votesGiven.${targetUserName}`]: FieldValue.increment(1)
            };

            // Update receiver: increment totalVotesReceived and voters.<myName>
            // In case target doc doesn't exist, we'll create it with the fields
            const targetDoc = await transaction.get(targetRef);
            if (!targetDoc.exists) {
                // initialize target user doc with vote info
                const init = {
                    totalVotesReceived: 1,
                    voters: { [myName]: 1 }
                };
                transaction.set(targetRef, init, { merge: true });
            } else {
                // update existing target
                transaction.update(targetRef, {
                    totalVotesReceived: FieldValue.increment(1),
                    [`voters.${myName}`]: FieldValue.increment(1)
                });
            }

            // apply sender update (if sender doc didn't have fields, update will create them)
            transaction.update(myRef, senderUpdate);
        });

        alert("Vote successfully cast for " + targetUserName);
    } catch (err) {
        console.error("castVote error:", err);
        // Provide user-friendly message
        alert(err.message || err.toString());
    }
}

/**
 * resetWeeklyVotes - resets votesRemaining to VOTES_PER_WEEK for everyone, clears votesGiven for the week,
 * and clears voters maps and totalVotesReceived (optional behavior: keep totalVotesReceived across weeks?).
 *
 * NOTE: Decide policy: If you want totalVotesReceived to be cumulative (all-time), do not reset it here.
 * The user requested the weekly voting window; here we reset per-week fields:
 * - votesRemaining -> VOTES_PER_WEEK
 * - votesGiven -> {}
 * - voters -> {} and totalVotesReceived -> 0 (resets weekly totals)
 *
 * This function should be run by an admin or by a scheduled cloud function every Sunday at 00:00.
 */
async function resetWeeklyVotes({ resetTotalVotes = true } = {}) {
    const usersSnapshot = await db.collection("users").get();
    const batch = db.batch();

    usersSnapshot.forEach(doc => {
        const ref = doc.ref;
        const updatePayload = {
            votesRemaining: VOTES_PER_WEEK,
            votesGiven: {} // clear per-week votes given
        };
        if (resetTotalVotes) {
            updatePayload.totalVotesReceived = 0;
            updatePayload.voters = {}; // clear map of who voted this week
        }
        batch.update(ref, updatePayload);
    });

    await batch.commit();
    console.log("Weekly votes have been reset to", VOTES_PER_WEEK, "for everyone.");
}

/**
 * getLeaderboard - fetches users ordered by totalVotesReceived descending
 * Each entry returns: { userName, totalVotesReceived, voters } where voters is a map { voterName: count }.
 *
 * Everyone can view the voters map so the leaderboard shows who voted for whom and how many times.
 */
async function getLeaderboard(limit = 100) {
    const usersRef = db.collection("users");
    // Ensure that totalVotesReceived exists; users without the field will be treated as 0
    const snapshot = await usersRef.orderBy("totalVotesReceived", "desc").limit(limit).get();
    return snapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
            userName: doc.id,
            displayName: data.displayName || doc.id,
            totalVotesReceived: typeof data.totalVotesReceived === "number" ? data.totalVotesReceived : 0,
            voters: data.voters || {}, // map of voterName -> count
            hasStar: !!data.hasStar
        };
    });
}

/**
 * Example DOM renderer for leaderboard.
 * Accepts a containerElement (DOM node) and renders a simple list showing:
 * - Display name
 * - totalVotesReceived
 * - voters (each voter: count)
 */
async function renderLeaderboard(containerElement) {
    try {
        const leaderboard = await getLeaderboard(100);
        containerElement.innerHTML = ""; // clear

        leaderboard.forEach(entry => {
            const item = document.createElement("div");
            item.className = "leaderboard-entry";

            // name + star if they have one
            const nameEl = document.createElement("strong");
            nameEl.textContent = entry.displayName + " ";
            if (entry.hasStar) {
                const starSpan = document.createElement("span");
                starSpan.textContent = "★"; // star symbol for profile star
                starSpan.title = "This user has a star";
                starSpan.className = "leaderboard-star";
                nameEl.appendChild(starSpan);
            }

            const votesEl = document.createElement("span");
            votesEl.textContent = " Votes: " + entry.totalVotesReceived;

            const votersEl = document.createElement("div");
            votersEl.className = "leaderboard-voters";
            // Show who voted and how many times
            const voters = entry.voters || {};
            const voterNames = Object.keys(voters);
            if (voterNames.length > 0) {
                voterNames.forEach(voterName => {
                    const vSpan = document.createElement("span");
                    vSpan.className = "voter-entry";
                    vSpan.textContent = `${voterName}: ${voters[voterName]}`;
                    votersEl.appendChild(vSpan);
                });
            } else {
                votersEl.textContent = "No votes yet.";
            }

            item.appendChild(nameEl);
            item.appendChild(votesEl);
            item.appendChild(votersEl);
            containerElement.appendChild(item);
        });
    } catch (err) {
        console.error("renderLeaderboard error:", err);
        containerElement.textContent = "Unable to load leaderboard.";
    }
}

/**
 * formatMessageWithStar:
 * When a user types messages like "Nihal Gupta: Hi everyone",
 * you should render the sender name with a star to the right if the user has a star in their profile.
 *
 * Example usage in message rendering pipeline:
 * - When rendering the message header, call formatMessageWithStar(senderName) which returns a DOM node or HTML string.
 *
 * This function fetches the user document to check `hasStar`. Cache or optimize as needed to avoid many reads.
 */
async function formatMessageWithStar(senderName) {
    const userRef = db.collection("users").doc(senderName);
    try {
        const userDoc = await userRef.get();
        const data = userDoc.exists ? userDoc.data() : {};
        const hasStar = !!(data && data.hasStar);
        // Return a small HTML snippet; adapt to your UI framework.
        if (hasStar) {
            // e.g. "Nihal Gupta ★"
            return `${senderName} ★`;
        } else {
            return senderName;
        }
    } catch (err) {
        console.error("formatMessageWithStar error:", err);
        return senderName;
    }
}

/**
 * Helper: getRemainingVotes - returns the current user's votesRemaining (or default VOTES_PER_WEEK if missing)
 */
async function getRemainingVotes(userName) {
    const userRef = db.collection("users").doc(userName);
    const doc = await userRef.get();
    if (!doc.exists) return VOTES_PER_WEEK;
    const data = doc.data() || {};
    return typeof data.votesRemaining === "number" ? data.votesRemaining : VOTES_PER_WEEK;
}

/* Export functions if using a bundler or module system */
window.pyramidVoting = {
    castVote,
    resetWeeklyVotes,
    isVotingOpen,
    getLeaderboard,
    renderLeaderboard,
    formatMessageWithStar,
    getRemainingVotes
};
