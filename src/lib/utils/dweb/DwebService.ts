import { Scratchpad, ScratchpadType } from './Scratchpad';
import { Pointer } from './Pointer';

/**
 * DwebService provides a simplified interface for working with Scratchpad and Pointer resources.
 */
export class DwebService {
  private backendUrl: string | null;
  private antAppId: string;
  private antOwnerSecret: string | null;
  
  // Lazily initialized instances
  private _privateScratchpad: Scratchpad | null = null;
  private _publicScratchpad: Scratchpad | null = null;
  private _pointer: Pointer | null = null;
  
  /**
   * Create a new DwebService instance
   * 
   * @param backendUrl - Optional backend URL (if not provided, relative URLs will be used)
   * @param antAppId - Application ID for Ant headers
   * @param antOwnerSecret - Optional owner secret for write operations
   */
  constructor(
    backendUrl: string | null = null,
    antAppId: string = 'friends',
    antOwnerSecret: string | null = null
  ) {
    this.backendUrl = backendUrl;
    this.antAppId = antAppId;
    this.antOwnerSecret = antOwnerSecret;
  }

  /**
   * Get the private scratchpad instance
   */
  public get privateScratchpad(): Scratchpad {
    if (!this._privateScratchpad) {
      this._privateScratchpad = new Scratchpad(
        ScratchpadType.PRIVATE,
        this.backendUrl,
        this.antAppId,
        this.antOwnerSecret
      );
    }
    return this._privateScratchpad;
  }

  /**
   * Get the public scratchpad instance
   */
  public get publicScratchpad(): Scratchpad {
    if (!this._publicScratchpad) {
      this._publicScratchpad = new Scratchpad(
        ScratchpadType.PUBLIC,
        this.backendUrl,
        this.antAppId,
        this.antOwnerSecret
      );
    }
    return this._publicScratchpad;
  }

  /**
   * Get the pointer instance
   */
  public get pointer(): Pointer {
    if (!this._pointer) {
      this._pointer = new Pointer(
        this.backendUrl,
        this.antAppId,
        this.antOwnerSecret
      );
    }
    return this._pointer;
  }
  
  /**
   * Get a public scratchpad for friend communication with a specific object name
   * @param objectName - The object name for the friend scratchpad
   * @returns A scratchpad instance configured for this specific friend
   */
  public async getFriendScratchpad(objectName: string): Promise<Scratchpad> {
    // Create a new scratchpad instance for this specific friend
    const scratchpad = new Scratchpad(
      ScratchpadType.PUBLIC,
      this.backendUrl,
      this.antAppId,
      this.antOwnerSecret
    );
    
    // Set the object name
    scratchpad.setObjectName(objectName);
    
    // Try to read it to verify it exists and get its address
    try {
      await scratchpad.readCurrent();
    } catch (error) {
      // If it doesn't exist, that's fine - it will be created on demand
      console.log(`Friend scratchpad ${objectName} not found, will be created on demand`);
    }
    
    return scratchpad;
  }
}
