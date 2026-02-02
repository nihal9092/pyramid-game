export type UserRank = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface User {
  id: string;
  name: string;
  class: string;
  section: string;
  rollNumber: string;
  email?: string;
  credits: number;
  title: string;
  rank: UserRank;
  votes: number;
  votesGiven: number;
  votesRemaining: number;
  referralCode: string;
  referredBy?: string;
  isMuted: boolean;
  mutedUntil?: number;
  isBanned: boolean;
  suspendedUntil?: number;
  online: boolean;
  lastSeen: number;
  createdAt: number;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  userTitle: string;
  userRank: UserRank;
  text: string;
  timestamp: number;
  isGlobal: boolean;
  recipientId?: string;
  deleted: boolean;
}

export interface Vote {
  id: string;
  voterId: string;
  targetId: string;
  value: number; // +1 or -1
  timestamp: number;
  week: string;
}

export interface Bounty {
  id: string;
  targetId: string;
  targetName: string;
  amount: number;
  remaining: number;
  placedBy: string;
  isAnonymous: boolean;
  createdAt: number;
  expiresAt: number;
  active: boolean;
}

export interface Gift {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  isAnonymous: boolean;
  timestamp: number;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: { [optionIndex: number]: string[] }; // option index -> user IDs
  createdBy: string;
  createdAt: number;
  endsAt: number;
  active: boolean;
}

export interface Confession {
  id: string;
  text: string;
  userId: string; // only admin can see this
  timestamp: number;
}

export interface AdminAction {
  id: string;
  type: 'credit_grant' | 'credit_revoke' | 'ban' | 'suspend' | 'title_edit' | 'broadcast' | 'vote' | 'reset_voting';
  targetId?: string;
  amount?: number;
  duration?: number;
  message?: string;
  timestamp: number;
}

export const TITLES = {
  CLASSMATE: 'Classmate',
  CONTRIBUTOR: 'The Contributor',
  RISING_STAR: 'Rising Star',
  INFLUENCER: 'The Influencer',
  LEGEND: 'Living Legend',
  ELITE: 'Elite Squad',
  SUPREME: 'Supreme Leader',
  KING_QUEEN: 'King/Queen',
  UNTOUCHABLE: 'The Untouchable',
  OUTCAST: 'The Outcast',
  FALLEN: 'The Fallen',
};

export const RANK_REQUIREMENTS = {
  S: 100, // 100+ votes
  A: 50,  // 50+ votes
  B: 20,  // 20+ votes
  C: 10,  // 10+ votes
  D: 3,   // 3-9 votes
  F: -Infinity, // < 3 votes
};
