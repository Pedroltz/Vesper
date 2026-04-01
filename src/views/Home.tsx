import { useState } from "react";
import { Character } from "../types";
import { Plus, User, Trash2, Pencil, X, Check, ImagePlus } from "lucide-react";

interface HomeProps {
  characters: Character[];
  onSelect: (char: Character) => void;
  onSaveCharacters: (chars: Character[]) => void;
}

const blankChar = (): Partial<Character> => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  systemPrompt: "",
});

export default function Home({ characters, onSelect, onSaveCharacters }: HomeProps) {
  const [modal, setModal] = useState<{ open: boolean; char: Partial<Character> }>({
    open: false,
    char: blankChar(),
  });
  const [activePreview, setActivePreview] = useState<"desc" | "prompt">("desc");

  const openCreate = () => setModal({ open: true, char: blankChar() });

  const openEdit = (char: Character, e: React.MouseEvent) => {
    e.stopPropagation();
    setModal({ open: true, char: { ...char } });
  };

  const closeModal = () => setModal(m => ({ ...m, open: false }));

  const handleSave = () => {
    const { char } = modal;
    if (!char.name?.trim()) return;
    const rest = characters.filter(c => c.id !== char.id);
    onSaveCharacters([...rest, char as Character]);
    closeModal();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Remover este personagem e todo o histórico de chat?")) {
      onSaveCharacters(characters.filter(c => c.id !== id));
    }
  };

  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "profilePicture" | "wallpaper"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () =>
      setModal(m => ({ ...m, char: { ...m.char, [field]: reader.result as string } }));
    reader.readAsDataURL(file);
  };

  const isEditing = characters.some(c => c.id === modal.char.id);

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#0d0d14" }}>
      <div className="max-w-5xl mx-auto px-8 py-10">

        {/* Header */}
        <header className="mb-10">
          <p style={{ color: "#3a3a60", fontSize: 11, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>
            Vesper
          </p>
          <div className="flex items-baseline justify-between">
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#e8e8f5", letterSpacing: "-0.02em" }}>
              Personagens
            </h1>
            {characters.length > 0 && (
              <span style={{ fontSize: 12, color: "#40406a" }}>
                {characters.length} criado{characters.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </header>

        {/* Grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>

          {/* New character card */}
          <button
            onClick={openCreate}
            className="group relative rounded-2xl overflow-hidden transition-all duration-200"
            style={{
              aspectRatio: "2/3",
              background: "transparent",
              border: "1.5px dashed #24243a",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,92,252,0.5)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,92,252,0.04)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#24243a";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ border: "1.5px solid #30305a", color: "#50507a" }}
              >
                <Plus size={18} />
              </div>
              <span style={{ fontSize: 11, color: "#40406a", fontWeight: 500, letterSpacing: "0.06em" }}>
                NOVO
              </span>
            </div>
          </button>

          {/* Character cards */}
          {characters.map((char) => (
            <CharCard
              key={char.id}
              char={char}
              onSelect={() => onSelect(char)}
              onEdit={(e) => openEdit(char, e)}
              onDelete={(e) => handleDelete(char.id, e)}
            />
          ))}
        </div>

        {characters.length === 0 && (
          <p className="text-center mt-16" style={{ color: "#30305a", fontSize: 13 }}>
            Crie seu primeiro personagem para começar.
          </p>
        )}
      </div>

      {/* ── Modal ── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(4,4,10,0.78)", backdropFilter: "blur(8px)" }}
            onClick={closeModal}
          />

          <div
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl pop-in"
            style={{ background: "#12121e", border: "1px solid #22223a" }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid #1c1c30" }}
            >
              <h2 style={{ fontWeight: 700, fontSize: 15, color: "#e0e0f0" }}>
                {isEditing ? "Editar Personagem" : "Novo Personagem"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: "#44446a" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#8888b0"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#44446a"}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body — two columns */}
            <div className="flex">
              {/* Left: preview */}
              <div
                className="w-44 shrink-0 flex flex-col overflow-hidden"
                style={{ borderRight: "1px solid #1c1c30" }}
              >
                {/* Wallpaper preview */}
                <div className="relative flex-1" style={{ minHeight: 160, background: "#0d0d18" }}>
                  {modal.char.wallpaper ? (
                    <img src={modal.char.wallpaper} className="w-full h-full object-cover absolute inset-0" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center absolute inset-0" style={{ color: "#28284a" }}>
                      <ImagePlus size={24} />
                    </div>
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, rgba(10,10,20,0.95) 0%, rgba(0,0,0,0.1) 60%)" }}
                  />

                  {/* Profile picture on top of wallpaper */}
                  <div className="absolute bottom-3 left-3">
                    <div
                      className="w-12 h-12 rounded-xl overflow-hidden"
                      style={{ border: "2px solid rgba(255,255,255,0.1)", background: "#1a1a28" }}
                    >
                      {modal.char.profilePicture ? (
                        <img src={modal.char.profilePicture} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: "#44446a" }}>
                          <User size={20} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview tabs */}
                <div style={{ padding: "10px 12px 4px" }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#c8c8e0", wordBreak: "break-word" }}>
                    {modal.char.name || <span style={{ color: "#30305a" }}>Nome</span>}
                  </p>
                </div>

                <div className="flex" style={{ borderTop: "1px solid #1c1c30", marginTop: 8 }}>
                  {(["desc", "prompt"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActivePreview(tab)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        color: activePreview === tab ? "#a78bfa" : "#404060",
                        background: activePreview === tab ? "rgba(124,92,252,0.1)" : "transparent",
                        textTransform: "uppercase",
                      }}
                    >
                      {tab === "desc" ? "Ficha" : "Prompt"}
                    </button>
                  ))}
                </div>
                <div style={{ padding: "8px 12px 12px", fontSize: 11, color: "#505070", lineHeight: 1.5, minHeight: 60, overflowY: "auto", maxHeight: 100 }}>
                  {activePreview === "desc"
                    ? (modal.char.description || <span style={{ color: "#28284a" }}>sem descrição</span>)
                    : (modal.char.systemPrompt || <span style={{ color: "#28284a" }}>sem prompt</span>)
                  }
                </div>
              </div>

              {/* Right: form */}
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: "72vh" }}>
                <div className="p-6 space-y-5">
                  {/* Name */}
                  <Field label="Nome">
                    <input
                      className="field-input"
                      placeholder="Nome do personagem"
                      value={modal.char.name ?? ""}
                      onChange={e => setModal(m => ({ ...m, char: { ...m.char, name: e.target.value } }))}
                      style={fieldStyle}
                    />
                  </Field>

                  {/* Images */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Foto de Perfil">
                      <label className="cursor-pointer" style={{ display: "block" }}>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "profilePicture")} />
                        <span style={{ ...fieldStyle, display: "flex", alignItems: "center", justifyContent: "center", height: 36, fontSize: 12, color: modal.char.profilePicture ? "#7c5cfc" : "#44446a", cursor: "pointer" }}>
                          {modal.char.profilePicture ? "✓ Definida" : "Escolher"}
                        </span>
                      </label>
                    </Field>
                    <Field label="Wallpaper">
                      <label className="cursor-pointer" style={{ display: "block" }}>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "wallpaper")} />
                        <span style={{ ...fieldStyle, display: "flex", alignItems: "center", justifyContent: "center", height: 36, fontSize: 12, color: modal.char.wallpaper ? "#7c5cfc" : "#44446a", cursor: "pointer" }}>
                          {modal.char.wallpaper ? "✓ Definido" : "Escolher"}
                        </span>
                      </label>
                    </Field>
                  </div>

                  {/* Description */}
                  <Field label="Personalidade & Aparência" hint="Markdown suportado">
                    <textarea
                      placeholder="Descreva a personalidade, aparência, histórico..."
                      value={modal.char.description ?? ""}
                      onChange={e => setModal(m => ({ ...m, char: { ...m.char, description: e.target.value } }))}
                      style={{ ...fieldStyle, height: 96, resize: "none" }}
                    />
                  </Field>

                  {/* System Prompt */}
                  <Field label="System Prompt" hint="invisível no chat — instrui a IA">
                    <textarea
                      placeholder="Você é um personagem chamado... Responda sempre em primeira pessoa..."
                      value={modal.char.systemPrompt ?? ""}
                      onChange={e => setModal(m => ({ ...m, char: { ...m.char, systemPrompt: e.target.value } }))}
                      style={{ ...fieldStyle, height: 72, resize: "none", fontFamily: "monospace", fontSize: 12 }}
                    />
                  </Field>
                </div>

                {/* Footer */}
                <div
                  className="flex items-center justify-end gap-3 px-6 py-4"
                  style={{ borderTop: "1px solid #1c1c30" }}
                >
                  <button
                    onClick={closeModal}
                    style={{ fontSize: 13, color: "#505075", padding: "6px 12px" }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#9090b8"}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#505075"}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!modal.char.name?.trim()}
                    className="flex items-center gap-1.5 rounded-lg transition-colors"
                    style={{
                      padding: "7px 18px",
                      fontSize: 13,
                      fontWeight: 600,
                      background: modal.char.name?.trim() ? "#7c3aed" : "#1e1e34",
                      color: modal.char.name?.trim() ? "#fff" : "#44446a",
                      cursor: modal.char.name?.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    <Check size={13} />
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function CharCard({ char, onSelect, onEdit, onDelete }: {
  char: Character;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer"
      style={{
        aspectRatio: "2/3",
        background: "#13131e",
        outline: hovered ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        transition: "outline 0.15s",
      }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wallpaper */}
      {char.wallpaper ? (
        <img
          src={char.wallpaper}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: hovered ? "scale(1.04)" : "scale(1)", transition: "transform 0.4s ease" }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #0d0d18 100%)" }}
        />
      )}

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(4,4,12,0.95) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)" }}
      />

      {/* Profile pic top-right */}
      <div
        className="absolute top-2.5 right-2.5 rounded-lg overflow-hidden"
        style={{ width: 28, height: 28, background: "#1a1a28", border: "1.5px solid rgba(255,255,255,0.12)" }}
      >
        {char.profilePicture ? (
          <img src={char.profilePicture} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: "#ffffff30" }}>
            <User size={12} />
          </div>
        )}
      </div>

      {/* Info bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3.5">
        <p style={{ fontWeight: 700, fontSize: 13, color: "#f0f0fa", lineHeight: 1.2, marginBottom: 3 }}>
          {char.name}
        </p>
        {char.description && (
          <p
            style={{
              fontSize: 10.5,
              color: "rgba(255,255,255,0.38)",
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {char.description.replace(/[#*_`[\]()]/g, "")}
          </p>
        )}
      </div>

      {/* Action buttons (hover) */}
      <div
        className="absolute top-2.5 left-2.5 flex gap-1.5"
        style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.15s" }}
      >
        <button
          onClick={onEdit}
          className="rounded-md flex items-center justify-center"
          style={{ width: 26, height: 26, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#fff"}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"}
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={onDelete}
          className="rounded-md flex items-center justify-center"
          style={{ width: 26, height: 26, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#f87171"}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#525275" }}>
          {label}
        </label>
        {hint && <span style={{ fontSize: 10, color: "#35354e" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "#0c0c18",
  border: "1px solid #20203a",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#dddde8",
  outline: "none",
};
