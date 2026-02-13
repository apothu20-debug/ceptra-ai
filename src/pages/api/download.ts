/**
 * GET /api/download?file=/path/to/file
 * 
 * Serves generated files for download.
 * Only allows files from /tmp/ceptra-outputs for security.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { readFile, stat } from 'fs/promises';
import { basename } from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const filePath = req.query.file as string;

  if (!filePath || !filePath.startsWith('/tmp/ceptra-')) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      return res.status(404).json({ error: 'Not found' });
    }

    const buffer = await readFile(filePath);
    const filename = basename(filePath);

    // Determine content type
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      png: 'image/png',
      jpg: 'image/jpeg',
      svg: 'image/svg+xml',
      html: 'text/html',
      txt: 'text/plain',
      json: 'application/json',
      ts: 'text/typescript',
      js: 'application/javascript',
      py: 'text/x-python',
    };

    res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch {
    return res.status(404).json({ error: 'File not found' });
  }
}
