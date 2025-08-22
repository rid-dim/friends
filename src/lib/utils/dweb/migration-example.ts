/**
 * This example demonstrates how to replace the existing scratchpad code with the new abstraction.
 * 
 * Original code looks like:
 * 
 * ```typescript
 * const scratchpadPayload = {
 *   counter: 0,
 *   data_encoding: 0,
 *   dweb_type: "PublicScratchpad",
 *   encrypted_data: [0],
 *   scratchpad_address: "string",
 *   unencrypted_data: [0]
 * };
 * 
 * const createResponse = await fetch(url, {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Ant-App-ID': 'friends'
 *   },
 *   body: JSON.stringify(scratchpadPayload)
 * });
 * ```
 */

import { DwebService, ScratchpadType } from '.';

// Example replacement of the code from App.svelte
async function exampleReplacementCode() {
  // Initialize the service
  const backendUrl = null; // or backendUrl from the app
  const dwebService = new DwebService(backendUrl, 'friends');
  
  // 1. Example: Creating a public scratchpad for friend communication
  // This replaces the createOrGetFriendScratchpad function
  
  async function createOrGetFriendScratchpad(friendProfileId: string, profileId: string): Promise<string> {
    // Build object name using the same pattern
    const objectName = `${friendProfileId}comm${profileId}`;
    
    try {
      // First try to read existing scratchpad
      const scratchpad = await dwebService.publicScratchpad.readScratchpad(objectName);
      
      if (scratchpad) {
        // Return the address if it exists
        const address = scratchpad.scratchpad_address || scratchpad.network_address;
        if (address) {
          console.log('✅ Found existing friend scratchpad:', address);
          return address;
        }
      }
      
      // If we reach here, we need to create a new scratchpad
      // The initialData can be empty or contain whatever info you want to store
      const initialData = {}; // empty object will be converted to byte array
      
      // Create the scratchpad - all required fields are handled automatically
      const success = await dwebService.publicScratchpad.create(objectName, initialData);
      
      if (success) {
        // Read the newly created scratchpad to get its address
        const created = await dwebService.publicScratchpad.readScratchpad(objectName);
        if (created) {
          const address = created.scratchpad_address || created.network_address;
          if (address) {
            console.log('✅ Created new friend scratchpad:', address);
            return address;
          }
        }
      }
      
      throw new Error('Failed to create or get friend scratchpad');
    } catch (error) {
      console.error('❌ Error with friend scratchpad:', error);
      throw error;
    }
  }
  
  // 2. Example: Creating or updating account package in a private scratchpad
  
  async function updateAccountPackage(accountData: any, accountName: string): Promise<boolean> {
    try {
      // The account data will be automatically converted to byte array and stored in unencrypted_data
      // All required fields like data_encoding, encrypted_data, etc. will be set automatically
      const success = await dwebService.privateScratchpad.update(accountName, accountData);
      
      if (success) {
        console.log('✅ Account package updated successfully');
        return true;
      } else {
        console.error('❌ Failed to update account package');
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating account package:', error);
      return false;
    }
  }
}
