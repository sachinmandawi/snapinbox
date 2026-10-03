import fs from 'fs/promises';
import path from 'path';
import { WorkerCodeClient } from './WorkerCodeClient';

export const metadata = {
  title: 'Cloudflare Worker Code | SnapInbox',
  description: 'Copy live deployment code for Cloudflare Worker mendoneet-worker',
};

export default async function WorkerCodePage() {
  const filePath = path.join(process.cwd(), 'cloudflare-worker', 'worker-fullstack.js');
  let code = '';
  try {
    code = await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    code = '// Error reading file: ' + String(e);
  }

  return <WorkerCodeClient code={code} />;
}
