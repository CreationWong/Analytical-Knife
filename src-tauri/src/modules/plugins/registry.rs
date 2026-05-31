use chrono::Utc;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::http::{header::CONTENT_TYPE, Method, Request, Response, StatusCode};

const DEFAULT_PLUGIN_GROUP_PATH: &str = "第三方插件";
const DEFAULT_PLUGIN_ICON_KEY: &str = "IconCode";
const XML_FILE_NAME: &str = "plugins.xml";
const PLUGINS_DIRECTORY_NAME: &str = "plugins";
pub const PLUGIN_URI_SCHEME: &str = "plugin";
const PLUGIN_RUNTIME_HOST_SUFFIX: &str = ".localhost";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomPluginRecord {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub enabled: bool,
    pub icon_key: String,
    pub sidebar_group_path: String,
    pub sidebar_order: i32,
    pub entry_file: String,
    pub plugin_root: String,
    #[serde(default)]
    pub window_max_width: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCompiledHtmlPluginInput {
    pub source_html_path: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_plugin_enabled")]
    pub enabled: bool,
    #[serde(default = "default_plugin_icon_key")]
    pub icon_key: String,
    #[serde(default = "default_plugin_group_path")]
    pub sidebar_group_path: String,
    #[serde(default)]
    pub sidebar_order: i32,
    #[serde(default)]
    pub window_max_width: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomPluginMetadataInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_plugin_enabled")]
    pub enabled: bool,
    #[serde(default = "default_plugin_icon_key")]
    pub icon_key: String,
    #[serde(default = "default_plugin_group_path")]
    pub sidebar_group_path: String,
    #[serde(default)]
    pub sidebar_order: i32,
    #[serde(default)]
    pub window_max_width: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginEnvironment {
    pub program_root: String,
    pub plugins_directory: String,
    pub xml_path: String,
}

fn default_plugin_enabled() -> bool {
    true
}

fn default_plugin_icon_key() -> String {
    DEFAULT_PLUGIN_ICON_KEY.to_string()
}

fn default_plugin_group_path() -> String {
    DEFAULT_PLUGIN_GROUP_PATH.to_string()
}

#[tauri::command]
pub fn get_plugin_environment() -> Result<PluginEnvironment, String> {
    let program_root = program_root_dir()?;
    let plugins_directory = ensure_plugins_directory(&program_root)?;
    let xml_path = plugin_xml_path(&program_root);

    Ok(PluginEnvironment {
        program_root: program_root.to_string_lossy().to_string(),
        plugins_directory: plugins_directory.to_string_lossy().to_string(),
        xml_path: xml_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn list_custom_plugins() -> Result<Vec<CustomPluginRecord>, String> {
    let program_root = program_root_dir()?;
    let xml_path = plugin_xml_path(&program_root);
    let mut plugins = read_plugins_from_xml_path(&xml_path)?;

    plugins.sort_by(|a, b| {
        a.sidebar_order
            .cmp(&b.sidebar_order)
            .then(a.name.cmp(&b.name))
    });

    Ok(plugins)
}

#[tauri::command]
pub fn import_compiled_html_plugin(
    input: ImportCompiledHtmlPluginInput,
) -> Result<CustomPluginRecord, String> {
    let program_root = program_root_dir()?;
    let plugins_directory = ensure_plugins_directory(&program_root)?;
    let xml_path = plugin_xml_path(&program_root);

    let source_html_path = PathBuf::from(input.source_html_path.trim());
    validate_source_html_path(&source_html_path)?;

    let source_root = source_html_path
        .parent()
        .ok_or_else(|| "无法识别 HTML 所在目录".to_string())?;

    let plugin_id = generate_plugin_id(&input.name);
    let target_root = plugins_directory.join(&plugin_id);

    copy_dir_recursive(source_root, &target_root)?;

    let now = Utc::now().to_rfc3339();
    let entry_file = source_html_path
        .file_name()
        .ok_or_else(|| "无法解析 HTML 入口文件名".to_string())?
        .to_string_lossy()
        .to_string();

    let plugin = CustomPluginRecord {
        id: plugin_id,
        name: sanitize_plugin_name(&input.name)?,
        description: input.description.trim().to_string(),
        enabled: input.enabled,
        icon_key: sanitize_icon_key(&input.icon_key),
        sidebar_group_path: normalize_sidebar_group_path(&input.sidebar_group_path),
        sidebar_order: input.sidebar_order,
        entry_file,
        plugin_root: target_root.to_string_lossy().to_string(),
        window_max_width: normalize_window_max_width(input.window_max_width),
        created_at: now.clone(),
        updated_at: now,
    };

    let mut plugins = read_plugins_from_xml_path(&xml_path)?;
    plugins.push(plugin.clone());

    if let Err(error) = write_plugins_to_xml_path(&xml_path, &plugins) {
        let _ = fs::remove_dir_all(&target_root);
        return Err(error);
    }

    Ok(plugin)
}

#[tauri::command]
pub fn update_custom_plugin_metadata(
    input: UpdateCustomPluginMetadataInput,
) -> Result<CustomPluginRecord, String> {
    let program_root = program_root_dir()?;
    let xml_path = plugin_xml_path(&program_root);
    let mut plugins = read_plugins_from_xml_path(&xml_path)?;

    let plugin = plugins
        .iter_mut()
        .find(|plugin| plugin.id == input.id)
        .ok_or_else(|| "未找到指定插件".to_string())?;

    plugin.name = sanitize_plugin_name(&input.name)?;
    plugin.description = input.description.trim().to_string();
    plugin.enabled = input.enabled;
    plugin.icon_key = sanitize_icon_key(&input.icon_key);
    plugin.sidebar_group_path = normalize_sidebar_group_path(&input.sidebar_group_path);
    plugin.sidebar_order = input.sidebar_order;
    plugin.window_max_width = normalize_window_max_width(input.window_max_width);
    plugin.updated_at = Utc::now().to_rfc3339();

    let updated = plugin.clone();

    write_plugins_to_xml_path(&xml_path, &plugins)?;

    Ok(updated)
}

#[tauri::command]
pub fn remove_custom_plugin(plugin_id: String) -> Result<(), String> {
    let program_root = program_root_dir()?;
    let plugins_directory = ensure_plugins_directory(&program_root)?;
    let xml_path = plugin_xml_path(&program_root);
    let mut plugins = read_plugins_from_xml_path(&xml_path)?;

    let removed_plugin = plugins
        .iter()
        .find(|plugin| plugin.id == plugin_id)
        .cloned()
        .ok_or_else(|| "未找到指定插件".to_string())?;

    plugins.retain(|plugin| plugin.id != plugin_id);
    write_plugins_to_xml_path(&xml_path, &plugins)?;

    let plugin_root = PathBuf::from(&removed_plugin.plugin_root);

    safe_remove_plugin_directory(&plugin_root, &plugins_directory)?;

    Ok(())
}

#[tauri::command]
pub fn generate_plugins_xml() -> Result<String, String> {
    let program_root = program_root_dir()?;
    let xml_path = plugin_xml_path(&program_root);
    let plugins = read_plugins_from_xml_path(&xml_path)?;

    write_plugins_to_xml_path(&xml_path, &plugins)?;

    Ok(xml_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn reset_third_party_tools() -> Result<(), String> {
    let program_root = program_root_dir()?;
    let plugins_directory = program_root.join(PLUGINS_DIRECTORY_NAME);
    let xml_path = plugin_xml_path(&program_root);

    if xml_path.exists() {
        fs::remove_file(&xml_path)
            .map_err(|e| format!("删除 XML 文件失败 {}: {}", xml_path.display(), e))?;
    }

    if plugins_directory.exists() {
        fs::remove_dir_all(&plugins_directory).map_err(|e| {
            format!(
                "删除第三方插件目录失败 {}: {}",
                plugins_directory.display(),
                e
            )
        })?;
    }

    Ok(())
}

#[tauri::command]
pub fn load_plugin_entry_html(plugin_root: String, entry_file: String) -> Result<String, String> {
    let plugin_root = PathBuf::from(plugin_root);

    if !plugin_root.exists() {
        return Err("插件根目录不存在".to_string());
    }

    if !plugin_root.is_dir() {
        return Err("插件根目录不是目录".to_string());
    }

    let entry_path = plugin_root.join(entry_file);
    let canonical_plugin_root = plugin_root
        .canonicalize()
        .map_err(|e| format!("无法解析插件根目录 {}: {}", plugin_root.display(), e))?;
    let canonical_entry_path = entry_path
        .canonicalize()
        .map_err(|e| format!("无法解析插件入口文件 {}: {}", entry_path.display(), e))?;

    if !canonical_entry_path.starts_with(&canonical_plugin_root) {
        return Err("插件入口文件不在插件目录内".to_string());
    }

    fs::read_to_string(&canonical_entry_path)
        .map_err(|e| format!("无法读取插件入口 HTML {}: {}", canonical_entry_path.display(), e))
}

pub fn handle_plugin_uri_request(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let origin = request
        .headers()
        .get("origin")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    match build_plugin_uri_response(request, origin.as_deref()) {
        Ok(response) => response,
        Err(error) => build_plain_text_response(error.status, &error.message, origin.as_deref()),
    }
}

fn program_root_dir() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        return manifest_dir
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "无法解析开发环境程序根目录".to_string());
    }

    let current_exe = std::env::current_exe().map_err(|e| format!("无法定位程序路径: {}", e))?;

    current_exe
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "无法解析程序根目录".to_string())
}

fn ensure_plugins_directory(program_root: &Path) -> Result<PathBuf, String> {
    let plugins_directory = program_root.join(PLUGINS_DIRECTORY_NAME);

    fs::create_dir_all(&plugins_directory)
        .map_err(|e| format!("无法创建插件目录 {}: {}", plugins_directory.display(), e))?;

    Ok(plugins_directory)
}

#[derive(Debug)]
struct PluginProtocolError {
    status: StatusCode,
    message: String,
}

impl PluginProtocolError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

fn build_plugin_uri_response(
    request: Request<Vec<u8>>,
    origin: Option<&str>,
) -> Result<Response<Vec<u8>>, PluginProtocolError> {
    let asset_path = resolve_plugin_request_path(request.uri())?;
    let body = if request.method() == Method::HEAD {
        Vec::new()
    } else {
        fs::read(&asset_path).map_err(|error| {
            PluginProtocolError::new(
                StatusCode::NOT_FOUND,
                format!("无法读取插件资源 {}: {}", asset_path.display(), error),
            )
        })?
    };

    let mut response = Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, content_type_for_path(&asset_path))
        .header("Access-Control-Allow-Origin", origin.unwrap_or("*"))
        .header("Cache-Control", "no-cache")
        .header("X-Content-Type-Options", "nosniff")
        .header("Service-Worker-Allowed", "/");

    if request.method() == Method::HEAD {
        if let Ok(metadata) = fs::metadata(&asset_path) {
            response = response.header("Content-Length", metadata.len().to_string());
        }
    }

    response.body(body).map_err(|error| {
        PluginProtocolError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("构建插件协议响应失败: {}", error),
        )
    })
}

fn resolve_plugin_request_path(uri: &tauri::http::Uri) -> Result<PathBuf, PluginProtocolError> {
    let plugin_id = resolve_plugin_id_from_uri(uri)?;
    let program_root = program_root_dir()
        .map_err(|error| PluginProtocolError::new(StatusCode::INTERNAL_SERVER_ERROR, error))?;
    let plugins_directory = ensure_plugins_directory(&program_root)
        .map_err(|error| PluginProtocolError::new(StatusCode::INTERNAL_SERVER_ERROR, error))?;
    let xml_path = plugin_xml_path(&program_root);
    let plugins = read_plugins_from_xml_path(&xml_path)
        .map_err(|error| PluginProtocolError::new(StatusCode::INTERNAL_SERVER_ERROR, error))?;

    let plugin = plugins
        .into_iter()
        .find(|current| current.id == plugin_id && current.enabled)
        .ok_or_else(|| PluginProtocolError::new(StatusCode::NOT_FOUND, "未找到已注册的插件"))?;

    let plugin_root = PathBuf::from(&plugin.plugin_root);
    let canonical_plugin_root = plugin_root.canonicalize().map_err(|error| {
        PluginProtocolError::new(
            StatusCode::NOT_FOUND,
            format!("插件目录不存在 {}: {}", plugin_root.display(), error),
        )
    })?;
    let canonical_plugins_directory = plugins_directory.canonicalize().map_err(|error| {
        PluginProtocolError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!(
                "无法解析插件托管目录 {}: {}",
                plugins_directory.display(),
                error
            ),
        )
    })?;

    if !canonical_plugin_root.starts_with(&canonical_plugins_directory) {
        return Err(PluginProtocolError::new(
            StatusCode::FORBIDDEN,
            "插件目录不在受控 plugins 目录内",
        ));
    }

    let relative_asset_path = resolve_relative_asset_path(uri.path(), &plugin)?;
    let mut asset_path = canonical_plugin_root.join(relative_asset_path);

    if asset_path.is_dir() {
        asset_path = asset_path.join("index.html");
    }

    let canonical_asset_path = asset_path.canonicalize().map_err(|error| {
        PluginProtocolError::new(
            StatusCode::NOT_FOUND,
            format!("插件资源不存在 {}: {}", asset_path.display(), error),
        )
    })?;

    if !canonical_asset_path.starts_with(&canonical_plugin_root) {
        return Err(PluginProtocolError::new(
            StatusCode::FORBIDDEN,
            "插件资源路径越界，已拒绝访问",
        ));
    }

    Ok(canonical_asset_path)
}

