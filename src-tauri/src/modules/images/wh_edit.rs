use base64::{Engine as _, engine::general_purpose};
use crc::{Crc, CRC_32_ISO_HDLC};
use std::io::Read;
use flate2::read::ZlibDecoder;

const PNG_CRC: Crc<u32> = Crc::<u32>::new(&CRC_32_ISO_HDLC);

#[derive(serde::Serialize)]
pub struct StegoResult {
    pub b64_data: String,
    pub original_w: u32,
    pub original_h: u32,
    pub physical_h: u32,
    pub format: String,
}

#[tauri::command]
pub async fn process_stego_edit(
    mut data: Vec<u8>,
    target_w: u32,
    target_h: u32,
    mode: String,
) -> Result<StegoResult, String> {
    let mut original_w = 0;
    let mut original_h = 0;
    let mut physical_h = 0;
    let mut format = "UNKNOWN".to_string();
    let mut mime_type = "image/png";

    // --- PNG 检测与处理 ---
    if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        format = "PNG".to_string();
        mime_type = "image/png";
        original_w = u32::from_be_bytes(data[16..20].try_into().unwrap());
        original_h = u32::from_be_bytes(data[20..24].try_into().unwrap());

        // PNG 物理高度计算 (IDAT 反推)
        let mut idat_data = Vec::new();
        let mut pos = 8;
        while pos + 8 < data.len() {
            let chunk_len = u32::from_be_bytes(data[pos..pos+4].try_into().unwrap()) as usize;
            let chunk_type = &data[pos+4..pos+8];
            if chunk_type == b"IDAT" {
                idat_data.extend_from_slice(&data[pos+8..pos+8+chunk_len]);
            }
            if chunk_type == b"IEND" { break; }
            pos += chunk_len + 12;
        }
        let mut decoder = ZlibDecoder::new(&idat_data[..]);
        let mut decoded = Vec::new();
        if decoder.read_to_end(&mut decoded).is_ok() {
            let row_size = 1 + (original_w * 4); // 默认 RGBA
            if row_size > 0 { physical_h = (decoded.len() as u32) / row_size; }
        }

        if mode == "EDIT" && target_w > 0 && target_h > 0 {
            data[16..20].copy_from_slice(&target_w.to_be_bytes());
            data[20..24].copy_from_slice(&target_h.to_be_bytes());
            let new_crc = PNG_CRC.checksum(&data[12..29]);
            data[29..33].copy_from_slice(&new_crc.to_be_bytes());
        }
    }
    // --- JPEG 检测与处理 ---
    else if data.starts_with(&[0xFF, 0xD8]) {
        format = "JPEG".to_string();
        mime_type = "image/jpeg";
        let mut pos = 2;
        while pos < data.len() - 9 {
            if data[pos] == 0xFF {
                let marker = data[pos + 1];
                // SOF0 - SOF15 (跳过 DHT, DAC 等)
                if (0xC0..=0xCF).contains(&marker) && marker != 0xC4 && marker != 0xC8 && marker != 0xCC {
                    // JPEG 格式: [标记 2b][长度 2b][精度 1b][高度 2b][宽度 2b]
                    original_h = u16::from_be_bytes([data[pos+5], data[pos+6]]) as u32;
                    original_w = u16::from_be_bytes([data[pos+7], data[pos+8]]) as u32;

                    if mode == "EDIT" && target_w > 0 && target_h > 0 {
                        data[pos+5..pos+7].copy_from_slice(&(target_h as u16).to_be_bytes());
                        data[pos+7..pos+9].copy_from_slice(&(target_w as u16).to_be_bytes());
                    }
                    break;
                }
                let len = u16::from_be_bytes([data[pos+2], data[pos+3]]) as usize;
                pos += len + 2;
            } else { pos += 1; }
        }
        physical_h = original_h; // JPEG 暂不支持通过压缩流反推高度
    }

    let b64 = general_purpose::STANDARD.encode(&data);
    Ok(StegoResult {
        b64_data: format!("data:{};base64,{}", mime_type, b64),
        original_w,
        original_h,
        physical_h: if physical_h > 0 { physical_h } else { original_h },
        format,
    })
}