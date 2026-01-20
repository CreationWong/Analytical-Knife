use super::{ChunkInfo, FormatDetail, FormatTemplate, ImageParser, MarkerDefinition};
use byteorder::{BigEndian, ReadBytesExt};
use std::fs::File;
use std::io::{BufReader, Seek, SeekFrom};

pub struct JpegParser;

impl ImageParser for JpegParser {
    fn can_parse(&self, header: &[u8; 16]) -> bool {
        header[0] == 0xFF && header[1] == 0xD8
    }

    fn parse(&self, file_path: &str) -> Result<FormatDetail, String> {
        let file = File::open(file_path).map_err(|e| e.to_string())?;
        let mut reader = BufReader::new(file);

        let mut chunks = vec![ChunkInfo {
            name: "SOI".into(), offset: 0, length: 0, total_size: 2, description: "Start Of Image".into(), color: "#FAB005".into()
        }];

        reader.seek(SeekFrom::Start(2)).map_err(|e| e.to_string())?;
        let mut width = 0;
        let mut height = 0;
        let mut bit_depth = 0;
        let mut color_desc = "Unknown".into();

        loop {
            let b = match reader.read_u8() { Ok(b) => b, Err(_) => break };
            if b != 0xFF { continue; }
            let marker = reader.read_u8().map_err(|e| e.to_string())?;
            let pos = reader.stream_position().unwrap() - 2;

            if marker == 0xD9 { // EOI
                chunks.push(ChunkInfo { name: "EOI".into(), offset: pos, length: 0, total_size: 2, description: "End Of Image".into(), color: "#212529".into() });
                break;
            }
            if marker == 0x00 || (marker >= 0xD0 && marker <= 0xD7) { continue; }

            let length = reader.read_u16::<BigEndian>().map_err(|e| e.to_string())?;
            let content_len = length as i64 - 2;
            let total_size = length as u32 + 2;

            // 使用 if/else 表达式直接初始化
            let (description, color) = if marker == 0xC0 || marker == 0xC2 {
                bit_depth = reader.read_u8().unwrap_or(0);
                height = reader.read_u16::<BigEndian>().unwrap_or(0) as u32;
                width = reader.read_u16::<BigEndian>().unwrap_or(0) as u32;
                let components = reader.read_u8().unwrap_or(0);
                color_desc = if components == 3 { "YCbCr".into() } else { format!("{} comps", components) };

                reader.seek(SeekFrom::Current(content_len - 6)).ok();
                (format!("Frame: {}x{}, {}bit", width, height, bit_depth), "#FA5252".to_string())
            } else {
                let info = match marker {
                    0xC4 => ("DHT (Huffman Table)", "#BE4BDB"),
                    0xDB => ("DQT (Quantization)", "#40C057"),
                    0xDA => ("SOS (Scan Start)", "#228BE6"),
                    0xE0..=0xEF => ("APPn Metadata", "#12B886"),
                    0xFE => ("Comment", "#FAB005"),
                    _ => ("Marker", "#868E96"),
                };
                // SOS has special scan logic, but for simplicity we treat header as chunk
                reader.seek(SeekFrom::Current(content_len)).ok();
                (info.0.to_string(), info.1.to_string())
            };

            chunks.push(ChunkInfo {
                name: format!("{:02X}", marker),
                offset: pos, length: length as u32, total_size, description, color,
            });
        }

        Ok(FormatDetail {
            format_name: "JPEG Image".into(), dimensions: Some((width, height)),
            bit_depth: Some(bit_depth), color_mode: color_desc, chunks,
        })
    }

    fn get_template(&self) -> FormatTemplate {
        FormatTemplate {
            name: "JPEG Image".into(),
            extension: "jpg, jpeg".into(),
            signature_hex: "FF D8".into(),
            description: "基于 Marker 的压缩格式".into(),
            markers: vec![
                MarkerDefinition { name: "SOI".into(), hex: "FF D8".into(), description: "Start Of Image".into(), color: "#FAB005".into() },
                MarkerDefinition { name: "SOF0".into(), hex: "FF C0".into(), description: "Baseline Frame".into(), color: "#FA5252".into() },
                MarkerDefinition { name: "DHT".into(), hex: "FF C4".into(), description: "Huffman Table".into(), color: "#BE4BDB".into() },
                MarkerDefinition { name: "SOS".into(), hex: "FF DA".into(), description: "Start Of Scan".into(), color: "#228BE6".into() },
            ],
        }
    }
}