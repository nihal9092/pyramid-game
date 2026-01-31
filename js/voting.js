/**
 * js/voting.js - Robust Weekly Voting System (rewritten)
 *
 * Goals & compatibility:
 * - Enforce max 3 votes per user per week.
 * - Default votesRemaining to 3 for new/missing data.
 * - Atomic transactions for decrementing sender and incrementing receiver.
 * - Add a lightweight chat notification when a vote is cast so chat UI updates immediately.
 * - Provide helpers: getVotesRemaining, listenToUserVotes (for UI updates), resetWeeklyVotes.
 * - Safe checks & friendly messages compatible with js/chat.js (uses 'pyramidUser' key).
 *
 * Assumptions:
 * - `db` is the Firestore instance and is available globally like in other project files.
 * - `localStorage` uses key 'pyramidUser' for the logged-in user (keeps parity with chat.js).
 *
 * Usage:
 * - call castVote(targetUserName)
 * - call resetWeeklyVotes() (admin / cron)
 * - call getVotesRemaining(userName) to read a user's remaining votes (returns number)
 * - call listenToUserVotes(userName, callback) to react to changes (returns unsubscribe)
 */

const VOTING = (() => {
  const WEEKLY_MAX = 3;

  function _ensureDb() {
    if (typeof db === 'undefined') {
      throw new Error('Database (db) not initialized.');
    }
  }

  /**
   * Get the votes remaining for a user (non-mutating).
   * Returns a Promise<number> (defaults to WEEKLY_MAX if missing).
   */
  async function getVotesRemaining(userName) {
    _ensureDb();
    if (!userName) throw new Error('Invalid userName');
    const doc = await db.collection('users').doc(userName).get();
    if (!doc.exists) return WEEKLY_MAX;
    const data = doc.data() || {};
    return (typeof data.votesRemaining === 'number') ? data.votesRemaining : WEEKLY_MAX;
  }

  /**
   * Cast a vote for targetUserName from the currently logged-in user.
   * Will:
   *  - Prevent self-voting
   *  - Ensure sender has votesRemaining > 0
   *  - Decrement sender.votesRemaining atomically
   *  - Increment target.totalVotesReceived and target.weeklyVotesReceived atomically
   *  - Add a short chat message of type 'VOTE' so chat renders the action (optional)
   */
  async function castVote(targetUserName) {
    _ensureDb();
    const sender = localStorage.getItem('pyramidUser');
    if (!sender) {
      alert('You must be logged in to vote.');
      return;
    }

    if (!targetUserName) {
      alert('Please specify a user to vote for.');
      return;
    }

    if (sender === targetUserName) {
      alert('In the Pyramid, you cannot vote for yourself.');
      return;
    }

    const senderRef = db.collection('users').doc(sender);
    const targetRef = db.collection('users').doc(targetUserName);

    try {
      await db.runTransaction(async (tx) => {
        const sDoc = await tx.get(senderRef);
        if (!sDoc.exists) throw new Error('Your account was not found.');

        const tDoc = await tx.get(targetRef);
        if (!tDoc.exists) throw new Error('Target user not found.');

        const sData = sDoc.data() || {};
        const tData = tDoc.data() || {};

        // Normalize votesRemaining for sender
        const sVotes = (typeof sData.votesRemaining === 'number') ? sData.votesRemaining : WEEKLY_MAX;

        if (sVotes <= 0) {
          // user has exhausted votes
          throw new Error("3 votes exhausted — wait for the next week's election.");
        }

        // Decrement sender votesRemaining
        tx.update(senderRef, { votesRemaining: sVotes - 1, lastVotedAt: Date.now() });

        // Update receiver totals (totalVotesReceived and weeklyVotesReceived)
        const prevTotal = (typeof tData.totalVotesReceived === 'number') ? tData.totalVotesReceived : 0;
        const prevWeekly = (typeof tData.weeklyVotesReceived === 'number') ? tData.weeklyVotesReceived : 0;

        tx.update(targetRef, {
          totalVotesReceived: prevTotal + 1,
          weeklyVotesReceived: prevWeekly + 1
        });

        // Optionally: track per-sender votes cast this week (map) - omitted for storage blowup
      });

      // Add a lightweight vote message to chat so other clients see the action.
      // Using type: 'VOTE' keeps it distinct from 'MSG' and 'GIFT' and will be rendered
      // by chat.js as a plain message (it currently renders by `m.text` for non-GIFT types).
      try {
        await db.collection('messages').add({
          user: sender,
          type: 'VOTE',
          text: `${sender} voted for ${targetUserName}`,
          target: targetUserName,
          time: Date.now()
        });
      } catch (e) {
        // Non-fatal - voting itself succeeded; just log.
        console.warn('Failed to post vote message to chat:', e);
      }

      alert('Vote successfully cast for ' + targetUserName);
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      alert(msg);
      throw err; // rethrow so callers can react if needed
    }
  }

  /**
   * Reset weekly votes for everyone back to WEEKLY_MAX.
   * Also resets weeklyVotesReceived to 0.
   * Intended to be called by an admin endpoint or cron job.
   */
  async function resetWeeklyVotes() {
    _ensureDb();
    const allUsersSnap = await db.collection('users').get();
    if (allUsersSnap.empty) {
      console.info('No user documents found to reset.');
      return;
    }

    const batch = db.batch();
    allUsersSnap.forEach(doc => {
      batch.update(doc.ref, {
        votesRemaining: WEEKLY_MAX,
        // Optionally record lastResetAt for auditing
        weeklyVotesReceived: 0,
        lastVotesResetAt: Date.now()
      });
    });

    await batch.commit();
    console.log(`Weekly votes reset to ${WEEKLY_MAX} for ${allUsersSnap.size} users.`);
  }

  /**
   * Subscribe to changes in a user's votesRemaining (useful to update UI / chat star).
   * callback receives (votesRemaining: number) whenever it changes.
   * Returns an unsubscribe function.
   */
  function listenToUserVotes(userName, callback) {
    _ensureDb();
    if (!userName || typeof callback !== 'function') {
      throw new Error('listenToUserVotes requires (userName, callback)');
    }
    const ref = db.collection('users').doc(userName);
    const unsub = ref.onSnapshot(doc => {
      const data = (doc.exists && doc.data()) ? doc.data() : {};
      const votes = (typeof data.votesRemaining === 'number') ? data.votesRemaining : WEEKLY_MAX;
      try { callback(votes); } catch (e) { console.error('vote listener callback error:', e); }
    }, err => {
      console.error('listenToUserVotes onSnapshot error:', err);
    });
    return unsub;
  }

  return {
    WEEKLY_MAX,
    castVote,
    getVotesRemaining,
    resetWeeklyVotes,
    listenToUserVotes
  };
})();

// Expose in global scope for the rest of the app to call (like chat UI)
if (typeof window !== 'undefined') {
  window.VOTING = VOTING;
}
