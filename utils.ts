import { UserRank, RANK_REQUIREMENTS, TITLES } from '@/types';

export function calculateRank(votes: number): UserRank {
  if (votes >= RANK_REQUIREMENTS.S) return 'S';
  if (votes >= RANK_REQUIREMENTS.A) return 'A';
  if (votes >= RANK_REQUIREMENTS.B) return 'B';
  if (votes >= RANK_REQUIREMENTS.C) return 'C';
  if (votes >= RANK_REQUIREMENTS.D) return 'D';
  return 'F';
}

export function getTitleByVotes(votes: number): string {
  if (votes >= 100) return TITLES.UNTOUCHABLE;
  if (votes >= 80) return TITLES.KING_QUEEN;
  if (votes >= 60) return TITLES.SUPREME;
  if (votes >= 40) return TITLES.ELITE;
  if (votes >= 25) return TITLES.LEGEND;
  if (votes >= 15) return TITLES.INFLUENCER;
  if (votes >= 8) return TITLES.RISING_STAR;
  if (votes >= 3) return TITLES.CONTRIBUTOR;
  if (votes <= 0) return TITLES.FALLEN;
  if (votes < 3) return TITLES.OUTCAST;
  return TITLES.CLASSMATE;
}

export function getRankColor(rank: UserRank): string {
  const colors = {
    S: 'text-yellow-400',
    A: 'text-cyan-400',
    B: 'text-purple-400',
    C: 'text-green-400',
    D: 'text-orange-400',
    F: 'text-red-500',
  };
  return colors[rank];
}

export function getRankGlow(rank: UserRank): string {
  const glows = {
    S: 'shadow-yellow-400/50',
    A: 'shadow-cyan-400/50',
    B: 'shadow-purple-400/50',
    C: 'shadow-green-400/50',
    D: 'shadow-orange-400/50',
    F: 'shadow-red-500/80',
  };
  return glows[rank];
}

export function generateReferralCode(name: string, rollNumber: string): string {
  const code = `${name.substring(0, 3).toUpperCase()}${rollNumber}${Date.now().toString().slice(-4)}`;
  return code;
}

export function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function getWeekIdentifier(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil((now.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${week}`;
}
