import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { useAuth } from '@/lib/auth-context';

type ToolType = 'chat'|'code'|'image'|'pptx'|'docx'|'pdf'|'xlsx'|'test'|'search';

interface FileAttachment { name: string; downloadUrl: string; mimeType: string; size: number; }
interface UserAttachment { name: string; size: number; type: string; dataUrl: string; }
interface Msg { id: string; role: 'user'|'assistant'; content: string; tool?: ToolType; files?: FileAttachment[]; attachments?: UserAttachment[]; provider?: string; ts: number; }
interface Conv { id: string; title: string; tool: ToolType; msgs: Msg[]; ts: number; }

const TOOLS: { id: ToolType; icon: string; label: string; color: string; hint: string }[] = [
  { id:'chat', icon:'💬', label:'Chat', color:'#6366f1', hint:'Ask anything...' },
  { id:'code', icon:'⌨️', label:'Code', color:'#22d3ee', hint:'Build a React component...' },
  { id:'image', icon:'🎨', label:'Images', color:'#f472b6', hint:'Generate a logo...' },
  { id:'pptx', icon:'📊', label:'Slides', color:'#fbbf24', hint:'Create a pitch deck...' },
  { id:'docx', icon:'📄', label:'Docs', color:'#818cf8', hint:'Write a contract...' },
  { id:'pdf', icon:'📕', label:'PDF', color:'#f87171', hint:'Create an invoice...' },
  { id:'xlsx', icon:'📈', label:'Sheets', color:'#34d399', hint:'Budget tracker...' },
  { id:'test', icon:'🧪', label:'Tests', color:'#a78bfa', hint:'Write tests...' },
  { id:'search', icon:'🔍', label:'Search', color:'#22d3ee', hint:'Research the market...' },
];

const isMob = typeof window !== 'undefined' && (/iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 768);
const v = { bg:'#07070d',bg2:'#0e0e18',bg3:'#151522',bg4:'#1c1c2e',text:'#e2e2f0',text2:'#9090a8',text3:'#5a5a72',accent:'#6366f1',border:'#1e1e30',green:'#34d399',red:'#f87171' };

