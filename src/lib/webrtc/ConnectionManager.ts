// WebRTC Connection Manager for multiple peer connections
import type { FileAttachment } from '../file-handling/types';

export interface ConnectionEvents {
  onMessage: (peerId: string, data: any) => void;
  onConnectionStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
  onError: (peerId: string, error: Error) => void;
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
  
  sendMessage(data: any): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn(`[${this.peerId}] Cannot send message: data channel not ready`);
      return false;
    }
    
    try {
      this.dataChannel.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`[${this.peerId}] Error sending message:`, error);
      return false;
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
  private connections: Map<string, PeerConnection> = new Map();
  private rtcConfig: RTCConfiguration;
  private events: ConnectionEvents;
  
  constructor(events: ConnectionEvents) {
    this.events = events;
    
    // WebRTC configuration with mDNS filtering
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all' // Allow all types of candidates
    };
    
    console.log('ConnectionManager initialized with config (mDNS filtering enabled):', this.rtcConfig);
  }
  
  getConnection(peerId: string): PeerConnection | undefined {
    return this.connections.get(peerId);
  }
  
  createConnection(peerId: string): PeerConnection {
    // Close existing connection if any
    this.closeConnection(peerId);
    
    const connection = new PeerConnection(peerId, this.events, this.rtcConfig);
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
    this.connections.forEach(connection => connection.close());
    this.connections.clear();
  }
  
  getConnectedPeers(): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.isConnected)
      .map(([peerId, _]) => peerId);
  }
  
  sendMessage(peerId: string, data: any): boolean {
    const connection = this.connections.get(peerId);
    if (!connection) {
      return false;
    }
    
    return connection.sendMessage(data);
  }
  
  // Send large file in chunks
  sendLargeFileInChunks(peerId: string, messageData: any, attachment: FileAttachment) {
    const connection = this.connections.get(peerId);
    if (!connection || !attachment.data) return;
    
    console.log(`[${peerId}] Sending large file in chunks:`, attachment.name);
    
    const maxDataPerChunk = 12000;
    const base64Data = attachment.data;
    const totalChunks = Math.max(Math.ceil(base64Data.length / maxDataPerChunk), 1);
    
    // Send metadata first
    const metadataMessage = {
      type: 'file-start',
      nick: messageData.nick,
      message: messageData.message,
      attachment: {
        ...attachment,
        data: undefined,
        totalChunks: totalChunks
      },
      timestamp: messageData.timestamp
    };
    
    if (!connection.sendMessage(metadataMessage)) {
      console.error(`[${peerId}] Failed to send file metadata`);
      return;
    }
    
    // Handle empty files
    if (base64Data.length === 0) {
      const emptyChunkMessage = {
        type: 'file-chunk',
        attachmentId: attachment.id,
        chunkIndex: 0,
        totalChunks: 1,
        data: '',
        timestamp: new Date().toISOString()
      };
      
      setTimeout(() => {
        connection.sendMessage(emptyChunkMessage);
      }, 50);
      return;
    }
    
    // Send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * maxDataPerChunk;
      const end = Math.min(start + maxDataPerChunk, base64Data.length);
      const chunkData = base64Data.slice(start, end);
      
      const chunkMessage = {
        type: 'file-chunk',
        attachmentId: attachment.id,
        chunkIndex: i,
        totalChunks: totalChunks,
        data: chunkData,
        timestamp: new Date().toISOString()
      };
      
      setTimeout(() => {
        connection.sendMessage(chunkMessage);
      }, i * 50);
    }
  }
} 