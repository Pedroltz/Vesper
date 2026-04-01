import { useState, useEffect } from "react";
import { Settings, Character, Session } from "./types";
import Chat from "./views/Chat";
import Config from "./views/Config";
import CharacterModal from "./components/CharacterModal";
import { Settings as SettingsIcon, Plus, LayoutGrid, X, Minus, Square, Database, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

/* ── IndexedDB Engine ── */
const DB_NAME = "VesperDB";
const STORE_NAME = "characters";

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveCharsToDB = async (chars: Character[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  // Clear and rewrite all for simplicity, or handle individual updates
  await new Promise((resolve) => {
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      chars.forEach(c => store.add(c));
      resolve(true);
    };
  });
};

const getCharsFromDB = async (): Promise<Character[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
};

/* ── Design tokens ── */
export const T = {
  bg:       "#0a0a0a",
  panel:    "#0f0f0f",
  surface:  "#1a1a1a",
  border:   "#2a2a2a",
  accent:   "#d1ff26",
  text:     "#e0e0e0",
  sub:      "#666",
  faint:    "#333",
  red:      "#ff4d4d",
} as const;

type View = "gallery" | "chat" | "settings";
type ModalState = { char: Partial<Character>; isEditing: boolean } | null;
type ConfirmState = { id: string; name: string } | null;

export default function App() {
  const [view, setView] = useState<View>("gallery");
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [settings, setSettings] = useState<Settings>({ selectedModel: "gpt-4o" });
  const [modal, setModal] = useState<ModalState>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmState>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [platform, setPlatform] = useState<string>("windows");

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 1000);
    handleResize();
    window.addEventListener("resize", handleResize);
    
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setPlatform("macos");
    else if (ua.includes("linux")) setPlatform("linux");
    else setPlatform("windows");

    // Load initial data
    const load = async () => {
      const storedChars = await getCharsFromDB();
      setCharacters(storedChars);
      const s = localStorage.getItem("vesper-settings");
      if (s) setSettings(JSON.parse(s));
    };
    load();
    
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const persistChars = async (chars: Character[]) => {
    setCharacters(chars);
    await saveCharsToDB(chars);
  };

  const openCreate = () =>
    setModal({ char: { id: crypto.randomUUID(), name: "", description: "", systemPrompt: "" }, isEditing: false });
  
  const openEdit = (char: Character) =>
    setModal({ char: { ...char }, isEditing: true });

  const handleSaveChar = (char: Partial<Character>) => {
    if (!char.name?.trim()) return;
    const finalChar = { ...char, id: char.id || crypto.randomUUID() } as Character;
    const updated = [...characters.filter(c => c.id !== finalChar.id), finalChar];
    persistChars(updated);
    if (selectedChar?.id === finalChar.id) setSelectedChar(finalChar);
    setModal(null);
  };

  const requestDelete = (char: Character) => setConfirmDelete({ id: char.id, name: char.name });

  const executeDelete = () => {
    if (!confirmDelete) return;
    const updated = characters.filter(c => c.id !== confirmDelete.id);
    persistChars(updated);
    if (selectedChar?.id === confirmDelete.id) {
      setSelectedChar(null);
      setView("gallery");
    }
    setConfirmDelete(null);
    setModal(null);
  };

  const loadOrCreateSessions = (char: Character): { loaded: Session[]; active: Session } => {
    const raw = localStorage.getItem(`vesper-sessions-${char.id}`);
    let loaded: Session[] = raw ? JSON.parse(raw) : [];
    if (loaded.length === 0) {
      const first: Session = { id: crypto.randomUUID(), characterId: char.id, title: "Sessão 1", createdAt: Date.now() };
      loaded = [first];
      localStorage.setItem(`vesper-sessions-${char.id}`, JSON.stringify(loaded));
    }
    return { loaded, active: loaded[loaded.length - 1] };
  };

  const selectChar = (char: Character) => {
    const { loaded, active } = loadOrCreateSessions(char);
    setSessions(loaded);
    setSelectedChar(char);
    setSelectedSession(active);
    setView("chat");
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text,
      fontFamily: "'Inter', sans-serif", letterSpacing: "-0.01em", overflow: "hidden"
    }}>
      <TitleBar platform={platform} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <aside style={{ width: 72, background: T.panel, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0", zIndex: 100, position: "relative" }}>
          <div style={{ marginBottom: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 36, height: 36, background: "#000", border: `1px solid ${T.accent}`, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, borderRadius: 2, boxShadow: `0 0 10px rgba(209, 255, 38, 0.2)` }}>V</div>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.accent, boxShadow: `0 0 8px ${T.accent}` }} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, zIndex: 2 }}>
            <SidebarIcon icon={<LayoutGrid size={20} />} active={view === "gallery"} onClick={() => setView("gallery")} label="INDEX" />
            <SidebarIcon icon={<Plus size={20} />} active={false} onClick={openCreate} label="NEW" />
            <SidebarIcon icon={<SettingsIcon size={20} />} active={view === "settings"} onClick={() => setView("settings")} label="CONF" />
          </div>
          <div style={{ padding: "20px 0", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 14, width: "100%", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
            <Database size={12} color={T.faint} />
            {characters.slice(0, 5).map(c => (
              <div key={c.id} onClick={() => selectChar(c)} title={c.name} style={{ width: 34, height: 34, overflow: "hidden", cursor: "pointer", border: `1px solid ${selectedChar?.id === c.id ? T.accent : T.border}`, padding: 2, background: "#000", position: "relative", transition: "0.2s" }} className="hover:scale-110">
                <div style={{ width: "100%", height: "100%", background: "#111", overflow: "hidden", borderRadius: "50%" }}>
                  {c.profilePicture ? <img src={c.profilePicture} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: selectedChar?.id === c.id ? 1 : 0.5 }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: T.sub }}>{c.name[0]}</div>}
                </div>
                {selectedChar?.id === c.id && <div style={{ position: "absolute", bottom: 0, right: 0, width: 6, height: 6, background: T.accent, borderRadius: "50%" }} />}
              </div>
            ))}
          </div>
        </aside>
        <main style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {view === "settings" ? (
            <Config settings={settings} onSaveSettings={s => { setSettings(s); localStorage.setItem("vesper-settings", JSON.stringify(s)); }} />
          ) : view === "chat" && selectedChar && selectedSession ? (
            <Chat character={selectedChar} settings={settings} onEdit={() => openEdit(selectedChar)} session={selectedSession} sessions={sessions} onNewSession={() => {}} onSelectSession={s => setSelectedSession(s)} onDeleteSession={() => {}} onUpdateSession={() => {}} />
          ) : (
            <GalleryView characters={characters} onSelect={selectChar} onOpenCreate={openCreate} onEdit={openEdit} onDelete={requestDelete} isNarrow={isNarrow} />
          )}
        </main>
      </div>
      {modal && <CharacterModal initialChar={modal.char} isEditing={modal.isEditing} onSave={handleSaveChar} onDelete={modal.isEditing ? () => requestDelete(modal.char as Character) : undefined} onClose={() => setModal(null)} />}
      {confirmDelete && <ConfirmModal name={confirmDelete.name} onCancel={() => setConfirmDelete(null)} onConfirm={executeDelete} />}
    </div>
  );
}