export default function Home() {
  const { user, signOut } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<ToolType>('chat');
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeConv, setActiveConv] = useState<string|null>(null);
  const [side, setSide] = useState(!isMob);
  const [status, setStatus] = useState<'checking'|'online'|'offline'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [showModels, setShowModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [prov, setProv] = useState('');

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Voice
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // File attachments
  const [attachments, setAttachments] = useState<UserAttachment[]>([]);

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser. Try Chrome.'); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev ? prev + ' ' + transcript : transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name} is too large (max 10MB)`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: reader.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  useEffect(() => { if(typeof window!=='undefined') setServerUrl(sessionStorage.getItem('ceptra-server')||''); }, []);

  // On mobile app or when no server set, use the deployed URL
  const api = serverUrl || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '' : '') || '';

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${api}/api/health`);
        const d = await r.json();
        const on = d.services?.ollama || d.services?.anthropic || d.services?.openrouter;
        setStatus(on?'online':'offline');
        if(d.services?.models?.length){ setModels(d.services.models); if(!model) setModel(d.services.models[0]); }
        setProv(d.services?.ollama?'local':'cloud');
      } catch { setStatus('offline'); }
    })();
  }, [api]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);
  useEffect(() => { if(inputRef.current){ inputRef.current.style.height='auto'; inputRef.current.style.height=Math.min(inputRef.current.scrollHeight,140)+'px'; } }, [input]);

  const send = useCallback(async () => {
    const text = input.trim();
    if(!text&&attachments.length===0||busy) return;
    const currentAttachments = [...attachments];
    const displayText = text || `[${currentAttachments.map(a=>a.name).join(', ')}]`;
    const uMsg: Msg = { id:crypto.randomUUID(), role:'user', content:displayText, attachments:currentAttachments.length?currentAttachments:undefined, ts:Date.now() };
    const aMsg: Msg = { id:crypto.randomUUID(), role:'assistant', content:'', ts:Date.now() };
    setMsgs(p=>[...p,uMsg,aMsg]); setInput(''); setAttachments([]); setBusy(true);
    if(isMob) setSide(false);

    // Build message content with file context
    let messageContent = text;
    if (currentAttachments.length > 0) {
      const fileDescs = currentAttachments.map(a => {
        if (a.type.startsWith('text/') || a.name.endsWith('.csv') || a.name.endsWith('.json')) {
          // Decode text content from dataUrl
          try {
            const base64 = a.dataUrl.split(',')[1];
            const decoded = atob(base64);
            return `[File: ${a.name}]\n${decoded.slice(0, 5000)}${decoded.length > 5000 ? '\n...(truncated)' : ''}`;
          } catch { return `[File: ${a.name} - ${(a.size/1024).toFixed(1)}KB]`; }
        }
        return `[File attached: ${a.name} (${a.type}, ${(a.size/1024).toFixed(1)}KB)]`;
      }).join('\n\n');
      messageContent = text ? `${text}\n\n${fileDescs}` : fileDescs;
    }

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`${api}/api/chat`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message:messageContent, model:model||undefined, history:msgs.slice(-10).map(m=>({role:m.role,content:m.content})) }),
        signal: abortRef.current.signal,
      });
      if(!res.ok) { const e = await res.text(); setMsgs(p=>p.map(m=>m.id===aMsg.id?{...m,content:`Error: ${e}`}:m)); setBusy(false); return; }
      const data = await res.json();
      setMsgs(p=>p.map(m=>m.id===aMsg.id?{...m,content:data.content||'',tool:data.tool||'chat',files:data.files?.length?data.files:undefined,provider:data.provider}:m));

      const upd = {...aMsg, content:data.content, tool:data.tool, files:data.files, provider:data.provider};
      const all = [...msgs, uMsg, upd];
      if(activeConv) setConvs(p=>p.map(c=>c.id===activeConv?{...c,msgs:all,ts:Date.now()}:c));
      else { const nc:Conv={id:crypto.randomUUID(),title:text.slice(0,30),tool:data.tool||'chat',msgs:all,ts:Date.now()}; setConvs(p=>[nc,...p]); setActiveConv(nc.id); }
    } catch(e:any) {
      if(e.name!=='AbortError') setMsgs(p=>p.map(m=>m.id===aMsg.id?{...m,content:'Connection failed. Tap ⚙️ to set server URL.'}:m));
    } finally { setBusy(false); }
  }, [input,busy,model,msgs,activeConv,api,attachments]);

  const newChat = () => { setMsgs([]); setActiveConv(null); if(isMob) setSide(false); };
  const loadConv = (c:Conv) => { setMsgs(c.msgs); setActiveConv(c.id); setTool(c.tool); if(isMob) setSide(false); };

  const handleKey = (e:KeyboardEvent<HTMLTextAreaElement>) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} };

  const userPlan = user?.user_metadata?.plan || 'free';
  const isProUser = userPlan === 'pro' || userPlan === 'team';

  const handleUpgrade = async (plan: string = 'pro') => {
    try {
      const res = await fetch(`${api}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, userId: user?.id, plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Failed to start checkout');
    } catch { alert('Failed to connect to payment server'); }
  };

  const handleManageBilling = async () => {
    const customerId = user?.user_metadata?.stripe_customer_id;
    if (!customerId) { alert('No subscription found'); return; }
    try {
      const res = await fetch(`${api}/api/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { alert('Failed to open billing portal'); }
  };

  const renderMd = (text:string) => {
    if(!text) return null;
    let h = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g,'<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>')
      .replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
      .replace(/^[•\-] (.+)$/gm,'<li>$1</li>')
      .replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br/>');
    return <div className="mc" dangerouslySetInnerHTML={{__html:'<p>'+h+'</p>'}} />;
  };

  const toolInfo = TOOLS.find(t=>t.id===tool)||TOOLS[0];
  const fIcon = (m:string) => {
    if(m?.includes('pptx')||m?.includes('presentation')) return {bg:'linear-gradient(135deg,#f59e0b,#f97316)',i:'📊'};
    if(m?.includes('docx')||m?.includes('word')) return {bg:'linear-gradient(135deg,#6366f1,#818cf8)',i:'📄'};
    if(m?.includes('xlsx')||m?.includes('sheet')) return {bg:'linear-gradient(135deg,#22c55e,#34d399)',i:'📈'};
    if(m?.includes('pdf')) return {bg:'linear-gradient(135deg,#ef4444,#f87171)',i:'📕'};
    return {bg:'linear-gradient(135deg,#6366f1,#818cf8)',i:'📁'};
  };

  return (
    <div style={{display:'flex',height:'100dvh',background:v.bg,color:v.text,fontFamily:"'SF Pro Display',-apple-system,sans-serif",overflow:'hidden'}}>
      {side&&isMob&&<div onClick={()=>setSide(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:40}}/>}

      {/* SIDEBAR */}
      <aside style={{width:side?(isMob?'80vw':260):0,maxWidth:side?300:0,background:v.bg2,borderRight:`1px solid ${v.border}`,display:'flex',flexDirection:'column',overflow:'hidden',transition:'all .2s',...(isMob&&side?{position:'fixed',left:0,top:0,bottom:0,zIndex:50}:{})}}>
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${v.border}`,display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:30,height:30,borderRadius:9,background:'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'#fff'}}>C</div>
          <span style={{fontWeight:700,fontSize:15}}>Ceptra AI</span>
          <span style={{fontSize:9,background:v.accent,color:'#fff',padding:'2px 6px',borderRadius:4,fontWeight:600,marginLeft:'auto'}}>PRO</span>
        </div>
        <button onClick={newChat} style={{margin:'10px 12px',padding:'11px 14px',background:v.bg3,border:`1px solid ${v.border}`,borderRadius:10,color:v.text,cursor:'pointer',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:7}}>
          <span style={{fontSize:16,opacity:.6}}>+</span> New Chat
        </button>
        <div style={{padding:'4px 12px',fontSize:10,fontWeight:600,color:v.text3,textTransform:'uppercase',letterSpacing:1}}>Tools</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5,padding:'4px 12px 8px'}}>
          {TOOLS.map(t=>(
            <button key={t.id} onClick={()=>{setTool(t.id);if(isMob)setSide(false)}} style={{padding:'9px 4px',background:tool===t.id?'rgba(99,102,241,.08)':v.bg3,border:`1px solid ${tool===t.id?v.accent:'transparent'}`,borderRadius:9,cursor:'pointer',textAlign:'center'}}>
              <span style={{fontSize:18,display:'block'}}>{t.icon}</span>
              <span style={{fontSize:9,color:v.text2,fontWeight:500}}>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{padding:'6px 12px 2px',fontSize:10,fontWeight:600,color:v.text3,textTransform:'uppercase',letterSpacing:1}}>Recent</div>
        <div style={{flex:1,overflowY:'auto',padding:'4px 8px'}}>
          {convs.length===0&&<div style={{padding:16,color:v.text3,fontSize:11,textAlign:'center'}}>No conversations yet</div>}
          {convs.map(c=>(
            <div key={c.id} onClick={()=>loadConv(c)} style={{padding:'8px 10px',borderRadius:7,cursor:'pointer',marginBottom:2,fontSize:12,color:v.text2,display:'flex',alignItems:'center',gap:6,background:activeConv===c.id?v.bg3:'transparent'}}>
              <span style={{fontSize:12}}>{TOOLS.find(t=>t.id===c.tool)?.icon}</span>
              <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</span>
            </div>
          ))}
        </div>
        <div style={{padding:'8px 14px',borderTop:`1px solid ${v.border}`}}>
          {user && (
            <div style={{marginBottom:6}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <div style={{width:26,height:26,borderRadius:7,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff',flexShrink:0}}>
                  {(user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:v.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.user_metadata?.full_name || user.email?.split('@')[0]}</div>
                  <div style={{fontSize:9,color:v.text3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
                </div>
                <span style={{fontSize:8,padding:'2px 5px',borderRadius:3,fontWeight:700,background:isProUser?'rgba(52,211,153,0.15)':'rgba(99,102,241,0.1)',color:isProUser?v.green:v.accent}}>{userPlan.toUpperCase()}</span>
                <button onClick={signOut} style={{background:'none',border:'none',color:v.text3,cursor:'pointer',fontSize:11,fontWeight:500,padding:'2px 6px',borderRadius:4}} title="Sign out">↪</button>
              </div>
              {isProUser ? (
                <button onClick={handleManageBilling} style={{width:'100%',padding:'6px 0',borderRadius:6,border:`1px solid ${v.border}`,background:'transparent',color:v.text3,cursor:'pointer',fontSize:10,fontWeight:500}}>Manage Billing</button>
              ) : (
                <button onClick={()=>handleUpgrade('pro')} style={{width:'100%',padding:'6px 0',borderRadius:6,border:'none',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',cursor:'pointer',fontSize:10,fontWeight:600}}>Upgrade to Pro — $15/mo</button>
              )}
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:11,color:v.text3,display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:status==='online'?v.green:v.red}}/>
              {status==='online'?(prov==='cloud'?'Cloud':'Local AI'):'Offline'}
            </div>
            <button onClick={()=>setShowSettings(!showSettings)} style={{background:'none',border:'none',color:v.text3,cursor:'pointer',fontSize:16}}>⚙️</button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        <header style={{padding:'10px 14px',borderBottom:`1px solid ${v.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:v.bg2,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={()=>setSide(!side)} style={{background:'none',border:'none',color:v.text2,cursor:'pointer',fontSize:18,padding:4}}>☰</button>
            <span style={{fontSize:14,fontWeight:600}}>{toolInfo.icon} {toolInfo.label}</span>
          </div>
          {model&&<button onClick={()=>setShowModels(!showModels)} style={{background:v.bg3,border:`1px solid ${v.border}`,borderRadius:8,padding:'5px 10px',color:v.text,cursor:'pointer',fontSize:11,fontWeight:500,display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:v.green}}/>{model.length>15?model.slice(0,15)+'…':model}
          </button>}
          {showModels&&<>
            <div style={{position:'fixed',inset:0,zIndex:40}} onClick={()=>setShowModels(false)}/>
            <div style={{position:'absolute',top:50,right:14,background:v.bg2,border:`1px solid ${v.border}`,borderRadius:10,padding:6,minWidth:200,zIndex:50,boxShadow:'0 8px 30px rgba(0,0,0,.5)'}}>
              {models.map(m=><button key={m} onClick={()=>{setModel(m);setShowModels(false)}} style={{width:'100%',padding:'8px 10px',borderRadius:6,background:model===m?v.bg3:'transparent',border:'none',color:v.text,cursor:'pointer',fontSize:12,textAlign:'left'}}>{m}</button>)}
            </div>
          </>}
        </header>

        {showSettings&&<div style={{padding:'12px 16px',background:v.bg3,borderBottom:`1px solid ${v.border}`}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Server URL</div>
          <div style={{display:'flex',gap:6}}>
            <input value={serverUrl} onChange={e=>setServerUrl(e.target.value)} placeholder="http://192.168.1.x:3000" style={{flex:1,padding:'8px 10px',background:v.bg,border:`1px solid ${v.border}`,borderRadius:8,color:v.text,fontSize:12,outline:'none'}}/>
            <button onClick={()=>{sessionStorage.setItem('ceptra-server',serverUrl);setShowSettings(false);location.reload()}} style={{padding:'8px 14px',borderRadius:8,border:'none',background:v.accent,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>Save</button>
          </div>
          <div style={{fontSize:10,color:v.text3,marginTop:4}}>Empty = localhost. Mobile = your Mac IP (find with: ifconfig | grep inet).</div>
        </div>}

        <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
          {msgs.length===0?(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:isMob?20:40,textAlign:'center'}}>
              <div style={{width:52,height:52,borderRadius:14,background:'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,color:'#fff',marginBottom:14,boxShadow:'0 8px 40px rgba(99,102,241,.25)'}}>C</div>
              <h1 style={{fontSize:isMob?17:20,fontWeight:700,marginBottom:5}}>What do you want to create?</h1>
              <p style={{color:v.text3,fontSize:12,marginBottom:20}}>Code · Images · Slides · Docs · PDFs · Sheets · Tests</p>
              <div style={{display:'grid',gridTemplateColumns:isMob?'repeat(3,1fr)':'repeat(4,1fr)',gap:8,maxWidth:420,width:'100%'}}>
                {TOOLS.filter(t=>t.id!=='chat').map(t=>(
                  <button key={t.id} onClick={()=>{setTool(t.id);inputRef.current?.focus()}} style={{padding:isMob?'12px 6px':'14px 8px',background:v.bg2,border:`1px solid ${v.border}`,borderRadius:12,cursor:'pointer',textAlign:'center'}}>
                    <span style={{fontSize:isMob?20:22,display:'block',marginBottom:3}}>{t.icon}</span>
                    <span style={{fontSize:isMob?9:11,fontWeight:600,color:v.text2}}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ):(
            <div style={{maxWidth:720,margin:'0 auto',padding:isMob?'14px 10px':'20px 16px'}}>
              {msgs.map(m=>(
                <div key={m.id} style={{marginBottom:18,display:'flex',gap:8,flexDirection:m.role==='user'?'row-reverse':'row'}}>
                  <div style={{width:26,height:26,borderRadius:7,flexShrink:0,background:m.role==='user'?v.bg4:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,color:m.role==='user'?v.text2:'#fff'}}>{m.role==='user'?'U':'C'}</div>
                  <div style={{maxWidth:'85%',minWidth:0}}>
                    {m.role==='assistant'&&m.tool&&m.tool!=='chat'&&<span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:9,padding:'2px 6px',borderRadius:4,fontWeight:600,marginBottom:4,color:TOOLS.find(t=>t.id===m.tool)?.color||v.accent,background:`${TOOLS.find(t=>t.id===m.tool)?.color||v.accent}15`}}>{TOOLS.find(t=>t.id===m.tool)?.icon} {m.tool?.toUpperCase()}</span>}
                    <div style={{padding:m.role==='user'?'9px 12px':0,background:m.role==='user'?v.bg3:'transparent',borderRadius:12,fontSize:isMob?13:14,lineHeight:1.7,overflowWrap:'break-word'}}>
                      {/* User attachments */}
                      {m.attachments?.map((a,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                          {a.type.startsWith('image/')?<img src={a.dataUrl} style={{maxWidth:200,maxHeight:150,borderRadius:8,border:`1px solid ${v.border}`}} alt={a.name}/>
                          :<div style={{display:'flex',alignItems:'center',gap:6,background:v.bg2,border:`1px solid ${v.border}`,borderRadius:8,padding:'6px 10px'}}>
                            <span>{a.name.endsWith('.pdf')?'📕':a.name.endsWith('.csv')?'📈':'📎'}</span>
                            <span style={{fontSize:12,color:v.text2}}>{a.name}</span>
                            <span style={{fontSize:10,color:v.text3}}>{(a.size/1024).toFixed(0)}KB</span>
                          </div>}
                        </div>
                      ))}
                      {m.content?(m.role==='user'?<span>{m.content}</span>:renderMd(m.content)):(
                        <div style={{padding:'8px 0',display:'flex',gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:'50%',background:v.accent,animation:`pulse 1.2s infinite ${i*0.2}s`}}/>)}</div>
                      )}
                    </div>
                    {m.files?.map((f,i)=>{const fi=fIcon(f.mimeType);return(
                      <a key={i} href={`${api}${f.downloadUrl}`} download={f.name} style={{display:'flex',alignItems:'center',gap:8,background:v.bg3,border:`1px solid ${v.border}`,borderRadius:10,padding:'9px 12px',marginTop:6,textDecoration:'none',color:v.text}}>
                        <div style={{width:34,height:34,borderRadius:8,background:fi.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>{fi.i}</div>
                        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600}}>{f.name}</div><div style={{fontSize:10,color:v.text3}}>{f.size?`${(f.size/1024).toFixed(1)} KB`:'Ready'}</div></div>
                        <span style={{fontSize:10,color:v.accent,fontWeight:600}}>⬇</span>
                      </a>
                    );})}
                  </div>
                </div>
              ))}
              <div ref={endRef}/>
            </div>
          )}
        </div>

        <div style={{padding:isMob?'8px 10px 12px':'10px 16px 16px',borderTop:`1px solid ${v.border}`,flexShrink:0,background:v.bg}}>
          {/* Attachment preview */}
          {attachments.length>0&&<div style={{maxWidth:720,margin:'0 auto 6px',display:'flex',gap:6,flexWrap:'wrap'}}>
            {attachments.map((a,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:6,background:v.bg2,border:`1px solid ${v.border}`,borderRadius:8,padding:'5px 8px',fontSize:11}}>
                <span>{a.type.startsWith('image/')?'🖼️':a.name.endsWith('.pdf')?'📕':a.name.endsWith('.csv')?'📈':'📎'}</span>
                <span style={{color:v.text2,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                <span style={{color:v.text3,fontSize:9}}>{(a.size/1024).toFixed(0)}KB</span>
                <button onClick={()=>removeAttachment(i)} style={{background:'none',border:'none',color:v.text3,cursor:'pointer',fontSize:13,padding:0,lineHeight:1}}>×</button>
              </div>
            ))}
          </div>}
          <div style={{maxWidth:720,margin:'0 auto',display:'flex',gap:7,alignItems:'flex-end'}}>
            {/* File upload */}
            <input ref={fileRef} type="file" multiple accept=".txt,.csv,.json,.md,.py,.js,.ts,.jsx,.tsx,.html,.css,.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx" onChange={e=>handleFiles(e.target.files)} style={{display:'none'}}/>
            <button onClick={()=>fileRef.current?.click()} title="Attach file" style={{padding:'10px',borderRadius:10,background:v.bg2,border:`1px solid ${v.border}`,color:v.text3,cursor:'pointer',fontSize:16,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',width:40,height:40}}>📎</button>
            {/* Input */}
            <div style={{flex:1,background:v.bg2,border:`1px solid ${v.border}`,borderRadius:14,overflow:'hidden'}}>
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder={toolInfo.hint} rows={1}
                style={{width:'100%',padding:isMob?'11px 12px':'13px 14px',background:'transparent',border:'none',outline:'none',color:v.text,fontFamily:'inherit',fontSize:14,resize:'none',maxHeight:140,lineHeight:1.5}}/>
            </div>
            {/* Voice */}
            <button onClick={listening?stopVoice:startVoice} title={listening?'Stop listening':'Voice input'} style={{
              padding:'10px',borderRadius:10,border:`1px solid ${listening?v.red:v.border}`,
              background:listening?`${v.red}20`:v.bg2,color:listening?v.red:v.text3,
              cursor:'pointer',fontSize:16,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',width:40,height:40,
              animation:listening?'pulse 1s infinite':'none',
            }}>🎤</button>
            {/* Send / Stop */}
            {busy?<button onClick={()=>{abortRef.current?.abort();setBusy(false)}} style={{padding:'10px 14px',borderRadius:12,background:v.red,border:'none',color:'#fff',cursor:'pointer',fontWeight:600,fontSize:13,flexShrink:0,height:40}}>Stop</button>
            :<button onClick={send} disabled={!input.trim()&&attachments.length===0} style={{padding:'10px 14px',borderRadius:12,border:'none',fontWeight:600,fontSize:13,flexShrink:0,height:40,background:(input.trim()||attachments.length)?v.accent:v.bg3,color:(input.trim()||attachments.length)?'#fff':v.text3,cursor:(input.trim()||attachments.length)?'pointer':'default'}}>Send</button>}
          </div>
          <div style={{maxWidth:720,margin:'4px auto 0',textAlign:'center',fontSize:10,color:v.text3}}>{prov==='cloud'?'Cloud AI · Ceptra':'Local AI · Free · Private'}</div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#__next{height:100%;background:#07070d;color:#e2e2f0;font-family:'SF Pro Display',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e1e30;border-radius:2px}
        .mc p{margin-bottom:.5rem;line-height:1.7}.mc p:last-child{margin-bottom:0}
        .mc pre{background:#08080f;border:1px solid #1e1e30;border-radius:8px;padding:12px;overflow-x:auto;margin:.5rem 0;font-size:12px;line-height:1.5}
        .mc code{font-family:'SF Mono',monospace;font-size:.85em}
        .mc :not(pre)>code{background:#151522;padding:.1rem .3rem;border-radius:4px}
        .mc ul,.mc ol{padding-left:1.2rem;margin:.3rem 0}.mc li{margin:.2rem 0}
        .mc h1,.mc h2,.mc h3{margin:.6rem 0 .3rem;font-weight:600;color:#fff}
        .mc strong{color:#fff}.mc a{color:#6366f1}
        input,textarea{font-family:inherit}
      `}</style>
    </div>
  );
}
