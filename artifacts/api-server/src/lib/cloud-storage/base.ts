export interface UploadedFile {
  cloudFileId: string;
  cloudPath:   string;
  cloudViewUrl?: string;
  cloudEditUrl?: string;
  fileSize?:   number;
}

export interface StorageProviderMeta {
  id:          string;     // "google_drive"
  label:       string;    // "Google Drive"
  description: string;
  icon:        string;    // URL ou nom d'icône
  available:   boolean;
}

export interface OAuthTokens {
  accessToken:  string;
  refreshToken?: string;
  expiresAt:    Date;
  scope?:       string;
  accountEmail?: string;
  accountName?:  string;
}

export interface IStorageProvider {
  readonly id:    string;
  readonly label: string;

  /** URL de consentement OAuth vers laquelle rediriger l'utilisateur */
  getAuthUrl(state: string): string;

  /** Échange le code OAuth contre des tokens */
  exchangeCode(code: string): Promise<OAuthTokens>;

  /** Rafraîchit les tokens expirés */
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;

  /** Vérifie que la connexion fonctionne et retourne le quota */
  testConnection(accessToken: string, refreshToken: string): Promise<{ ok: boolean; email?: string; name?: string; quota?: string }>;

  /** Crée un dossier (retourne son id cloud) */
  createFolder(accessToken: string, refreshToken: string, name: string, parentId?: string): Promise<string>;

  /** Upload un fichier et retourne les infos cloud */
  uploadFile(
    accessToken: string,
    refreshToken: string,
    file: { name: string; content: Buffer; mimeType: string },
    parentFolderId?: string,
  ): Promise<UploadedFile>;

  /** Supprime un fichier cloud (ne lève pas d'erreur si introuvable) */
  deleteFile(accessToken: string, refreshToken: string, cloudFileId: string): Promise<void>;
}
