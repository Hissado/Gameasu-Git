import { GoogleDriveProvider } from "./google-drive";
import type { IStorageProvider, StorageProviderMeta } from "./base";

export { encryptToken, decryptToken, signState, verifyState } from "./encryption";
export type { IStorageProvider, OAuthTokens, UploadedFile, StorageProviderMeta } from "./base";

function getCallbackBase(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  const pubBase = process.env.PUBLIC_BASE_URL;
  if (pubBase) return pubBase;
  return "http://localhost:80";
}

export function getGoogleDriveProvider(): GoogleDriveProvider {
  const redirectUri = `${getCallbackBase()}/api/cloud-storage/oauth/google/callback`;
  return new GoogleDriveProvider(redirectUri);
}

export function getProvider(providerId: string): IStorageProvider {
  switch (providerId) {
    case "google_drive": return getGoogleDriveProvider();
    default: throw new Error(`Fournisseur inconnu : ${providerId}`);
  }
}

export const PROVIDER_CATALOG: StorageProviderMeta[] = [
  {
    id:          "google_drive",
    label:       "Google Drive",
    description: "Synchronisez vos documents vers votre Google Drive ou Google Workspace. Accès limité aux fichiers créés par Gameasu.",
    icon:        "google_drive",
    available:   !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },
  {
    id:          "onedrive",
    label:       "Microsoft OneDrive",
    description: "Stockage Microsoft 365 / OneDrive Entreprise.",
    icon:        "onedrive",
    available:   false,
  },
  {
    id:          "sharepoint",
    label:       "SharePoint",
    description: "Bibliothèques documentaires SharePoint d'entreprise.",
    icon:        "sharepoint",
    available:   false,
  },
  {
    id:          "s3",
    label:       "Amazon S3",
    description: "Stockage objet AWS S3 ou compatible (MinIO, Wasabi…).",
    icon:        "s3",
    available:   false,
  },
  {
    id:          "dropbox",
    label:       "Dropbox",
    description: "Synchronisation Dropbox Business ou personnel.",
    icon:        "dropbox",
    available:   false,
  },
];
