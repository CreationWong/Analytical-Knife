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
    pub remote_user: String,
    pub timestamp: String,
    pub method: String,
    pub path: String,
    pub status: String,
    pub size: String,
    pub referer: String,
    pub ua: String,
    pub x_forwarded_for: String,
    pub request_time: String,
    pub upstream_response_time: String,
    pub scheme: String,
    pub host: String,
    pub server_protocol: String,
    pub raw: String,
}

/// 核心解析函数：处理时间格式转换与 URL 解码
/// 三级回退：完整扩展格式 → 标准格式+X-Forwarded-For → 标准格式
fn perform_parse(lines: impl Iterator<Item = String>) -> Vec<LogEntry> {
    let mut results = Vec::new();

    // 扩展格式（Nginx extended with all fields）：
    // $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent
    // "$http_referer" "$http_user_agent" "$http_x_forwarded_for" $request_time
    // $upstream_response_time $scheme $request_method $host $server_protocol
    let re_ext = Regex::new(
        r#"(?x)
        (?P<ip>\S+)\s+-\s+(?P<remote_user>\S+)\s+
        \[(?P<time>[^\]]+)\]\s+
        "(?P<method>\S+)\s+(?P<path>\S+)\s+\S+"\s+
        (?P<status>\d+)\s+
        (?P<size>\S+)\s+
        "(?P<ref>[^"]*)"\s+
        "(?P<ua>[^"]*)"\s+
        "(?P<x_ff>[^"]*)"\s+
        (?P<req_time>\S+)\s+
        (?P<upstream_time>\S+)\s+
        (?P<scheme>\S+)\s+
        (?P<method_ext>\S+)\s+
        (?P<host>\S+)\s+
        (?P<server_proto>\S+)
        "#
    ).unwrap();

    // 标准格式 + X-Forwarded-For（无后续扩展字段）：
    // $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent
    // "$http_referer" "$http_user_agent" "$http_x_forwarded_for"
    let re_xff = Regex::new(
        r#"(?P<ip>\S+) \S+ \S+ \[(?P<time>.*?)] "(?P<method>\S+) (?P<path>\S+) \S+" (?P<status>\d+) (?P<size>\S+) "(?P<ref>.*?)" "(?P<ua>.*?)" "(?P<x_ff>[^"]*)""#
    ).unwrap();

    // 标准格式（Nginx combined）：
    // $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
    let re_std = Regex::new(
        r#"(?P<ip>\S+) \S+ \S+ \[(?P<time>.*?)] "(?P<method>\S+) (?P<path>\S+) \S+" (?P<status>\d+) (?P<size>\S+) "(?P<ref>.*?)" "(?P<ua>.*?)""#
    ).unwrap();

    for line in lines {
        let entry = if let Some(caps) = re_ext.captures(&line) {
            parse_captures(&caps, ParseMode::FullExtended, &line)
        } else if let Some(caps) = re_xff.captures(&line) {
            parse_captures(&caps, ParseMode::WithXForwardedFor, &line)
        } else if let Some(caps) = re_std.captures(&line) {
            parse_captures(&caps, ParseMode::Standard, &line)
        } else {
            None
        };

        if let Some(e) = entry {
            results.push(e);
        }
    }
    results
}

#[derive(PartialEq)]
enum ParseMode {
    Standard,
    WithXForwardedFor,
    FullExtended,
}

