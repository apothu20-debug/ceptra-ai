import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const TOOLS = [
  { icon: '💬', name: 'Chat', desc: 'Intelligent conversations with context' },
  { icon: '⌨️', name: 'Code', desc: 'Generate, debug, and review code' },
  { icon: '🎨', name: 'Images', desc: 'Create logos, art, and designs' },
  { icon: '📊', name: 'Slides', desc: 'Build presentations in seconds' },
  { icon: '📄', name: 'Docs', desc: 'Write reports, contracts, letters' },
  { icon: '📕', name: 'PDF', desc: 'Create and fill PDF documents' },
  { icon: '📈', name: 'Sheets', desc: 'Budgets, trackers, analytics' },
  { icon: '🧪', name: 'Tests', desc: 'Automated testing with Playwright' },
  { icon: '🔍', name: 'Search', desc: 'Deep research and analysis' },
];

const PLANS = [
  { name: 'Free', price: '$0', period: '/forever', features: ['20 messages/day', '3 tools', 'Community support'], cta: 'Get Started', accent: false },
  { name: 'Pro', price: '$15', period: '/month', features: ['Unlimited messages', 'All 9 tools', 'File generation (PPTX, DOCX, PDF, XLSX)', 'Voice input', 'Priority support'], cta: 'Start Free Trial', accent: true },
  { name: 'Team', price: '$25', period: '/user/mo', features: ['Everything in Pro', 'Shared workspace', 'Admin dashboard', 'API access', 'Custom integrations'], cta: 'Contact Sales', accent: false },
];

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState(new Set<string>());

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisible(prev => new Set(prev).add(e.target.id));
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isVis = (id: string) => visible.has(id);

  return (
    <>
      <Head>
        <title>Ceptra AI — Your AI-Powered Workspace</title>
        <meta name="description" content="Code, create, design, and research — all with one AI platform. 9 tools, one interface." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ background: '#04040a', color: '#e8e8f0', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>

        {/* ═══ NAV ═══ */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: '14px 24px',
          background: scrollY > 50 ? 'rgba(4,4,10,0.85)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 50 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          transition: 'all 0.3s',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          maxWidth: 1200, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#fff' }}>C</div>
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>Ceptra AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="#tools" style={{ color: '#9090a8', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>Tools</a>
            <a href="#pricing" style={{ color: '#9090a8', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>Pricing</a>
            <Link href="/login" style={{ padding: '8px 18px', borderRadius: 8, background: '#6366f1', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600, transition: 'transform 0.15s' }}>Get Started</Link>
          </div>
        </nav>

        {/* ═══ HERO ═══ */}
        <section style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '120px 24px 80px', position: 'relative',
        }}>
          {/* Glow effects */}
          <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '30%', left: '20%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.06)', fontSize: 12, fontWeight: 500, color: '#a5a5f7', marginBottom: 28, animation: 'fadeDown 0.6s ease' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', animation: 'pulse2 2s infinite' }} />
            Now live — Try it free
          </div>

          <h1 style={{
            fontSize: 'clamp(40px, 7vw, 76px)', fontWeight: 900, lineHeight: 1.05,
            letterSpacing: '-2px', maxWidth: 800, margin: '0 0 20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #a5a5f7 50%, #6366f1 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'fadeDown 0.8s ease',
          }}>
            One AI.<br />Nine superpowers.
          </h1>

          <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: '#7a7a94', maxWidth: 520, lineHeight: 1.6, fontWeight: 400, marginBottom: 36, animation: 'fadeDown 1s ease' }}>
            Code, design, write, research, and create — all from a single conversation. Built for makers who ship fast.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeDown 1.2s ease' }}>
            <Link href="/login" style={{
              padding: '14px 32px', borderRadius: 10, background: '#6366f1', color: '#fff',
              textDecoration: 'none', fontSize: 15, fontWeight: 600, letterSpacing: '-0.2px',
              boxShadow: '0 4px 30px rgba(99,102,241,0.35)', transition: 'transform 0.15s, box-shadow 0.15s',
            }}>Start Creating — Free</Link>
            <a href="#tools" style={{
              padding: '14px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              color: '#b0b0c4', textDecoration: 'none', fontSize: 15, fontWeight: 500,
              transition: 'border-color 0.15s',
            }}>See All Tools ↓</a>
          </div>

          {/* Tool pills floating */}
          <div style={{ display: 'flex', gap: 10, marginTop: 60, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 1.4s ease' }}>
            {TOOLS.map((t, i) => (
              <div key={i} style={{
                padding: '8px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                animationDelay: `${i * 0.1}s`,
              }}>
                <span>{t.icon}</span>
                <span style={{ color: '#9090a8', fontWeight: 500 }}>{t.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ DEMO PREVIEW ═══ */}
        <section id="demo" data-animate style={{
          padding: '0 24px 100px', maxWidth: 900, margin: '0 auto',
          opacity: isVis('demo') ? 1 : 0, transform: isVis('demo') ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.8s ease',
        }}>
          <div style={{
            background: '#0a0a14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16,
            overflow: 'hidden', boxShadow: '0 20px 80px rgba(0,0,0,0.5)',
          }}>
            {/* Fake browser bar */}
            <div style={{ padding: '12px 16px', background: '#0e0e18', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
              </div>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#5a5a72' }}>ceptra-ai.vercel.app</div>
            </div>
            {/* Chat preview */}
            <div style={{ padding: '24px 20px' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'flex-end' }}>
                <div style={{ background: '#151522', padding: '10px 14px', borderRadius: 12, fontSize: 13, maxWidth: '70%' }}>Create a pitch deck for my AI startup</div>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1c1c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>U</div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', flexShrink: 0 }}>C</div>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', marginBottom: 6 }}>📊 PPTX</span>
                  <div style={{ fontSize: 13, color: '#b0b0c4', lineHeight: 1.6 }}>I've created a 12-slide pitch deck with market analysis, product overview, team, and financials.</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#151522', border: '1px solid #1e1e30', borderRadius: 10, padding: '9px 12px', marginTop: 8, maxWidth: 280 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: 'linear-gradient(135deg,#f59e0b,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📊</div>
                    <div><div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f0' }}>AI-Startup-Pitch.pptx</div><div style={{ fontSize: 10, color: '#5a5a72' }}>2.4 MB · Ready</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ TOOLS ═══ */}
        <section id="tools" data-animate style={{
          padding: '80px 24px', maxWidth: 1000, margin: '0 auto',
          opacity: isVis('tools') ? 1 : 0, transform: isVis('tools') ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.8s ease',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>Nine tools. One interface.</h2>
            <p style={{ color: '#7a7a94', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>Everything you need to create, from code to contracts. No switching between apps.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {TOOLS.map((t, i) => (
              <div key={i} style={{
                padding: '22px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 14,
                transition: 'all 0.2s', cursor: 'default',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{t.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{t.name}</div>
                  <div style={{ color: '#7a7a94', fontSize: 13 }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <section id="features" data-animate style={{
          padding: '80px 24px', maxWidth: 1000, margin: '0 auto',
          opacity: isVis('features') ? 1 : 0, transform: isVis('features') ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.8s ease',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { icon: '🎤', title: 'Voice Input', desc: 'Speak naturally. Ceptra listens, understands, and creates.' },
              { icon: '📎', title: 'File Upload', desc: 'Drop files into chat. Analyze CSVs, review code, parse PDFs.' },
              { icon: '⚡', title: 'Instant Files', desc: 'Generate PPTX, DOCX, XLSX, and PDF files on demand.' },
              { icon: '🔒', title: 'Private & Secure', desc: 'Run locally with Ollama or use encrypted cloud AI.' },
              { icon: '📱', title: 'Mobile Ready', desc: 'Works on any device. iOS and Android apps coming soon.' },
              { icon: '🔌', title: 'VS Code Extension', desc: 'Use Ceptra directly in your editor. Code without context-switching.' },
            ].map((f, i) => (
              <div key={i} style={{ padding: '28px 24px', borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{f.title}</div>
                <div style={{ color: '#7a7a94', fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section id="pricing" data-animate style={{
          padding: '80px 24px', maxWidth: 1000, margin: '0 auto',
          opacity: isVis('pricing') ? 1 : 0, transform: isVis('pricing') ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.8s ease',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>Simple, fair pricing</h2>
            <p style={{ color: '#7a7a94', fontSize: 16 }}>Start free. Upgrade when you need more.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {PLANS.map((p, i) => (
              <div key={i} style={{
                padding: '32px 24px', borderRadius: 16,
                background: p.accent ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${p.accent ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}`,
                position: 'relative',
              }}>
                {p.accent && <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', padding: '3px 12px', borderRadius: '0 0 8px 8px', background: '#6366f1', fontSize: 10, fontWeight: 600, color: '#fff', letterSpacing: '0.5px' }}>MOST POPULAR</div>}
                <div style={{ fontSize: 14, fontWeight: 600, color: '#9090a8', marginBottom: 12 }}>{p.name}</div>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1px' }}>{p.price}</span>
                  <span style={{ color: '#5a5a72', fontSize: 14 }}>{p.period}</span>
                </div>
                <Link href="/login" style={{
                  display: 'block', textAlign: 'center', padding: '12px 0', borderRadius: 10,
                  background: p.accent ? '#6366f1' : 'rgba(255,255,255,0.05)',
                  border: p.accent ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: p.accent ? '#fff' : '#b0b0c4', textDecoration: 'none', fontSize: 14, fontWeight: 600,
                  marginBottom: 20, transition: 'transform 0.15s',
                }}>{p.cta}</Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {p.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9090a8' }}>
                      <span style={{ color: '#34d399', fontSize: 14 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section style={{ padding: '80px 24px 100px', textAlign: 'center' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 32px', borderRadius: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.06))', border: '1px solid rgba(99,102,241,0.15)' }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12 }}>Ready to build something?</h2>
            <p style={{ color: '#7a7a94', fontSize: 15, marginBottom: 24 }}>Join thousands of makers using Ceptra AI to ship faster.</p>
            <Link href="/login" style={{
              display: 'inline-block', padding: '14px 36px', borderRadius: 10,
              background: '#6366f1', color: '#fff', textDecoration: 'none',
              fontSize: 15, fontWeight: 600, boxShadow: '0 4px 30px rgba(99,102,241,0.35)',
            }}>Get Started — Free</Link>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer style={{ padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: '#fff' }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#5a5a72' }}>Ceptra AI</span>
          </div>
          <div style={{ fontSize: 12, color: '#3a3a4a' }}>© 2026 Ceptra AI. All rights reserved.</div>
        </footer>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #04040a; }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse2 { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        a:hover { opacity: 0.9; }
      `}</style>
    </>
  );
}
