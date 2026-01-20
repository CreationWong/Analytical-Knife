use std::fs::File;
use std::io::{Read, Seek, SeekFrom, BufReader};
use byteorder::{BigEndian, ReadBytesExt};
use super::{ImageParser, FormatDetail, ChunkInfo, FormatTemplate, MarkerDefinition};

pub struct PngParser;

impl ImageParser for PngParser {
    fn can_parse(&self, header: &[u8; 16]) -> bool {
        header.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    }

    fn parse(&self, file_path: &str) -> Result<FormatDetail, String> {
        let file = File::open(file_path).map_err(|e| e.to_string())?;
        let mut reader = BufReader::new(file);

        // Add Signature Chunk
        let mut chunks = vec![ChunkInfo {
            name: "Signature".into(), offset: 0, length: 8, total_size: 8,
            description: "PNG Magic Header".into(), color: "#FAB005".into(),
        }];

        reader.seek(SeekFrom::Start(8)).map_err(|e| e.to_string())?;

        let mut width = 0;
        let mut height = 0;
        let mut bit_depth = 0;
        let mut color_desc = "Unknown".to_string();

        loop {
            let length = match reader.read_u32::<BigEndian>() {
                Ok(l) => l, Err(_) => break,
            };
            let chunk_start = reader.stream_position().unwrap() - 4;

            let mut type_code = [0u8; 4];
            reader.read_exact(&mut type_code).map_err(|e| e.to_string())?;
            let type_str = String::from_utf8_lossy(&type_code).to_string();

            // 使用 if/else 表达式直接初始化
            let (description, color) = if type_str == "IHDR" {
                width = reader.read_u32::<BigEndian>().map_err(|e| e.to_string())?;
                height = reader.read_u32::<BigEndian>().map_err(|e| e.to_string())?;
                bit_depth = reader.read_u8().map_err(|e| e.to_string())?;
                let color_type = reader.read_u8().map_err(|e| e.to_string())?;
                reader.seek(SeekFrom::Current(3)).map_err(|e| e.to_string())?; // skip compression/filter/interlace

                color_desc = match color_type {
                    0 => "Grayscale".into(), 2 => "Truecolor".into(), 3 => "Indexed".into(),
                    4 => "Gray+Alpha".into(), 6 => "RGBA".into(), _ => "Unknown".into(),
                };

                // IHDR CRC
                reader.read_u32::<BigEndian>().map_err(|e| e.to_string())?;

                (format!("Dims: {}x{}, Depth: {}, Type: {}", width, height, bit_depth, color_desc), "#FA5252".to_string())
            } else {
                let info = match type_str.as_str() {
                    "IDAT" => ("图像数据 (Deflate)", "#228BE6"),
                    "PLTE" => ("调色板", "#BE4BDB"),
                    "IEND" => ("文件结束", "#212529"),
                    "tEXt" | "zTXt" => ("文本元数据", "#12B886"),
                    "pHYs" => ("物理像素尺寸", "#15AABF"),
                    _ => ("辅助数据块", "#868E96"),
                };
                // Skip Data + CRC
                reader.seek(SeekFrom::Current(length as i64 + 4)).map_err(|e| e.to_string())?;
                (info.0.to_string(), info.1.to_string())
            };

            chunks.push(ChunkInfo {
                name: type_str.clone(),
                offset: chunk_start,
                length,
                total_size: length + 12,
                description,
                color,
            });

            if type_str == "IEND" { break; }
        }

        Ok(FormatDetail {
            format_name: "PNG Image".into(),
            dimensions: Some((width, height)),
            bit_depth: Some(bit_depth),
            color_mode: color_desc,
            chunks,
        })
    }

    fn get_template(&self) -> FormatTemplate {
        FormatTemplate {
            name: "PNG (Portable Network Graphics)".into(),
            extension: "png".into(),
            signature_hex: "89 50 4E 47 0D 0A 1A 0A".into(),
            description: "基于 Chunk 的无损压缩位图格式".into(),
            markers: vec![
                MarkerDefinition { name: "Signature".into(), hex: "89 50...".into(), description: "PNG 文件魔法头".into(), color: "#FAB005".into() },
                MarkerDefinition { name: "IHDR".into(), hex: "49 48 44 52".into(), description: "图像头 (Header Chunk)".into(), color: "#FA5252".into() },
                MarkerDefinition { name: "IDAT".into(), hex: "49 44 41 54".into(), description: "图像数据 (Image Data)".into(), color: "#228BE6".into() },
                MarkerDefinition { name: "IEND".into(), hex: "49 45 4E 44".into(), description: "文件结束 (End)".into(), color: "#212529".into() },
            ],
        }
    }
}