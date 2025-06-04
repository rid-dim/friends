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
    this.connection = new RTCPeerConnection(rtcConfig);
    
    this.setupConnection();
  }
  
  private setupConnection() {
    // Handle ICE candidates
    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[${this.peerId}] New ICE Candidate:`, event.candidate);
      }
    };
    
    // Handle connection state changes
    this.connection.onconnectionstatechange = () => {
      const state = this.connection.connectionState;
      console.log(`[${this.peerId}] Connection state:`, state);
      
      // Update connection status flags
      this.isConnected = state === 'connected';
      this.isConnecting = state === 'connecting' || state === 'new';
      
      this.events.onConnectionStateChange(this.peerId, state);
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
  
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    // Create data channel before creating offer
    this.dataChannel = this.connection.createDataChannel('chat', {
      ordered: true,
      maxRetransmits: 3
    });
    this.setupDataChannel(this.dataChannel);
    
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    
    // Wait for ICE gathering
    await this.waitForIceGathering();
    
    return this.connection.localDescription!;
  }
  
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.connection.setRemoteDescription(offer);
    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);
    
    // Wait for ICE gathering
    await this.waitForIceGathering();
    
    return this.connection.localDescription!;
  }
  
  async setRemoteAnswer(answer: RTCSessionDescriptionInit) {
    await this.connection.setRemoteDescription(answer);
  }
  
  private async waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connection.iceGatheringState === 'complete') {
        resolve();
      } else {
        this.connection.onicegatheringstatechange = () => {
          if (this.connection.iceGatheringState === 'complete') {
            resolve();
          }
        };
      }
    });
  }
  
  sendMessage(data: any): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
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
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.connection.close();
    this.isConnected = false;
    this.isConnecting = false;
  }
}

export class ConnectionManager {
  private connections: Map<string, PeerConnection> = new Map();
  private rtcConfig: RTCConfiguration;
  private events: ConnectionEvents;
  
  constructor(events: ConnectionEvents) {
    this.events = events;
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
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