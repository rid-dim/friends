export interface ImmutableUploadResult {
  dataMapHex: string;
  fileName?: string;
  mimeType?: string;
}

/**
 * Service für immutable Datei-Uploads/Downloads ins DWeb/Autonomi Netzwerk.
 * - Upload via multipart/form-data auf /dweb-0/form-upload-file/<is_public>?tries=3
 * - Download-URL via /dweb-0/data/<datamap>
 */
export class ImmutableFileService {
  private backendUrl: string | null;
  private antAppId: string;
  private antOwnerSecret: string | null;

  constructor(backendUrl: string | null = null, antAppId: string = 'friends', antOwnerSecret: string | null = null) {
    this.backendUrl = backendUrl;
    this.antAppId = antAppId;
    this.antOwnerSecret = antOwnerSecret;
  }

  private buildBase(path: string): string {
    return this.backendUrl ? `${this.backendUrl}${path}` : path;
  }

  private buildUploadUrl(isPublic: boolean = false, tries: number = 3): string {
    const path = `/dweb-0/form-upload-file/${isPublic ? 'true' : 'false'}?tries=${tries}`;
    return this.buildBase(path);
  }

  public buildDataUrl(dataMapHex: string): string {
    const path = `/dweb-0/data/${dataMapHex}`;
    return this.buildBase(path);
  }

  /**
   * Lädt eine Datei hoch und gibt die Datamap zurück.
   */
  public async uploadFile(file: File | Blob, fileName?: string, mimeType?: string, isPublic: boolean = false): Promise<ImmutableUploadResult> {
    const url = this.buildUploadUrl(isPublic, 3);
    const form = new FormData();

    const finalName = fileName || (file instanceof File ? file.name : 'upload');
    const finalType = mimeType || (file instanceof File ? file.type : 'application/octet-stream');

    // Manche Browser ignorieren den dritten Parameter (type) am File-Teil, daher setzen wir den Blob-Typ oben
    const blob = file instanceof File ? file : new Blob([file], { type: finalType });
    form.append('file', blob, finalName);

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Ant-App-ID': this.antAppId
    };
    if (this.antOwnerSecret) headers['Ant-Owner-Secret'] = this.antOwnerSecret;

    const resp = await fetch(url, {
      method: 'PUT',
      body: form,
      headers
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Upload fehlgeschlagen (${resp.status}): ${text}`);
    }
    const json = await resp.json();
    const dataMapHex: string | undefined = json?.data_map;
    if (!dataMapHex || typeof dataMapHex !== 'string') {
      throw new Error('Upload erfolgreich, aber keine data_map im Response gefunden');
    }
    return { dataMapHex, fileName: finalName, mimeType: finalType };
  }
}


