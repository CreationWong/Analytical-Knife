use std::fs::File;
use std::io::{Read, BufReader};
use std::collections::HashMap;
use serde::Serialize;
use super::formats::{ImageParser, FormatDetail, FormatTemplate};
use super::formats::png::PngParser;
use super::formats::jpeg::JpegParser;
use super::formats::gif::GifParser;

#[derive(Serialize)]
pub struct AnalysisResult {
    file_size: u64,
    header_hex: String,
    exif_data: HashMap<String, String>,
    structure: Option<FormatDetail>,
    raw_preview: Vec<u8>,
}

#[tauri::command]
pub fn get_supported_templates() -> Vec<FormatTemplate> {
    vec![
        PngParser.get_template(),
        JpegParser.get_template(),
        GifParser.get_template(),
    ]
}

#[tauri::command]
pub fn analyze_image_header(file_path: String) -> Result<AnalysisResult, String> {
    // 基础文件读取
    let file = File::open(&file_path).map_err(|e| format!("无法读取文件: {}", e))?;
    let file_size = file.metadata().map_err(|e| e.to_string())?.len();

    // 读取魔数 (Magic Number)
    let mut reader = BufReader::new(&file);
    let mut header_buffer = [0u8; 16];
    if let Err(_) = reader.read(&mut header_buffer) {
        // 如果读取失败，至少有一个空的 buffer，不强制报错，继续流程
    }

    // EXIF 解析
    let mut exif_data = HashMap::new();

    // 尝试重新打开文件用于 EXIF 读取
    if let Ok(file_exif) = File::open(&file_path) {
        let mut reader_exif = BufReader::new(file_exif);
        let exif_reader = exif::Reader::new();

        // read_from_container 返回 Result<Exif, Error>
        if let Ok(exif_obj) = exif_reader.read_from_container(&mut reader_exif) {
            for f in exif_obj.fields() {
                // with_unit 是 Exif 库的方法，需要引用 exif_obj
                exif_data.insert(
                    f.tag.to_string(),
                    f.display_value().with_unit(&exif_obj).to_string()
                );
            }
        }
    }

    // 结构模板解析
    let png_parser = PngParser;
    let jpeg_parser = JpegParser;
    let gif_parser = GifParser;

    // 逻辑判定：根据 Header 决定使用哪个解析器
    let structure = if png_parser.can_parse(&header_buffer) {
        png_parser.parse(&file_path).ok()
    } else if jpeg_parser.can_parse(&header_buffer) {
        jpeg_parser.parse(&file_path).ok()
    } else if gif_parser.can_parse(&header_buffer) {
        gif_parser.parse(&file_path).ok()
    }
    else {
        None
    };

    let mut file_raw = File::open(&file_path).map_err(|e| e.to_string())?;
    let mut raw_preview = Vec::new();
    // file_raw.take(8192).read_to_end(&mut raw_preview).ok();
    file_raw.read_to_end(&mut raw_preview).ok();

    Ok(AnalysisResult {
        file_size,
        exif_data,
        structure,
        raw_preview,
        header_hex: "".into(),
    })
}