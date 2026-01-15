// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod module; // 声明 module 目录为一个模块

use module::crypto::common_modulus::{parse_biguint, recover_plaintext};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
fn common_modulus_attack(
    n: String,
    e1: String,
    c1: String,
    e2: String,
    c2: String,
) -> Result<String, String> {
    let n = parse_biguint(&n)?;
    let e1 = parse_biguint(&e1)?;
    let c1 = parse_biguint(&c1)?;
    let e2 = parse_biguint(&e2)?;
    let c2 = parse_biguint(&c2)?;

    let plaintext_bytes = recover_plaintext(&n, &e1, &c1, &e2, &c2)?;

    match String::from_utf8(plaintext_bytes.clone()) {
        Ok(s) if !s.is_empty() && s.chars().all(|c| c.is_ascii_control() || c.is_ascii_graphic()) => Ok(s),
        _ => {
            let hex = plaintext_bytes.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join("");
            Ok(format!("[非文本数据] Hex: {}", hex))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            common_modulus_attack
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}