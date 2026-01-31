/**
 * js/auth.js - Flexible Name Verification
 */

// Your official list (Full names for better admin tracking)
const classmateWhitelist = [
    "Ayush Sharma", 
    "Anjali Rai", 
    "Rahul Verma",
    "Priya Das"
];

async function handleRegister() {
    const inputName = document.getElementById('reg-name').value.trim().toLowerCase();
    const genderInput = document.getElementById('reg-gender').value;

    // 1. Check if the input matches any FIRST name in the whitelist
    const matchedUser = classmateWhitelist.find(fullName => {
        const firstName = fullName.split(" ")[0].toLowerCase();
        return firstName === inputName || fullName.toLowerCase() === inputName;
    });

    if (!matchedUser) {
        alert("ACCESS DENIED: Name not recognized. Please use your real name.");
        return;
    }

    if (!genderInput) {
        alert("Please select your gender.");
        return;
    }

    // 2. Use the FULL name from the whitelist as the Database ID 
    // This prevents "Ayush" and "Ayush Sharma" from creating two accounts.
    const userRef = db.collection("users").doc(matchedUser);
    const doc = await userRef.get();

    if (doc.exists) {
        alert("This person is already registered.");
    } else {
        await userRef.set({
            name: matchedUser, // Saves the proper Full Name
            displayName: inputName, // Saves what they like to be called
            gender: genderInput,
            credits: 100000,
            title: "Commoner",
            votesRemaining: 3,
            totalVotesReceived: 0,
            registeredAt: Date.now()
        });
        
        localStorage.setItem('pyramidName', matchedUser);
        alert(`Welcome, ${matchedUser}. Your rank is being assigned.`);
        location.reload();
    }
}
