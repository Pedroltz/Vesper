use tauri::Manager;
use serde::Serialize;

#[derive(Serialize)]
struct SpecialDirs {
    downloads: Option<String>,
    desktop: Option<String>,
    documents: Option<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
fn get_special_dirs(app: tauri::AppHandle) -> SpecialDirs {
    SpecialDirs {
        downloads: app.path().download_dir().ok().map(|p| p.to_string_lossy().to_string()),
        desktop:   app.path().desktop_dir().ok().map(|p| p.to_string_lossy().to_string()),
        documents: app.path().document_dir().ok().map(|p| p.to_string_lossy().to_string()),
    }
}

#[tauri::command]
fn save_text_file(dir: String, filename: String, content: String) -> Result<String, String> {
    let base = std::path::PathBuf::from(&dir);
    if !base.exists() {
        return Err(format!("Diretório não encontrado: {}", dir));
    }
    let safe: String = filename.chars().map(|c| if c.is_alphanumeric() || matches!(c, '.' | '_' | '-') { c } else { '_' }).collect();
    let filepath = base.join(&safe);
    std::fs::write(&filepath, content.as_bytes()).map_err(|e| format!("Erro ao salvar arquivo: {}", e))?;
    Ok(filepath.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_special_dirs, save_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
