export interface ProfileData {
  accountname: string;
  profileImage?: string;
  'friend-request-scratchpad': {
    'ant-owner-secret': string;
    object_name: string;
  };
}

export interface FriendRequest {
  request?: string;  // Handshake-Adresse des Anfragenden (für WebRTC)
  approval?: string; // Handshake-Adresse des Genehmigenden (für WebRTC)
  time: number;
  profileId: string; // Profile-ID für Profil-Lookup
  displayName?: string; // Optional: Display-Name für einfachere Verwaltung
}

export class FriendRequestManager {
  private backendUrl: string;
  private profileId: string;
  private accountName: string;
  // Generierter Object-Name für das Profil-Scratchpad
  private profileObjectName: string;
  private antOwnerSecret = '6e273a3c19d3e908e905dc6537b7cfb9010ca7650a605886029850cef60cd440';

  constructor(backendUrl: string, profileId: string, accountName: string) {
    this.backendUrl = backendUrl;
    this.profileId = profileId;
    this.accountName = accountName;

    // Bestimme object_name für das Profil-Scratchpad
    this.profileObjectName = accountName ? `profile${accountName}` : 'profile';
  }

  // Generate SHA256 hash
  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // Build URL to access *owned* scratchpad by object_name (needs secret for write)
  private buildProfileObjectUrl(objectName: string): string {
    const baseUrl = this.backendUrl ? `${this.backendUrl}/ant-0/scratchpad-public` : '/ant-0/scratchpad-public';
    return `${baseUrl}?object_name=${encodeURIComponent(objectName)}`;
  }

  // Build URL to access a scratchpad by its public address (read-only)
  private buildProfileAddressUrl(address: string): string {
    const baseUrl = this.backendUrl ? `${this.backendUrl}/ant-0/scratchpad-public` : '/ant-0/scratchpad-public';
    return `${baseUrl}/${address}`;
  }

  // Convert byte array back to JSON
  private byteArrayToJson(byteArray: number[]): any {
    const uint8Array = new Uint8Array(byteArray);
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(uint8Array);
    return JSON.parse(jsonString);
  }

  // Read profile data from scratchpad
  async readProfile(profileId: string): Promise<ProfileData | null> {
    try {
      const url = this.buildProfileAddressUrl(profileId);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Failed to read profile:', response.status);
        return null;
      }

      const scratchpadData = await response.json();

      // Handle scratchpad wrapper format
      let chunk: any = null;
      if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
        chunk = scratchpadData[0];
      } else if (scratchpadData && scratchpadData.dweb_type === 'PublicScratchpad') {
        chunk = scratchpadData;
      }

      if (chunk && Array.isArray(chunk.unencrypted_data)) {
        try {
          const profile = this.byteArrayToJson(chunk.unencrypted_data);
          return profile as ProfileData;
        } catch (err) {
          console.error('Error parsing profile JSON:', err);
          return null;
        }
      }

