const giftPrices = {
    "Rose": 1000,
    "Bouquet of roses":10000,
    "car":50000,
    "Bmw":75000,
    "Lamborghini": 100000,
    "Private Jet": 300000
};

function processGift(sender, receiver, giftName) {
    const cost = giftPrices[giftName];
    console.log(`${sender} is sending a ${giftName} to ${receiver} for ${cost} credits.`);
    // Add your Firebase transaction code here
}
