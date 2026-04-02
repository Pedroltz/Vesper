import { useState } from "react";
import { Settings } from "../types";
import { Eye, EyeOff, Check, Cpu, Key, Info } from "lucide-react";

/* ── Design tokens — Editorial Noir ── */
const T = {
  bg:       "#0a0a0a",
  surface:  "#121212",
  border:   "#222",
  accent:   "#d1ff26",
  text:     "#e0e0e0",
  sub:      "#666",
} as const;

interface ConfigProps {
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
}

type Tab = "config" | "about";

export default function Config({ settings, onSaveSettings }: ConfigProps) {
  const [tab, setTab] = useState<Tab>("config");
  const [openAIKey, setOpenAIKey] = useState(settings.openAIKey ?? "");
  const [deepSeekKey, setDeepSeekKey] = useState(settings.deepSeekKey ?? "");
  const [model, setModel] = useState(settings.selectedModel);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showDeepSeek, setShowDeepSeek] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({ openAIKey, deepSeekKey, selectedModel: model });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: T.bg, padding: "80px 60px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }} className="slide-up">

        {/* Header */}
        <header style={{ marginBottom: 48, display: "flex", alignItems: "flex-end", gap: 20 }}>
          <h1 style={{ fontSize: "4rem", fontWeight: 900, color: "#fff", lineHeight: 0.8, letterSpacing: "-0.04em", margin: 0 }}>
            CONFIG
          </h1>
          <div style={{ height: 1, flex: 1, background: T.border, marginBottom: 8 }} />
          <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 10, color: T.sub }}>
            <p>VESPER_SYSTEM_CORE</p>
            <p>ACCESS_LEVEL: ADMIN</p>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 48, borderBottom: `1px solid ${T.border}` }}>
          {([
            { id: "config", label: "SISTEMA", icon: <Cpu size={11} /> },
            { id: "about",  label: "SOBRE",   icon: <Info size={11} /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? T.accent : "transparent"}`,
                color: tab === t.id ? T.accent : T.sub, padding: "10px 24px", cursor: "pointer",
                fontFamily: "monospace", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em",
                display: "flex", alignItems: "center", gap: 7, marginBottom: -1, transition: "color 0.15s",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Config */}
        {tab === "config" && (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            <section>
              <SectionLabel icon={<Key size={14} />}>ACCESS_KEYS</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <KeyInput
                  label="OPENAI_API_KEY"
                  value={openAIKey}
                  show={showOpenAI}
                  onChange={setOpenAIKey}
                  onToggle={() => setShowOpenAI(!showOpenAI)}
                />
                <KeyInput
                  label="DEEPSEEK_API_KEY"
                  value={deepSeekKey}
                  show={showDeepSeek}
                  onChange={setDeepSeekKey}
                  onToggle={() => setShowDeepSeek(!showDeepSeek)}
                />
              </div>
            </section>

            <section>
              <SectionLabel icon={<Cpu size={14} />}>PROCESSOR_MODEL</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {MODELS.map(m => (
                  <div
                    key={m.id}
                    onClick={() => setModel(m.id as any)}
                    style={{
                      padding: 16, border: `1px solid ${model === m.id ? T.accent : T.border}`,
                      background: model === m.id ? "rgba(209, 255, 38, 0.05)" : T.surface,
                      cursor: "pointer", transition: "0.2s", position: "relative",
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 900, color: model === m.id ? T.accent : "#fff", marginBottom: 4 }}>{m.name}</p>
                    <p style={{ fontSize: 10, color: T.sub, lineHeight: 1.4 }}>{m.desc}</p>
                    {model === m.id && <div style={{ position: "absolute", top: 0, right: 0, width: 4, height: 4, background: T.accent }} />}
                  </div>
                ))}
              </div>
            </section>

            <button
              type="submit"
              style={{
                width: "100%", height: 54, background: saved ? "none" : T.accent,
                border: `1px solid ${saved ? "#3ba55d" : T.accent}`,
                color: saved ? "#3ba55d" : "#000",
                fontWeight: 900, fontSize: 12, letterSpacing: "0.2em",
                cursor: "pointer", transition: "0.3s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              {saved ? <><Check size={16} /> SYSTEM_UPDATED</> : "COMMIT_CONFIG_CHANGES"}
            </button>
          </form>
        )}

        {/* Tab: About */}
        {tab === "about" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* App identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{
                width: 64, height: 64, background: "#000",
                border: `1px solid ${T.accent}`, display: "flex",
                alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 32, color: T.accent,
                boxShadow: `0 0 20px rgba(209,255,38,0.15)`,
              }}>V</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>Vesper</h2>
                <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 10, color: T.sub }}>v0.2.1 — NOIR_ROLEPLAY_ENGINE</p>
              </div>
            </div>

            <div style={{ height: 1, background: T.border }} />

            {/* Info rows */}
            {[
              { label: "AUTHOR",    value: "Pedroltz" },
              { label: "VERSION",   value: "0.2.1" },
              { label: "RUNTIME",   value: "Tauri 2 + React 19" },
              { label: "LANGUAGE",  value: "TypeScript + Rust" },
              { label: "RENDERER",  value: "WebView2 (Chromium)" },
              { label: "STORAGE",   value: "localStorage — WebView2 Profile" },
              { label: "LICENSE",   value: "Private" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${T.border}`, paddingBottom: 14 }}>
                <p style={{ margin: 0, fontFamily: "monospace", fontSize: 9, color: T.sub, letterSpacing: "0.12em" }}>{row.label}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{row.value}</p>
              </div>
            ))}

            <p style={{ margin: 0, fontFamily: "monospace", fontSize: 9, color: "#333", letterSpacing: "0.08em", textAlign: "center", paddingTop: 8 }}>
              // VESPER_OS_CORE — ALL RIGHTS RESERVED
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children, icon }: { children: React.ReactNode, icon: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{ color: T.accent }}>{icon}</div>
      <p style={{ fontSize: 10, fontWeight: 900, color: T.sub, letterSpacing: "0.15em" }}>{children}</p>
    </div>
  );
}

function KeyInput({ label, value, show, onChange, onToggle }: any) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "12px 16px" }}>
      <p style={{ fontSize: 9, fontWeight: 900, color: T.sub, marginBottom: 8 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input 
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="AUTH_TOKEN_REQUIRED"
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontFamily: "monospace", fontSize: 13 }}
        />
        <button type="button" onClick={onToggle} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer" }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

const MODELS = [
  { id: "gpt-4o", name: "GPT_4O", desc: "Highest intelligence. Experimental logic." },
  { id: "gpt-3.5-turbo", name: "GPT_3.5_T", desc: "Fast processing. Low latency." },
  { id: "deepseek-chat", name: "DEEPSEEK_V3", desc: "Roleplay optimized core." },
];
