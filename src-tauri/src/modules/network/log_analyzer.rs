use serde::{Deserialize, Serialize};
use regex::Regex;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use chrono::DateTime;
use percent_encoding::percent_decode_str;

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct LogEntry {
    pub ip: String,
    pub timestamp: String,
    pub method: String,
    pub path: String,
    pub status: String,
    pub size: String,
    pub ua: String,
    pub raw: String,
}

/// 核心解析函数：处理时间格式转换与 URL 解码
fn perform_parse(lines: impl Iterator<Item = String>) -> Vec<LogEntry> {
    let mut results = Vec::new();
    let re_std = Regex::new(r#"(?P<ip>\S+) \S+ \S+ \[(?P<time>.*?)] "(?P<method>\S+) (?P<path>\S+) \S+" (?P<status>\d+) (?P<size>\d+) "(?P<ref>.*?)" "(?P<ua>.*?)""#).unwrap();

    for line in lines {
        if let Some(caps) = re_std.captures(&line) {
            let formatted_time = DateTime::parse_from_str(&caps["time"], "%d/%b/%Y:%H:%M:%S %z")
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                .unwrap_or_else(|_| caps["time"].to_string());

            let decoded_path = percent_decode_str(&caps["path"]).decode_utf8_lossy().to_string();

            results.push(LogEntry {
                ip: caps["ip"].to_string(),
                timestamp: formatted_time,
                method: caps["method"].to_string(),
                path: decoded_path,
                status: caps["status"].to_string(),
                size: caps["size"].to_string(),
                ua: caps["ua"].to_string(),
                raw: line.clone(),
            });
        }
    }
    results
}

#[tauri::command]
pub fn parse_log_content(content: String) -> Result<Vec<LogEntry>, String> {
    Ok(perform_parse(content.lines().map(|s| s.to_string())))
}

#[tauri::command]
pub fn read_and_parse_log(file_path: String) -> Result<Vec<LogEntry>, String> {
    let file = File::open(Path::new(&file_path)).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    Ok(perform_parse(reader.lines().map_while(Result::ok)))
}