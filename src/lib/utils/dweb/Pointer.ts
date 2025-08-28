import { Mutable } from './Mutable';

/**
 * Interface for pointer data structure
 */
export interface PointerData {
  pointer_address: string;
  counter: number;
  chunk_target_address: string;
  graphentry_target_address: string;
  pointer_target_address: string;
  scratchpad_target_address: string;
  [key: string]: any;
}

/**
 * Default counter value for pointers (maximum 64-bit unsigned integer)
 */
export const MAX_COUNTER = 18446744073709551615n;

/**
 * Pointer class for interacting with DWeb pointer endpoints.
 * Provides methods for reading, creating, and updating pointers.
 */
export class Pointer extends Mutable {
  /**
   * Create a new Pointer instance
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
    super(backendUrl, antAppId, antOwnerSecret);
  }

  /**
   * Get the API endpoint for pointers
   */
  protected getEndpoint(): string {
    return '/dweb-0/pointer';
  }
  
  /**
   * Read a pointer
   * 
   * @param objectName - Name of the pointer to read
   * @param params - Additional query parameters
   */
  public async readPointer(objectName: string, params: Record<string, string> = {}, timeoutMs: number = 10_000): Promise<PointerData | null> {
    // Wir benötigen bei manchen Backends das Ant-Owner-Secret auch für GETs auf Pointer
    const url = this.buildUrl(objectName, params);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), Math.max(0, timeoutMs));
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(!!this.antOwnerSecret),
        signal: abortController.signal
      });
      if (response.ok) {
        return await response.json() as PointerData;
      }
      return null;
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        console.warn(`Read timeout for Pointer after ${timeoutMs}ms at ${url}`);
      } else {
        console.error('Error reading pointer:', error);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Create a pointer that targets a scratchpad
   *
   * @param pointerName - Name of the pointer to create
   * @param scratchpadTargetAddress - Target scratchpad address
   */
  public async createPointer(pointerName: string, scratchpadTargetAddress: string): Promise<boolean> {
    // Build payload string manually to keep huge counter numeric (avoids JS precision loss)
    const payload = `{
      "pointer_address": "",
      "counter": ${MAX_COUNTER},
      "chunk_target_address": "",
      "graphentry_target_address": "",
      "pointer_target_address": "",
      "scratchpad_target_address": "${scratchpadTargetAddress}"
    }`;

    const url = this.buildUrl(pointerName);

    try {
      // Wenn ein Ant-Owner-Secret gesetzt wurde (z.B. für Public Identifier), wird es verwendet
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(!!this.antOwnerSecret), // Sende Secret nur wenn es existiert
        body: payload
      });

      return response.ok && response.status === 201;
    } catch (error) {
      console.error('Error creating pointer:', error);
      return false;
    }
  }

  /**
   * Create a pointer that targets a scratchpad with detailed error information
   *
   * @param pointerName - Name of the pointer to create
   * @param scratchpadTargetAddress - Target scratchpad address
   * @returns Object with success status and error details if applicable
   */
  public async createPointerWithErrorDetails(pointerName: string, scratchpadTargetAddress: string): Promise<{ success: boolean; error?: { status: number; message: string; isPaymentFailure: boolean } }> {
    // Build payload string manually to keep huge counter numeric (avoids JS precision loss)
    const payload = `{
      "pointer_address": "",
      "counter": ${MAX_COUNTER},
      "chunk_target_address": "",
      "graphentry_target_address": "",
      "pointer_target_address": "",
      "scratchpad_target_address": "${scratchpadTargetAddress}"
    }`;

    const url = this.buildUrl(pointerName);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(!!this.antOwnerSecret),
        body: payload
      });

      if (response.ok && response.status === 201) {
        return { success: true };
      } else {
        const responseText = await response.text();
        const isPaymentFailure = response.status === 502 && responseText.includes('Payment failure occurred');

        console.error('Error creating pointer:', responseText);

        return {
          success: false,
          error: {
            status: response.status,
            message: responseText,
            isPaymentFailure
          }
        };
      }
    } catch (error) {
      console.error('Error creating pointer:', error);
      return {
        success: false,
        error: {
          status: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
          isPaymentFailure: false
        }
      };
    }
  }
  
  /**
   * Update a pointer to point to a new target
   * 
   * @param pointerName - Name of the pointer to update
   * @param scratchpadTargetAddress - New target scratchpad address
   */
  public async updatePointer(pointerName: string, scratchpadTargetAddress: string): Promise<boolean> {
    // First check if pointer exists
    const current = await this.readPointer(pointerName);
    
    if (!current) {
      return this.createPointer(pointerName, scratchpadTargetAddress);
    }
    
    // Build payload string manually to keep huge counter numeric
    const payload = `{
      "pointer_address": "${current.pointer_address || ''}",
      "counter": ${MAX_COUNTER},
      "chunk_target_address": "",
      "graphentry_target_address": "",
      "pointer_target_address": "",
      "scratchpad_target_address": "${scratchpadTargetAddress}"
    }`;

    const url = this.buildUrl(pointerName);
    
    try {
      // Wenn ein Ant-Owner-Secret gesetzt wurde (z.B. für Public Identifier), wird es verwendet
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(!!this.antOwnerSecret), // Sende Secret nur wenn es existiert
        body: payload
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error updating pointer:', error);
      return false;
    }
  }
}