fn resolve_plugin_id_from_uri(uri: &tauri::http::Uri) -> Result<String, PluginProtocolError> {
    uri.host()
        .ok_or_else(|| PluginProtocolError::new(StatusCode::BAD_REQUEST, "插件协议 URL 缺少插件 host"))
        .and_then(decode_plugin_runtime_host)
}

fn decode_plugin_runtime_host(host: &str) -> Result<String, PluginProtocolError> {
    let normalized = host.to_ascii_lowercase();
    let without_suffix = normalized
        .strip_suffix(PLUGIN_RUNTIME_HOST_SUFFIX)
        .unwrap_or(&normalized);
    let encoded = without_suffix.replace('.', "");
    let encoded = encoded.strip_prefix('p').ok_or_else(|| {
        PluginProtocolError::new(StatusCode::BAD_REQUEST, "插件协议 host 编码无效")
    })?;

    if encoded.len() % 2 != 0 {
        return Err(PluginProtocolError::new(
            StatusCode::BAD_REQUEST,
            "插件协议 host 编码长度无效",
        ));
    }

    let mut bytes = Vec::with_capacity(encoded.len() / 2);

    for index in (0..encoded.len()).step_by(2) {
        let byte = u8::from_str_radix(&encoded[index..index + 2], 16).map_err(|error| {
            PluginProtocolError::new(
                StatusCode::BAD_REQUEST,
                format!("插件协议 host 编码解析失败: {}", error),
            )
        })?;
        bytes.push(byte);
    }

    String::from_utf8(bytes).map_err(|error| {
        PluginProtocolError::new(
            StatusCode::BAD_REQUEST,
            format!("插件协议 host 解码失败: {}", error),
        )
    })
}

