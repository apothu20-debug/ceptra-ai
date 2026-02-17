import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, userId, plan } = req.body;

  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });

  const priceId = plan === 'team'
    ? process.env.STRIPE_TEAM_PRICE_ID
    : process.env.STRIPE_PRO_PRICE_ID;

  if (!priceId) return res.status(500).json({ error: 'Price ID not configured' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://ceptra-ai.vercel.app'}/?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://ceptra-ai.vercel.app'}/?cancelled=true`,
      metadata: { userId: userId || '', plan: plan || 'pro' },
      subscription_data: {
        metadata: { userId: userId || '', plan: plan || 'pro' },
      },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
