import { Mutable } from './Mutable';

/**
 * Types of scratchpads available in the DWeb protocol
 */
export enum ScratchpadType {
  PRIVATE = 'private',
  PUBLIC = 'public'
}

/**
 * Interface for common scratchpad data structure
 */
export interface ScratchpadData {
  dweb_type: string;
  counter: number;
  data?: any;  // Optional because data might be stored in unencrypted_data
  data_encoding?: number;
  encrypted_data?: number[];
  scratchpad_address?: string;
  network_address?: string;  // Alternative name for address used in some responses
  unencrypted_data?: number[];
  [key: string]: any;
}

/**
 * Scratchpad class for interacting with DWeb scratchpad endpoints.
 * Provides methods for reading, creating, and updating scratchpads.
 */
export class Scratchpad extends Mutable {
  private type: ScratchpadType;
  private objectName: string | null = null;
  private cachedData: ScratchpadData | null = null;
  private scratchpadUrl: string | null = null;
  
  /**
   * Create a new Scratchpad instance
   * 
   * @param type - Type of scratchpad (private or public)
   * @param backendUrl - Optional backend URL (if not provided, relative URLs will be used)
   * @param antAppId - Application ID for Ant headers
   * @param antOwnerSecret - Optional owner secret for write operations
   */
  constructor(
    type: ScratchpadType = ScratchpadType.PUBLIC,
    backendUrl: string | null = null,
    antAppId: string = 'friends',
    antOwnerSecret: string | null = null
  ) {
    super(backendUrl, antAppId, antOwnerSecret);
    this.type = type;
  }
  
  /**
   * Set the object name for this scratchpad instance
   * This allows reusing the same instance for multiple operations
   * 
   * @param objectName - The object name for this scratchpad
   */
  public setObjectName(objectName: string): void {
    this.objectName = objectName;
    // Clear cached data when object name changes
    this.cachedData = null;
    // Update URL
    this.scratchpadUrl = this.buildUrl(objectName);
  }
  
  /**
   * Get the current URL for this scratchpad
   */
  public get url(): string {
    if (!this.scratchpadUrl && this.objectName) {
      this.scratchpadUrl = this.buildUrl(this.objectName);
    }
    return this.scratchpadUrl || '';
  }
  
  /**
   * Read the scratchpad data for the pre-configured object name
   * Only works if setObjectName has been called
   */
  public async readCurrent<T = any>(): Promise<ScratchpadData & { data: T } | null> {
    if (!this.objectName) {
      throw new Error('No object name set. Call setObjectName first.');
    }
    
    const result = await this.readScratchpad<T>(this.objectName);
    this.cachedData = result;
    return result;
  }
  
  /**
   * Check if this scratchpad has a valid address
   */
  public hasAddress(): boolean {
    return !!(this.cachedData && (this.cachedData.scratchpad_address || this.cachedData.network_address));
  }
  
  /**
   * Get the address of this scratchpad
   */
  public getAddress(): string {
    if (!this.cachedData) {
      return '';
    }
    return this.cachedData.scratchpad_address || this.cachedData.network_address || '';
  }
  
  /**
   * Create a scratchpad using the preset object name
   * 
   * @param data - Initial data to store
   * @param additionalProps - Additional properties to include in the scratchpad
   */
  public async createWithPresetName(data: any, additionalProps: Record<string, any> = {}): Promise<boolean> {
    if (!this.objectName) {
      throw new Error('No object name set. Call setObjectName first.');
    }
    
    const result = await this.create(this.objectName, data, additionalProps);
    
    // After creating, read it back to update the cached data
    if (result) {
      await this.readCurrent();
    }
    
    return result;
  }
  
  /**
   * Utility method to convert JSON to byte array for scratchpad storage
   * 
   * @param jsonString - JSON string to convert
   * @returns Array of byte values
   */
  private jsonToByteArray(jsonString: string): number[] {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    return Array.from(uint8Array);
  }
  
  /**
   * Utility method to convert byte array back to JSON
   * 
   * @param byteArray - Array of byte values
   * @returns Parsed JSON object
   */
  private byteArrayToJson<T = any>(byteArray: number[]): T {
    const uint8Array = new Uint8Array(byteArray);
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(uint8Array);
    return JSON.parse(jsonString);
  }

  /**
   * Get the API endpoint for this scratchpad type
   */
  protected getEndpoint(): string {
    return this.type === ScratchpadType.PRIVATE 
      ? '/dweb-0/scratchpad-private'
      : '/dweb-0/scratchpad-public';
  }

