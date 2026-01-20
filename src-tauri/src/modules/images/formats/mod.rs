pub(crate) mod jpeg;
pub(crate) mod png;
pub(crate) mod gif;

use serde::Serialize;

// 用于分析结果的结构
#[derive(Serialize, Debug, Clone)]
pub struct ChunkInfo {
    pub name: String,
    pub offset: u64,
    pub length: u32,
    pub total_size: u32,
    pub description: String,
    pub color: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct FormatDetail {
    pub format_name: String,
    pub dimensions: Option<(u32, u32)>,
    pub bit_depth: Option<u8>,
    pub color_mode: String,
    pub chunks: Vec<ChunkInfo>,
}

// 用于前端展示的静态模板结构
#[derive(Serialize, Debug, Clone)]
pub struct MarkerDefinition {
    pub name: String,
    pub hex: String,       // 例如 "FF D8"
    pub description: String,
    pub color: String,     // 建议的高亮颜色
}

#[derive(Serialize, Debug, Clone)]
pub struct FormatTemplate {
    pub name: String,
    pub extension: String,
    pub signature_hex: String, // 文件头特征
    pub description: String,
    pub markers: Vec<MarkerDefinition>, // 支持的关键标记列表
}

pub trait ImageParser {
    fn can_parse(&self, header: &[u8; 16]) -> bool;
    fn parse(&self, file_path: &str) -> Result<FormatDetail, String>;
    // 获取该格式的静态定义
    fn get_template(&self) -> FormatTemplate;
}