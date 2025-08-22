import { DwebService } from './dweb/DwebService';

/**
 * Singleton instance of DwebService
 */
let dwebServiceInstance: DwebService | null = null;

/**
 * Get or create the DwebService instance
 * @param backendUrl Backend URL to use
 * @param antAppId Application ID for Ant headers
 * @param antOwnerSecret Owner secret for write operations
 * @returns DwebService instance
 */
export function getDwebService(
  backendUrl: string | null = null,
  antAppId: string = 'friends',
  antOwnerSecret: string | null = null
): DwebService {
  if (!dwebServiceInstance) {
    dwebServiceInstance = new DwebService(backendUrl, antAppId, antOwnerSecret);
  }
  return dwebServiceInstance;
}
