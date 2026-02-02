# 🎯 THE PYRAMID GAME - Classmate Ranking System

A gamified social platform where classmates can vote, rank, chat, and interact in a competitive hierarchy system.

## 🌟 Features Overview

### 👥 Authentication System
- **Register**: Name, Class, Section, Roll Number, Email (optional), Password
- **Login**: Name + Password
- 100,000 credits bonus on registration
- Referral system (+25,000 credits for both parties)
- Auto-generated unique referral codes

### 💬 Chat System
- **Global Chat**: Everyone can see and participate
- **Private Chat**: One-on-one conversations
- User titles and ranks visible while chatting
- Delete last 5 messages feature
- Online/Last seen status
- Mute system for lower ranks

### 🏆 Ranking & Title System
**Ranks (based on votes):**
- **S Rank**: 100+ votes (God Tier)
- **A Rank**: 50+ votes (Elite - Can mute others)
- **B Rank**: 20+ votes
- **C Rank**: 10+ votes
- **D Rank**: 3-9 votes
- **F Rank**: <3 votes (Red neon glow)

**Titles** (Dynamic based on performance):
- The Untouchable (100+ votes)
- King/Queen (80+ votes)
- Supreme Leader (60+ votes)
- Elite Squad (40+ votes)
- Living Legend (25+ votes)
- The Influencer (15+ votes)
- Rising Star (8+ votes)
- The Contributor (3+ votes)
- Classmate (default)
- The Outcast (<3 votes)
- The Fallen (negative votes)

### 🗳️ Voting System
- 3 votes per person per week
- +vote or -vote anyone
- Cannot vote for yourself
- Unused votes deducted from your received votes
- Weekly reset (controlled by admin)
- Voting gives/takes credits
- **Top 5 Weekly Rewards:**
  - 1st: 1,000,000 credits
  - 2nd: 500,000 credits
  - 3rd: 300,000 credits
  - 4th: 200,000 credits
  - 5th: 100,000 credits

### 🎯 Bounty System
- Minimum bounty: 50,000 credits
- Duration: 1 hour
- Can be placed anonymously
- Cool animation when bounty is placed
- Anyone who -votes the target gets 5,000 credits from bounty
- Bounty depletes as people participate
- Public notification to all users

### 🎁 Gift System
- Send credits to anyone
- Can be anonymous
- **Low-level gifts** (100, 500, 1,000): Private notification
- **High-level gifts** (10,000+): Public animation + sound
- Credits auto-deduct from sender, add to recipient
- Special animations for different gift tiers

### 💰 Credits System
- 100,000 starting credits
- Earn through:
  - Voting participation
  - Receiving gifts
  - Bounty participation
  - Weekly top 5 rewards
  - Referrals
- Spend on:
  - Bounties
  - Gifts
  - Muting powers (A rank)

### 🔇 Mute Power (A Rank Special)
- A rank can mute D/F ranks
- D rank: 5 minutes mute
- F rank: 15 minutes mute
- Costs credits to use

### 🔒 Confession Booth
- Submit anonymous confessions
- Visible in global chat with animation (4 seconds)
- Name hidden from everyone except admin
- Cool notification system

### 📊 Leaderboard
- Real-time ranking
- Highest to lowest votes
- F rank in red neon outline
- Shows online status
- Displays titles and ranks

### 📋 Poll System
- Admin can create polls anonymously
- Users vote on mini tasks
- Time-limited polls
- Results visible to all

### 👑 Admin Panel (Secret - Nihal Gupta)
**Secret Access**: Special key combination or URL
**Powers:**
- View all private chats secretly
- Grant/revoke credits to anyone
- Ban or suspend users
- Edit user titles
- Admin broadcast (sound + animation)
- Create anonymous polls
- Reset weekly voting
- Secret upvote/downvote
- Full system control

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Firebase project
- Vercel account (for deployment)

### Installation

