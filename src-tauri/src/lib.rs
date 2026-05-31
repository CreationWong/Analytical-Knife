// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod modules; // 声明 modules 目录为一个模块

use std::sync::Arc;
use tauri::Manager;

// 导入模块
use modules::crypto::big_rsa::solve_multi_layer_rsa;
use modules::crypto::caesar::{caesar_crack, caesar_transform};
use modules::crypto::common_modulus::{parse_biguint, recover_plaintext};
use modules::crypto::replacer::batch_replace;
use modules::crypto::word_freq::analyze_text_advanced;
use modules::encode_decode::vigenere::{crack_vigenere_auto, vigenere_cipher};
use modules::images::image_structure_analyzer::{analyze_image_header, get_supported_templates};
use modules::images::mirage_tank::generate_mirage_tank;
use modules::images::wh_edit::{process_stego_edit};
use modules::media::audio_heatmap::analyze_audio_heatmap;
use modules::media::ffmpeg::{check_ffmpeg, run_ffmpeg_stream, stop_ffmpeg_native, FfmpegProcess};
use modules::network::log_analyzer::{parse_log_content, read_and_parse_log};
use modules::plugins::registry::{
    generate_plugins_xml, get_plugin_environment, handle_plugin_uri_request,
    import_compiled_html_plugin, list_custom_plugins, load_plugin_entry_html,
    remove_custom_plugin, reset_third_party_tools, update_custom_plugin_metadata,
    PLUGIN_URI_SCHEME,
};

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
        Ok(s)
            if !s.is_empty()
                && s.chars()
                    .all(|c| c.is_ascii_control() || c.is_ascii_graphic()) =>
        {
            Ok(s)
        }
        _ => {
            let hex = plaintext_bytes
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<Vec<_>>()
                .join("");
            Ok(format!("[非文本数据] Hex: {}", hex))
        }
    }
}

#[tauri::command]
fn open_main_devtools(app: tauri::AppHandle) -> Result<(), String> {
    let webview = app
        .get_webview_window("main")
        .ok_or_else(|| "未找到主窗口".to_string())?;

    webview.open_devtools();

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol(PLUGIN_URI_SCHEME, |_ctx, request| {
            handle_plugin_uri_request(request)
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(FfmpegProcess(
            Arc::new(tokio::sync::Mutex::new(None))
        ))
        .invoke_handler(tauri::generate_handler![
            greet,
            analyze_text_advanced,
            common_modulus_attack,
            solve_multi_layer_rsa,
            batch_replace,
            caesar_transform,
            caesar_crack,
            vigenere_cipher,
            crack_vigenere_auto,
            generate_mirage_tank,
            analyze_image_header,
            get_supported_templates,
            parse_log_content,
            read_and_parse_log,
            check_ffmpeg,
            analyze_audio_heatmap,
            run_ffmpeg_stream,
            stop_ffmpeg_native,
            process_stego_edit,
            get_plugin_environment,
            list_custom_plugins,
            import_compiled_html_plugin,
            update_custom_plugin_metadata,
            remove_custom_plugin,
            generate_plugins_xml,
            reset_third_party_tools,
            load_plugin_entry_html,
            open_main_devtools
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