fn parse_captures(caps: &regex::Captures, mode: ParseMode, line: &str) -> Option<LogEntry> {
    let formatted_time = DateTime::parse_from_str(&caps["time"], "%d/%b/%Y:%H:%M:%S %z")
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|_| caps["time"].to_string());

    let decoded_path = percent_decode_str(&caps["path"]).decode_utf8_lossy().to_string();

    match mode {
        ParseMode::FullExtended => Some(LogEntry {
            ip: caps["ip"].to_string(),
            remote_user: clean_dash(&caps["remote_user"]),
            timestamp: formatted_time,
            method: caps["method_ext"].to_string(),
            path: decoded_path,
            status: caps["status"].to_string(),
            size: caps["size"].to_string(),
            referer: caps["ref"].to_string(),
            ua: caps["ua"].to_string(),
            x_forwarded_for: clean_dash(&caps["x_ff"]),
            request_time: caps["req_time"].to_string(),
            upstream_response_time: caps["upstream_time"].to_string(),
            scheme: caps["scheme"].to_string(),
            host: caps["host"].to_string(),
            server_protocol: caps["server_proto"].to_string(),
            raw: line.to_string(),
        }),
        ParseMode::WithXForwardedFor => Some(LogEntry {
            ip: caps["ip"].to_string(),
            remote_user: String::new(),
            timestamp: formatted_time,
            method: caps["method"].to_string(),
            path: decoded_path,
            status: caps["status"].to_string(),
            size: caps["size"].to_string(),
            referer: caps["ref"].to_string(),
            ua: caps["ua"].to_string(),
            x_forwarded_for: clean_dash(&caps["x_ff"]),
            request_time: String::new(),
            upstream_response_time: String::new(),
            scheme: String::new(),
            host: String::new(),
            server_protocol: String::new(),
            raw: line.to_string(),
        }),
        ParseMode::Standard => Some(LogEntry {
            ip: caps["ip"].to_string(),
            remote_user: String::new(),
            timestamp: formatted_time,
            method: caps["method"].to_string(),
            path: decoded_path,
            status: caps["status"].to_string(),
            size: caps["size"].to_string(),
            referer: caps["ref"].to_string(),
            ua: caps["ua"].to_string(),
            x_forwarded_for: String::new(),
            request_time: String::new(),
            upstream_response_time: String::new(),
            scheme: String::new(),
            host: String::new(),
            server_protocol: String::new(),
            raw: line.to_string(),
        }),
    }
}

