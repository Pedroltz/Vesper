# Vesper

Vesper is a specialized local desktop environment for immersive roleplay experiences powered by large language models. Designed with a focus on editorial aesthetics and technical performance, it provides a high-fidelity interface for character management and complex narrative interactions.

## Technical Core

The application is built on the Tauri framework, utilizing Rust for system operations and React for the user interface. This architecture ensures low resource overhead and native platform performance across Windows, Linux, and macOS.

### Key Features

- **Dossier Management**: Specialized character organization using an index-based filing system.
- **Visual Synthesis**: Dual-layer visual representation combining profile portraiture with environmental context.
- **Noir Interface**: High-contrast, tech-brutalist design optimized for focused narrative immersion.
- **LLM Integration**: Direct support for OpenAI and DeepSeek APIs with granular model selection.
- **Security**: Local data persistence and secure handling of API credentials.

## Setup and Installation

### Prerequisites

- Node.js (Latest LTS)
- Rust and Cargo
- Tauri CLI

### Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the application in development mode:
   ```bash
   npm run tauri dev
   ```

### Production Build

To generate a native executable for your current platform:
```bash
npm run tauri build
```

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS.
- **Backend**: Rust, Tauri v2.
- **Styling**: Editorial Noir design system with custom window decorations.
