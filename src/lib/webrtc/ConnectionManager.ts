// WebRTC Connection Manager for multiple peer connections
import type { FileAttachment } from '../file-handling/types';
import { Link, HandshakeserverConnector } from 'smokesigns';
import type { ReadWriteInterface } from 'smokesigns';

export interface ConnectionEvents {
  onMessage: (peerId: string, data: any) => void;
  onConnectionStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
  onError: (peerId: string, error: Error) => void;
}

// Common interface for both connection types
interface ConnectionInterface {
  peerId: string;
  isConnected: boolean;
  isConnecting: boolean;
  sendMessage(data: any): void;
  sendLargeFileInChunks(messageData: any, attachment: FileAttachment): void;
  close(): void;
}

/**
 * SinglePeerConnection using smokesigns library
 * This replaces the old PeerConnection implementation using smokesigns Link
 */
export class SinglePeerConnection {
  peerId: string;
  private events: ConnectionEvents;
  private link: Link | null = null;
  dataChannel: RTCDataChannel | null = null;
  isConnected: boolean = false;
  isConnecting: boolean = false;
  private messageQueue: any[] = [];
  private fileTransfers: Map<string, { 
    chunks: string[],
    totalChunks: number,
    chunkSize: number,
    attachment: FileAttachment
  }> = new Map();

  constructor(peerId: string, events: ConnectionEvents, 
    myAddress: string, peerAddress: string, priority: boolean) {
    this.peerId = peerId;
    this.events = events;
    
    console.log(`[${this.peerId}] Creating smokesigns Link with addresses:`, { 
      readAddress: peerAddress,
      writeAddress: myAddress,
      priority
    });
    
    // Create smokesigns link
    this.setupLink(myAddress, peerAddress, priority);
  }
  
  private setupLink(myAddress: string, peerAddress: string, priority: boolean): void {
    try {
      // Create handshake server connector
      const connector = new HandshakeserverConnector({
        serverUrl: 'https://handshake.autonomi.space',
        readAddress: peerAddress, // Read from peer's address
        writeAddress: myAddress   // Write to my address
      });

      console.log(`[${this.peerId}] Creating smokesigns Link with:`, {
        serverUrl: 'https://handshake.autonomi.space',
        readAddress: peerAddress.substring(0, 8) + '...',
        writeAddress: myAddress.substring(0, 8) + '...',
        priority
      });

      // Create link
      this.link = new Link({
        readWriteInterface: connector,
        priority: priority,
        onConnect: () => {
          console.log(`[${this.peerId}] Link connected`);
          this.isConnected = true;
          this.isConnecting = false;
          this.events.onConnectionStateChange(this.peerId, 'connected');
          
          // Process queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) {
              this.sendMessage(msg);
            }
          }
        },
        onClose: () => {
          console.log(`[${this.peerId}] Link closed`);
          this.isConnected = false;
          this.events.onConnectionStateChange(this.peerId, 'disconnected');
        },
        onError: (error) => {
          console.error(`[${this.peerId}] Link error:`, error);
          this.events.onError(this.peerId, error);
        },
        onMessage: (data) => {
          console.log(`[${this.peerId}] Received message:`, data);
          this.events.onMessage(this.peerId, data);
        }
      });
      
