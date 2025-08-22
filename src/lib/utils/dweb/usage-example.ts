/**
 * Example usage of the new DwebService classes
 * 
 * This example demonstrates how to use the abstracted Scratchpad and Pointer classes
 * instead of direct API calls for working with DWeb resources.
 */

// Import the DwebService and related types
import { DwebService, ScratchpadType } from '.';
// Importiere die Konstante aus dem FriendRequestManager
import { FRIENDS_SHARED_GLOBAL_SECRET } from '../../webrtc/FriendRequestManager';

/**
 * Initialize the DwebService with backend URL and optional ant-owner-secret
 */
export function initDwebService(backendUrl: string | null = null): DwebService {
  // Verwende die importierte Konstante für das Owner Secret
  // (In echten Anwendungen könnte dies auch aus einer Umgebungsvariablen kommen)
  
  // Create a new service instance with the imported secret
  return new DwebService(backendUrl, 'friends', FRIENDS_SHARED_GLOBAL_SECRET);
}

/**
 * Example of how to work with public identifiers (pointers)
 */
export async function workWithPublicIdentifiers(
  service: DwebService, 
  identifier: string,
  profileId: string
): Promise<boolean> {
  try {
    // Check if identifier exists
    const existing = await service.pointer.readPointer(identifier);
    
    if (existing && existing.scratchpad_target_address !== profileId) {
      console.log('Public identifier is already taken by someone else');
      return false;
    }
    
    // Create or update the pointer
    const success = existing 
      ? await service.pointer.updatePointer(identifier, profileId)
      : await service.pointer.createPointer(identifier, profileId);
      
    if (success) {
      console.log(`Public identifier ${identifier} successfully ${existing ? 'updated' : 'created'}`);
    } else {
      console.error(`Failed to ${existing ? 'update' : 'create'} public identifier ${identifier}`);
    }
    
    return success;
  } catch (error) {
    console.error('Error working with public identifier:', error);
    return false;
  }
}

/**
 * Example of how to work with profile data in a scratchpad
 */
export async function workWithProfileData(
  service: DwebService,
  profileObjectName: string,
  profileData: any
): Promise<boolean> {
  try {
    // Check if profile exists
    const existingProfile = await service.publicScratchpad.readScratchpad(profileObjectName);
    
    if (existingProfile) {
      // Update existing profile
      return await service.publicScratchpad.update(profileObjectName, {
        ...existingProfile.data,
        ...profileData
      });
    } else {
      // Create new profile
      return await service.publicScratchpad.create(profileObjectName, profileData, {
        dweb_type: "PublicScratchpad"
      });
    }
  } catch (error) {
    console.error('Error working with profile data:', error);
    return false;
  }
}

/**
 * Example of how to work with account data in a private scratchpad
 */
export async function workWithAccountData(
  service: DwebService,
  accountName: string,
  accountData: any
): Promise<boolean> {
  try {
    // Use the private scratchpad
    const existingAccount = await service.privateScratchpad.readScratchpad(accountName);
    
    if (existingAccount) {
      // Update specific fields without overwriting everything
      // The data will be automatically converted to byte array and stored in unencrypted_data
      return await service.privateScratchpad.updateFields(accountName, accountData);
    } else {
      // Create new account
      // All required fields like data_encoding, encrypted_data, etc. will be set automatically
      return await service.privateScratchpad.create(accountName, accountData);
    }
  } catch (error) {
    console.error('Error working with account data:', error);
    return false;
  }
}
