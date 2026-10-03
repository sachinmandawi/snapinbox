export interface EmailMessage {
  id: string;
  recipient: string; // e.g. "alex49@mendoneet.me"
  from: {
    name?: string;
    address: string;
  };
  subject: string;
  text?: string;
  html?: string;
  receivedAt: string; // ISO string
  read: boolean;
  size?: number; // size in bytes
  extractedOtp?: string | null;
  extractedLink?: string | null;
  rawMime?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentUrl?: string; // base64 or download url
}

export interface WebhookIncomingPayload {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  raw?: string;
  secret?: string;
}
