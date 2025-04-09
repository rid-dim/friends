/**
 * Types for file attachment handling
 */

export type AttachmentType = 'image' | 'video' | 'file';

export interface FileAttachment {
  id: string;         // Unique identifier for the attachment
  name: string;       // Original filename
  type: AttachmentType; // Type of attachment (image, video, file)
  mimeType: string;   // MIME type of the file
  size: number;       // Size in bytes
  data?: string;      // Base64 encoded data (might be undefined for chunked files until complete)
  chunks?: number;    // Number of chunks (for chunked files)
  complete?: boolean; // Whether all chunks have been received
}

export interface AttachmentChunk {
  attachmentId: string; // Reference to the parent attachment
  chunkIndex: number;   // Index of this chunk
  totalChunks: number;  // Total number of chunks
  data: string;         // Base64 encoded chunk data
}

// Extended message structure for attachments
export interface AttachmentMessage {
  version: number;
  original: string;   // Original text (can be empty for pure attachment messages)
  translation?: string; // Translation (optional)
  targetLanguage?: string; // Target language (optional)
  
  // Attachment fields
  attachment?: FileAttachment;
  isAttachmentChunk?: boolean; // Flag to identify chunks
  attachmentChunk?: AttachmentChunk;
}

// Constants
export const MAX_CHUNK_SIZE = 60000; // Maximum size in bytes (~60KB) for each chunk 