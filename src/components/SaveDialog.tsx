import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, HardDrive, Monitor, BookOpen } from "lucide-react";

const T = {
  bg:      "#0a0a0a",
  surface: "#111",
  input:   "#161616",
  border:  "#2a2a2a",
  accent:  "#d1ff26",
  text:    "#e0e0e0",
  sub:     "#555",
  faint:   "#333",
  red:     "#ff4d4d",
} as const;

interface SpecialDirs {
  downloads: string | null;
  desktop: string | null;
  documents: string | null;
}

type Preset = "downloads" | "desktop" | "documents" | null;

interface SaveDialogProps {
  defaultFilename: string;
  onSave: (dir: string, filename: string) => Promise<void>;
  onClose: () => void;
}

export default function SaveDialog({ defaultFilename, onSave, onClose }: SaveDialogProps) {
  const [dirs, setDirs] = useState<SpecialDirs>({ downloads: null, desktop: null, documents: null });
  const [preset, setPreset] = useState<Preset>("downloads");
  const [customPath, setCustomPath] = useState("");
  const [filename, setFilename] = useState(defaultFilename);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const filenameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    invoke<SpecialDirs>("get_special_dirs").then(d => {
      setDirs(d);
      const first = d.downloads ?? d.desktop ?? d.documents ?? "";
      setCustomPath(first);
    }).catch(() => {
      setCustomPath("");
    });

    // Focus filename on open
    setTimeout(() => filenameRef.current?.focus(), 80);
  }, []);

  const resolvedDir = preset ? (dirs[preset] ?? "") : customPath;
  const previewPath = resolvedDir
    ? `${resolvedDir.replace(/[/\\]$/, "")}${sep()}${filename.trim() || "arquivo.txt"}`
    : "";

  function sep() {
    return customPath.includes("/") ? "/" : "\\";
  }

  const handlePreset = (p: Preset, path: string | null) => {
    setPreset(p);
    if (path) setCustomPath(path);
    setError("");
  };

  const handleCustomPathChange = (val: string) => {
    setCustomPath(val);
    setPreset(null);
    setError("");
  };

  const handleSave = async () => {
    const dir = resolvedDir.trim();
    const name = filename.trim();
    if (!dir) { setError("Escolha um diretório."); return; }
    if (!name) { setError("Informe o nome do arquivo."); return; }

    setSaving(true);
    setError("");
    try {
      await onSave(dir, name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const presets: { key: Preset; label: string; icon: React.ReactNode }[] = [
    { key: "downloads", label: "DOWNLOADS", icon: <HardDrive size={15} /> },
    { key: "desktop",   label: "DESKTOP",   icon: <Monitor size={15} /> },
    { key: "documents", label: "DOCUMENTOS", icon: <BookOpen size={15} /> },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.92)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 500, background: T.bg,
        border: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
      }}>

        {/* ── Title bar ── */}
        <div style={{
          height: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", borderBottom: `1px solid ${T.border}`,
          background: T.surface,
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: T.accent, letterSpacing: "0.12em", fontWeight: 900 }}>
            // EXPORT_FILE
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", display: "flex", padding: 4 }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = T.text}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = T.sub}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Location presets */}
          <div>
            <p style={{ fontFamily: "monospace", fontSize: 9, color: T.sub, letterSpacing: "0.12em", margin: "0 0 10px" }}>
              LOCALIZAÇÃO
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {presets.map(p => {
                const available = dirs[p.key!] != null;
                const active = preset === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => handlePreset(p.key, dirs[p.key!])}
                    disabled={!available}
                    style={{
                      flex: 1, padding: "10px 6px",
                      background: active ? "rgba(209,255,38,0.06)" : "none",
                      border: `1px solid ${active ? T.accent : T.border}`,
                      color: active ? T.accent : available ? T.sub : T.faint,
                      cursor: available ? "pointer" : "default",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      fontFamily: "monospace", fontSize: 8, fontWeight: 900, letterSpacing: "0.06em",
                      transition: "border-color 0.12s, color 0.12s, background 0.12s",
                    }}
                    onMouseEnter={e => { if (available && !active) (e.currentTarget as HTMLButtonElement).style.borderColor = T.sub; }}
                    onMouseLeave={e => { if (available && !active) (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; }}
                  >
                    {p.icon}
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Manual path */}
            <input
              value={customPath}
              onChange={e => handleCustomPathChange(e.target.value)}
              onFocus={() => { setPreset(null); setError(""); }}
              placeholder="C:\caminho\personalizado"
              style={{
                width: "100%", background: T.input,
                border: `1px solid ${preset === null ? T.accent : T.border}`,
                padding: "10px 12px", color: T.text, outline: "none",
                fontSize: 12, fontFamily: "monospace", boxSizing: "border-box",
                transition: "border-color 0.12s",
              }}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: T.border }} />

          {/* Filename */}
          <div>
            <p style={{ fontFamily: "monospace", fontSize: 9, color: T.sub, letterSpacing: "0.12em", margin: "0 0 10px" }}>
              NOME_DO_ARQUIVO
            </p>
            <input
              ref={filenameRef}
              value={filename}
              onChange={e => { setFilename(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
              style={{
                width: "100%", background: T.input,
                border: `1px solid ${T.border}`,
                padding: "10px 12px", color: T.text, outline: "none",
                fontSize: 12, fontFamily: "monospace", boxSizing: "border-box",
              }}
              onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = T.accent}
              onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = T.border}
            />
          </div>

          {/* Path preview */}
          {previewPath && (
            <div style={{ background: T.surface, padding: "8px 12px", borderLeft: `2px solid ${T.faint}` }}>
              <p style={{ fontFamily: "monospace", fontSize: 10, color: T.sub, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: T.faint }}>{">"} </span>{previewPath}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontFamily: "monospace", fontSize: 10, color: T.red, margin: 0 }}>
              ERR: {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: "flex", gap: 10, padding: "0 28px 28px",
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "13px 0",
              background: "none", border: `1px solid ${T.border}`,
              color: T.sub, cursor: "pointer",
              fontFamily: "monospace", fontSize: 10, fontWeight: 900, letterSpacing: "0.06em",
              transition: "border-color 0.12s, color 0.12s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.sub; (e.currentTarget as HTMLButtonElement).style.color = T.text; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.color = T.sub; }}
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: "13px 0",
              background: saving ? T.faint : T.accent,
              border: "none", color: "#000",
              cursor: saving ? "default" : "pointer",
              fontFamily: "monospace", fontSize: 10, fontWeight: 900, letterSpacing: "0.06em",
              transition: "background 0.12s",
            }}
          >
            {saving ? "SALVANDO..." : "SALVAR_ARQUIVO →"}
          </button>
        </div>
      </div>
    </div>
  );
}
