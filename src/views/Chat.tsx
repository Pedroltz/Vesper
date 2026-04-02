import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Character, Settings, Message, Session } from "../types";
import SaveDialog from "../components/SaveDialog";
import {
  Send, User, Trash2, Pencil, X, RotateCcw, Info, History, Download, Cpu, Check, Wand2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const T = {
  bg:      "#0a0a0a",
  panel:   "#0f0f0f",
  surface: "#161616",
  border:  "#222",
  accent:  "#d1ff26",
  text:    "#e0e0e0",
  sub:     "#666",
  faint:   "#333",
  red:     "#ff4d4d",
} as const;

interface ChatProps {
  character: Character;
  settings: Settings;
  onEdit: () => void;
  session: Session;
  sessions: Session[];
  onNewSession: () => void;
  onSelectSession: (s: Session) => void;
  onDeleteSession: (id: string) => void;
  onUpdateSession: (id: string, updates: Partial<Session>) => void;
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

function loadSessionMsgs(sessionId: string): Message[] {
  try {
    const raw = localStorage.getItem(`vesper-msgs-${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function buildExportContent(s: Session, char: Character, msgs: Message[]): string {
  const sep = "=".repeat(72);
  const date = new Date(s.createdAt).toLocaleString("pt-BR");
  const header = [sep, `VESPER RP — ${char.name.toUpperCase()}`, `Sessão: ${s.title}`, `Data: ${date}`, sep].join("\n");
  const summaryBlock = s.summary ? `\n// RESUMO\n${s.summary}\n\n${sep}` : "";
  const lines = msgs.length > 0
    ? msgs.map(m => {
        const who = m.role === "user" ? "PLAYER_USER" : char.name.toUpperCase();
        const time = new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        return `[${time}] ${who}:\n${m.content}`;
      }).join("\n\n---\n\n")
    : "(sessão sem mensagens)";
  return `${header}${summaryBlock}\n\n// TRANSCRIÇÃO\n\n${lines}\n\n${sep}\n`;
}

export default function Chat({
  character, settings, onEdit,
  session, sessions, onNewSession, onSelectSession, onDeleteSession, onUpdateSession,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1100);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [saveDialog, setSaveDialog] = useState<{ filename: string; content: string } | null>(null);
  const [scenarioDismissed, setScenarioDismissed] = useState(false);
  const [responseLength, setResponseLength] = useState(600);
  const [directorMode, setDirectorMode] = useState(false);
  const DIR_COLOR = "#a78bfa";
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    skipNextSaveRef.current = true;
    setScenarioDismissed(false);
    try {
      const saved = localStorage.getItem(`vesper-msgs-${session.id}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch { setMessages([]); }
  }, [session.id]);

  useEffect(() => {
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    localStorage.setItem(`vesper-msgs-${session.id}`, JSON.stringify(messages));
  }, [messages, session.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  /* ── API ── */
  const callAPI = async (ctx: { role: string; content: string }[], maxTokens?: number) => {
    const isGPT = settings.selectedModel.startsWith("gpt");
    const url = isGPT
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.deepseek.com/v1/chat/completions";
    const key = isGPT ? settings.openAIKey : settings.deepSeekKey;
    if (!key) throw new Error("API Key ausente. Configure nas Configurações.");
    const body: Record<string, unknown> = { model: settings.selectedModel, messages: ctx };
    if (maxTokens) body.max_tokens = maxTokens;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content as string;
  };

  /* ── Build system prompt (Injects Identity, Background and Context) ── */
  const buildSystemPrompt = () => {
    const identity = `VOCÊ É: ${character.name.toUpperCase()}\n`;
    const background = character.description ? `\n// FICHA E BIOMETRIA:\n${character.description}\n` : "";
    const coreInstructions = `\n// INSTRUÇÕES DE SISTEMA:\n${character.systemPrompt || `Interprete ${character.name} de forma imersiva.`}\n`;
    const formatting = `\n// FORMATAÇÃO OBRIGATÓRIA (markdown):\n- Ações e narração: *texto em itálico*\n- Pensamentos internos: > texto em bloco\n- Fala direta: "texto entre aspas"\nCombine os formatos naturalmente. Nunca escreva tudo em texto plano.\n`;

    const lengthLabel =
      responseLength <= 250 ? "muito curta (2 a 3 parágrafos pequenos no máximo)" :
      responseLength <= 600 ? "moderada (3 a 5 parágrafos)" :
      responseLength <= 1000 ? "detalhada (vários parágrafos)" :
      "extensa e elaborada (sem limitação de tamanho)";
    const lengthGuide = `\n// TAMANHO DA RESPOSTA:\nEscreva respostas de tamanho ${lengthLabel}. Sempre termine suas frases e cenas de forma completa — nunca corte no meio. Adapte a profundidade da narrativa ao tamanho permitido.\n`;

    const scenario = session.scenario ? `\n// CENÁRIO DESTA SESSÃO:\n${session.scenario}\n` : "";
    const memory = session.importedContext ? `\n// MEMÓRIA DE SESSÃO ANTERIOR:\n${session.importedContext}\n` : "";

    return `${identity}${background}${coreInstructions}${formatting}${lengthGuide}${scenario}${memory}`;
  };

  /* ── Send ── */
  const sendMessage = async (content: string, base: Message[]) => {
    if (!content.trim() || isLoading) return;

    if (base.filter(m => m.role === "user").length === 0) {
      const title = content.slice(0, 42) + (content.length > 42 ? "…" : "");
      onUpdateSession(session.id, { title });
    }

    const userMsg: Message = {
      id: crypto.randomUUID(), characterId: character.id,
      role: "user", content, timestamp: Date.now(),
    };
    const next = [...base, userMsg];
    setMessages(next);
    setIsLoading(true);
    try {
      const ctx = [
        { role: "system", content: buildSystemPrompt() },
        ...next.map(m =>
          m.role === "director"
            ? { role: "system", content: `[INSTRUÇÃO DO DIRETOR]: ${m.content}` }
            : { role: m.role, content: m.content }
        ),
      ];
      const text = await callAPI(ctx, responseLength);
      const aiMsg: Message = {
        id: crypto.randomUUID(), characterId: character.id,
        role: "assistant", content: text, timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Director mode: inject system instruction, saved as "director" role ── */
  const sendDirectorMsg = async (content: string) => {
    if (!content.trim() || isLoading) return;
    const dirMsg: Message = {
      id: crypto.randomUUID(), characterId: character.id,
      role: "director", content, timestamp: Date.now(),
    };
    const next = [...messages, dirMsg];
    setMessages(next);
    setIsLoading(true);
    try {
      const ctx = [
        { role: "system", content: buildSystemPrompt() },
        ...next.map(m =>
          m.role === "director"
            ? { role: "system", content: `[INSTRUÇÃO DO DIRETOR]: ${m.content}` }
            : { role: m.role, content: m.content }
        ),
      ];
      const text = await callAPI(ctx, responseLength);
      const aiMsg: Message = {
        id: crypto.randomUUID(), characterId: character.id,
        role: "assistant", content: text, timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setIsLoading(false);
      setDirectorMode(false);
    }
  };

  const handleSend = () => {
    if (directorMode) { sendDirectorMsg(input); } else { sendMessage(input, messages); }
    setInput("");
  };

  const handleDeleteMsg = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleRetryMsg = (id: string) => {
    setMessages(current => {
      const idx = current.findIndex(m => m.id === id);
      if (idx < 0) return current;
      const base = current.slice(0, idx);
      const lastUser = [...base].reverse().find(m => m.role === "user");
      if (!lastUser) return current;
      const userIdx = base.findIndex(m => m.id === lastUser.id);
      const newBase = base.slice(0, userIdx);
      // Kick off the API call after state settles
      setTimeout(() => sendMessage(lastUser.content, newBase), 0);
      return newBase;
    });
  };

  const handleEditMsg = (id: string, newContent: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newContent } : m));
  };

  const clearMessages = () => {
    if (confirm("Apagar todas as mensagens desta sessão?")) setMessages([]);
  };

  /* ── Generate summary for a session then import as context ── */
  const handleImportContext = async (targetSession: Session) => {
    setGeneratingFor(targetSession.id);
    try {
      let summary = targetSession.summary;

      if (!summary) {
        const msgs = loadSessionMsgs(targetSession.id);
        if (msgs.length === 0) { alert("Sessão vazia — nada para resumir."); return; }

        const transcript = msgs
          .map(m => `${m.role === "user" ? "Usuário" : character.name}: ${m.content}`)
          .join("\n\n");

        summary = await callAPI([
          {
            role: "system",
            content: "Você é um assistente de narrativa. Crie resumos concisos de conversas de roleplay.",
          },
          {
            role: "user",
            content: `Resuma esta conversa de roleplay entre um usuário e o personagem "${character.name}" em 4 a 6 frases objetivas em português. Use passado. Descreva eventos importantes, revelações e desenvolvimentos da relação. Seja conciso.\n\nConversa:\n${transcript}`,
          },
        ]);

        // Save summary back to the source session
        onUpdateSession(targetSession.id, { summary });
      }

      // Import the summary into the current session
      onUpdateSession(session.id, { importedContext: summary });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao gerar resumo.");
    } finally {
      setGeneratingFor(null);
    }
  };

  const removeImportedContext = () => onUpdateSession(session.id, { importedContext: undefined });

  const openExportDialog = (s: Session, msgs: Message[]) => {
    const content = buildExportContent(s, character, msgs);
    const filename = `vesper_${character.name}_${s.title}.txt`.replace(/[^\w.-]/g, "_");
    setSaveDialog({ filename, content });
  };

  const handleSaveFile = async (dir: string, filename: string) => {
    const savedPath = await invoke<string>("save_text_file", { dir, filename, content: saveDialog!.content });
    setSaveDialog(null);
    alert(`Salvo em:\n${savedPath}`);
  };

  // Split messages: director messages render inline, others grouped
  type ChatItem = { type: "group"; group: MsgGroup } | { type: "director"; msg: Message };
  const chatItems: ChatItem[] = [];
  const pending: Message[] = [];
  for (const msg of messages) {
    if (msg.role === "director") {
      if (pending.length) { groupMessages(pending).forEach(g => chatItems.push({ type: "group", group: g })); pending.length = 0; }
      chatItems.push({ type: "director", msg });
    } else {
      pending.push(msg);
    }
  }
  if (pending.length) groupMessages(pending).forEach(g => chatItems.push({ type: "group", group: g }));

  return (
    <div style={{ height: "100%", display: "flex", background: T.bg, position: "relative", overflow: "hidden" }}>

      {/* Wallpaper */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.25 }}>
        {character.wallpaper && (
          <img src={character.wallpaper} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1)" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${T.bg}, transparent)` }} />
      </div>

      {/* ── Sessions panel (left) ── */}
      {showSessions && (
        <aside style={{
          width: isNarrow ? "100%" : 288,
          position: isNarrow ? "absolute" : "relative",
          left: 0, top: 0, bottom: 0, zIndex: 100,
          background: T.panel, borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: isNarrow ? "10px 0 40px rgba(0,0,0,0.8)" : "none",
        }}>
          <div style={{
            padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`,
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          }}>
            <div>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 9, color: T.accent, letterSpacing: "0.12em" }}>MEMORY_BANK</p>
              <p style={{ margin: "5px 0 0", fontSize: 11, color: T.sub, fontFamily: "monospace" }}>
                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={onNewSession}
                style={{
                  fontFamily: "monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.06em",
                  color: T.accent, background: "none", border: `1px solid ${T.accent}`,
                  padding: "6px 10px", cursor: "pointer",
                }}
              >
                + NEW
              </button>
              {isNarrow && (
                <button onClick={() => setShowSessions(false)} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", display: "flex", padding: 4 }}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {[...sessions].reverse().map(s => (
              <SessionItem
                key={s.id}
                s={s}
                active={s.id === session.id}
                isCurrentSession={s.id === session.id}
                canDelete={sessions.length > 1}
                isGenerating={generatingFor === s.id}
                hasImported={session.importedContext !== undefined && s.id !== session.id}
                onSelect={() => { onSelectSession(s); if (isNarrow) setShowSessions(false); }}
                onDelete={() => onDeleteSession(s.id)}
                onExport={() => openExportDialog(s, loadSessionMsgs(s.id))}
                onExportCurrent={() => openExportDialog(session, messages)}
                onImport={() => handleImportContext(s)}
              />
            ))}
          </div>
        </aside>
      )}

      {/* ── Main column ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1, minWidth: 0 }}>

        {/* Header */}
        <header style={{
          height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isNarrow ? "0 16px" : "0 32px",
          borderBottom: `1px solid ${T.border}`,
          background: "rgba(10,10,10,0.85)", backdropFilter: "blur(10px)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, border: `1px solid ${T.border}`, overflow: "hidden", borderRadius: "50%", flexShrink: 0 }}>
              {character.profilePicture && (
                <img src={character.profilePicture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </div>
            <div>
              <p style={{ fontWeight: 900, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
                {character.name}
              </p>
              {!isNarrow && (
                <p style={{ fontSize: 9, color: T.sub, fontFamily: "monospace", margin: 0 }}>
                  // {session.title}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <HeaderBtn onClick={clearMessages} title="Limpar sessão"><Trash2 size={14} /></HeaderBtn>
            <HeaderBtn onClick={onEdit} title="Editar personagem"><Pencil size={14} /></HeaderBtn>
            <HeaderBtn
              onClick={() => { setShowSessions(v => !v); setShowInfo(false); }}
              active={showSessions}
              title="Sessões / Memórias"
            >
              <History size={14} />
            </HeaderBtn>
            <HeaderBtn
              onClick={() => { setShowInfo(v => !v); setShowSessions(false); }}
              active={showInfo}
              title="Ficha do personagem"
            >
              <Info size={14} />
            </HeaderBtn>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: isNarrow ? "24px 16px" : "40px 32px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>

            {/* Scenario indicator (when set) */}
            {session.scenario && (
              <div style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                padding: "14px 18px",
                border: `1px solid ${T.faint}`,
                borderLeft: `3px solid #888`,
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 6px", fontFamily: "monospace", fontSize: 9, color: "#888", letterSpacing: "0.1em" }}>
                    // CENÁRIO_ATIVO
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: T.sub, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {session.scenario}
                  </p>
                </div>
                <button
                  onClick={() => onUpdateSession(session.id, { scenario: undefined })}
                  title="Remover cenário"
                  style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", flexShrink: 0, display: "flex", paddingTop: 2 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = T.red}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = T.faint}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Scenario prompt (only for empty sessions without scenario) */}
            {messages.length === 0 && !session.scenario && !scenarioDismissed && (
              <ScenarioPrompt
                onSet={text => onUpdateSession(session.id, { scenario: text })}
                onDismiss={() => setScenarioDismissed(true)}
              />
            )}

            {/* Imported context indicator */}
            {session.importedContext && (
              <div style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                padding: "14px 18px",
                border: `1px solid ${T.faint}`,
                borderLeft: `3px solid ${T.accent}`,
                background: "rgba(209,255,38,0.03)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 6px", fontFamily: "monospace", fontSize: 9, color: T.accent, letterSpacing: "0.1em" }}>
                    // MEMORY_CONTEXT_ACTIVE
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: T.sub, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {session.importedContext}
                  </p>
                </div>
                <button
                  onClick={removeImportedContext}
                  title="Remover contexto importado"
                  style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", flexShrink: 0, display: "flex", paddingTop: 2 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = T.red}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = T.faint}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {messages.length === 0 && !isLoading && (session.scenario || scenarioDismissed) && (
              <div style={{ textAlign: "center", paddingTop: 40 }}>
                <p style={{ fontFamily: "monospace", fontSize: 10, color: T.faint, letterSpacing: "0.15em" }}>
                  SESSION_EMPTY — AWAITING_INPUT
                </p>
              </div>
            )}

            {chatItems.map(item =>
              item.type === "director"
                ? <DirectorEntry key={item.msg.id} msg={item.msg} onDelete={handleDeleteMsg} />
                : <MessageGroupRow
                    key={item.group.lead.id}
                    group={item.group}
                    character={character}
                    isNarrow={isNarrow}
                    onDelete={handleDeleteMsg}
                    onRetry={handleRetryMsg}
                    onEdit={handleEditMsg}
                  />
            )}

            {isLoading && (
              <div style={{ color: T.accent, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em" }}>
                RECEIVING_DATA...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ padding: isNarrow ? "0 16px 16px" : "0 32px 32px", flexShrink: 0 }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>

            {/* Director mode label */}
            {directorMode && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 6, padding: "5px 10px",
                border: `1px solid ${DIR_COLOR}22`,
                background: `${DIR_COLOR}08`,
              }}>
                <Wand2 size={10} color={DIR_COLOR} />
                <span style={{ fontFamily: "monospace", fontSize: 9, color: DIR_COLOR, letterSpacing: "0.1em" }}>
                  MODO_DIRETOR — instrução invisível ao personagem
                </span>
                <button
                  onClick={() => setDirectorMode(false)}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: DIR_COLOR, cursor: "pointer", display: "flex", opacity: 0.6 }}
                >
                  <X size={11} />
                </button>
              </div>
            )}

            <div style={{ position: "relative" }}>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  if (e.key === "Control") { e.preventDefault(); setDirectorMode(v => !v); }
                }}
                placeholder={directorMode ? "Instrução ao personagem — não registrada no chat..." : isNarrow ? "Comando..." : `Enviar comando para ${character.name}...`}
                style={{
                  width: "100%", background: T.surface,
                  border: `1px solid ${directorMode ? DIR_COLOR : T.border}`,
                  padding: "16px 84px 16px 20px", color: "#fff", outline: "none",
                  fontSize: 14, fontFamily: "monospace", resize: "none",
                  maxHeight: "30vh", overflowY: "auto",
                  boxSizing: "border-box", display: "block",
                  transition: "border-color 0.2s",
                }}
              />

              {/* Director toggle */}
              <button
                onClick={() => setDirectorMode(v => !v)}
                title="Modo Diretor — instrução silenciosa"
                style={{
                  position: "absolute", right: 46, bottom: 13,
                  background: "none", border: "none", cursor: "pointer",
                  color: directorMode ? DIR_COLOR : T.faint,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => { if (!directorMode) (e.currentTarget as HTMLButtonElement).style.color = DIR_COLOR; }}
                onMouseLeave={e => { if (!directorMode) (e.currentTarget as HTMLButtonElement).style.color = T.faint; }}
              >
                <Wand2 size={16} />
              </button>

              {/* Send */}
              <button
                onClick={handleSend}
                style={{
                  position: "absolute", right: 16, bottom: 14,
                  background: "none", border: "none", cursor: "pointer",
                  color: input.trim() ? (directorMode ? DIR_COLOR : T.accent) : T.sub,
                  transition: "color 0.15s",
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save dialog ── */}
      {saveDialog && (
        <SaveDialog
          defaultFilename={saveDialog.filename}
          onSave={handleSaveFile}
          onClose={() => setSaveDialog(null)}
        />
      )}

      {/* ── Info panel (right) ── */}
      {showInfo && (
        <aside style={{
          width: isNarrow ? "100%" : 360,
          position: isNarrow ? "absolute" : "relative",
          right: 0, top: 0, bottom: 0,
          background: T.panel, padding: 32, overflowY: "auto", zIndex: 100,
          borderLeft: isNarrow ? "none" : `1px solid ${T.border}`,
          boxShadow: isNarrow ? "-20px 0 40px rgba(0,0,0,0.8)" : "none",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <p style={{ fontFamily: "monospace", fontSize: 10, color: T.accent }}>FILE_DETAILS</p>
            {isNarrow && (
              <button onClick={() => setShowInfo(false)} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer" }}>
                <X size={20} />
              </button>
            )}
          </div>

          {/* Response length slider */}
          <div style={{ marginBottom: 32, padding: "16px 20px", border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.01)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 9, color: T.sub, letterSpacing: "0.1em" }}>TAMANHO_RESPOSTA</p>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, color: T.accent, fontWeight: 700 }}>
                {responseLength <= 250 ? "CURTO" : responseLength <= 600 ? "MÉDIO" : responseLength <= 1000 ? "LONGO" : "EXTENSO"}
              </p>
            </div>
            <input
              type="range"
              className="noir-slider"
              min={100}
              max={1500}
              step={50}
              value={responseLength}
              onChange={e => setResponseLength(Number(e.target.value))}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              {["CURTO", "MÉDIO", "LONGO", "EXTENSO"].map(label => (
                <span key={label} style={{ fontFamily: "monospace", fontSize: 8, color: T.faint, letterSpacing: "0.05em" }}>{label}</span>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", height: 220, width: 220, background: "#000", border: "1px solid #333", borderRadius: "50%", margin: "0 auto 32px", overflow: "hidden" }}>
            {character.profilePicture && (
              <img src={character.profilePicture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
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

/* ── Director entry (collapsed by default) ── */
const DIR_ENTRY_COLOR = "#a78bfa";
function DirectorEntry({ msg, onDelete }: { msg: Message; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, opacity: 0.7 }}>
      <div style={{ flex: 1, border: `1px solid ${DIR_ENTRY_COLOR}22`, background: `${DIR_ENTRY_COLOR}06` }}>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            width: "100%", background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 12px", color: DIR_ENTRY_COLOR,
          }}
        >
          <Wand2 size={10} />
          <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em", flex: 1, textAlign: "left" }}>
            // DIRETOR
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: `${DIR_ENTRY_COLOR}88` }}>
            {expanded ? "▲" : "▼"}
          </span>
        </button>
        {expanded && (
          <div style={{ padding: "0 12px 10px", borderTop: `1px solid ${DIR_ENTRY_COLOR}22` }}>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#ccc", lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
              {msg.content}
            </p>
          </div>
        )}
      </div>
      <button
        onClick={() => onDelete(msg.id)}
        title="Remover instrução"
        style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", paddingTop: 7, flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = T.red}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = T.faint}
      >
        <X size={12} />
      </button>
    </div>
  );
}

/* ── Scenario prompt (shown on empty sessions) ── */
function ScenarioPrompt({ onSet, onDismiss }: {
  onSet: (text: string) => void;
  onDismiss: () => void;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { taRef.current?.focus(); }, []);

  const handleSet = () => {
    if (text.trim()) onSet(text.trim());
    else onDismiss();
  };

  return (
    <div style={{
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid #555`,
      background: "rgba(255,255,255,0.02)",
      padding: "20px 24px",
    }}>
      <p style={{ margin: "0 0 4px", fontFamily: "monospace", fontSize: 9, color: "#666", letterSpacing: "0.12em" }}>
        // CENÁRIO_INICIAL — OPCIONAL
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
        Defina o cenário desta sessão — onde estão, o que aconteceu antes, o tom da cena.
      </p>
      <textarea
        ref={taRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSet(); } }}
        placeholder="Ex: É uma noite chuvosa em Neo-Tokyo. Vocês se encontram num bar clandestino..."
        rows={3}
        style={{
          width: "100%", background: T.surface, border: `1px solid ${T.border}`,
          color: T.text, outline: "none", resize: "none",
          fontFamily: "inherit", fontSize: 13, lineHeight: 1.6,
          padding: "10px 14px", boxSizing: "border-box", display: "block",
          marginBottom: 12,
        }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={handleSet}
          style={{
            background: T.accent, border: "none", color: "#000",
            padding: "7px 18px", cursor: "pointer",
            fontFamily: "monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em",
          }}
        >
          DEFINIR_CENÁRIO
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: "none", border: "none", color: T.sub,
            padding: "7px 10px", cursor: "pointer",
            fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          }}
        >
          PULAR →
        </button>
      </div>
    </div>
  );
}

/* ── Session list item ── */
function SessionItem({ s, active, isCurrentSession, canDelete, isGenerating, onSelect, onDelete, onExport, onExportCurrent, onImport }: {
  s: Session;
  active: boolean;
  isCurrentSession: boolean;
  canDelete: boolean;
  isGenerating: boolean;
  hasImported: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onExport: () => void;
  onExportCurrent: () => void;
  onImport: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "14px 16px", cursor: "pointer",
        borderBottom: `1px solid ${T.border}`,
        borderLeft: `2px solid ${active ? T.accent : "transparent"}`,
        background: active ? "rgba(209,255,38,0.04)" : hov ? "rgba(255,255,255,0.02)" : "transparent",
        transition: "background 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 700,
              color: active ? T.accent : hov ? T.text : T.sub,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, minWidth: 0,
            }}>
              {s.title}
            </p>
            {s.summary && (
              <span style={{ fontSize: 8, fontFamily: "monospace", color: T.accent, flexShrink: 0, letterSpacing: "0.05em" }}>
                ∑
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 9, color: T.faint, fontFamily: "monospace" }}>
            {new Date(s.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            {" · "}
            {new Date(s.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Action buttons (on hover) */}
        {hov && (
          <div
            style={{ display: "flex", gap: 3, flexShrink: 0, alignItems: "center" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Export */}
            <IconBtn
              onClick={isCurrentSession ? onExportCurrent : onExport}
              title="Exportar como .txt"
              color={T.sub}
            >
              <Download size={12} />
            </IconBtn>

            {/* Import context (only for past sessions) */}
            {!isCurrentSession && (
              <IconBtn
                onClick={onImport}
                title={isGenerating ? "Gerando resumo..." : s.summary ? "Importar contexto" : "Gerar resumo e importar"}
                color={isGenerating ? T.accent : T.sub}
                disabled={isGenerating}
              >
                {isGenerating
                  ? <span style={{ fontFamily: "monospace", fontSize: 9, color: T.accent }}>···</span>
                  : <Cpu size={12} />
                }
              </IconBtn>
            )}

            {/* Delete */}
            {canDelete && !isCurrentSession && (
              <IconBtn onClick={onDelete} title="Excluir sessão" color={T.sub} hoverColor={T.red}>
                <X size={12} />
              </IconBtn>
            )}
          </div>
        )}
      </div>

      {/* Summary preview (if exists and not hovering) */}
      {s.summary && !hov && (
        <p style={{
          margin: "8px 0 0", fontSize: 10, color: T.faint,
          lineHeight: 1.5, fontStyle: "italic",
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const, overflow: "hidden",
        }}>
          {s.summary}
        </p>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, color, hoverColor, disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  color: string;
  hoverColor?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 24, height: 24, background: "none", border: `1px solid ${T.border}`,
        color, cursor: disabled ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "color 0.12s, border-color 0.12s",
      }}
      onMouseEnter={e => { if (!disabled && hoverColor) (e.currentTarget as HTMLButtonElement).style.color = hoverColor; }}
      onMouseLeave={e => { if (!disabled && hoverColor) (e.currentTarget as HTMLButtonElement).style.color = color; }}
    >
      {children}
    </button>
  );
}

/* ── Message group row ── */
function MessageGroupRow({ group, character, isNarrow, onDelete, onRetry, onEdit }: {
  group: MsgGroup; character: Character; isNarrow: boolean;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onEdit: (id: string, content: string) => void;
}) {
  const isUser = group.lead.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: isNarrow ? 12 : 20 }}>
      <div style={{
        width: 32, height: 32, background: isUser ? T.accent : T.surface, flexShrink: 0,
        border: `1px solid ${T.border}`, overflow: "hidden", borderRadius: "50%",
      }}>
        {!isUser && character.profilePicture && (
          <img src={character.profilePicture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {isUser && (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}>
            <User size={16} />
          </div>
        )}
      </div>

      <div style={{
        flex: 1, maxWidth: isNarrow ? "100%" : "85%",
        display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start",
      }}>
        <p style={{ fontSize: 9, fontWeight: 900, color: T.sub, marginBottom: 6, letterSpacing: "0.1em" }}>
          {isUser ? "PLAYER_USER" : character.name.toUpperCase()}
        </p>
        {[group.lead, ...group.rest].map(msg => (
          <MsgBubble
            key={msg.id}
            msg={msg}
            isUser={isUser}
            onDelete={onDelete}
            onRetry={onRetry}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Individual message bubble ── */
function MsgBubble({ msg, isUser, onDelete, onRetry, onEdit }: {
  msg: Message;
  isUser: boolean;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onEdit: (id: string, content: string) => void;
}) {
  const [hov, setHov] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = "0px";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
      textareaRef.current.focus();
    }
  }, [editing]);

  const commitEdit = () => {
    if (draft.trim()) onEdit(msg.id, draft.trim());
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(msg.content);
    setEditing(false);
  };

  return (
    <div
      style={{ marginBottom: 2, maxWidth: "100%" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {editing ? (
        <div style={{
          background: T.surface,
          borderLeft: `2px solid ${T.accent}`,
          padding: "12px 16px",
          minWidth: 280,
        }}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              e.currentTarget.style.height = "0px";
              e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") cancelEdit();
            }}
            style={{
              width: "100%", background: "transparent", border: "none",
              color: T.text, outline: "none", resize: "none", overflow: "hidden",
              fontFamily: "inherit", fontSize: 14, lineHeight: 1.7,
              boxSizing: "border-box", display: "block",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              onClick={commitEdit}
              style={{
                background: T.accent, border: "none", color: "#000",
                padding: "5px 12px", cursor: "pointer",
                fontFamily: "monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.06em",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Check size={10} /> SALVAR
            </button>
            <button
              onClick={cancelEdit}
              style={{
                background: "none", border: `1px solid ${T.border}`, color: T.sub,
                padding: "5px 12px", cursor: "pointer",
                fontFamily: "monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.06em",
              }}
            >
              CANCELAR
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          position: "relative",
          background: isUser ? "none" : hov ? "#1c1c1c" : T.surface,
          borderLeft: isUser ? "none" : `2px solid ${T.accent}`,
          borderRight: isUser ? `2px solid ${T.sub}` : "none",
          padding: "12px 16px",
          transition: "background 0.12s",
        }}>
          <div className="msg-prose">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>

          {/* Action bar — inline at bottom-right, only assistant messages */}
          {!isUser && hov && (
            <div style={{
              display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 8,
            }}>
              <MsgActionBtn onClick={() => { setDraft(msg.content); setEditing(true); }} title="Editar mensagem">
                <Pencil size={11} />
              </MsgActionBtn>
              <MsgActionBtn onClick={() => onRetry(msg.id)} title="Refazer resposta">
                <RotateCcw size={11} />
              </MsgActionBtn>
              <MsgActionBtn onClick={() => onDelete(msg.id)} title="Excluir mensagem" danger>
                <Trash2 size={11} />
              </MsgActionBtn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MsgActionBtn({ children, onClick, title, danger }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 26, padding: "0 8px", gap: 5,
        background: hov ? (danger ? "rgba(255,77,77,0.12)" : "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.03)",
        border: `1px solid ${hov ? (danger ? T.red : T.sub) : "#3a3a3a"}`,
        color: hov ? (danger ? T.red : T.text) : "#888",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
        transition: "color 0.1s, border-color 0.1s, background 0.1s",
      }}
    >
      {children}
    </button>
  );
}

/* ── Header button ── */
function HeaderBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        background: active ? T.accent : "none", border: `1px solid ${T.border}`,
        color: active ? "#000" : T.sub, width: 32, height: 32,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "0.15s",
      }}
    >
      {children}
    </button>
  );
}
