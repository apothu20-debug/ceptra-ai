/**
 * POST /api/run
 * 
 * Executes code in a sandboxed environment.
 * Body: { code: string, language: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { executeCode } from '@/lib/sandbox';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'code and language are required' });
  }

  // Safety: only allow certain languages
  const allowed = ['python', 'py', 'javascript', 'js', 'typescript', 'ts', 'bash', 'sh'];
  if (!allowed.includes(language.toLowerCase())) {
    return res.status(400).json({ error: `Language not supported: ${language}` });
  }

  try {
    const result = await executeCode(code, language);
    res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Execution failed';
    res.status(500).json({ error: msg });
  }
}
