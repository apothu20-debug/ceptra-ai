import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  if (user) { router.push('/'); return null; }

  const handleSubmit = async () => {
    setError(''); setSuccess(''); setLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else router.push('/');
    } else {
      if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
      const { error } = await signUp(email, password, name);
      if (error) setError(error);
      else setSuccess('Check your email to confirm your account!');
    }
    setLoading(false);
  };

  const v = { bg:'#07070d',bg2:'#0e0e18',bg3:'#151522',text:'#e2e2f0',text2:'#9090a8',text3:'#5a5a72',accent:'#6366f1',border:'#1e1e30',red:'#f87171',green:'#34d399' };

  return (
    <div style={{ minHeight:'100vh', background:v.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'SF Pro Display',-apple-system,sans-serif" }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:'#fff', marginBottom:12, boxShadow:'0 8px 40px rgba(99,102,241,.25)' }}>C</div>
          <h1 style={{ fontSize:22, fontWeight:700, color:v.text, marginBottom:4 }}>Ceptra AI</h1>
          <p style={{ fontSize:13, color:v.text3 }}>Code · Images · Docs · Slides · PDFs · Sheets</p>
        </div>

        {/* Card */}
        <div style={{ background:v.bg2, border:`1px solid ${v.border}`, borderRadius:16, padding:28, boxShadow:'0 8px 40px rgba(0,0,0,.3)' }}>
          {/* Tabs */}
          <div style={{ display:'flex', marginBottom:24, background:v.bg3, borderRadius:10, padding:3 }}>
            {(['login','signup'] as const).map(m => (
              <button key={m} onClick={()=>{setMode(m);setError('');setSuccess('')}} style={{
                flex:1, padding:'9px 0', borderRadius:8, border:'none', cursor:'pointer',
                background: mode===m ? v.accent : 'transparent',
                color: mode===m ? '#fff' : v.text3,
                fontSize:13, fontWeight:600, transition:'all .15s',
              }}>{m==='login'?'Log In':'Sign Up'}</button>
            ))}
          </div>

          {/* Google */}
          <button onClick={signInWithGoogle} style={{
            width:'100%', padding:'11px 0', borderRadius:10, border:`1px solid ${v.border}`,
            background:v.bg3, color:v.text, cursor:'pointer', fontSize:13, fontWeight:500,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:20, transition:'border-color .15s',
          }}
            onMouseOver={e=>(e.currentTarget.style.borderColor=v.accent)}
            onMouseOut={e=>(e.currentTarget.style.borderColor=v.border)}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <div style={{ flex:1, height:1, background:v.border }} />
            <span style={{ fontSize:11, color:v.text3 }}>or</span>
            <div style={{ flex:1, height:1, background:v.border }} />
          </div>

          {/* Form */}
          {mode === 'signup' && (
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"
              style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:`1px solid ${v.border}`, background:v.bg, color:v.text, fontSize:13, outline:'none', marginBottom:10, boxSizing:'border-box' }}
              onFocus={e=>(e.target.style.borderColor=v.accent)} onBlur={e=>(e.target.style.borderColor=v.border)} />
          )}

          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email"
            style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:`1px solid ${v.border}`, background:v.bg, color:v.text, fontSize:13, outline:'none', marginBottom:10, boxSizing:'border-box' }}
            onFocus={e=>(e.target.style.borderColor=v.accent)} onBlur={e=>(e.target.style.borderColor=v.border)} />

          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password"
            onKeyDown={e=>{if(e.key==='Enter')handleSubmit()}}
            style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:`1px solid ${v.border}`, background:v.bg, color:v.text, fontSize:13, outline:'none', marginBottom:16, boxSizing:'border-box' }}
            onFocus={e=>(e.target.style.borderColor=v.accent)} onBlur={e=>(e.target.style.borderColor=v.border)} />

          {/* Error / Success */}
          {error && <div style={{ padding:'8px 12px', borderRadius:8, background:`${v.red}15`, color:v.red, fontSize:12, marginBottom:12 }}>{error}</div>}
          {success && <div style={{ padding:'8px 12px', borderRadius:8, background:`${v.green}15`, color:v.green, fontSize:12, marginBottom:12 }}>{success}</div>}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading || !email || !password} style={{
            width:'100%', padding:'12px 0', borderRadius:10, border:'none', cursor: loading?'wait':'pointer',
            background: (!email||!password) ? v.bg3 : v.accent,
            color: (!email||!password) ? v.text3 : '#fff',
            fontSize:14, fontWeight:600, transition:'all .15s',
          }}>
            {loading ? 'Please wait...' : mode==='login' ? 'Log In' : 'Create Account'}
          </button>
        </div>

        {/* Footer */}
        <p style={{ textAlign:'center', fontSize:11, color:v.text3, marginTop:16 }}>
          {mode==='login' ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setSuccess('')}} style={{ color:v.accent, cursor:'pointer', fontWeight:600 }}>
            {mode==='login' ? 'Sign up' : 'Log in'}
          </span>
        </p>
      </div>

      <style jsx global>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#__next{height:100%;background:#07070d;color:#e2e2f0;font-family:'SF Pro Display',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        input::placeholder{color:#5a5a72}
        input,button{font-family:inherit}
      `}</style>
    </div>
  );
}
