/**
 * js/voting.js - Handles the Weekly Voting Mechanics
 */

async function castVote(targetUserName) {
    const myName = localStorage.getItem('pyramidName');

    // 1. Prevent self-voting
    if (myName === targetUserName) {
        alert("In the Pyramid, you cannot vote for yourself.");
        return;
    }

    const myRef = db.collection("users").doc(myName);
    const targetRef = db.collection("users").doc(targetUserName);

    try {
        await db.runTransaction(async (transaction) => {
            const myDoc = await transaction.get(myRef);
            const votesLeft = myDoc.data().votesRemaining;

            // 2. Check if they have votes left
            if (votesLeft <= 0) {
                throw "You have used all 3 of your weekly votes.";
            }

            // 3. Subtract a vote from sender, add a vote to receiver
            transaction.update(myRef, { votesRemaining: votesLeft - 1 });
            
            const targetDoc = await transaction.get(targetRef);
            const currentVotes = targetDoc.data().totalVotesReceived || 0;
            transaction.update(targetRef, { totalVotesReceived: currentVotes + 1 });
        });

        alert("Vote successfully cast for " + targetUserName);
    } catch (error) {
        alert(error);
    }
}

// Function to reset votes every week (Admin only or automated)
async function resetWeeklyVotes() {
    const allUsers = await db.collection("users").get();
    const batch = db.batch();
    
    allUsers.forEach(user => {
        batch.update(user.ref, { votesRemaining: 3 });
    });
    
    await batch.commit();
    console.log("Weekly votes have been reset to 3 for everyone.");
          }
