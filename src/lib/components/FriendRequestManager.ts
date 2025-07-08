// Friend Request Manager - Handles profile scratchpads and friend requests

export interface ProfileData {
  accountname: string;
  profileImage?: string;
  friendRequestScratchpad: {
    'Ant-Owner-Secret': string;
    object_name: string;
  };
}

export interface FriendRequest {
  request?: string; // peer-id for handshake
  approval?: string; // peer-id for handshake (when accepting)
  time: number; // unix timestamp
  profileId: string;
}

export class FriendRequestManager {
  private backendUrl: string;
  private accountName: string;
  private profileId: string;
  
  // Fixed owner secret for friend request scratchpads
  private static readonly FRIEND_REQUEST_OWNER_SECRET = '6e273a3c19d3e908e905dc6537b7cfb9010ca7650a605886029850cef60cd440';
  
  constructor(backendUrl: string, accountName: string, profileId: string) {
    this.backendUrl = backendUrl;
    this.accountName = accountName;
    this.profileId = profileId;
  }
  
  // Generate SHA256 hash for object name
  private generateObjectName(profileId: string): string {
    // In browser environment, we'll use Web Crypto API
    // This will be called from Svelte component where we have access to browser APIs
    return ''; // Placeholder - will be implemented in browser
  }
  
  // Convert JSON to byte array
  private jsonToByteArray(jsonString: string): number[] {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    return Array.from(uint8Array);
  }
  
  // Convert byte array to JSON
  private byteArrayToJson(byteArray: number[]): any {
    const uint8Array = new Uint8Array(byteArray);
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(uint8Array);
    return JSON.parse(jsonString);
  }
  
  // Build URL for profile scratchpad (public)
  private buildProfileUrl(profileId: string): string {
    const baseUrl = this.backendUrl ? `${this.backendUrl}/ant-0/scratchpad-public` : '/ant-0/scratchpad-public';
    return `${baseUrl}/${profileId}`;
  }
  
  // Build URL for friend request scratchpad
  private buildFriendRequestUrl(objectName: string): string {
    const baseUrl = this.backendUrl ? `${this.backendUrl}/ant-0/scratchpad-public` : '/ant-0/scratchpad-public';
    return `${baseUrl}?object_name=${encodeURIComponent(objectName)}`;
  }
  