1. **Clone and Install:**
```bash
git clone <your-repo>
cd pyramid-game
npm install
```

2. **Firebase Setup:**

Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)

Enable these services:
- Firestore Database
- Authentication (optional, for future)
- Storage (optional, for future)

Create these collections in Firestore:
```
users/
messages/
votes/
bounties/
gifts/
confessions/
polls/
adminActions/
```

3. **Environment Variables:**

Create `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_ADMIN_SECRET=nihal_admin_2026_pyramid
```

4. **Firestore Security Rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // For development
      // TODO: Add proper security rules for production
    }
  }
}
```

5. **Run Development Server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
pyramid-game/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Main dashboard
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Login/Register page
│   │   └── globals.css            # Global styles
│   ├── components/                # Reusable components
│   ├── lib/
│   │   ├── firebase.ts            # Firebase config
│   │   └── utils.ts               # Utility functions
│   ├── store/
│   │   └── index.ts               # Global state (Zustand)
│   └── types/
│       └── index.ts               # TypeScript types
├── public/                        # Static assets
├── .env.example                   # Environment template
├── next.config.js
├── tailwind.config.js
└── package.json
```

## 🎮 How to Use

### For Students:

1. **Register:**
   - Enter your real name, class, section, roll number
   - Create a password
   - Optionally add email and referral code
   - Get 100,000 starting credits!

2. **Login:**
   - Just use your name and password

3. **Participate:**
   - Chat in global or private
   - Vote for classmates (3 votes/week)
   - Place bounties on anyone
   - Send gifts
   - Submit anonymous confessions
   - Climb the leaderboard!

### For Admin (Nihal Gupta):

1. Access admin panel via secret entrance
2. Monitor all activities
3. Manage users and system
4. Reset voting weekly
5. Create polls and broadcasts

## 🚀 Deployment to Vercel

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial Pyramid Game"
git branch -M main
git remote add origin <your-github-repo>
git push -u origin main
```

2. **Deploy on Vercel:**
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repository
- Add environment variables from `.env.local`
- Deploy!

3. **Configure Firebase:**
- Add your Vercel domain to Firebase authorized domains
- Update Firestore rules for production

## ⚙️ Configuration

### Voting Reset Schedule:
The admin should manually reset voting every week. This can be automated using:
- Vercel Cron Jobs
- Firebase Cloud Functions
- External cron service

### Credit Rewards:
Edit in `src/types/index.ts` to adjust reward amounts.

### Rank Requirements:
Modify `RANK_REQUIREMENTS` in `src/types/index.ts`.

## 🎨 Customization

### Theme Colors:
Edit `tailwind.config.js` to change rank colors and neon effects.

### Titles:
Modify `TITLES` object in `src/types/index.ts`.

### Features:
All features are modular and can be enabled/disabled.

## 🛡️ Security Notes

⚠️ **Important for Production:**

1. **Password Hashing**: Currently passwords are stored in plain text. Implement bcrypt or similar.
2. **Authentication**: Use Firebase Auth instead of custom auth.
3. **Firestore Rules**: Add proper security rules.
4. **Input Validation**: Add validation for all user inputs.
5. **Rate Limiting**: Prevent spam and abuse.
6. **Admin Secret**: Change the default admin secret key!

## 📱 Features Status

✅ Completed:
- Authentication (Login/Register)
- Global Chat
- Leaderboard
- Ranking System
- Bounty System
- Gift System
- Credits System
- Confession Booth

🚧 To Implement:
- Private Chat UI
- Vote UI
- Mute functionality
- Poll system UI
- Admin Panel UI
- Notification system
- Real-time updates
- Mobile responsive optimizations

## 🤝 Contributing

This is a private class project. Only classmates can participate.

## 📄 License

Private project for class use only.

## 👨‍💻 Admin

**Nihal Gupta** - Supreme Administrator

For issues or questions, contact the admin.

---

**Welcome to The Pyramid Game! May the best classmate rise to the top! 🎯👑**
