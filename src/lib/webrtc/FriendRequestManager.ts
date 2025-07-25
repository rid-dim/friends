export interface ProfileData {
  accountname: string;
  profileImage?: string;
  /** Öffentlicher RSA-Schlüssel (PEM) des Benutzers */
  publicKeyPem?: string;
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

// --- Hybrid-Encryption Container (wie in smokesigns) ---
interface EncryptedData {
  encryptedKey: string;      // RSA-verschlüsselter AES-Key (base64)
  encryptedData: string;     // AES-verschlüsseltes Payload (base64)
  iv: string;                // Initialisierungsvektor (base64)
}

export class FriendRequestManager {
  private backendUrl: string;
  private profileId: string;
  private accountName: string;
  // Generierter Object-Name für das Profil-Scratchpad
  private profileObjectName: string;
  private antOwnerSecret = '6e273a3c19d3e908e905dc6537b7cfb9010ca7650a605886029850cef60cd440';

  // Eigener RSA-Private-Key (PEM) für Entschlüsselung
  private privateKeyPem?: string;

  constructor(backendUrl: string, profileId: string, accountName: string, privateKeyPem?: string) {
    this.backendUrl = backendUrl;
    this.profileId = profileId;
    this.accountName = accountName;
    this.privateKeyPem = privateKeyPem;

    // Bestimme object_name für das Profil-Scratchpad
    this.profileObjectName = accountName ? `profile${accountName}` : 'profile';
  }

  // Ermöglicht nachträgliches Setzen/Ändern des Private Keys
  public setPrivateKeyPem(pem: string) {
    this.privateKeyPem = pem;
  }

  // ----------------------------------------------
  // Hybrid-Crypto Helfer (RSA-OAEP + AES-CBC)
  // ----------------------------------------------

  private pemToBuffer(pem: string): ArrayBuffer {
    const pemContents = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s/g, '');
    return this.base64ToBuffer(pemContents);
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  private async encryptHybrid(data: any, publicPem: string): Promise<EncryptedData> {
    const aesKeyRaw = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(16));

    const aesKey = await crypto.subtle.importKey('raw', aesKeyRaw, { name: 'AES-CBC' }, false, ['encrypt']);
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encryptedDataBuf = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, aesKey, encoded);

    const pubKeyBuf = this.pemToBuffer(publicPem);
    const rsaKey = await crypto.subtle.importKey('spki', pubKeyBuf, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const encryptedKeyBuf = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, aesKeyRaw);

    return {
      encryptedKey: this.bufferToBase64(encryptedKeyBuf),
      encryptedData: this.bufferToBase64(encryptedDataBuf),
      iv: this.bufferToBase64(iv.buffer)
    };
  }

  private async decryptHybrid(container: EncryptedData, privatePem: string): Promise<any> {
    try {
      const privKeyBuf = this.pemToBuffer(privatePem);
      const rsaKey = await crypto.subtle.importKey('pkcs8', privKeyBuf, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);

      const encKeyBuf = this.base64ToBuffer(container.encryptedKey);
      const aesKeyRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsaKey, encKeyBuf);

      const aesKey = await crypto.subtle.importKey('raw', aesKeyRaw, { name: 'AES-CBC' }, false, ['decrypt']);
      const encDataBuf = this.base64ToBuffer(container.encryptedData);
      const ivBuf = this.base64ToBuffer(container.iv);
      const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBuf }, aesKey, encDataBuf);

      const json = new TextDecoder().decode(decryptedBuf);
      return JSON.parse(json);
    } catch (e) {
      console.error('Hybrid-Decrypt failed', e);
      return null;
    }
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
    const baseUrl = this.backendUrl ? `${this.backendUrl}/dweb-0/scratchpad-public` : '/dweb-0/scratchpad-public';
    return `${baseUrl}?object_name=${encodeURIComponent(objectName)}`;
  }

  // Build URL to access a scratchpad by its public address (read-only)
  private buildProfileAddressUrl(address: string): string {
    const baseUrl = this.backendUrl ? `${this.backendUrl}/dweb-0/scratchpad-public` : '/dweb-0/scratchpad-public';
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

      // Handle scratchpad wrapper format
      let chunk: any = null;
      if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
        chunk = scratchpadData[0];
      } else if (scratchpadData && scratchpadData.dweb_type === 'PublicScratchpad') {
        chunk = scratchpadData;
      }

      if (chunk && Array.isArray(chunk.unencrypted_data)) {
        try {
          const arr = this.byteArrayToJson(chunk.unencrypted_data);
          // Entschlüsseln sofern nötig
          const processed: FriendRequest[] = [];
          for (const item of arr) {
            if (item && item.encryptedKey && item.encryptedData && item.iv && this.privateKeyPem) {
              const decrypted = await this.decryptHybrid(item as EncryptedData, this.privateKeyPem);
              if (decrypted) processed.push(decrypted as FriendRequest);
            } else {
              processed.push(item as FriendRequest);
            }
          }
          return processed;
        } catch (err) {
          console.error('Error parsing/decoding friend requests:', err);
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
  async writeFriendRequest(objectName: string, secret: string, request: FriendRequest, recipientPublicKeyPem?: string): Promise<boolean> {
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

      // Optional verschlüsseln (erst nach dem Mergen, daher hier)
      let payloadObj: any = request;
      if (recipientPublicKeyPem) {
        try {
          payloadObj = await this.encryptHybrid(request, recipientPublicKeyPem);
        } catch (e) {
          console.warn('⚠️ Encryption of friend request failed, falling back to plaintext', e);
        }
      }

      // Ersetze (gleicher Typ) vorhandenen Eintrag dieser profileId, ansonsten anhängen
      updatedRequests = updatedRequests.filter(r => r.profileId !== request.profileId || (!!r.request !== !!request.request) || (!!r.approval !== !!request.approval));
      updatedRequests.push(payloadObj);

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
    // Do not send request to self
    if (targetProfileId === this.profileId) {
      console.warn('Attempted to send friend request to self, aborted.');
      return false;
    }
    try {
      // Read target profile
      const targetProfile = await this.readProfile(targetProfileId);
      if (!targetProfile || !targetProfile['friend-request-scratchpad']) {
        console.error('Invalid target profile');
        return false;
      }

      // Build request object
      const request: FriendRequest = {
        request: myHandshakeAddress, // Handshake-Adresse für WebRTC
        time: Date.now(),
        profileId: this.profileId, // Eigene Profile-ID für Profil-Lookup
        displayName: displayName
      };

      // Write friend request (optional Verschlüsselung)
      return await this.writeFriendRequest(targetProfile['friend-request-scratchpad'].object_name, targetProfile['friend-request-scratchpad']['ant-owner-secret'], request, targetProfile.publicKeyPem);
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

      // Build approval object
      const approval: FriendRequest = {
        approval: myHandshakeAddress, // Handshake-Adresse für WebRTC
        time: Date.now(),
        profileId: this.profileId // Eigene Profile-ID für Profil-Lookup
      };

      // Write approval to scratchpad (optional verschlüsselt)
      return await this.writeFriendRequest(requesterProfile['friend-request-scratchpad'].object_name, requesterProfile['friend-request-scratchpad']['ant-owner-secret'], approval, requesterProfile.publicKeyPem);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }
  }

  // Check for pending friend requests
  async checkPendingRequests(): Promise<FriendRequest[]> {
    try {
      // Profil lesen, um korrekten Object-Namen zu erhalten
      const profile = await this.readProfile(this.profileId);
      if (!profile || !profile['friend-request-scratchpad']) {
        console.warn('⚠️ Kein gültiges Profil oder Friend-Request-Scratchpad gefunden');
        return [];
      }
      
      const objectName = profile['friend-request-scratchpad'].object_name;
      
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
      // Profil lesen, um korrekten Object-Namen zu erhalten
      const profile = await this.readProfile(this.profileId);
      if (!profile || !profile['friend-request-scratchpad']) {
        console.warn('⚠️ Kein gültiges Profil oder Friend-Request-Scratchpad gefunden');
        return [];
      }
      
      const objectName = profile['friend-request-scratchpad'].object_name;
      
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
      // Profil lesen, um korrekten Object-Namen zu erhalten
      const profile = await this.readProfile(this.profileId);
      if (!profile || !profile['friend-request-scratchpad']) {
        console.warn('⚠️ Kein gültiges Profil oder Friend-Request-Scratchpad gefunden');
        return false;
      }
      
      const objectName = profile['friend-request-scratchpad'].object_name;
      
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
      // Profil lesen, um korrekten Object-Namen zu erhalten
      const profile = await this.readProfile(this.profileId);
      if (!profile || !profile['friend-request-scratchpad']) {
        console.warn('⚠️ Kein gültiges Profil oder Friend-Request-Scratchpad gefunden');
        return false;
      }
      
      const objectName = profile['friend-request-scratchpad'].object_name;
      
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
      // Profil lesen, um korrekten Object-Namen zu erhalten
      const profile = await this.readProfile(this.profileId);
      if (!profile || !profile['friend-request-scratchpad']) {
        console.warn('⚠️ Kein gültiges Profil oder Friend-Request-Scratchpad gefunden');
        return false;
      }
      
      const objectName = profile['friend-request-scratchpad'].object_name;
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

      // Create basic profile data (ohne friend-request-scratchpad)
      const profileData: ProfileData = {
        accountname: this.accountName,
        'friend-request-scratchpad': {
          'ant-owner-secret': this.antOwnerSecret,
          object_name: '' // Wird später durch ensureFriendRequestLink gesetzt
        }
      };

      // Scratchpad via POST erstellen
      const created = await this.createProfileScratchpad(profileData);
      if (created) {
        // Jetzt den korrekten Friend-Request-Link setzen (basierend auf profileId)
        await this.ensureFriendRequestLink();
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
  
  // Stellt sicher, dass im Profil ein korrekter Link zum Friend-Request-Scratchpad existiert
  // und verwendet die profileId als Basis für den Hash
  public async ensureFriendRequestLink(): Promise<boolean> {
    if (!this.profileId) {
      console.warn('⚠️ Keine profileId vorhanden - kann Friend-Request-Link nicht sicherstellen');
      return false;
    }
    
    try {
      console.log('🔍 ensureFriendRequestLink() wird ausgeführt');
      let prof = await this.readProfile(this.profileId);
      if (!prof) {
        console.warn('⚠️ Profil nicht lesbar');
        return false;
      }
      
      // Hash der profileId berechnen (statt accountName)
      const hashHex = await this.sha256(this.profileId);
      
      // Prüfen, ob bereits ein korrekter Link existiert
      if ('friend-request-scratchpad' in prof) {
        const existingHash = prof['friend-request-scratchpad'].object_name;
        if (existingHash === hashHex) {
          console.log('✅ Friend-Request-Scratchpad-Link bereits korrekt');
          return true;
        }
        console.log('🔄 Friend-Request-Scratchpad-Link wird aktualisiert');
      } else {
        console.log('➕ Friend-Request-Scratchpad-Link wird erstellt');
      }
      
      // Link setzen oder aktualisieren
      prof['friend-request-scratchpad'] = {
        'ant-owner-secret': this.antOwnerSecret,
        object_name: hashHex
      };
      
      // Profil speichern
      const success = await this.writeProfile(prof);
      if (success) {
        console.log('✅ Friend-Request-Scratchpad-Link gespeichert');
        
        // Sicherstellen, dass das Scratchpad auch existiert
        await this.ensureFriendRequestScratchpadExists();
        return true;
      } else {
        console.error('❌ Fehler beim Speichern des Friend-Request-Scratchpad-Links');
        return false;
      }
    } catch (e) {
      console.error('❌ Fehler beim Sicherstellen des Friend-Request-Links:', e);
      return false;
    }
  }
} 