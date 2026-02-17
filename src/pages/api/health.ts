import type { NextApiRequest, NextApiResponse } from 'next';
import { checkProviders } from '@/lib/ai-provider';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const providers = await checkProviders();
  const isHealthy = providers.ollama || providers.anthropic || providers.openrouter;

  res.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    version: '0.2.0',
    services: {
      ollama: providers.ollama,
      anthropic: providers.anthropic,
      openrouter: providers.openrouter,
      models: providers.models,
    },
  });
}
