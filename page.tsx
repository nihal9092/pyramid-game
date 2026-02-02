'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, onSnapshot, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { User, Message, Bounty, Gift } from '@/types';
import { getRankColor, getTitleByVotes, calculateRank, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<'global' | 'private' | 'leaderboard' | 'rules'>('global');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [bountyTarget, setBountyTarget] = useState<User | null>(null);
  const [giftRecipient, setGiftRecipient] = useState<User | null>(null);
  const [bountyAmount, setBountyAmount] = useState(50000);
  const [giftAmount, setGiftAmount] = useState(100);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [activeBounties, setActiveBounties] = useState<Bounty[]>([]);
  const [showConfessionModal, setShowConfessionModal] = useState(false);
  const [confessionText, setConfessionText] = useState('');

  useEffect(() => {
    // Check if user is logged in
    const stored = localStorage.getItem('pyramidUser');
    if (!stored) {
      router.push('/');
      return;
    }

    const user = JSON.parse(stored);
    setCurrentUser(user);

    // Load users
    loadUsers();
    
    // Load messages
    const messagesQuery = query(
      collection(db, 'messages'),
      where('isGlobal', '==', true),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs.reverse());
    });

    // Load bounties
    const bountiesQuery = query(
      collection(db, 'bounties'),
      where('active', '==', true)
    );
    
    const unsubBounties = onSnapshot(bountiesQuery, (snapshot) => {
      const bounties = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Bounty));
      setActiveBounties(bounties);
    });

    return () => {
      unsubMessages();
      unsubBounties();
    };
  }, [router]);

  const loadUsers = async () => {
    const usersQuery = query(collection(db, 'users'));
    const snapshot = await getDocs(usersQuery);
    const usersData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
    setUsers(usersData.sort((a, b) => b.votes - a.votes));
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !currentUser) return;

    if (currentUser.isMuted) {
      toast.error('You are muted!');
      return;
    }

    try {
      const newMessage: Partial<Message> = {
        userId: currentUser.id,
        userName: currentUser.name,
        userTitle: currentUser.title,
        userRank: currentUser.rank,
        text: messageText,
        timestamp: Date.now(),
        isGlobal: activeTab === 'global',
        recipientId: selectedUser?.id,
        deleted: false,
      };

      await addDoc(collection(db, 'messages'), newMessage);
      setMessageText('');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const placeBounty = async () => {
    if (!bountyTarget || !currentUser) return;

    if (currentUser.credits < bountyAmount) {
      toast.error('Insufficient credits!');
      return;
    }

    try {
      const newBounty: Partial<Bounty> = {
        targetId: bountyTarget.id,
        targetName: bountyTarget.name,
        amount: bountyAmount,
        remaining: bountyAmount,
        placedBy: currentUser.id,
        isAnonymous,
        createdAt: Date.now(),
        expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
        active: true,
      };

      await addDoc(collection(db, 'bounties'), newBounty);
      
      // Deduct credits from user
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        credits: currentUser.credits - bountyAmount
      });

      toast.success(`Bounty placed on ${bountyTarget.name}!`, {
        icon: '🎯',
        duration: 4000,
      });

      setShowBountyModal(false);
      setBountyTarget(null);
      setBountyAmount(50000);
    } catch (error) {
      toast.error('Failed to place bounty');
    }
  };

  const sendGift = async () => {
    if (!giftRecipient || !currentUser) return;

    if (currentUser.credits < giftAmount) {
      toast.error('Insufficient credits!');
      return;
    }

    try {
      const newGift: Partial<Gift> = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        recipientId: giftRecipient.id,
        recipientName: giftRecipient.name,
        amount: giftAmount,
        isAnonymous,
        timestamp: Date.now(),
      };

      await addDoc(collection(db, 'gifts'), newGift);

      // Deduct from sender
      const senderRef = doc(db, 'users', currentUser.id);
      await updateDoc(senderRef, {
        credits: currentUser.credits - giftAmount
      });

      // Add to recipient
      const recipientRef = doc(db, 'users', giftRecipient.id);
      await updateDoc(recipientRef, {
        credits: (giftRecipient.credits || 0) + giftAmount
      });

      if (giftAmount >= 10000) {
        toast.success(`${isAnonymous ? 'Someone' : currentUser.name} sent ${giftAmount} credits to ${giftRecipient.name}! 🎁`, {
          duration: 5000,
          icon: '✨',
        });
      } else {
        toast.success(`Gift sent to ${giftRecipient.name}!`);
      }

      setShowGiftModal(false);
      setGiftRecipient(null);
      setGiftAmount(100);
    } catch (error) {
      toast.error('Failed to send gift');
    }
  };

  const submitConfession = async () => {
    if (!confessionText.trim() || !currentUser) return;

    try {
      const confession = {
        text: confessionText,
        userId: currentUser.id, // Only admin can see this
        timestamp: Date.now(),
      };

      await addDoc(collection(db, 'confessions'), confession);

      // Show confession animation in global chat
      toast('📢 New Anonymous Confession!', {
        duration: 4000,
        icon: '🔒',
      });

      setShowConfessionModal(false);
      setConfessionText('');
    } catch (error) {
      toast.error('Failed to submit confession');
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                The Pyramid
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${getRankColor(currentUser.rank)}`}>
                    {currentUser.name}
                  </span>
                  <span className="text-xs bg-gray-800 px-2 py-1 rounded">
                    {currentUser.title}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  💰 {currentUser.credits.toLocaleString()} credits
                </div>
              </div>
              
              <button
                onClick={() => {
                  localStorage.removeItem('pyramidUser');
                  router.push('/');
                }}
                className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Chat Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 bg-gray-900/50 p-2 rounded-xl">
              {['global', 'private', 'leaderboard', 'rules'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium capitalize transition-all ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Chat/Content Area */}
            {activeTab === 'global' && (
              <div className="glass rounded-xl p-6 h-[600px] flex flex-col">
                <h2 className="text-xl font-bold mb-4 text-white">Global Chat</h2>
                
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${getRankColor(msg.userRank)}`}>
                          {msg.userName}
                        </span>
                        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                          {msg.userTitle}
                        </span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-300">{msg.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={sendMessage}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="glass rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 text-white">Leaderboard</h2>
                <div className="space-y-2">
                  {users.map((user, index) => (
                    <div key={user.id} className={`bg-gray-800/50 rounded-lg p-4 flex items-center gap-4 ${
                      user.rank === 'F' ? 'border-2 border-red-500 rank-f-glow' : ''
                    }`}>
                      <div className="text-2xl font-bold text-gray-600">#{index + 1}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${getRankColor(user.rank)}`}>
                            {user.name}
                          </span>
                          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                            {user.title}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          {user.votes} votes • Rank {user.rank}
                        </div>
                      </div>
                      {user.online && (
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="glass rounded-xl p-6">
                <h2 className="text-2xl font-bold mb-6 text-white">Pyramid Game Rules</h2>
                <div className="space-y-6 text-gray-300">
                  <div>
                    <h3 className="text-lg font-semibold text-cyan-400 mb-2">🗳️ Voting System</h3>
                    <p>• You get 3 votes per week (+ or - votes)</p>
                    <p>• Vote for classmates you respect or downvote those you don't</p>
                    <p>• Cannot vote for yourself</p>
                    <p>• Unused votes are deducted from your received votes</p>
                    <p>• Voting resets every Sunday at midnight</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-purple-400 mb-2">🏆 Ranking System</h3>
                    <p>• S Rank: 100+ votes (God Tier)</p>
                    <p>• A Rank: 50+ votes (Elite)</p>
                    <p>• B Rank: 20+ votes (Great)</p>
                    <p>• C Rank: 10+ votes (Good)</p>
                    <p>• D Rank: 3-9 votes (Average)</p>
                    <p>• F Rank: Less than 3 votes (Outcast)</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-pink-400 mb-2">🎯 Bounty System</h3>
                    <p>• Place bounties on anyone (min 50,000 credits)</p>
                    <p>• Lasts 1 hour</p>
                    <p>• Anyone who downvotes the target gets 5,000 credits from the bounty</p>
                    <p>• Can be anonymous</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-green-400 mb-2">🎁 Gift System</h3>
                    <p>• Send credits as gifts to anyone</p>
                    <p>• Gifts 10k+ trigger animations for everyone</p>
                    <p>• Can be sent anonymously</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">🔇 Mute Power (A Rank Only)</h3>
                    <p>• A rank can mute D/F rank for 5 minutes (costs credits)</p>
                    <p>• F rank gets muted for 15 minutes</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-red-400 mb-2">🔒 Confession Booth</h3>
                    <p>• Submit anonymous confessions</p>
                    <p>• Visible to everyone in global chat for 4 seconds</p>
                    <p>• Your identity is hidden (except from admin)</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">💰 Credits System</h3>
                    <p>• 100,000 credits on registration</p>
                    <p>• 25,000 bonus for referrals (both parties)</p>
                    <p>• Weekly rewards for top 5: 1M, 500k, 300k, 200k, 100k</p>
                    <p>• Earn credits by voting, receiving gifts, bounties</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="glass rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-white">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowBountyModal(true)}
                  className="w-full py-2 px-4 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                >
                  🎯 Place Bounty
                </button>
                <button
                  onClick={() => setShowGiftModal(true)}
                  className="w-full py-2 px-4 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
                >
                  🎁 Send Gift
                </button>
                <button
                  onClick={() => setShowConfessionModal(true)}
                  className="w-full py-2 px-4 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors"
                >
                  🔒 Confess Anonymously
                </button>
              </div>
            </div>

            {/* Active Bounties */}
            {activeBounties.length > 0 && (
              <div className="glass rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-white">Active Bounties 🎯</h3>
                <div className="space-y-2">
                  {activeBounties.map((bounty) => (
                    <div key={bounty.id} className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 animate-bounty">
                      <div className="font-semibold text-red-400">{bounty.targetName}</div>
                      <div className="text-sm text-gray-400">
                        {bounty.remaining.toLocaleString()} credits remaining
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        By: {bounty.isAnonymous ? 'Anonymous' : 'Someone'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Your Stats */}
            <div className="glass rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-white">Your Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rank:</span>
                  <span className={`font-semibold ${getRankColor(currentUser.rank)}`}>
                    {currentUser.rank}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Votes:</span>
                  <span className="text-white">{currentUser.votes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Votes Remaining:</span>
                  <span className="text-white">{currentUser.votesRemaining}/3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Referral Code:</span>
                  <span className="text-cyan-400 font-mono">{currentUser.referralCode}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals would go here - Bounty, Gift, Confession */}
    </div>
  );
}
