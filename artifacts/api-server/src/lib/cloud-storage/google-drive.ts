import { google } from "googleapis";
import type { IStorageProvider, OAuthTokens, UploadedFile } from "./base";
import { logger } from "../logger";
import { Readable } from "stream";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function getClientId()     { return process.env.GOOGLE_CLIENT_ID ?? ""; }
function getClientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ""; }

function makeOAuth2(redirectUri: string) {
  return new google.auth.OAuth2(getClientId(), getClientSecret(), redirectUri);
}

function makeOAuth2WithTokens(accessToken: string, refreshToken: string, redirectUri = "") {
  const oauth2 = makeOAuth2(redirectUri);
  oauth2.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return oauth2;
}

async function ensureFreshToken(
  accessToken: string,
  refreshToken: string,
  redirectUri = "",
): Promise<{ oauth2: ReturnType<typeof makeOAuth2WithTokens>; token: string }> {
  const oauth2 = makeOAuth2WithTokens(accessToken, refreshToken, redirectUri);
  const creds  = oauth2.credentials;
  const expired = !creds.expiry_date || Date.now() > creds.expiry_date - 60_000;
  if (expired && refreshToken) {
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);
    return { oauth2, token: credentials.access_token! };
  }
  return { oauth2, token: accessToken };
}

export class GoogleDriveProvider implements IStorageProvider {
  readonly id    = "google_drive";
  readonly label = "Google Drive";
  private  redirectUri: string;

  constructor(redirectUri: string) {
    this.redirectUri = redirectUri;
  }

  isConfigured(): boolean {
    return !!(getClientId() && getClientSecret());
  }

  getAuthUrl(state: string): string {
    const oauth2 = makeOAuth2(this.redirectUri);
    return oauth2.generateAuthUrl({
      access_type:    "offline",
      prompt:         "consent select_account",
      scope:          SCOPES,
      state,
      include_granted_scopes: true,
    });
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const oauth2 = makeOAuth2(this.redirectUri);
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const { data: info } = await oauth2Api.userinfo.get();

    return {
      accessToken:  tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt:    new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      scope:        tokens.scope ?? SCOPES.join(" "),
      accountEmail: info.email ?? undefined,
      accountName:  info.name  ?? undefined,
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const oauth2 = makeOAuth2(this.redirectUri);
    oauth2.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2.refreshAccessToken();
    return {
      accessToken:  credentials.access_token!,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt:    new Date(credentials.expiry_date ?? Date.now() + 3600_000),
      scope:        credentials.scope ?? undefined,
    };
  }

  async testConnection(accessToken: string, refreshToken: string): Promise<{ ok: boolean; email?: string; name?: string; quota?: string }> {
    try {
      const { oauth2: auth } = await ensureFreshToken(accessToken, refreshToken, this.redirectUri);
      const driveApi = google.drive({ version: "v3", auth });
      const { data: about } = await driveApi.about.get({ fields: "user,storageQuota" });
      const used  = parseInt(about.storageQuota?.usage         ?? "0");
      const limit = parseInt(about.storageQuota?.limit         ?? "0");
      const quota = limit > 0 ? `${(used / 1e9).toFixed(1)} Go / ${(limit / 1e9).toFixed(1)} Go` : `${(used / 1e9).toFixed(1)} Go utilisés`;
      return { ok: true, email: about.user?.emailAddress ?? undefined, name: about.user?.displayName ?? undefined, quota };
    } catch (err) {
      logger.warn({ err }, "google-drive: testConnection failed");
      return { ok: false };
    }
  }

  async createFolder(accessToken: string, refreshToken: string, name: string, parentId?: string): Promise<string> {
    const { oauth2: auth } = await ensureFreshToken(accessToken, refreshToken, this.redirectUri);
    const driveApi = google.drive({ version: "v3", auth });

    const query = parentId
      ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
      : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const existing = await driveApi.files.list({ q: query, fields: "files(id,name)", pageSize: 1 });
    if (existing.data.files?.length) return existing.data.files[0].id!;

    const meta: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.folder" };
    if (parentId) meta.parents = [parentId];
    const { data } = await driveApi.files.create({ requestBody: meta, fields: "id" });
    return data.id!;
  }

  async uploadFile(
    accessToken: string,
    refreshToken: string,
    file: { name: string; content: Buffer; mimeType: string },
    parentFolderId?: string,
  ): Promise<UploadedFile> {
    const { oauth2: auth } = await ensureFreshToken(accessToken, refreshToken, this.redirectUri);
    const driveApi = google.drive({ version: "v3", auth });

    const meta: Record<string, unknown> = { name: file.name };
    if (parentFolderId) meta.parents = [parentFolderId];

    const { data } = await driveApi.files.create({
      requestBody: meta,
      media:       { mimeType: file.mimeType, body: Readable.from(file.content) },
      fields:      "id,name,webViewLink,webContentLink,size",
    });

    return {
      cloudFileId: data.id!,
      cloudPath:   data.name!,
      cloudViewUrl: data.webViewLink ?? undefined,
      cloudEditUrl: data.webViewLink ?? undefined,
      fileSize:    parseInt(data.size ?? "0") || file.content.length,
    };
  }

  async deleteFile(accessToken: string, refreshToken: string, cloudFileId: string): Promise<void> {
    try {
      const { oauth2: auth } = await ensureFreshToken(accessToken, refreshToken, this.redirectUri);
      const driveApi = google.drive({ version: "v3", auth });
      await driveApi.files.delete({ fileId: cloudFileId });
    } catch (err: any) {
      if (err?.code === 404) return;
      throw err;
    }
  }
}