fn resolve_relative_asset_path(
    raw_path: &str,
    plugin: &CustomPluginRecord,
) -> Result<PathBuf, PluginProtocolError> {
    let path_segments = raw_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(|segment| {
            percent_encoding::percent_decode_str(segment)
                .decode_utf8()
                .map(|value| value.to_string())
                .map_err(|error| {
                    PluginProtocolError::new(
                        StatusCode::BAD_REQUEST,
                        format!("插件资源路径解码失败: {}", error),
                    )
                })
        })
        .collect::<Result<Vec<_>, _>>()?;

    let relative_path = if path_segments.is_empty() {
        PathBuf::from(&plugin.entry_file)
    } else {
        path_segments.into_iter().fold(PathBuf::new(), |mut path, segment| {
            path.push(segment);
            path
        })
    };

    if !is_safe_relative_path(&relative_path) {
        return Err(PluginProtocolError::new(
            StatusCode::FORBIDDEN,
            "插件资源路径非法，已拒绝访问",
        ));
    }

    Ok(relative_path)
}

fn is_safe_relative_path(path: &Path) -> bool {
    !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn build_plain_text_response(
    status: StatusCode,
    message: &str,
    origin: Option<&str>,
) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "text/plain; charset=utf-8")
        .header("Access-Control-Allow-Origin", origin.unwrap_or("*"))
        .body(message.as_bytes().to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn content_type_for_path(path: &Path) -> &'static str {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" | "cjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        "wasm" => "application/wasm",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "ogg" => "audio/ogg",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "eot" => "application/vnd.ms-fontobject",
        "xml" => "application/xml; charset=utf-8",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn plugin_xml_path(program_root: &Path) -> PathBuf {
    program_root.join(XML_FILE_NAME)
}

fn validate_source_html_path(source_html_path: &Path) -> Result<(), String> {
    if !source_html_path.exists() {
        return Err("选择的 HTML 入口文件不存在".to_string());
    }

    if !source_html_path.is_file() {
        return Err("选择的路径不是文件".to_string());
    }

    let extension = source_html_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if extension != "html" && extension != "htm" {
        return Err("仅支持导入 .html 或 .htm 入口文件".to_string());
    }

    Ok(())
}

fn sanitize_required_text(value: &str, field_name: &str) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(format!("{}不能为空", field_name));
    }

    Ok(trimmed.to_string())
}

