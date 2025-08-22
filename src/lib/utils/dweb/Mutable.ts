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
   */
  public async read<T = any>(objectName: string, params: Record<string, string> = {}): Promise<T | null> {
    const url = this.buildUrl(objectName, params);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (response.ok) {
        return await response.json() as T;
      } else {
        console.warn(`Failed to read ${this.constructor.name}:`, await response.text());
        return null;
      }
    } catch (error) {
      console.error(`Error reading ${this.constructor.name}:`, error);
      return null;
    }
  }

  /**
   * Check if an object exists
   * 
   * @param objectName - The object name to check
   */
  public async exists(objectName: string): Promise<boolean> {
    const data = await this.read(objectName);
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
    const exists = !forcePost && await this.exists(objectName);
    const method = exists ? 'PUT' : 'POST';
    const url = this.buildUrl(objectName);
    
    // Das Ant-Owner-Secret wird nur gesendet, wenn es beim Initialisieren der Klasse gesetzt wurde
    // Dies erlaubt eine präzise Kontrolle darüber, wann das Secret gesendet wird
    // Bei Public Identifiers und Freundschaftsanfragen wird es benötigt
    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(!!this.antOwnerSecret), // Sende Secret nur wenn es existiert
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        return true;
      } else {
        console.warn(`Failed to write to ${this.constructor.name}:`, await response.text());
        return false;
      }
    } catch (error) {
      console.error(`Error writing to ${this.constructor.name}:`, error);
      return false;
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
