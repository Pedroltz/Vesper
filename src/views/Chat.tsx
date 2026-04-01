import { useState, useRef, useEffect } from "react";
import { Character, Settings, Message } from "../types";
import {
  Send, User, Trash2, Copy, Pencil, X, Check, RotateCcw, Info
} from "lucide-react";
import ReactMarkdown from "react-markdown";

/* ── Design tokens ── */
const T = {
  bg:       "#0a0a0a",
  panel:    "#0f0f0f",
  surface:  "#161616",
  border:   "#222",
  accent:   "#d1ff26",
  text:     "#e0e0e0",
  sub:      "#666",
  red:    "#ff4d4d",
} as const;

interface ChatProps {
  character: Character;
  settings: Settings;
  onEdit: () => void;
}

type MsgGroup = { lead: Message; rest: Message[] };

function groupMessages(messages: Message[]): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const lastMsg = last ? (last.rest[last.rest.length - 1] ?? last.lead) : null;
    const sameRole = last?.lead.role === msg.role;
    const recentEnough = lastMsg ? msg.timestamp - lastMsg.timestamp < 5 * 60 * 1000 : false;
    if (last && sameRole && recentEnough) {
      last.rest.push(msg);
    } else {
      groups.push({ lead: msg, rest: [] });
    }
  }
  return groups;
}