fn sanitize_plugin_name(value: &str) -> Result<String, String> {
    let name = sanitize_required_text(value, "插件名称")?;

    if name.contains('/') || name.contains('\\') {
        return Err("插件名称不能包含 / 或 \\".to_string());
    }

    Ok(name)
}

fn sanitize_icon_key(icon_key: &str) -> String {
    let trimmed = icon_key.trim();

    if trimmed.is_empty() {
        DEFAULT_PLUGIN_ICON_KEY.to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_sidebar_group_path(value: &str) -> String {
    let segments = value
        .split(['/', '\\'])
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();

    if segments.is_empty() {
        DEFAULT_PLUGIN_GROUP_PATH.to_string()
    } else {
        segments.join("/")
    }
}

fn normalize_window_max_width(value: Option<String>) -> Option<String> {
    value.and_then(|current| {
        let trimmed = current.trim().to_string();

        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn generate_plugin_id(name: &str) -> String {
    let normalized = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();

    let normalized = normalized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let base = if normalized.is_empty() { "plugin" } else { &normalized };

    format!("{}_{}", base, Utc::now().timestamp_millis())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|e| format!("无法创建插件托管目录 {}: {}", target.display(), e))?;

    let entries = fs::read_dir(source)
        .map_err(|e| format!("无法读取插件目录 {}: {}", source.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取插件目录项失败: {}", e))?;
        let entry_path = entry.path();
        let target_path = target.join(entry.file_name());

        if entry_path.is_dir() {
            copy_dir_recursive(&entry_path, &target_path)?;
        } else {
            fs::copy(&entry_path, &target_path).map_err(|e| {
                format!(
                    "复制文件失败 {} -> {}: {}",
                    entry_path.display(),
                    target_path.display(),
                    e
                )
            })?;
        }
    }

    Ok(())
}

fn safe_remove_plugin_directory(plugin_root: &Path, plugins_directory: &Path) -> Result<(), String> {
    if !plugin_root.exists() {
        return Ok(());
    }

    let canonical_plugin_root = plugin_root
        .canonicalize()
        .map_err(|e| format!("无法解析插件目录 {}: {}", plugin_root.display(), e))?;
    let canonical_plugins_directory = plugins_directory
        .canonicalize()
        .map_err(|e| format!("无法解析插件根目录 {}: {}", plugins_directory.display(), e))?;

    if !canonical_plugin_root.starts_with(&canonical_plugins_directory) {
        return Err("插件目录不在受控 plugins 目录内，已拒绝删除".to_string());
    }

    fs::remove_dir_all(&canonical_plugin_root)
        .map_err(|e| format!("删除插件目录失败 {}: {}", canonical_plugin_root.display(), e))?;

    Ok(())
}

fn read_plugins_from_xml_path(xml_path: &Path) -> Result<Vec<CustomPluginRecord>, String> {
    if !xml_path.exists() {
        return Ok(Vec::new());
    }

    let xml_content = fs::read_to_string(xml_path)
        .map_err(|e| format!("无法读取 XML 文件 {}: {}", xml_path.display(), e))?;

    parse_plugins_xml(&xml_content)
}

fn write_plugins_to_xml_path(xml_path: &Path, plugins: &[CustomPluginRecord]) -> Result<(), String> {
    let xml_content = build_plugins_xml(plugins);

    fs::write(xml_path, xml_content)
        .map_err(|e| format!("无法写入 XML 文件 {}: {}", xml_path.display(), e))
}

fn parse_plugins_xml(xml_content: &str) -> Result<Vec<CustomPluginRecord>, String> {
    if xml_content.trim().is_empty() {
        return Ok(Vec::new());
    }

    let plugin_regex = Regex::new(r"(?s)<plugin>\s*(.*?)\s*</plugin>")
        .map_err(|e| format!("构建插件 XML 解析器失败: {}", e))?;

    let mut plugins = Vec::new();

    for plugin_block in plugin_regex.captures_iter(xml_content) {
        let block = plugin_block
            .get(1)
            .ok_or_else(|| "插件 XML 块缺失内容".to_string())?
            .as_str();

        let sidebar_order = extract_optional_tag(block, "sidebarOrder")?
            .unwrap_or_else(|| "0".to_string())
            .parse::<i32>()
            .map_err(|e| format!("解析 sidebarOrder 失败: {}", e))?;

        let plugin = CustomPluginRecord {
            id: extract_required_tag(block, "id")?,
            name: extract_required_tag(block, "name")?,
            description: extract_optional_tag(block, "description")?.unwrap_or_default(),
            enabled: extract_optional_tag(block, "enabled")?
                .unwrap_or_else(|| "true".to_string())
                .parse::<bool>()
                .map_err(|e| format!("解析 enabled 失败: {}", e))?,
            icon_key: extract_optional_tag(block, "iconKey")?
                .unwrap_or_else(|| DEFAULT_PLUGIN_ICON_KEY.to_string()),
            sidebar_group_path: normalize_sidebar_group_path(
                &extract_optional_tag(block, "sidebarGroupPath")?
                    .unwrap_or_else(|| DEFAULT_PLUGIN_GROUP_PATH.to_string()),
            ),
            sidebar_order,
            entry_file: extract_required_tag(block, "entryFile")?,
            plugin_root: extract_required_tag(block, "pluginRoot")?,
            window_max_width: normalize_window_max_width(extract_optional_tag(block, "windowMaxWidth")?),
            created_at: extract_optional_tag(block, "createdAt")?
                .unwrap_or_else(|| Utc::now().to_rfc3339()),
            updated_at: extract_optional_tag(block, "updatedAt")?
                .unwrap_or_else(|| Utc::now().to_rfc3339()),
        };

        plugins.push(plugin);
    }

    Ok(plugins)
}

fn extract_required_tag(block: &str, tag_name: &str) -> Result<String, String> {
    extract_optional_tag(block, tag_name)?
        .ok_or_else(|| format!("XML 缺少 <{}> 节点", tag_name))
}

fn extract_optional_tag(block: &str, tag_name: &str) -> Result<Option<String>, String> {
    let pattern = format!(
        r"(?s)<{tag}>\s*(.*?)\s*</{tag}>",
        tag = regex::escape(tag_name)
    );
    let regex = Regex::new(&pattern).map_err(|e| format!("构建标签解析器失败: {}", e))?;

    Ok(regex
        .captures(block)
        .and_then(|capture| capture.get(1))
        .map(|value| xml_unescape(value.as_str().trim())))
}

fn build_plugins_xml(plugins: &[CustomPluginRecord]) -> String {
    let generated_at = Utc::now().to_rfc3339();
    let plugin_blocks = plugins
        .iter()
        .map(build_plugin_xml_block)
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<pluginRegistry>\n  <generatedAt>{}</generatedAt>\n{}\n</pluginRegistry>\n",
        xml_escape(&generated_at),
        plugin_blocks
    )
}

fn build_plugin_xml_block(plugin: &CustomPluginRecord) -> String {
    let mut lines = vec![
        "  <plugin>".to_string(),
        format!("    <id>{}</id>", xml_escape(&plugin.id)),
        format!("    <name>{}</name>", xml_escape(&plugin.name)),
        format!(
            "    <description>{}</description>",
            xml_escape(&plugin.description)
        ),
        format!("    <enabled>{}</enabled>", plugin.enabled),
        format!("    <iconKey>{}</iconKey>", xml_escape(&plugin.icon_key)),
        format!(
            "    <sidebarGroupPath>{}</sidebarGroupPath>",
            xml_escape(&plugin.sidebar_group_path)
        ),
        format!("    <sidebarOrder>{}</sidebarOrder>", plugin.sidebar_order),
        format!(
            "    <entryFile>{}</entryFile>",
            xml_escape(&plugin.entry_file)
        ),
        format!(
            "    <pluginRoot>{}</pluginRoot>",
            xml_escape(&plugin.plugin_root)
        ),
    ];

    if let Some(window_max_width) = &plugin.window_max_width {
        lines.push(format!(
            "    <windowMaxWidth>{}</windowMaxWidth>",
            xml_escape(window_max_width)
        ));
    }

    lines.push(format!(
        "    <createdAt>{}</createdAt>",
        xml_escape(&plugin.created_at)
    ));
    lines.push(format!(
        "    <updatedAt>{}</updatedAt>",
        xml_escape(&plugin.updated_at)
    ));
    lines.push("  </plugin>".to_string());

    lines.join("\n")
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn xml_unescape(value: &str) -> String {
    value
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_normalize_sidebar_group_path() {
        assert_eq!(
            normalize_sidebar_group_path(" /第三方插件/ 常用工具 // "),
            "第三方插件/常用工具"
        );
    }

    #[test]
    fn should_roundtrip_plugins_xml() {
        let plugins = vec![CustomPluginRecord {
            id: "plugin_1".to_string(),
            name: "测试插件".to_string(),
            description: "包含 <html> & 资源".to_string(),
            enabled: true,
            icon_key: "IconCode".to_string(),
            sidebar_group_path: "第三方插件/测试".to_string(),
            sidebar_order: 42,
            entry_file: "index.html".to_string(),
            plugin_root: "C:\\plugins\\plugin_1".to_string(),
            window_max_width: Some("none".to_string()),
            created_at: "2026-05-31T00:00:00Z".to_string(),
            updated_at: "2026-05-31T00:00:00Z".to_string(),
        }];

        let xml = build_plugins_xml(&plugins);
        let parsed = parse_plugins_xml(&xml).expect("xml should be parsed");

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name, "测试插件");
        assert_eq!(parsed[0].description, "包含 <html> & 资源");
        assert_eq!(parsed[0].window_max_width.as_deref(), Some("none"));
    }

    #[test]
    fn should_decode_plugin_runtime_host() {
        let plugin_id = "cyberchef-v11-0-0_1780203402396";
        let encoded = "p6379626572636865662d7631312d302d305f31373830323033343032333936.localhost";

        let decoded = decode_plugin_runtime_host(encoded).expect("runtime host should decode");

        assert_eq!(decoded, plugin_id);
    }

    #[test]
    fn should_reject_unsafe_relative_path() {
        assert!(is_safe_relative_path(Path::new("assets/main.js")));
        assert!(!is_safe_relative_path(Path::new("../main.js")));
        assert!(!is_safe_relative_path(Path::new("assets/../main.js")));
    }
}