      // Start the connection process
      console.log(`[${this.peerId}] Starting smokesigns connection...`);
      this.link.connect().catch(error => {
        console.error(`[${this.peerId}] Failed to start smokesigns connection:`, error);
        this.events.onError(this.peerId, error);
      });
      
    } catch (error) {
      console.error(`[${this.peerId}] Error setting up link:`, error);
      this.events.onError(this.peerId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  private handleFileChunk(data: any): void {
    // Process file chunk...
    // (This would be implemented based on the file handling needs)
    console.log(`[${this.peerId}] Received file chunk:`, data.chunkIndex, 'of', data.totalChunks);
  }
  
  async connect(): Promise<void> {
    if (!this.link) {
      console.error(`[${this.peerId}] Cannot connect, Link not initialized`);
      return;
    }
    
    if (this.isConnected) {
      console.log(`[${this.peerId}] Already connected`);
      return;
    }
    
    if (this.isConnecting) {
      console.log(`[${this.peerId}] Already connecting`);
      return;
    }
    
    this.isConnecting = true;
    
    try {
      await this.link.connect();
      console.log(`[${this.peerId}] Connection started`);
    } catch (error) {
      console.error(`[${this.peerId}] Connection error:`, error);
      this.isConnecting = false;
      this.events.onError(this.peerId, error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  close(): void {
    console.log(`[${this.peerId}] Closing SinglePeerConnection`);
    
    if (this.link) {
      this.link.disconnect();
      this.link = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
  }
  
  sendMessage(data: any): void {
    if (!this.link) {
      console.warn(`[${this.peerId}] Cannot send message - no link`);
      return;
    }
    
    if (!this.isConnected) {
      console.log(`[${this.peerId}] Queueing message - not connected`);
      this.messageQueue.push(data);
      return;
    }
    
    try {
      this.link.send(data);
      console.log(`[${this.peerId}] Message sent:`, data.type);
    } catch (error) {
      console.error(`[${this.peerId}] Failed to send message:`, error);
      this.messageQueue.push(data);
    }
  }
  
  sendLargeFileInChunks(data: any, attachment: FileAttachment): boolean {
    if (!attachment.data) return false;
    
    const chunkSize = 16000; // bytes per chunk
    const fileData = attachment.data;
    const totalChunks = Math.ceil(fileData.length / chunkSize);
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[${this.peerId}] Sending file in ${totalChunks} chunks, size: ${fileData.length}`);
    
    // Send initial message with file information
    const fileInfo = {
      type: 'file-start',
      fileId,
      timestamp: new Date().toISOString(),
      nick: data.nick,
      message: data.message,
      attachment: {
        ...attachment,
        id: fileId,
        data: undefined,
        totalChunks
      }
    };
    
    this.sendMessage(fileInfo);
    
    // Send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileData.length);
      const chunk = fileData.substring(start, end);
      
      const chunkData = {
        type: 'file-chunk',
        fileId,
        chunkIndex: i,
        totalChunks,
        data: chunk,
        attachmentId: fileId
      };
      
      // Short delay between chunks to avoid flooding
      setTimeout(() => {
        this.sendMessage(chunkData);
        
        // Log progress periodically
        if (i % 10 === 0 || i === totalChunks - 1) {
          console.log(`[${this.peerId}] Sending chunk ${i+1}/${totalChunks}`);
        }
      }, i * 50); // 50ms between chunks
    }
    
    return true;
  }
}

export class PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null = null;
  isConnected: boolean = false;
  isConnecting: boolean = false;
  private events: ConnectionEvents;
  
  constructor(peerId: string, events: ConnectionEvents, rtcConfig: RTCConfiguration) {
    this.peerId = peerId;
    this.events = events;
    console.log(`[${this.peerId}] Creating RTCPeerConnection with config:`, rtcConfig);
    this.connection = new RTCPeerConnection(rtcConfig);
    
    // Add connection timeout monitoring
    this.startConnectionTimeout();
    
    this.setupConnection();
  }
  
  private connectionTimeoutId?: number;
  
  private startConnectionTimeout() {
    // Give the connection 30 seconds to establish
    this.connectionTimeoutId = setTimeout(() => {
      if (!this.isConnected && this.connection.connectionState !== 'closed') {
        console.warn(`[${this.peerId}] Connection timeout after 30 seconds`);
        console.log(`[${this.peerId}] Final state - Connection: ${this.connection.connectionState}, ICE: ${this.connection.iceConnectionState}`);
      }
    }, 30000);
  }
  
  private setupConnection() {
    // Handle ICE candidates - log but don't store separately
    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate;
        
        // Analysiere den Kandidaten-Typ
        let candidateType = 'unknown';
        let isLocal = false;
        
        if (candidate.candidate.includes('typ host')) {
          candidateType = 'HOST (Local)';
          isLocal = true;
        } else if (candidate.candidate.includes('typ srflx')) {
          candidateType = 'SERVER REFLEXIVE (STUN)';
        } else if (candidate.candidate.includes('typ relay')) {
          candidateType = 'RELAY (TURN)';
        } else if (candidate.candidate.includes('typ prflx')) {
          candidateType = 'PEER REFLEXIVE';
        }
        
        // Prüfe auf mDNS-Adressen (.local)
        const isMdns = candidate.candidate.includes('.local');
        
        console.log(`[${this.peerId}] New ICE Candidate:`, {
          type: candidateType,
          candidate: candidate.candidate,
          protocol: candidate.protocol,
          address: candidate.address,
          port: candidate.port,
          foundation: candidate.foundation,
          priority: candidate.priority,
          isLocal: isLocal,
          isMdns: isMdns
        });
        
        if (isMdns) {
          console.log(`[${this.peerId}] 🎯 mDNS CANDIDATE FOUND: ${candidate.candidate}`);
        }
        
        if (isLocal) {
          console.log(`[${this.peerId}] 🏠 LOCAL NETWORK CANDIDATE: ${candidate.address}:${candidate.port}`);
        }
      } else {
        console.log(`[${this.peerId}] ICE candidate gathering completed`);
      }
    };
    
    // Handle ICE connection state changes
    this.connection.oniceconnectionstatechange = () => {
      const iceState = this.connection.iceConnectionState;
      console.log(`[${this.peerId}] ICE connection state:`, iceState);
      
      // Detailliertes Logging für ICE-Zuständenänderungen
      switch (iceState) {
        case 'new':
          console.log(`[${this.peerId}] 🔄 ICE NEW: Starting ICE gathering`);
          break;
        case 'checking':
          console.log(`[${this.peerId}] 🔍 ICE CHECKING: Testing connectivity between candidates`);
          break;
        case 'connected':
          console.log(`[${this.peerId}] ✅ ICE CONNECTED: Found working candidate pair!`);
          break;
        case 'completed':
          console.log(`[${this.peerId}] 🎉 ICE COMPLETED: All checks done, connection established`);
          break;
        case 'disconnected':
          console.warn(`[${this.peerId}] ⚠️ ICE DISCONNECTED: Connection lost, trying to reconnect...`);
          break;
        case 'failed':
          console.error(`[${this.peerId}] ❌ ICE FAILED: No working connection path found`);
          break;
        case 'closed':
          console.log(`[${this.peerId}] 🔒 ICE CLOSED: Connection terminated`);
          break;
      }
      
      // Bei kritischen Zuständen zusätzliche Diagnose
      if (iceState === 'failed' || iceState === 'disconnected') {
        setTimeout(() => this.quickIceDiagnosis(), 1000);
      }
    };
    
    // Handle connection state changes
    this.connection.onconnectionstatechange = () => {
      const state = this.connection.connectionState;
      console.log(`[${this.peerId}] Connection state:`, state);
      console.log(`[${this.peerId}] ICE state:`, this.connection.iceConnectionState);
      console.log(`[${this.peerId}] Signaling state:`, this.connection.signalingState);
      
      // Log more details when connection fails
      if (state === 'failed') {
        console.error(`[${this.peerId}] Connection failed!`);
        console.error(`[${this.peerId}] Local description:`, this.connection.localDescription?.sdp?.substring(0, 200));
        console.error(`[${this.peerId}] Remote description:`, this.connection.remoteDescription?.sdp?.substring(0, 200));
        console.error(`[${this.peerId}] ICE gathering state:`, this.connection.iceGatheringState);
        console.error(`[${this.peerId}] ICE connection state:`, this.connection.iceConnectionState);
        
        // Detaillierte ICE-Kandidaten-Analyse bei Fehlschlag
        this.analyzeConnectionFailure();
      }
      
      // Update connection status flags
      this.isConnected = state === 'connected';
      this.isConnecting = state === 'connecting' || state === 'new';
      
      this.events.onConnectionStateChange(this.peerId, state);
    };
    
    // Handle signaling state changes
    this.connection.onsignalingstatechange = () => {
      console.log(`[${this.peerId}] Signaling state:`, this.connection.signalingState);
    };
    
    // Handle incoming data channel
    this.connection.ondatachannel = (event) => {
      console.log(`[${this.peerId}] Data channel received`);
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
    };
  }
  
  setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    
    channel.onopen = () => {
      console.log(`[${this.peerId}] Data channel opened`);
      this.isConnected = true;
    };
    
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.events.onMessage(this.peerId, data);
      } catch (error) {
        console.error(`[${this.peerId}] Error parsing message:`, error);
      }
    };
    
    channel.onclose = () => {
      console.log(`[${this.peerId}] Data channel closed`);
      this.isConnected = false;
    };
    
    channel.onerror = (error) => {
      console.error(`[${this.peerId}] Data channel error:`, error);
      this.events.onError(this.peerId, new Error('Data channel error'));
    };
  }
  
  // Filter mDNS candidates from SDP
  private filterMDNSCandidates(sdp: string): string {
    const lines = sdp.split('\n');
    const filteredLines = lines.filter(line => {
      // Keep all non-candidate lines
      if (!line.startsWith('a=candidate:')) {
        return true;
      }
      
      // Check if this is an mDNS candidate
      if (line.includes('.local')) {
        console.log(`[${this.peerId}] Filtering out mDNS candidate: ${line}`);
        return false;
      }
      
      return true;
    });
    
    const filteredSdp = filteredLines.join('\n');
    console.log(`[${this.peerId}] Filtered SDP (removed mDNS candidates)`);
    return filteredSdp;
  }
  
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    console.log(`[${this.peerId}] Creating offer...`);
    
    try {
      // Create data channel first
      this.dataChannel = this.connection.createDataChannel('chat', {
        ordered: true,
        maxRetransmits: 3
      });
      this.setupDataChannel(this.dataChannel);
      
      // Create offer
      const offer = await this.connection.createOffer();
      await this.connection.setLocalDescription(offer);
      
      // Wait for complete ICE gathering (from working version)
      await this.waitForCompleteIceGathering();
      
      // Get the complete offer with all ICE candidates
      const completeOffer = this.connection.localDescription;
      if (!completeOffer) {
        throw new Error('No local description after ICE gathering');
      }
      
      // Filter out mDNS candidates
      const filteredSdp = this.filterMDNSCandidates(completeOffer.sdp);
      const filteredOffer = {
        type: completeOffer.type,
        sdp: filteredSdp
      };
      
      console.log(`[${this.peerId}] Offer created with filtered ICE candidates`);
      console.log(`[${this.peerId}] Filtered offer SDP:`, filteredSdp);
      
      return filteredOffer;
    } catch (error) {
      console.error(`[${this.peerId}] Error creating offer:`, error);
      throw error;
    }
  }
  
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    console.log(`[${this.peerId}] Creating answer...`);
    
    try {
      // Set remote offer
      await this.connection.setRemoteDescription(offer);
      
      // Create answer
      const answer = await this.connection.createAnswer();
      await this.connection.setLocalDescription(answer);
      
      // Wait for complete ICE gathering (from working version)
      await this.waitForCompleteIceGathering();
      
      // Get the complete answer with all ICE candidates
      const completeAnswer = this.connection.localDescription;
      if (!completeAnswer) {
        throw new Error('No local description after ICE gathering');
      }
      
      // Filter out mDNS candidates
      const filteredSdp = this.filterMDNSCandidates(completeAnswer.sdp);
      const filteredAnswer = {
        type: completeAnswer.type,
        sdp: filteredSdp
      };
      
      console.log(`[${this.peerId}] Answer created with filtered ICE candidates`);
      console.log(`[${this.peerId}] Filtered answer SDP:`, filteredSdp);
      
      return filteredAnswer;
    } catch (error) {
      console.error(`[${this.peerId}] Error creating answer:`, error);
      throw error;
    }
  }
  
  async setRemoteAnswer(answer: RTCSessionDescriptionInit) {
    await this.connection.setRemoteDescription(answer);
  }
  
  // Simplified: no separate ICE candidates needed
  getIceCandidates(): RTCIceCandidate[] {
    return []; // Not used anymore - ICE candidates are in SDP
  }
  
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    // Not used anymore - ICE candidates are in SDP
    console.log(`[${this.peerId}] Ignoring separate ICE candidate (using SDP-integrated approach)`);
  }
  
  // Wait for complete ICE gathering (from working version)
  private async waitForCompleteIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connection.iceGatheringState === 'complete') {
        console.log(`[${this.peerId}] ICE gathering already complete`);
        resolve();
        return;
      }
      
      console.log(`[${this.peerId}] Waiting for complete ICE gathering...`);
      
      this.connection.onicegatheringstatechange = () => {
        console.log(`[${this.peerId}] ICE gathering state change: ${this.connection.iceGatheringState}`);
        if (this.connection.iceGatheringState === 'complete') {
          console.log(`[${this.peerId}] ICE gathering completed`);
          resolve();
        }
      };
    });
  }
  
  sendMessage(data: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(data));
    } else {
      console.warn(`[${this.peerId}] Data channel not open, message not sent`);
    }
  }
  
  close() {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
    }
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.connection) {
      this.connection.close();
    }
    
    this.isConnected = false;
    this.isConnecting = false;
  }
  
  // Analysiere warum die Verbindung fehlgeschlagen ist
  private async analyzeConnectionFailure() {
    console.group(`[${this.peerId}] 🔍 CONNECTION FAILURE ANALYSIS`);
    
    try {
      const stats = await this.connection.getStats();
      let candidatePairs = 0;
      let successfulPairs = 0;
      let failedPairs = 0;
      let localCandidates = new Map();
      let remoteCandidates = new Map();
      
      stats.forEach(report => {
        if (report.type === 'candidate-pair') {
          candidatePairs++;
          console.log(`Candidate pair ${report.id}:`, {
            state: report.state,
            nominated: report.nominated,
            priority: report.priority,
            localCandidateId: report.localCandidateId,
            remoteCandidateId: report.remoteCandidateId
          });
          
          if (report.state === 'succeeded') successfulPairs++;
          if (report.state === 'failed') failedPairs++;
        }
        
        if (report.type === 'local-candidate') {
          localCandidates.set(report.id, report);
        }
        
        if (report.type === 'remote-candidate') {
          remoteCandidates.set(report.id, report);
        }
      });
      
      console.log(`📊 ICE Statistics:`, {
        candidatePairs,
        successfulPairs,
        failedPairs,
        localCandidatesCount: localCandidates.size,
        remoteCandidatesCount: remoteCandidates.size
      });
      
      // Zeige lokale Kandidaten
      console.log(`🏠 Local candidates:`, Array.from(localCandidates.values()).map(c => ({
        type: c.candidateType,
        address: c.address || c.ip,
        port: c.port,
        protocol: c.protocol
      })));
      
      // Zeige Remote-Kandidaten
      console.log(`🌐 Remote candidates:`, Array.from(remoteCandidates.values()).map(c => ({
        type: c.candidateType,
        address: c.address || c.ip,
        port: c.port,
        protocol: c.protocol
      })));
      
      // Netzwerk-Diagnose
      if (candidatePairs === 0) {
        console.error(`❌ No candidate pairs found - ICE connectivity check failed to start`);
      } else if (successfulPairs === 0) {
        console.error(`❌ No successful candidate pairs - Network connectivity issues`);
        console.error(`💡 Possible causes:`);
        console.error(`   - Peers in different networks without proper NAT traversal`);
        console.error(`   - Firewall blocking WebRTC traffic`);
        console.error(`   - STUN server not reachable`);
        console.error(`   - Need TURN server for relay`);
      }
      
    } catch (error) {
      console.error(`Error analyzing connection failure:`, error);
    }
    
    console.groupEnd();
  }
  
  // Schnelle ICE-Diagnose bei Problemen
  private quickIceDiagnosis() {
    console.log(`[${this.peerId}] 🩺 Quick ICE Diagnosis:`);
    console.log(`  Connection state: ${this.connection.connectionState}`);
    console.log(`  ICE connection state: ${this.connection.iceConnectionState}`);
    console.log(`  ICE gathering state: ${this.connection.iceGatheringState}`);
    console.log(`  Signaling state: ${this.connection.signalingState}`);
    
    // Check if we have descriptions
    const hasLocal = !!this.connection.localDescription;
    const hasRemote = !!this.connection.remoteDescription;
    console.log(`  Has local description: ${hasLocal}`);
    console.log(`  Has remote description: ${hasRemote}`);
    
    if (hasLocal && hasRemote) {
      console.log(`  📋 SDP exchange successful - problem is in ICE connectivity`);
    } else {
      console.log(`  📋 SDP exchange incomplete - signaling problem`);
    }
  }
}

export class ConnectionManager {
  private connections: Map<string, PeerConnection | SinglePeerConnection> = new Map();
  private rtcConfig: RTCConfiguration;
  private events: ConnectionEvents;
  
  constructor(events: ConnectionEvents) {
    this.events = events;
    
    // WebRTC configuration with mDNS filtering
    this.rtcConfig = {
      iceServers: [
        // Google's public STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        
        // OpenRelay STUN servers
        { urls: 'stun:stun.openrelay.metered.ca:80' },
        
        // Twilio's STUN servers
        { urls: 'stun:global.stun.twilio.com:3478' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all' // Allow all types of candidates
    };
    
    console.log('ConnectionManager initialized with config (mDNS filtering enabled):', this.rtcConfig);
  }
  
  getConnection(peerId: string): PeerConnection | SinglePeerConnection | undefined {
    return this.connections.get(peerId);
  }
  
  getConnectedPeers(): string[] {
    const connectedPeers: string[] = [];
    this.connections.forEach((connection, peerId) => {
      if (connection.isConnected) {
        connectedPeers.push(peerId);
      }
    });
    return connectedPeers;
  }
  
  createConnection(peerId: string): PeerConnection {
    // Close existing connection if any
    this.closeConnection(peerId);
    
    const connection = new PeerConnection(peerId, this.events, this.rtcConfig);
    this.connections.set(peerId, connection);
    
    return connection;
  }
  
  /**
   * Create a new connection using the smokesigns library
   */
  createConnectionUsingSigns(peerId: string, myAddress: string, peerAddress: string, priority: boolean): SinglePeerConnection {
    // Close existing connection if any
    this.closeConnection(peerId);
    
    const connection = new SinglePeerConnection(
      peerId, 
      this.events, 
      myAddress, 
      peerAddress,
      priority
    );
    
    this.connections.set(peerId, connection);
    return connection;
  }
  
  closeConnection(peerId: string) {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }
  }
  
  closeAllConnections() {
    this.connections.forEach((connection, peerId) => {
      connection.close();
    });
    this.connections.clear();
  }
  
  sendMessage(peerId: string, data: any): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.sendMessage(data);
    } else {
      console.warn(`No connection found for peer ${peerId}`);
    }
  }
  
  sendLargeFileInChunks(peerId: string, data: any, attachment: FileAttachment): boolean {
    const connection = this.connections.get(peerId);
    if (!connection) {
      return false;
    }
    
    if ('sendLargeFileInChunks' in connection) {
      return connection.sendLargeFileInChunks(data, attachment);
    }
    
    return false;
  }
} 