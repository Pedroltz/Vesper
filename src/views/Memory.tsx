import { useState, useEffect, useRef } from "react";
import { Character, MemoryEntry } from "../types";
import { Pencil, Trash2, Check, Brain, ChevronLeft } from "lucide-react";

/* ── Design tokens — Editorial Noir ── */
const T = {
  bg:       "#0a0a0a",
  surface:  "#161616",
  border:   "#222",
  accent:   "#d1ff26",
  text:     "#e0e0e0",
  sub:      "#666",
  faint:    "#333",
  red:      "#ff4d4d",
} as const;

const MEM_BUDGET = 1500; // keep in sync with Chat.tsx (non-pinned chars injected per request)

interface Props {
  character: Character;
  onBack: () => void;
}

export default function Memory({ character, onBack }: Props) {
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`vesper-memory-${character.id}`);
      setMemory(raw ? JSON.parse(raw) : []);
    } catch { setMemory([]); }
  }, [character.id]);

  const persist = (next: MemoryEntry[]) => {
    setMemory(next);
    localStorage.setItem(`vesper-memory-${character.id}`, JSON.stringify(next));
  };
  const add = () => {
    const content = draft.trim();
    if (!content) return;
    persist([...memory, { id: crypto.randomUUID(), content, kind: "manual", pinned: true, createdAt: Date.now() }]);
    setDraft("");
  };
  const update = (id: string, content: string) => persist(memory.map(e => e.id === id ? { ...e, content } : e));
  const remove = (id: string) => persist(memory.filter(e => e.id !== id));
  const togglePin = (id: string) => persist(memory.map(e => e.id === id ? { ...e, pinned: !e.pinned } : e));

  const pinnedCount = memory.filter(e => e.pinned).length;
  const nonPinnedChars = memory.filter(e => !e.pinned).reduce((a, e) => a + e.content.length, 0);
  const overBudget = nonPinnedChars > MEM_BUDGET;
  // Pinned first, then most recent.
  const ordered = [...memory].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div style={{ height: "100%", overflowY: "auto", background: T.bg, padding: "80px 60px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }} className="slide-up">

        {/* Back */}
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.sub, cursor: "pointer", fontFamily: "monospace", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", marginBottom: 24, padding: 0 }}
        >
          <ChevronLeft size={14} /> VOLTAR_AO_INDEX
        </button>

        {/* Header */}
        <header style={{ marginBottom: 40, display: "flex", alignItems: "flex-end", gap: 20 }}>
          <h1 style={{ fontSize: "4rem", fontWeight: 900, color: "#fff", lineHeight: 0.8, letterSpacing: "-0.04em", margin: 0 }}>MEMÓRIA</h1>
          <div style={{ height: 1, flex: 1, background: T.border, marginBottom: 8 }} />
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: T.text }}>{character.name}</p>
            <p style={{ margin: "2px 0 0", fontFamily: "monospace", fontSize: 9, color: T.sub }}>PERSISTENT_MEMORY_BANK</p>
          </div>
        </header>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          <StatCard label="ENTRADAS" value={String(memory.length)} />
          <StatCard label="FIXADAS (★)" value={String(pinnedCount)} />
          <StatCard
            label="ORÇAMENTO_RECENTES"
            value={`${nonPinnedChars} / ${MEM_BUDGET}`}
            accent={overBudget ? T.red : undefined}
            hint={overBudget ? "acima do limite — as mais antigas não entram no prompt" : undefined}
          />
        </div>

        {/* Add */}
        <div style={{ marginBottom: 32, padding: 20, border: `1px solid ${T.border}`, background: T.surface }}>
          <p style={{ margin: "0 0 10px", fontFamily: "monospace", fontSize: 9, color: T.sub, letterSpacing: "0.1em" }}>NOVA_ENTRADA</p>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }}
            placeholder="Ex: o usuário se chama Marco; o personagem prometeu protegê-lo."
            rows={2}
            style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, color: T.text, outline: "none", resize: "none", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5, padding: "10px 12px", boxSizing: "border-box", display: "block", marginBottom: 10 }}
          />
          <button
            onClick={add}
            style={{ background: T.accent, border: "none", color: "#000", padding: "8px 20px", cursor: "pointer", fontFamily: "monospace", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em" }}
          >
            + ADICIONAR
          </button>
        </div>

        {/* List */}
        {ordered.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <Brain size={32} color={T.faint} style={{ marginBottom: 16 }} />
            <p style={{ fontFamily: "monospace", fontSize: 10, color: T.faint, letterSpacing: "0.12em", lineHeight: 2 }}>
              MEMÓRIA_VAZIA
              <br />
              O que você salvar aqui o personagem lembra em todas as sessões.
            </p>
          </div>
        ) : (
          <div style={{ border: `1px solid ${T.border}` }}>
            {ordered.map(e => (
              <MemoryItem key={e.id} entry={e} onUpdate={update} onDelete={remove} onTogglePin={togglePin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, hint }: { label: string; value: string; accent?: string; hint?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 150, padding: "14px 16px", border: `1px solid ${T.border}`, background: T.surface }}>
      <p style={{ margin: 0, fontFamily: "monospace", fontSize: 8, color: T.sub, letterSpacing: "0.1em" }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontFamily: "monospace", fontSize: 16, fontWeight: 900, color: accent || T.accent }}>{value}</p>
      {hint && <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 8, color: accent || T.faint, lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

/* ── Single memory entry ── */
function MemoryItem({ entry, onUpdate, onDelete, onTogglePin }: {
  entry: MemoryEntry;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [hov, setHov] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.style.height = "0px";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== entry.content) onUpdate(entry.id, next);
    setEditing(false);
  };
  const cancel = () => { setDraft(entry.content); setEditing(false); };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "14px 18px", borderBottom: `1px solid ${T.border}`,
        borderLeft: `2px solid ${entry.pinned ? T.accent : "transparent"}`,
        background: hov ? "rgba(255,255,255,0.02)" : "transparent",
      }}
    >
      {editing ? (
        <div>
          <textarea
            ref={ref}
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              e.currentTarget.style.height = "0px";
              e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
              if (e.key === "Escape") cancel();
            }}
            style={{ width: "100%", background: T.bg, border: `1px solid ${T.accent}`, color: T.text, outline: "none", resize: "none", overflow: "hidden", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5, padding: "8px 10px", boxSizing: "border-box", display: "block" }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={commit} style={{ background: T.accent, border: "none", color: "#000", padding: "5px 12px", cursor: "pointer", fontFamily: "monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={10} /> SALVAR
            </button>
            <button onClick={cancel} style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, padding: "5px 12px", cursor: "pointer", fontFamily: "monospace", fontSize: 9, fontWeight: 900, letterSpacing: "0.06em" }}>
              CANCELAR
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <button
            onClick={() => onTogglePin(entry.id)}
            title={entry.pinned ? "Fixada — sempre incluída. Clique para desafixar." : "Fixar (sempre incluir, ignora o limite)"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1, color: entry.pinned ? T.accent : T.faint, fontSize: 14, lineHeight: 1, flexShrink: 0 }}
          >
            {entry.pinned ? "★" : "☆"}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{entry.content}</p>
            <p style={{ margin: "6px 0 0", fontFamily: "monospace", fontSize: 8, color: T.faint, letterSpacing: "0.06em" }}>
              {entry.kind === "manual" ? "MANUAL" : "RESUMO_SESSÃO"}
              {" · "}
              {new Date(entry.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </p>
          </div>
          {hov && (
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <IconBtn onClick={() => { setDraft(entry.content); setEditing(true); }} title="Editar"><Pencil size={13} /></IconBtn>
              <IconBtn onClick={() => onDelete(entry.id)} title="Apagar" danger><Trash2 size={13} /></IconBtn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, background: "none", border: `1px solid ${hov ? (danger ? T.red : T.sub) : T.border}`,
        color: hov ? (danger ? T.red : T.text) : T.sub, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.12s, border-color 0.12s",
      }}
    >
      {children}
    </button>
  );
}