      // Fallback: assume response already is raw profile data
      return scratchpadData as ProfileData;
    } catch (error) {
      console.error('Error reading profile:', error);
      return null;
    }
  }

  // Convert JSON to byte array (same helper as in App.svelte)
  private jsonToByteArray(jsonString: string): number[] {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    return Array.from(uint8Array);
  }

  // Create a new public scratchpad for the profile (POST)
  private async createProfileScratchpad(profileData: ProfileData): Promise<boolean> {
    try {
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

      const url = this.buildProfileObjectUrl(this.profileObjectName);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends'
        },
        body: JSON.stringify(scratchpadPayload)
      });
      if (!response.ok) {
        return false;
      }

      const createdScratchpad = await response.json();
      const address = createdScratchpad?.scratchpad_address || createdScratchpad?.network_address;
      if (address) {
        this.profileId = address;
      }

      return true;
    } catch (error) {
      console.error('Error creating profile scratchpad:', error);
      return false;
    }
  }

  // Update existing profile scratchpad (PUT)
  async writeProfile(profileData: ProfileData): Promise<boolean> {
    try {
      const profileJson = JSON.stringify(profileData);
      const profileBytes = this.jsonToByteArray(profileJson);

      // Aktuellen Counter ermitteln (falls vorhanden)
      let currentCounter = -1;
      try {
        const metaRes = await fetch(this.buildProfileObjectUrl(this.profileObjectName), {
          headers: {
            'accept': 'application/json',
            'Ant-App-ID': 'friends'
          }
        });
        if (metaRes.ok) {
          const scratchpadData = await metaRes.json();
          let chunk: any = null;
          if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
            chunk = scratchpadData[0];
          } else if (scratchpadData && scratchpadData.dweb_type === 'PublicScratchpad') {
            chunk = scratchpadData;
          }
          if (chunk && typeof chunk.counter === 'number') {
            currentCounter = chunk.counter;
          }
        }
      } catch (e) {
        console.warn('Could not fetch current scratchpad to determine counter', e);
      }

      const newCounter = currentCounter + 1;

      const scratchpadPayload = {
        counter: newCounter < 0 ? 0 : newCounter,
        data_encoding: 0,
        dweb_type: 'PublicScratchpad',
        encrypted_data: [0],
        scratchpad_address: 'string',
        unencrypted_data: profileBytes
      };

      const url = this.buildProfileObjectUrl(this.profileObjectName);

      // Versuche PUT zuerst
      let response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends'
        },
        body: JSON.stringify(scratchpadPayload)
      });

      if (response.status === 404) {
        // Noch kein Scratchpad – dann POST
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ant-App-ID': 'friends'
          },
          body: JSON.stringify(scratchpadPayload)
        });
      }

      if (!response.ok) {
        console.error('writeProfile failed', response.status, await response.text());
      }

      return response.ok;
    } catch (error) {
      console.error('Error writing profile:', error);
      return false;
    }
  }

  // Read friend requests from scratchpad
  async readFriendRequests(objectName: string, secret: string): Promise<FriendRequest[]> {
    try {
      const url = this.buildProfileObjectUrl(objectName);
      const response = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': secret
        }
      });

      if (response.status === 404) {
        // Noch kein Scratchpad – keine Anfragen
        return [];
      }

      if (!response.ok) {
        console.error('Failed to read friend requests:', response.status);
        return [];
      }

      const scratchpadData = await response.json();

      let chunk: any = null;
      if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
        chunk = scratchpadData[0];
      } else if (scratchpadData && scratchpadData.dweb_type === 'PublicScratchpad') {
        chunk = scratchpadData;
      }

      if (chunk && Array.isArray(chunk.unencrypted_data)) {
        try {
          const requests = this.byteArrayToJson(chunk.unencrypted_data);
          return Array.isArray(requests) ? requests : [];
        } catch (err) {
          console.error('Error parsing friend requests JSON:', err);
          return [];
        }
      }

      // Fallback – falls als rohe Liste gespeichert (alte Version)
      if (Array.isArray(scratchpadData)) {
        return scratchpadData as FriendRequest[];
      }
      return [];
    } catch (error) {
      console.error('Error reading friend requests:', error);
      return [];
    }
  }

  // Write friend request to scratchpad
  async writeFriendRequest(objectName: string, secret: string, request: FriendRequest): Promise<boolean> {
    try {
      // Aktuelle Requests lesen (falls vorhanden)
      const existingRequests = await this.readFriendRequests(objectName, secret);

      // Prüfe auf Duplikate
      let updatedRequests = [...existingRequests];
      
      if (request.approval) {
        // Bei Approval: Prüfe ob bereits ein Approval von dieser Profile-ID existiert
        const existingApprovalIndex = existingRequests.findIndex(
          r => r.approval && r.profileId === request.profileId
        );
        
        if (existingApprovalIndex >= 0) {
          // Update existing approval
          updatedRequests[existingApprovalIndex] = request;
          console.log('Updated existing approval from profile:', request.profileId);
        } else {
          // Add new approval
          updatedRequests.push(request);
          console.log('Added new approval from profile:', request.profileId);
        }
      } else if (request.request) {
        // Bei Request: Prüfe ob bereits ein Request von dieser Profile-ID existiert
        const existingRequestIndex = existingRequests.findIndex(
          r => r.request && r.profileId === request.profileId
        );
        
        if (existingRequestIndex >= 0) {
          // Update existing request
          updatedRequests[existingRequestIndex] = request;
          console.log('Updated existing request from profile:', request.profileId);
        } else {
          // Add new request
          updatedRequests.push(request);
          console.log('Added new request from profile:', request.profileId);
        }
      } else {
        // Fallback: just add
        updatedRequests.push(request);
      }

      const requestsJson = JSON.stringify(updatedRequests);
      const requestsBytes = this.jsonToByteArray(requestsJson);

      // Aktuellen Counter ermitteln, damit wir inkrementieren können
      let currentCounter = -1;
      const url = this.buildProfileObjectUrl(objectName);
      try {
        const metaRes = await fetch(url, {
          headers: {
            'accept': 'application/json',
            'Ant-App-ID': 'friends',
            'Ant-Owner-Secret': secret
          }
        });

        if (metaRes.ok) {
          const scratchpadData = await metaRes.json();
          let chunk: any = null;
          if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
            chunk = scratchpadData[0];
          } else if (scratchpadData && scratchpadData.dweb_type === 'PublicScratchpad') {
            chunk = scratchpadData;
          }

          if (chunk && typeof chunk.counter === 'number') {
            currentCounter = chunk.counter;
          }
        }
      } catch (e) {
        console.warn('Could not fetch current friend request scratchpad to determine counter', e);
      }

      const newCounter = currentCounter + 1;

      const scratchpadPayload = {
        counter: newCounter < 0 ? 0 : newCounter,
        data_encoding: 0,
        dweb_type: 'PublicScratchpad',
        encrypted_data: [0],
        scratchpad_address: 'string',
        unencrypted_data: requestsBytes
      };

      // url bereits oben definiert

      // Versuche PUT zuerst
      let response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': secret
        },
        body: JSON.stringify(scratchpadPayload)
      });

      if (response.status === 404) {
        // Noch kein Scratchpad – dann POST
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ant-App-ID': 'friends',
            'Ant-Owner-Secret': secret
          },
          body: JSON.stringify(scratchpadPayload)
        });
      }

      return response.ok;
    } catch (error) {
      console.error('Error writing friend request:', error);
      return false;
    }
  }

  // Send friend request
  async sendFriendRequest(targetProfileId: string, myHandshakeAddress: string, displayName?: string): Promise<boolean> {
    try {
      // Read target profile
      const targetProfile = await this.readProfile(targetProfileId);
      if (!targetProfile || !targetProfile['friend-request-scratchpad']) {
        console.error('Invalid target profile');
        return false;
      }

      // Create friend request with handshake address
      const request: FriendRequest = {
        request: myHandshakeAddress, // Handshake-Adresse für WebRTC
        time: Date.now(),
        profileId: this.profileId, // Eigene Profile-ID für Profil-Lookup
        displayName: displayName
      };

      // Write to target's friend request scratchpad
      const objectName = targetProfile['friend-request-scratchpad'].object_name;
      const secret = targetProfile['friend-request-scratchpad']['ant-owner-secret'];
      return await this.writeFriendRequest(objectName, secret, request);
    } catch (error) {
      console.error('Error sending friend request:', error);
      return false;
    }
  }

  // Accept friend request
  async acceptFriendRequest(requesterProfileId: string, myHandshakeAddress: string): Promise<boolean> {
    try {
      // Read requester profile
      const requesterProfile = await this.readProfile(requesterProfileId);
      if (!requesterProfile || !requesterProfile['friend-request-scratchpad']) {
        console.error('Invalid requester profile');
        return false;
      }

      // Create approval with handshake address
      const approval: FriendRequest = {
        approval: myHandshakeAddress, // Handshake-Adresse für WebRTC
        time: Date.now(),
        profileId: this.profileId // Eigene Profile-ID für Profil-Lookup
      };

      // Write to requester's friend request scratchpad
      const objectName = requesterProfile['friend-request-scratchpad'].object_name;
      const secret = requesterProfile['friend-request-scratchpad']['ant-owner-secret'];
      return await this.writeFriendRequest(objectName, secret, approval);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }
  }

  // Check for pending friend requests
  async checkPendingRequests(): Promise<FriendRequest[]> {
    try {
      // Generate object name for my friend request scratchpad (Hash des Profil-Object-Namens)
      const objectName = await this.sha256(this.profileObjectName);
      
      // Read all requests
      const allRequests = await this.readFriendRequests(objectName, this.antOwnerSecret);
      
      // Filter for pending requests (not approvals)
      return allRequests.filter(req => req.request && !req.approval);
    } catch (error) {
      console.error('Error checking pending requests:', error);
      return [];
    }
  }

  // Check for received approvals
  async checkReceivedApprovals(): Promise<FriendRequest[]> {
    try {
      // Generate object name for my friend request scratchpad
      const objectName = await this.sha256(this.profileObjectName);
      
      // Read all requests
      const allRequests = await this.readFriendRequests(objectName, this.antOwnerSecret);
      
      // Filter for approvals
      return allRequests.filter(req => req.approval && !req.request);
    } catch (error) {
      console.error('Error checking received approvals:', error);
      return [];
    }
  }

  // Remove processed approval from scratchpad
  async removeProcessedApproval(approvalProfileId: string): Promise<boolean> {
    try {
      // Generate object name for my friend request scratchpad
      const objectName = await this.sha256(this.profileObjectName);
      
      // Read all requests
      const allRequests = await this.readFriendRequests(objectName, this.antOwnerSecret);
      
      // Filter out the processed approval
      const updatedRequests = allRequests.filter(req => 
        !(req.approval && req.profileId === approvalProfileId)
      );
      
      // If nothing changed, return
      if (updatedRequests.length === allRequests.length) {
        return true;
      }
      
      // Write back the updated list
      const requestsJson = JSON.stringify(updatedRequests);
      const requestsBytes = this.jsonToByteArray(requestsJson);
      
      // Get current counter
      let currentCounter = -1;
      const url = this.buildProfileObjectUrl(objectName);
      try {
        const metaRes = await fetch(url, {
          headers: {
            'accept': 'application/json',
            'Ant-App-ID': 'friends',
            'Ant-Owner-Secret': this.antOwnerSecret
          }
        });
        
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData && typeof metaData.counter === 'number') {
            currentCounter = metaData.counter;
          }
        }
      } catch (e) {
        console.warn('Could not fetch current counter:', e);
      }
      
      const scratchpadPayload = {
        counter: currentCounter + 1,
        data_encoding: 0,
        dweb_type: "PublicScratchpad",
        encrypted_data: [0],
        scratchpad_address: "string",
        unencrypted_data: requestsBytes
      };
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': this.antOwnerSecret
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Processed approval removed from scratchpad');
      return true;
    } catch (error) {
      console.error('Error removing processed approval:', error);
      return false;
    }
  }

  // Remove processed friend request (after we have accepted it) from my scratchpad
  async removeProcessedRequest(requestProfileId: string): Promise<boolean> {
    try {
      // Generate object name for my friend request scratchpad
      const objectName = await this.sha256(this.profileObjectName);
      
      // Read all requests
      const allRequests = await this.readFriendRequests(objectName, this.antOwnerSecret);
      
      // Filter out the processed request
      const updatedRequests = allRequests.filter(req => 
        !(req.request && req.profileId === requestProfileId)
      );
      
      if (updatedRequests.length === allRequests.length) {
        // Nothing changed
        return true;
      }
      
      // Write back
      const requestsJson = JSON.stringify(updatedRequests);
      const requestsBytes = this.jsonToByteArray(requestsJson);
      
      // Determine current counter
      let currentCounter = -1;
      const url = this.buildProfileObjectUrl(objectName);
      try {
        const metaRes = await fetch(url, {
          headers: {
            'accept': 'application/json',
            'Ant-App-ID': 'friends',
            'Ant-Owner-Secret': this.antOwnerSecret
          }
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData && typeof metaData.counter === 'number') {
            currentCounter = metaData.counter;
          }
        }
      } catch (e) {
        console.warn('Could not fetch current counter for removeProcessedRequest:', e);
      }
      
      const scratchpadPayload = {
        counter: currentCounter + 1,
        data_encoding: 0,
        dweb_type: "PublicScratchpad",
        encrypted_data: [0],
        scratchpad_address: "string",
        unencrypted_data: requestsBytes
      };
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': this.antOwnerSecret
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Processed friend request removed from my scratchpad');
      return true;
    } catch (error) {
      console.error('Error removing processed friend request:', error);
      return false;
    }
  }

  // Stellt sicher, dass das Freundschaftsanfragen-Scratchpad existiert.
  private async ensureFriendRequestScratchpadExists(): Promise<boolean> {
    try {
      const objectName = await this.sha256(this.profileObjectName);
      const url = this.buildProfileObjectUrl(objectName);

      // Prüfen, ob bereits vorhanden
      const headRes = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': this.antOwnerSecret
        }
      });

      if (headRes.ok) {
        // Bereits vorhanden
        return true;
      }

      if (headRes.status !== 404) {
        console.warn('Unable to check friend request scratchpad:', headRes.status);
      }

      // Neues leeres Scratchpad anlegen
      const emptyJson = JSON.stringify([]);
      const emptyBytes = this.jsonToByteArray(emptyJson);

      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: 'PublicScratchpad',
        encrypted_data: [0],
        scratchpad_address: 'string',
        unencrypted_data: emptyBytes
      };

      const createRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': this.antOwnerSecret
        },
        body: JSON.stringify(scratchpadPayload)
      });

      if (!createRes.ok) {
        console.error('Failed to create friend request scratchpad:', createRes.status);
      }

      return createRes.ok;
    } catch (error) {
      console.error('Error ensuring friend request scratchpad exists:', error);
      return false;
    }
  }

  // Initialize profile if not exists
  async initializeProfile(): Promise<boolean> {
    try {
      // Prüfe, ob ein Profil-Scratchpad mit unserem object_name bereits existiert
      const url = this.buildProfileObjectUrl(this.profileObjectName);
      const response = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends'
        }
      });

      let profileExists = false;
      if (response.ok) {
        const scratchpadData = await response.json();
        let chunk: any = null;
        if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
          chunk = scratchpadData[0];
        } else if (scratchpadData && scratchpadData.dweb_type === 'PublicScratchpad') {
          chunk = scratchpadData;
        }

        if (chunk) {
          const address = chunk.scratchpad_address || chunk.network_address;
          if (address) {
            this.profileId = address;
            profileExists = true;
          }
        }
      }

      if (profileExists) {
        console.log('Profile scratchpad already exists at', this.profileId);
        await this.ensureFriendRequestScratchpadExists();
        return true;
      }

      // Wir haben noch keine Adresse – die wird nach Erstellung gesetzt

      // Generate object name for friend request scratchpad
      const objectName = await this.sha256(this.profileObjectName);

      // Create profile data
      const profileData: ProfileData = {
        accountname: this.accountName,
        'friend-request-scratchpad': {
          'ant-owner-secret': this.antOwnerSecret,
          object_name: objectName
        }
      };

      // Scratchpad via POST erstellen
      const created = await this.createProfileScratchpad(profileData);
      if (created) {
        await this.ensureFriendRequestScratchpadExists();
      }
      return created;
    } catch (error) {
      console.error('Error initializing profile:', error);
      return false;
    }
  }

  // Update profile image
  async updateProfileImage(profileImage: string): Promise<boolean> {
    try {
      const profile = await this.readProfile(this.profileId);
      if (!profile) {
        console.error('Profile not found');
        return false;
      }

      profile.profileImage = profileImage;
      return await this.writeProfile(profile);
    } catch (error) {
      console.error('Error updating profile image:', error);
      return false;
    }
  }

  // Ermöglicht extern das Auslesen der aktuell bekannten Profil-ID (Scratchpad-Adresse)
  public getProfileId(): string {
    return this.profileId;
  }
} 