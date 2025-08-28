/**
 * Base class for mutable data types in the DWeb protocol (Scratchpad, Pointer).
 * Provides common functionality for reading/writing data through the API.
 */
export abstract class Mutable {
  protected backendUrl: string | null = null;
  protected antAppId: string = 'friends';
  protected antOwnerSecret: string | null = null;

  /**
   * Create a new Mutable instance
   * 
   * @param backendUrl - Optional backend URL (if not provided, relative URLs will be used)
   * @param antAppId - Application ID for Ant headers
   * @param antOwnerSecret - Optional owner secret for write operations
   */
  constructor(backendUrl: string | null = null, antAppId: string = 'friends', antOwnerSecret: string | null = null) {
    this.backendUrl = backendUrl;
    this.antAppId = antAppId;
    this.antOwnerSecret = antOwnerSecret;
  }

  /**
   * Get the base endpoint URL for this mutable type
   */
  protected abstract getEndpoint(): string;

  /**
   * Build the full URL for API operations
   * 
   * @param objectName - The object name to use
   * @param params - Additional query parameters
   */
  protected buildUrl(objectName: string | null = null, params: Record<string, string> = {}): string {
    const baseUrl = this.backendUrl ? `${this.backendUrl}${this.getEndpoint()}` : this.getEndpoint();
    const searchParams = new URLSearchParams();
    
    // Default retries
    searchParams.set('tries', params.tries || '1');
    
    // Add object name if provided
    if (objectName) {
      searchParams.set('object_name', objectName);
    }
    
    // Add any additional parameters
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'tries' && key !== 'object_name') {
        searchParams.set(key, value);
      }
    });
    
    const queryString = searchParams.toString();
    return `${baseUrl}?${queryString}`;
  }

  /**
   * Get headers for API requests
   * 
   * @param includeOwnerSecret - Whether to include the owner secret header
   */
  protected getHeaders(includeOwnerSecret: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'Ant-App-ID': this.antAppId
    };
    
    if (includeOwnerSecret && this.antOwnerSecret) {
      headers['Ant-Owner-Secret'] = this.antOwnerSecret;
    }
    
    return headers;
  }

  /**
   * Read data from the API
   * 
   * @param objectName - The object name to read
   * @param params - Additional query parameters
   * @param timeoutMs - Optional timeout in milliseconds (defaults to 10_000)
   */
  public async read<T = any>(objectName: string, params: Record<string, string> = {}, timeoutMs: number = 10_000): Promise<T | null> {
    const url = this.buildUrl(objectName, params);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, Math.max(0, timeoutMs));

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: abortController.signal
      });

      if (response.ok) {
        return await response.json() as T;
      } else {
        console.warn(`Failed to read ${this.constructor.name}:`, await response.text());
        return null;
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        console.warn(`Read timeout for ${this.constructor.name} after ${timeoutMs}ms at ${url}`);
      } else {
        console.error(`Error reading ${this.constructor.name}:`, error);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if an object exists
   * 
   * @param objectName - The object name to check
   */
  public async exists(objectName: string, timeoutMs?: number): Promise<boolean> {
    const data = await this.read(objectName, {}, timeoutMs);
    return data !== null;
  }

  /**
   * Write data to the API (using POST for create, PUT for update)
   *
   * @param objectName - The object name to write to
   * @param data - The data to write
   * @param forcePost - Force using POST even if the object exists
   */
  public async write<T = any>(objectName: string, data: any, forcePost: boolean = false): Promise<boolean> {
    // Strategie:
    // - Wenn forcePost: immer POST
    // - Wenn objectName vorhanden: exists()-Check beibehalten
    // - Wenn objectName leer (Default-Scratchpad): standardmäßig PUT versuchen (idempotent)
    //   und bei 404 einmalig auf POST zurückfallen.

    const url = this.buildUrl(objectName);
    let method: 'PUT' | 'POST';
    if (forcePost) {
      method = 'POST';
    } else if (objectName) {
      const exists = await this.exists(objectName);
      method = exists ? 'PUT' : 'POST';
    } else {
      // Default-Scratchpad ohne object_name → bevorzugt PUT (idempotent)
      method = 'PUT';
    }

    // Das Ant-Owner-Secret wird nur gesendet, wenn es beim Initialisieren der Klasse gesetzt wurde
    // Dies erlaubt eine präzise Kontrolle darüber, wann das Secret gesendet wird
    // Bei Public Identifiers und Freundschaftsanfragen wird es benötigt
    try {
      const attempt = async (m: 'PUT' | 'POST') => {
        const resp = await fetch(url, {
          method: m,
          headers: this.getHeaders(!!this.antOwnerSecret),
          body: JSON.stringify(data)
        });
        return resp;
      };

      let response = await attempt(method);

      // Fallback: Wenn wir beim Default-Scratchpad mit PUT auf 404 laufen, einmalig POST versuchen
      if (!response.ok && !objectName && method === 'PUT' && response.status === 404) {
        response = await attempt('POST');
      }

      if (response.ok) {
        return true;
      }

      console.warn(`Failed to write to ${this.constructor.name}:`, await response.text());
      return false;
    } catch (error) {
      console.error(`Error writing to ${this.constructor.name}:`, error);
      return false;
    }
  }

  /**
   * Write data to the API with detailed error information
   *
   * @param objectName - The object name to write to
   * @param data - The data to write
   * @param forcePost - Force using POST even if the object exists
   * @returns Object with success status and error details if applicable
   */
  public async writeWithErrorDetails<T = any>(objectName: string, data: any, forcePost: boolean = false): Promise<{ success: boolean; error?: { status: number; message: string; isPaymentFailure: boolean } }> {
    const exists = !forcePost && await this.exists(objectName);
    const method = exists ? 'PUT' : 'POST';
    const url = this.buildUrl(objectName);

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(!!this.antOwnerSecret),
        body: JSON.stringify(data)
      });

      if (response.ok) {
        return { success: true };
      } else {
        const responseText = await response.text();
        const isPaymentFailure = response.status === 502 && responseText.includes('Payment failure occurred');

        console.warn(`Failed to write to ${this.constructor.name}:`, responseText);

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
      console.error(`Error writing to ${this.constructor.name}:`, error);
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
   * Delete an object (if supported)
   * 
   * @param objectName - The object name to delete
   */
  public async delete(objectName: string): Promise<boolean> {
    // Das Ant-Owner-Secret wird nur gesendet, wenn es beim Initialisieren der Klasse gesetzt wurde
    const url = this.buildUrl(objectName);
    
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(!!this.antOwnerSecret) // Sende Secret nur wenn es existiert
      });
      
      if (response.ok) {
        return true;
      } else {
        console.warn(`Failed to delete ${this.constructor.name}:`, await response.text());
        return false;
      }
    } catch (error) {
      console.error(`Error deleting ${this.constructor.name}:`, error);
      return false;
    }
  }
}
