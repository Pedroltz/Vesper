export interface Character {
  id: string;
  name: string;
  description: string; // Markdown personality/appearance
  profilePicture?: string; // Base64 or local path
  wallpaper?: string; // Base64 or local path
  systemPrompt: string; // Instructions for the LLM
}

export interface Settings {
  openAIKey?: string;
  deepSeekKey?: string;
  selectedModel: "gpt-4o" | "gpt-3.5-turbo" | "deepseek-chat";
}

export interface Message {
  id: string;
  characterId: string;
  role: "user" | "assistant" | "system" | "director";
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  characterId: string;
  title: string;
  createdAt: number;
  summary?: string;         // AI-generated summary of this session
  importedContext?: string; // Summary imported from another session
  scenario?: string;        // Initial scenario/context set at session start
}
