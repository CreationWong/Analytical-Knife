use super::{ChunkInfo, FormatDetail, FormatTemplate, ImageParser, MarkerDefinition};
use byteorder::{LittleEndian, ReadBytesExt};
use std::fs::File;
use std::io::{BufReader, Seek, SeekFrom};

pub struct GifParser;

impl ImageParser for GifParser {
    fn can_parse(&self, header: &[u8; 16]) -> bool {
        header.starts_with(b"GIF87a") || header.starts_with(b"GIF89a")
    }

    fn parse(&self, file_path: &str) -> Result<FormatDetail, String> {
        let file = File::open(file_path).map_err(|e| e.to_string())?;
        let mut reader = BufReader::new(file);
        let mut chunks = Vec::new();

        // 1. Header (6 bytes: GIF89a)
        chunks.push(ChunkInfo {
            name: "Header".into(),
            offset: 0,
            length: 6,
            total_size: 6,
            description: "GIF Signature (Version 89a)".into(),
            color: "#FAB005".into(),
        });

        // 2. Logical Screen Descriptor (7 bytes)
        reader.seek(SeekFrom::Start(6)).map_err(|e| e.to_string())?;
        let width = reader.read_u16::<LittleEndian>().map_err(|e| e.to_string())? as u32;
        let height = reader.read_u16::<LittleEndian>().map_err(|e| e.to_string())? as u32;
        let packed_field = reader.read_u8().map_err(|e| e.to_string())?;
        reader.seek(SeekFrom::Current(2)).ok(); // Skip BG color and Aspect Ratio

        chunks.push(ChunkInfo {
            name: "LSD".into(),
            offset: 6,
            length: 7,
            total_size: 7,
            description: format!("Logical Screen: {}x{}", width, height),
            color: "#FA5252".into(),
        });

        // 3. Global Color Table (GCT)
        let has_gct = (packed_field & 0x80) != 0;
        if has_gct {
            let gct_size_exponent = (packed_field & 0x07) + 1;
            let gct_entries = 1 << gct_size_exponent;
            let gct_bytes = 3 * gct_entries;

            chunks.push(ChunkInfo {
                name: "GCT".into(),
                offset: 13,
                length: gct_bytes as u32,
                total_size: gct_bytes as u32,
                description: format!("Global Color Table ({} colors)", gct_entries),
                color: "#BE4BDB".into(),
            });
            reader.seek(SeekFrom::Current(gct_bytes as i64)).ok();
        }

        // 4. 解析 Block 循环
        loop {
            let pos = reader.stream_position().unwrap();
            let introducer = match reader.read_u8() {
                Ok(b) => b,
                Err(_) => break,
            };

            match introducer {
                0x21 => { // Extension Block
                    let label = reader.read_u8().map_err(|e| e.to_string())?;
                    let block_size = reader.read_u8().map_err(|e| e.to_string())?;

                    let name = match label {
                        0xF9 => "GCE", // Graphic Control Extension
                        0xFE => "Comment",
                        0xFF => "App Ext",
                        _ => "Extension",
                    };

                    // 跳过数据 + Block Terminator (0x00)
                    reader.seek(SeekFrom::Current(block_size as i64)).ok();
                    let terminator = reader.read_u8().unwrap_or(1);
                    if terminator != 0x00 { /* 异常处理 */ }

                    chunks.push(ChunkInfo {
                        name: name.into(),
                        offset: pos,
                        length: block_size as u32,
                        total_size: (reader.stream_position().unwrap() - pos) as u32,
                        description: format!("Extension Block (Type: 0x{:02X})", label),
                        color: "#12B886".into(),
                    });
                },
                0x2C => { // Image Descriptor
                    // 跳过位置和尺寸信息 (9 bytes)
                    reader.seek(SeekFrom::Current(9)).ok();
                    // LZW Minimum Code Size
                    reader.read_u8().ok();

                    // 解析 Data Sub-blocks
                    let mut data_len = 0;
                    loop {
                        let sub_block_len = reader.read_u8().map_err(|e| e.to_string())?;
                        if sub_block_len == 0 { break; }
                        data_len += sub_block_len as u32;
                        reader.seek(SeekFrom::Current(sub_block_len as i64)).ok();
                    }

                    chunks.push(ChunkInfo {
                        name: "IDAT".into(),
                        offset: pos,
                        length: data_len,
                        total_size: (reader.stream_position().unwrap() - pos) as u32,
                        description: "Image Descriptor & LZW Data".into(),
                        color: "#228BE6".into(),
                    });
                },
                0x3B => { // Trailer
                    chunks.push(ChunkInfo {
                        name: "Trailer".into(),
                        offset: pos,
                        length: 0,
                        total_size: 1,
                        description: "File Termination".into(),
                        color: "#212529".into(),
                    });
                    break;
                },
                _ => break, // 未知字节，停止解析
            }
        }

        Ok(FormatDetail {
            format_name: "GIF Image".into(),
            dimensions: Some((width, height)),
            bit_depth: Some(8),
            color_mode: "Indexed".into(),
            chunks,
        })
    }

    fn get_template(&self) -> FormatTemplate {
        FormatTemplate {
            name: "GIF (Graphics Interchange Format)".into(),
            extension: "gif".into(),
            signature_hex: "47 49 46 38 39 61".into(),
            description: "基于块（Block）的 8 位色彩格式，支持动画与 LZW 压缩".into(),
            markers: vec![
                MarkerDefinition { name: "Header".into(), hex: "47 49 46".into(), description: "GIF 签名".into(), color: "#FAB005".into() },
                MarkerDefinition { name: "LSD".into(), hex: "6 字节处".into(), description: "逻辑屏幕描述符".into(), color: "#FA5252".into() },
                MarkerDefinition { name: "GCT".into(), hex: "13 字节处".into(), description: "全局调色板".into(), color: "#BE4BDB".into() },
                MarkerDefinition { name: "GCE".into(), hex: "21 F9".into(), description: "图形控制扩展 (透明/帧间隔)".into(), color: "#12B886".into() },
                MarkerDefinition { name: "Trailer".into(), hex: "3B".into(), description: "文件结束符".into(), color: "#212529".into() },
            ],
        }
    }
}