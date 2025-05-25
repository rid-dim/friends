/**
 * Utility functions for file processing
 */
import { MAX_CHUNK_SIZE, type AttachmentType, type FileAttachment, type AttachmentChunk } from './types';

/**
 * Generates a random ID for attachments
 */
export function generateAttachmentId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Determines the attachment type based on MIME type
 */
export function getAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else {
    return 'file';
  }
}

/**
 * Processes a file into a FileAttachment object
 */
export async function processFile(file: File): Promise<FileAttachment> {
  const id = generateAttachmentId();
  const type = getAttachmentType(file.type);
  
  // Always process as complete base64 data (no chunking for 1MB limit)
  const data = await readFileAsBase64(file);
  
  return {
    id,
    name: file.name,
    type,
    mimeType: file.type,
    size: file.size,
    data,
    complete: true
  };
}

/**
 * Reads a file as base64 string
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      // Extract just the base64 data without the MIME prefix
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Splits a file into chunks
 */
export async function createFileChunks(file: File, attachmentId: string): Promise<AttachmentChunk[]> {
  const chunks: AttachmentChunk[] = [];
  const totalChunks = Math.ceil(file.size / MAX_CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * MAX_CHUNK_SIZE;
    const end = Math.min(file.size, start + MAX_CHUNK_SIZE);
    
    const chunk = file.slice(start, end);
    const chunkData = await readFileAsBase64(new File([chunk], file.name, { type: file.type }));
    
    chunks.push({
      attachmentId,
      chunkIndex: i,
      totalChunks,
      data: chunkData
    });
  }
  
  return chunks;
}

/**
 * Reassembles chunks into a complete file attachment
 */
export function reassembleChunks(attachment: FileAttachment, chunks: AttachmentChunk[]): FileAttachment {
  // Sort chunks by index to ensure correct order
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
  
  // Concatenate all chunk data
  const completeData = chunks.map(chunk => chunk.data).join('');
  
  return {
    ...attachment,
    data: completeData,
    complete: true
  };
}

/**
 * Formats file size in a human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

/**
 * Creates a local download for an attachment
 */
export function downloadAttachment(attachment: FileAttachment): void {
  if (!attachment.data || !attachment.complete) {
    console.error('Cannot download incomplete attachment');
    return;
  }
  
  const blob = base64ToBlob(attachment.data, attachment.mimeType);
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Converts base64 to a Blob object
 */
export function base64ToBlob(base64Data: string, mimeType: string): Blob {
  const byteCharacters = atob(base64Data);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: mimeType });
} 