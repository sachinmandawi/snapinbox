import fs from 'fs/promises';
import path from 'path';
import { EmailMessage } from '@/types/email';

// Path to persistent data store
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'emails.json');

// In-memory cache to guarantee fast responses
let emailCache: Map<string, EmailMessage> = new Map();
let isInitialized = false;

// Default TTL: 1 hour (in milliseconds)
const DEFAULT_TTL_MS = 60 * 60 * 1000;

async function ensureDataFileExists() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DATA_FILE);
    } catch {
      // File does not exist, initialize empty array
      await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error ensuring data file exists:', err);
  }
}

async function loadEmails(): Promise<void> {
  if (isInitialized) return;
  try {
    await ensureDataFileExists();
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    const emails: EmailMessage[] = JSON.parse(content || '[]');
    emailCache.clear();
    for (const email of emails) {
      emailCache.set(email.id, email);
    }
    isInitialized = true;
  } catch (err) {
    console.error('Failed to load emails from disk, using in-memory only:', err);
    isInitialized = true;
  }
}

async function persistEmails(): Promise<void> {
  try {
    await ensureDataFileExists();
    const emails = Array.from(emailCache.values());
    await fs.writeFile(DATA_FILE, JSON.stringify(emails, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist emails to disk:', err);
  }
}

export async function saveEmail(email: EmailMessage): Promise<EmailMessage> {
  await loadEmails();
  emailCache.set(email.id, email);
  await persistEmails();
  return email;
}

export async function getEmailsForRecipient(recipient: string): Promise<EmailMessage[]> {
  await loadEmails();
  const normalized = recipient.trim().toLowerCase();

  const results: EmailMessage[] = [];
  const now = Date.now();

  const cachedEmails = Array.from(emailCache.values());
  for (const email of cachedEmails) {
    // Check if recipient matches
    if (email.recipient.trim().toLowerCase() === normalized) {
      // Check expiration (default 24h cleanup)
      const receivedTime = new Date(email.receivedAt).getTime();
      if (now - receivedTime < 24 * 60 * 60 * 1000) {
        results.push(email);
      }
    }
  }

  // Sort descending by receivedAt (newest first)
  return results.sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
}

export async function getEmailById(id: string): Promise<EmailMessage | null> {
  await loadEmails();
  const email = emailCache.get(id);
  return email || null;
}

export async function markAsRead(id: string): Promise<boolean> {
  await loadEmails();
  const email = emailCache.get(id);
  if (!email) return false;
  email.read = true;
  await persistEmails();
  return true;
}

export async function deleteEmail(id: string): Promise<boolean> {
  await loadEmails();
  const deleted = emailCache.delete(id);
  if (deleted) {
    await persistEmails();
  }
  return deleted;
}

export async function clearAllForRecipient(recipient: string): Promise<number> {
  await loadEmails();
  const normalized = recipient.trim().toLowerCase();
  let count = 0;

  const entries = Array.from(emailCache.entries());
  for (const [id, email] of entries) {
    if (email.recipient.trim().toLowerCase() === normalized) {
      emailCache.delete(id);
      count++;
    }
  }

  if (count > 0) {
    await persistEmails();
  }
  return count;
}

const RECOVERY_FILE = path.join(DATA_DIR, 'recovery.json');

export async function saveRecoveryKey(key: string, address: string): Promise<void> {
  const normKey = key.trim().toUpperCase();
  const normAddr = address.trim().toLowerCase();
  let map: Record<string, string> = {};
  try {
    const raw = await fs.readFile(RECOVERY_FILE, 'utf-8');
    map = JSON.parse(raw || '{}');
  } catch (e) {}
  map[normKey] = normAddr;
  map[`addr_${normAddr}`] = normKey;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(RECOVERY_FILE, JSON.stringify(map, null, 2), 'utf-8');
  } catch (e) {}
}

export async function getAddressByRecoveryKey(key: string): Promise<string | null> {
  const normKey = key.trim().toUpperCase();
  try {
    const raw = await fs.readFile(RECOVERY_FILE, 'utf-8');
    const map = JSON.parse(raw || '{}');
    return map[normKey] || null;
  } catch (e) {
    return null;
  }
}