/// Nginx 用短横 "-" 表示空值，转换为空串以便前端统一判断
fn clean_dash(s: &str) -> String {
    if s == "-" { String::new() } else { s.to_string() }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_format() {
        let log_line = r#"192.168.1.1 - - [07/Jun/2026:10:15:30 +0800] "GET /api/data HTTP/1.1" 200 1234 "https://example.com" "Mozilla/5.0""#;
        let result = perform_parse(vec![log_line.to_string()].into_iter());
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].ip, "192.168.1.1");
        assert_eq!(result[0].method, "GET");
        assert_eq!(result[0].path, "/api/data");
        assert_eq!(result[0].status, "200");
        assert_eq!(result[0].size, "1234");
        assert_eq!(result[0].ua, "Mozilla/5.0");
        assert_eq!(result[0].referer, "https://example.com");
        assert_eq!(result[0].timestamp, "2026-06-07 10:15:30");
        // 扩展字段应为空
        assert_eq!(result[0].x_forwarded_for, "");
        assert_eq!(result[0].request_time, "");
        assert_eq!(result[0].host, "");
    }

    #[test]
    fn test_extended_format() {
        let log_line = r#"10.0.0.1 - admin [07/Jun/2026:14:22:01 +0800] "POST /api/login HTTP/2.0" 200 512 "https://app.example.com" "curl/7.88" "203.0.113.5, 10.0.0.1" 0.045 0.042 https POST api.example.com HTTP/2.0"#;
        let result = perform_parse(vec![log_line.to_string()].into_iter());
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].ip, "10.0.0.1");
        assert_eq!(result[0].remote_user, "admin");
        assert_eq!(result[0].method, "POST");
        assert_eq!(result[0].path, "/api/login");
        assert_eq!(result[0].status, "200");
        assert_eq!(result[0].size, "512");
        assert_eq!(result[0].referer, "https://app.example.com");
        assert_eq!(result[0].ua, "curl/7.88");
        assert_eq!(result[0].x_forwarded_for, "203.0.113.5, 10.0.0.1");
        assert_eq!(result[0].request_time, "0.045");
        assert_eq!(result[0].upstream_response_time, "0.042");
        assert_eq!(result[0].scheme, "https");
        assert_eq!(result[0].host, "api.example.com");
        assert_eq!(result[0].server_protocol, "HTTP/2.0");
        assert_eq!(result[0].timestamp, "2026-06-07 14:22:01");
    }

    #[test]
    fn test_extended_with_dash_size() {
        // body_bytes_sent 可能为 "-"（如 304 响应）
        let log_line = r#"10.0.0.1 - - [07/Jun/2026:10:15:30 +0800] "GET /static/style.css HTTP/1.1" 304 - "https://example.com" "Mozilla/5.0" "-" 0.001 0.000 https GET cdn.example.com HTTP/1.1"#;
        let result = perform_parse(vec![log_line.to_string()].into_iter());
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].status, "304");
        assert_eq!(result[0].size, "-");
        assert_eq!(result[0].host, "cdn.example.com");
    }

    #[test]
    fn test_mixed_formats() {
        let lines = vec![
            r#"1.1.1.1 - - [07/Jun/2026:08:00:00 +0800] "GET /a HTTP/1.1" 200 10 "https://a.com" "bot1""#.to_string(),
            r#"2.2.2.2 - user [07/Jun/2026:08:01:00 +0800] "DELETE /b HTTP/1.1" 204 0 "https://b.com" "bot2" "10.0.0.2" 0.500 0.498 https DELETE api.b.com HTTP/1.1"#.to_string(),
            r#"3.3.3.3 - - [07/Jun/2026:08:02:00 +0800] "GET /c HTTP/1.1" 302 0 "https://c.com" "bot3""#.to_string(),
        ];
        let result = perform_parse(lines.into_iter());
        assert_eq!(result.len(), 3);
        // 标准格式
        assert_eq!(result[0].ip, "1.1.1.1");
        assert_eq!(result[0].x_forwarded_for, "");
        // 扩展格式
        assert_eq!(result[1].ip, "2.2.2.2");
        assert_eq!(result[1].remote_user, "user");
        assert_eq!(result[1].x_forwarded_for, "10.0.0.2");
        assert_eq!(result[1].request_time, "0.500");
        // 标准格式
        assert_eq!(result[2].ip, "3.3.3.3");
        assert_eq!(result[2].x_forwarded_for, "");
    }

    #[test]
    fn test_standard_with_x_forwarded_for_only() {
        // 标准 combined 格式末尾只多一个 X-Forwarded-For，无后续扩展字段
        let log_line = r#"172.70.176.44 - - [07/Jun/2026:08:40:25 +0000] "GET /.env.old HTTP/1.1" 200 4314 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0" "208.84.100.110""#;
        let result = perform_parse(vec![log_line.to_string()].into_iter());
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].ip, "172.70.176.44");
        assert_eq!(result[0].x_forwarded_for, "208.84.100.110");
        assert_eq!(result[0].method, "GET");
        assert_eq!(result[0].path, "/.env.old");
        assert_eq!(result[0].status, "200");
        assert_eq!(result[0].request_time, "");
        assert_eq!(result[0].host, "");
    }

    #[test]
    fn test_dash_x_forwarded_for_treated_as_empty() {
        // X-Forwarded-For 为 "-" 表示没有这个头，应视为空
        let log_line = r#"110.35.80.116 - - [07/Jun/2026:08:48:18 +0000] "POST /cgi-bin/test HTTP/1.1" 400 157 "-" "-" "-""#;
        let result = perform_parse(vec![log_line.to_string()].into_iter());
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].ip, "110.35.80.116");
        assert_eq!(result[0].x_forwarded_for, "");
        assert_eq!(result[0].referer, "-");
        assert_eq!(result[0].ua, "-");
    }

    #[test]
    fn test_invalid_line_skipped() {
        let lines = vec![
            "this is not a valid log line".to_string(),
            r#"10.0.0.1 - - [07/Jun/2026:10:15:30 +0800] "GET /test HTTP/1.1" 200 123 "https://x.com" "test-agent""#.to_string(),
        ];
        let result = perform_parse(lines.into_iter());
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].ip, "10.0.0.1");
    }
}