  /**
   * Create a new scratchpad with initial data
   * 
   * @param objectName - Name of the scratchpad to create
   * @param data - Initial data to store
   * @param additionalProps - Additional properties to include in the scratchpad
   */
  public async create(objectName: string, data: any, additionalProps: Record<string, any> = {}): Promise<boolean> {
    // Convert data to byte array if it's an object
    const dataBytes = typeof data === 'object' ? this.jsonToByteArray(JSON.stringify(data)) : data;
    
    // Create standard scratchpad payload with all required fields
    const payload = {
      counter: 1,
      data_encoding: 0,
      dweb_type: this.type === ScratchpadType.PRIVATE ? "PrivateScratchpad" : "PublicScratchpad",
      encrypted_data: [0],
      scratchpad_address: "string",
      unencrypted_data: Array.isArray(dataBytes) ? dataBytes : [0],
      ...additionalProps
    };
    
    return this.write(objectName, payload, true);
  }

  /**
   * Read a scratchpad and cast it to the expected type
   * 
   * @param objectName - Name of the scratchpad to read
   * @param params - Additional query parameters
   */
  public async readScratchpad<T = any>(objectName: string, params: Record<string, string> = {}): Promise<ScratchpadData & { data: T } | null> {
    const data = await super.read<ScratchpadData>(objectName, params);
    
    if (!data) return null;
    
    // Process the data to add a convenient 'data' property if it doesn't exist
    // This helps standardize the interface regardless of whether data is in unencrypted_data or already parsed
    if (!data.data && data.unencrypted_data && Array.isArray(data.unencrypted_data)) {
      try {
        // Try to parse the unencrypted_data as JSON
        const parsedData = this.byteArrayToJson<T>(data.unencrypted_data);
        return {
          ...data,
          data: parsedData
        };
      } catch (e) {
        // If parsing fails, just return the original data
        console.warn('Could not parse unencrypted_data as JSON:', e);
        return data as ScratchpadData & { data: T };
      }
    }
    
    return data as ScratchpadData & { data: T };
  }

  /**
   * Update an existing scratchpad with new data, incrementing the counter
   * 
   * @param objectName - Name of the scratchpad to update
   * @param newData - New data to store
   * @param additionalProps - Additional properties to include in the scratchpad
   */
  public async update(objectName: string, newData: any, additionalProps: Record<string, any> = {}): Promise<boolean> {
    // First read the current scratchpad to get the counter
    const current = await this.readScratchpad(objectName);
    
    if (!current) {
      console.warn(`Scratchpad ${objectName} not found, creating instead of updating`);
      return this.create(objectName, newData, additionalProps);
    }
    
    // Convert data to byte array if it's an object
    const dataBytes = typeof newData === 'object' ? this.jsonToByteArray(JSON.stringify(newData)) : newData;
    
    const payload = {
      counter: (current.counter || 0) + 1,
      data_encoding: 0,
      dweb_type: current.dweb_type || (this.type === ScratchpadType.PRIVATE ? "PrivateScratchpad" : "PublicScratchpad"),
      encrypted_data: [0],
      scratchpad_address: current.scratchpad_address || "string",
      unencrypted_data: Array.isArray(dataBytes) ? dataBytes : [0],
      ...additionalProps
    };
    
    return this.write(objectName, payload);
  }

  /**
   * Update specific fields in a scratchpad's data object without overwriting other fields
   * 
   * @param objectName - Name of the scratchpad to update
   * @param partialData - Partial data to update
   * @param additionalProps - Additional properties to include in the scratchpad
   */
  public async updateFields(
    objectName: string, 
    partialData: Record<string, any>, 
    additionalProps: Record<string, any> = {}
  ): Promise<boolean> {
    const current = await this.readScratchpad(objectName);
    
    if (!current) {
      console.warn(`Scratchpad ${objectName} not found, creating instead of updating fields`);
      return this.create(objectName, partialData, additionalProps);
    }
    
    // Extract current data if stored as byte array
    let currentData: Record<string, any> = {};
    
    // If we have current data as byte array, convert it to JSON
    if (current.unencrypted_data && Array.isArray(current.unencrypted_data)) {
      try {
        currentData = this.byteArrayToJson(current.unencrypted_data);
      } catch (e) {
        // If we can't parse it, assume it's not JSON data
        console.warn('Could not parse unencrypted_data as JSON:', e);
        currentData = current.data || {};
      }
    } else {
      currentData = current.data || {};
    }
    
    // Merge current data with partial data
    const newData = {
      ...currentData,
      ...partialData
    };
    
    return this.update(objectName, newData, additionalProps);
  }
}