export default function Chat({ character, settings, onEdit }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1100);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    try {
      const saved = localStorage.getItem(`chat-${character.id}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
    return () => window.removeEventListener("resize", handleResize);
  }, [character.id]);

  useEffect(() => {
    localStorage.setItem(`chat-${character.id}`, JSON.stringify(messages));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, character.id]);

  // Auto-grow textarea effect
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = scrollHeight + "px";
    }
  }, [input]);

  const callAPI = async (ctx: { role: string; content: string }[]) => {
    const isGPT = settings.selectedModel.startsWith("gpt");
    const url = isGPT ? "https://api.openai.com/v1/chat/completions" : "https://api.deepseek.com/v1/chat/completions";
    const key = isGPT ? settings.openAIKey : settings.deepSeekKey;
    if (!key) throw new Error("API Key ausente.");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: settings.selectedModel, messages: ctx }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content as string;
  };

  const sendMessage = async (content: string, base: Message[]) => {
    if (!content.trim() || isLoading) return;
    const userMsg: Message = { id: crypto.randomUUID(), characterId: character.id, role: "user", content, timestamp: Date.now() };
    const next = [...base, userMsg];
    setMessages(next);
    setIsLoading(true);
    try {
      const ctx = [{ role: "system", content: character.systemPrompt || `Você é ${character.name}.` }, ...next.map(m => ({ role: m.role, content: m.content }))];
      const text = await callAPI(ctx);
      const aiMsg: Message = { id: crypto.randomUUID(), characterId: character.id, role: "assistant", content: text, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => { sendMessage(input, messages); setInput(""); };

  const groups = groupMessages(messages);

  return (
    <div style={{ height: "100%", display: "flex", background: T.bg, position: "relative", overflow: "hidden" }}>
      
      {/* Background Overlay */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.15 }}>
        {character.wallpaper && <img src={character.wallpaper} className="w-full h-full object-cover grayscale" />}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${T.bg}, transparent)` }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        
        {/* Header */}
        <header style={{
          height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isNarrow ? "0 16px" : "0 32px", borderBottom: `1px solid ${T.border}`, background: "rgba(10,10,10,0.8)", backdropFilter: "blur(10px)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, border: `1px solid ${T.border}`, overflow: "hidden", borderRadius: "50%" }}>
               {character.profilePicture && <img src={character.profilePicture} className="w-full h-full object-cover" />}
            </div>
            <div>
               <p style={{ fontWeight: 900, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>{character.name}</p>
               {!isNarrow && <p style={{ fontSize: 9, color: T.sub, fontFamily: "monospace", margin: 0 }}>// {settings.selectedModel}</p>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <HeaderBtn onClick={() => sendMessage(messages.slice(-1)[0]?.content || "", messages.slice(0, -1))}><RotateCcw size={14} /></HeaderBtn>
            <HeaderBtn onClick={onEdit}><Pencil size={14} /></HeaderBtn>
            <HeaderBtn onClick={() => setShowInfo(!showInfo)} active={showInfo}><Info size={14} /></HeaderBtn>
          </div>
        </header>

        {/* Messages Container */}
        <div style={{ flex: 1, overflowY: "auto", padding: isNarrow ? "24px 16px" : "40px 32px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
            {groups.map(group => (
              <MessageGroupRow key={group.lead.id} group={group} character={character} isNarrow={isNarrow} />
            ))}
            {isLoading && <div style={{ color: T.accent, fontFamily: "monospace", fontSize: 10 }}>RECEIVING_DATA...</div>}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Area */}
        <div style={{ padding: isNarrow ? "0 16px 16px" : "0 32px 32px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
             <textarea
               ref={textareaRef}
               rows={1}
               value={input}
               onChange={e => setInput(e.target.value)}
               onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
               placeholder={isNarrow ? "COMANDO..." : `ENVIAR COMANDO PARA ${character.name.toUpperCase()}...`}
               style={{
                 width: "100%", background: T.surface, border: `1px solid ${T.border}`,
                 padding: "16px 50px 16px 20px", color: "#fff", outline: "none",
                 fontSize: 14, fontFamily: "monospace", resize: "none",
                 maxHeight: "30vh", overflowY: "auto",
                 boxSizing: "border-box", display: "block"
               }}
             />
             <button
               onClick={handleSend}
               style={{
                 position: "absolute", right: 16, bottom: 14,
                 background: "none", border: "none", color: input.trim() ? T.accent : T.sub, cursor: "pointer"
               }}
             >
               <Send size={18} />
             </button>
          </div>
        </div>
      </div>

      {/* Responsive Info Sidebar */}
      {showInfo && (
        <aside style={{ 
          width: isNarrow ? "100%" : 360, 
          position: isNarrow ? "absolute" : "relative",
          right: 0, top: 0, bottom: 0,
          background: T.panel, padding: 32, overflowY: "auto", zIndex: 100,
          borderLeft: isNarrow ? "none" : `1px solid ${T.border}`,
          boxShadow: isNarrow ? "-20px 0 40px rgba(0,0,0,0.8)" : "none",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <p style={{ fontFamily: "monospace", fontSize: 10, color: T.accent }}>FILE_DETAILS</p>
              {isNarrow && <button onClick={() => setShowInfo(false)} style={{ background: "none", border: "none", color: T.sub }}><X size={20} /></button>}
           </div>
           
           <div style={{ position: "relative", height: 220, background: "#000", border: "1px solid #333", marginBottom: 32, borderRadius: "50%", width: 220, margin: "0 auto 32px", overflow: "hidden" }}>
              {character.profilePicture && <img src={character.profilePicture} className="w-full h-full object-cover" />}
           </div>
           
           <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8, textTransform: "uppercase", textAlign: "center" }}>{character.name}</h2>
           <div style={{ height: 2, width: 40, background: T.accent, margin: "0 auto 20px" }} />
           
           <div className="msg-prose" style={{ fontSize: 14, color: T.sub }}>
              <ReactMarkdown>{character.description || "NO_BIOMETRIC_DATA"}</ReactMarkdown>
           </div>
        </aside>
      )}
    </div>
  );
}

function MessageGroupRow({ group, character, isNarrow }: { group: MsgGroup; character: Character; isNarrow: boolean }) {
  const isUser = group.lead.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: isNarrow ? 12 : 20 }}>
      <div style={{
        width: 32, height: 32, background: isUser ? T.accent : T.surface, flexShrink: 0,
        border: `1px solid ${T.border}`, overflow: "hidden", borderRadius: "50%"
      }}>
        {!isUser && character.profilePicture && <img src={character.profilePicture} className="w-full h-full object-cover" />}
        {isUser && <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}><User size={16} /></div>}
      </div>

      <div style={{ flex: 1, maxWidth: isNarrow ? "100%" : "85%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
        <p style={{ fontSize: 9, fontWeight: 900, color: T.sub, marginBottom: 6, letterSpacing: "0.1em" }}>
          {isUser ? "PLAYER_USER" : character.name.toUpperCase()}
        </p>

        {[group.lead, ...group.rest].map(msg => (
          <div key={msg.id} style={{
            background: isUser ? "none" : T.surface,
            borderLeft: isUser ? "none" : `2px solid ${T.accent}`,
            borderRight: isUser ? `2px solid ${T.sub}` : "none",
            padding: "12px 16px", marginBottom: 2,
            width: "fit-content"
          }}>
            <div className="msg-prose">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeaderBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? T.accent : "none", border: `1px solid ${T.border}`,
        color: active ? "#000" : T.sub, width: 32, height: 32,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}