  // Update own profile scratchpad
  async updateOwnProfile(username: string, profileImage?: string): Promise<boolean> {
    try {
      // Generate object name for friend request scratchpad
      const objectName = await this.generateObjectNameAsync(this.profileId);
      
      const profileData: ProfileData = {
        accountname: username,
        profileImage: profileImage,
        friendRequestScratchpad: {
          'Ant-Owner-Secret': FriendRequestManager.FRIEND_REQUEST_OWNER_SECRET,
          object_name: objectName
        }
      };
      
      const profileJson = JSON.stringify(profileData);
      const profileBytes = this.jsonToByteArray(profileJson);
      
      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: "PublicScratchpad",
        encrypted_data: [0],
        scratchpad_address: "string",
        unencrypted_data: profileBytes
      };
      
      const response = await fetch(this.buildProfileUrl(this.profileId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends'
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Profile scratchpad updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating profile scratchpad:', error);
      return false;
    }
  }
  
  // Read profile from scratchpad
  async readProfile(profileId: string): Promise<ProfileData | null> {
    try {
      const response = await fetch(this.buildProfileUrl(profileId), {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Profile not found');
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const scratchpadData = await response.json();
      
      // Extract data from scratchpad format
      let chunk = null;
      if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
        chunk = scratchpadData[0];
      } else if (scratchpadData && scratchpadData.dweb_type === "PublicScratchpad") {
        chunk = scratchpadData;
      }
      
      if (chunk && chunk.unencrypted_data && Array.isArray(chunk.unencrypted_data)) {
        const profileData = this.byteArrayToJson(chunk.unencrypted_data);
        return profileData as ProfileData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error reading profile:', error);
      return null;
    }
  }
  
  // Read friend requests from scratchpad
  async readFriendRequests(objectName: string, ownerSecret: string): Promise<FriendRequest[]> {
    try {
      const response = await fetch(this.buildFriendRequestUrl(objectName), {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': ownerSecret
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Friend request scratchpad not found');
          return [];
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const scratchpadData = await response.json();
      
      // Extract data from scratchpad format
      let chunk = null;
      if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
        chunk = scratchpadData[0];
      } else if (scratchpadData && scratchpadData.dweb_type === "PublicScratchpad") {
        chunk = scratchpadData;
      }
      
      if (chunk && chunk.unencrypted_data && Array.isArray(chunk.unencrypted_data)) {
        const requests = this.byteArrayToJson(chunk.unencrypted_data);
        return Array.isArray(requests) ? requests : [];
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error reading friend requests:', error);
      return [];
    }
  }
  
  // Send friend request
  async sendFriendRequest(targetProfileId: string, myPeerId: string): Promise<boolean> {
    try {
      // First read the target profile to get friend request scratchpad info
      const targetProfile = await this.readProfile(targetProfileId);
      if (!targetProfile || !targetProfile.friendRequestScratchpad) {
        console.error('Target profile not found or invalid');
        return false;
      }
      
      const { object_name, 'Ant-Owner-Secret': ownerSecret } = targetProfile.friendRequestScratchpad;
      
      // Read existing requests
      const existingRequests = await this.readFriendRequests(object_name, ownerSecret);
      
      // Add our request
      const newRequest: FriendRequest = {
        request: myPeerId,
        time: Date.now(),
        profileId: this.profileId
      };
      
      const updatedRequests = [...existingRequests, newRequest];
      
      // Write back to scratchpad
      const requestsJson = JSON.stringify(updatedRequests);
      const requestsBytes = this.jsonToByteArray(requestsJson);
      
      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: "PublicScratchpad",
        encrypted_data: [0],
        scratchpad_address: "string",
        unencrypted_data: requestsBytes
      };
      
      const response = await fetch(this.buildFriendRequestUrl(object_name), {
        method: existingRequests.length === 0 ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': ownerSecret
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Friend request sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Error sending friend request:', error);
      return false;
    }
  }
  
  // Accept friend request
  async acceptFriendRequest(requestProfileId: string, myPeerId: string): Promise<boolean> {
    try {
      // Read the requester's profile to get their friend request scratchpad
      const requesterProfile = await this.readProfile(requestProfileId);
      if (!requesterProfile || !requesterProfile.friendRequestScratchpad) {
        console.error('Requester profile not found or invalid');
        return false;
      }
      
      const { object_name, 'Ant-Owner-Secret': ownerSecret } = requesterProfile.friendRequestScratchpad;
      
      // Read existing requests
      const existingRequests = await this.readFriendRequests(object_name, ownerSecret);
      
      // Add our approval
      const approval: FriendRequest = {
        approval: myPeerId,
        time: Date.now(),
        profileId: this.profileId
      };
      
      const updatedRequests = [...existingRequests, approval];
      
      // Write back to scratchpad
      const requestsJson = JSON.stringify(updatedRequests);
      const requestsBytes = this.jsonToByteArray(requestsJson);
      
      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: "PublicScratchpad",
        encrypted_data: [0],
        scratchpad_address: "string",
        unencrypted_data: requestsBytes
      };
      
      const response = await fetch(this.buildFriendRequestUrl(object_name), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': ownerSecret
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Friend request accepted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error accepting friend request:', error);
      return false;
    }
  }
  
  // Check own friend requests
  async checkOwnFriendRequests(): Promise<FriendRequest[]> {
    try {
      const objectName = await this.generateObjectNameAsync(this.profileId);
      const requests = await this.readFriendRequests(objectName, FriendRequestManager.FRIEND_REQUEST_OWNER_SECRET);
      return requests;
    } catch (error) {
      console.error('❌ Error checking own friend requests:', error);
      return [];
    }
  }
  
  // Generate object name using Web Crypto API (async)
  async generateObjectNameAsync(profileId: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(profileId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
} 