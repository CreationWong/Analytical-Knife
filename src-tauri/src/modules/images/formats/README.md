这份文档旨在指导开发者如何基于现有的架构，为「图像分析器」扩展新的文件格式模板。通过标准化的接口和注册机制，确保代码的可读性与高度可维护性。

------

## 1. 架构设计概览

系统采用**插件式架构**。核心引擎不感知具体的图片格式，而是通过一个统一的 `ImageParser` 特性（Trait）与各个格式解析器交互。

- **加载器 (Loader):** `analyze_image_header` 函数，负责文件 IO 和调用解析器。
- **注册表 (Registry):** 集中管理所有可用解析器的列表。
- **解析器 (Parser):** 针对特定格式（如 PNG, JPEG）的二进制流解析逻辑。

------

## 2. 核心接口规范 (The Trait)

所有新格式必须实现 `ImageParser` Trait。它是开发者与系统通信的协议。

```rust
pub trait ImageParser {
    /// 快速判定：根据文件头前16字节判断是否属于该格式
    fn can_parse(&self, header: &[u8; 16]) -> bool;

    /// 深度解析：解析文件的具体块（Chunks）或标记（Markers）结构
    fn parse(&self, file_path: &str) -> Result<FormatDetail, String>;

    /// 模板信息：返回给前端 UI 展示的格式元数据和特征码说明
    fn get_template(&self) -> FormatTemplate;
}
```

------

## 3. 开发步骤：以 GIF 格式为例

如果你要添加一个新格式，请遵循以下四个步骤：

### 第一步：创建格式文件

在 `src-tauri/src/modules/images/formats/` 目录下新建 `gif.rs`。

### 第二步：实现解析逻辑

GIF 是基于块的格式，具有典型的 `Header -> Logical Screen Descriptor -> Data Blocks` 结构。

```Rust
pub struct GifParser;

impl ImageParser for GifParser {
    fn can_parse(&self, header: &[u8; 16]) -> bool {
        // GIF87a 或 GIF89a
        header.starts_with(b"GIF87a") || header.starts_with(b"GIF89a")
    }

    fn parse(&self, file_path: &str) -> Result<FormatDetail, String> {
        let mut reader = BufReader::new(File::open(file_path).map_err(|e| e.to_string())?);
        let mut chunks = Vec::new();

        // 示例：解析固定长度的 Header
        chunks.push(ChunkInfo {
            name: "Header".into(),
            offset: 0,
            length: 6,
            total_size: 6,
            description: "GIF Signature & Version".into(),
            color: "#FAB005".into(),
        });

        // 后续逻辑：循环读取块 ID，根据 ID 长度跳过或解析...
        
        Ok(FormatDetail {
            format_name: "GIF Image".into(),
            dimensions: Some((width, height)), // 从 Logical Screen Descriptor 读取
            bit_depth: None,
            color_mode: "Indexed".into(),
            chunks,
        })
    }

    fn get_template(&self) -> FormatTemplate {
        FormatTemplate {
            name: "GIF (Graphics Interchange Format)".into(),
            extension: "gif".into(),
            signature_hex: "47 49 46 38 39 61".into(),
            description: "8位颜色限制的位图格式，支持动画和透明".into(),
            markers: vec![
                MarkerDefinition { name: "Signature".into(), hex: "47 49 46".into(), description: "文件标识符".into(), color: "#FAB005".into() },
                MarkerDefinition { name: "Extension".into(), hex: "21".into(), description: "扩展块引入符".into(), color: "#BE4BDB".into() },
            ],
        }
    }
}
```

### 第三步：挂载

修改 `image_structure_analyzer.rs`，将 `GifParser` 加入：

```Rust
use super::formats::png::PngParser;
use super::formats::jpeg::JpegParser;
use super::formats::gif::GifParser; // 新增

// ***

pub fn get_all_parsers() -> Vec<Box<dyn ImageParser + Send + Sync>> {
    vec![
        Box::new(PngParser),
        Box::new(JpegParser),
        Box::new(GifParser), // 新增
    ]
}

// ***

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
```

### 第四步：添加打开项

修改 `ImageStructureAnalyzer.tsx`，将 `Gif` 加入：

```tsx
            const selected = await open({
                multiple: false,
                title: '选择图片',
                filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif'] }]
            });
            if (selected === null) return;
```



------

## 4. UI 交互与维护规范

为了保持用户体验的一致性，请遵循以下**视觉标准**：

### 颜色映射表 (UI Color Palette)

在定义 `ChunkInfo` 或 `MarkerDefinition` 的 `color` 字段时，建议使用以下语义化色彩：

| **数据类型**             | **推荐 Hex** | **含义**         |
|----------------------|------------|----------------|
| **Header/Signature** | `#FAB005`  | 文件头、魔法数字（黄色）   |
| **Metadata/Desc**    | `#FA5252`  | 关键信息、图像尺寸（红色）  |
| **Data/Payload**     | `#228BE6`  | 实际图像数据、像素流（蓝色） |
| **Extension/Extra**  | `#BE4BDB`  | 扩展块、调色板（紫色）    |
| **Footer/End**       | `#212529`  | 文件结束标志（深灰色/黑色） |

### 错误处理

- **非阻塞解析：** 如果某个非关键块解析失败，应当 `log` 错误并继续解析后续块，而不是直接返回 `Err` 导致整个界面空白。
- **性能考量：** 对于巨大的图像文件，避免一次性将整个 `IDAT` 或数据流读入内存，仅记录其 `offset` 和 `length`。