function TitleBar({ platform }: { platform: string }) {
  const isMac = platform === "macos";
  return (
    <div style={{ height: 32, background: "#000", display: "flex", flexDirection: isMac ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}`, userSelect: "none", position: "relative", zIndex: 1000 }}>
      <div data-tauri-drag-region style={{ position: "absolute", inset: 0, zIndex: -1 }} />
      <div style={{ padding: isMac ? "0 12px 0 0" : "0 0 0 12px", display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
        <div style={{ width: 6, height: 6, background: T.accent }} />
        <span style={{ fontSize: 10, fontWeight: 900, color: T.sub, letterSpacing: "0.1em", fontFamily: "monospace" }}>VESPER_OS_CORE</span>
      </div>
      <div style={{ display: "flex", height: "100%", flexDirection: isMac ? "row-reverse" : "row" }}>
        <WindowBtn onClick={() => appWindow.minimize()}><Minus size={14} /></WindowBtn>
        <WindowBtn onClick={() => appWindow.toggleMaximize()}><Square size={12} /></WindowBtn>
        <WindowBtn onClick={() => appWindow.close()} hoverBg={T.red}><X size={14} /></WindowBtn>
      </div>
    </div>
  );
}

function WindowBtn({ children, onClick, hoverBg }: any) {
  const [hov, setHov] = useState(false);
  return <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick} style={{ width: 44, height: "100%", background: hov ? (hoverBg || T.surface) : "none", border: "none", color: hov ? "#fff" : T.sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" }}>{children}</button>;
}

function SidebarIcon({ icon, active, onClick, label }: any) {
  return <button onClick={onClick} style={{ width: 44, height: 44, borderRadius: 2, border: active ? `1px solid ${T.accent}` : "1px solid transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: active ? "rgba(209, 255, 38, 0.05)" : "none", color: active ? T.accent : T.sub, transition: "0.2s", gap: 2, position: "relative" }}>{icon}<span style={{ fontSize: 7, fontWeight: 900, fontFamily: "monospace" }}>{label}</span></button>;
}

function ConfirmModal({ name, onCancel, onConfirm }: { name: string, onCancel: () => void, onConfirm: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.95)", backdropFilter: "blur(8px)" }} onClick={onCancel} />
      <div className="slide-up" style={{ position: "relative", width: "100%", maxWidth: 400, background: "#000", border: `1px solid ${T.red}`, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <AlertTriangle size={48} color={T.red} style={{ marginBottom: 20 }} />
        <h2 style={{ fontSize: 14, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>PERMANENT_DELETE_WARNING</h2>
        <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, marginBottom: 32 }}>Você está prestes a excluir permanentemente os dados de <span style={{ color: "#fff", fontWeight: 700 }}>{name.toUpperCase()}</span>. Esta ação não pode ser desfeita.</p>
        <div style={{ display: "flex", width: "100%", gap: 12 }}><button onClick={onCancel} style={{ flex: 1, background: "none", border: `1px solid ${T.sub}`, color: T.sub, padding: "12px 0", cursor: "pointer", fontSize: 11, fontWeight: 900 }}>ABORT_ACTION</button><button onClick={onConfirm} style={{ flex: 1, background: T.red, border: "none", color: "#fff", padding: "12px 0", cursor: "pointer", fontSize: 11, fontWeight: 900 }}>CONFIRM_ERASE</button></div>
      </div>
    </div>
  );
}

function GalleryView({ characters, onSelect, onOpenCreate, onEdit, onDelete, isNarrow }: any) {
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: isNarrow ? "40px 24px" : "80px 5vw" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: isNarrow ? 40 : 80 }}>
           <h1 className="text-huge" style={{ color: "#fff", fontSize: isNarrow ? "3rem" : "5rem" }}>INDEX</h1>
           <div style={{ height: 1, flex: 1, background: T.border, marginBottom: isNarrow ? 8 : 12 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "repeat(auto-fill, minmax(280px, 1fr))" : "repeat(auto-fill, minmax(320px, 1fr))", gap: isNarrow ? "32px 24px" : "60px 40px" }}>
          {characters.map((c: Character, i: number) => (
            <DossierCard key={c.id} char={c} index={(i + 1).toString().padStart(2, '0')} onClick={() => onSelect(c)} onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />
          ))}
          <div onClick={onOpenCreate} className="hover-glitch" style={{ height: 480, border: `1px dashed ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.faint }}>
            <Plus size={48} />
            <p style={{ marginTop: 12, fontWeight: 700, letterSpacing: "0.2em", fontSize: 9 }}>NEW_RECORD</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DossierCard({ char, index, onClick, onEdit, onDelete }: any) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ position: "relative", height: 480, cursor: "pointer", transition: "0.3s" }}>
      <div style={{ position: "absolute", top: -20, left: -5, fontSize: 100, fontWeight: 900, color: hov ? T.accent : T.faint, opacity: 0.1, zIndex: 0, transition: "0.3s" }}>{index}</div>
      <div style={{ position: "relative", width: "100%", height: "100%", background: T.surface, border: `1px solid ${hov ? T.accent : T.border}`, transition: "0.3s", overflow: "hidden", zIndex: 1 }}>
        <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 6, opacity: hov ? 1 : 0, transition: "0.2s", transform: hov ? "none" : "translateY(-10px)" }}>
          <button onClick={() => onEdit(char)} style={{ width: 28, height: 28, background: "#000", border: `1px solid ${T.border}`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Pencil size={12} /></button>
          <button onClick={() => onDelete(char)} style={{ width: 28, height: 28, background: "#000", border: `1px solid ${T.border}`, color: T.red, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={12} /></button>
        </div>
        {char.wallpaper ? <img src={char.wallpaper} style={{ width: "100%", height: "100%", objectFit: "cover", filter: hov ? "grayscale(0) brightness(0.6)" : "grayscale(1) brightness(0.3)", transition: "0.5s" }} /> : <div style={{ width: "100%", height: "100%", background: "#111" }} />}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, background: "linear-gradient(transparent, rgba(0,0,0,0.9))" }}>
          <p style={{ fontFamily: "monospace", fontSize: 9, color: T.accent, marginBottom: 2 }}>ID: {char.id.slice(0, 8)}</p>
          <h3 style={{ fontSize: 20, fontWeight: 900, color: "#fff", textTransform: "uppercase" }}>{char.name}</h3>
        </div>
        <div style={{ position: "absolute", top: "15%", left: "10%", width: "55%", height: "55%", background: "#000", border: `3px solid #fff`, transform: hov ? "rotate(-2deg) scale(1.05)" : "rotate(3deg) scale(1)", transition: "0.4s", overflow: "hidden", zIndex: 2 }}>
          {char.profilePicture ? <img src={char.profilePicture} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#333", fontSize: 32 }}>?</div>}
        </div>
      </div>
    </div>
  );
}
