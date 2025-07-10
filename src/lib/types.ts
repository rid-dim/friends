export interface Friend {
  profileId?: string;  
  displayName: string;
  profileImage?: string;
  peerId?: string;
  scratchpadAddress?: string;
  targetProfileId?: string;
  isConnected: boolean;
  unreadCount: number;
  isLoadingScratchpad?: boolean;
  scratchpadError?: boolean;
} 