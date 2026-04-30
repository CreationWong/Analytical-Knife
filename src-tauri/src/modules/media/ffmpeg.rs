use std::process::Stdio;
use std::sync::Arc;

use tauri::{Emitter, State, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

// ===================== 状态 =====================

pub struct FfmpegProcess(pub Arc<Mutex<Option<Child>>>);

// ===================== check =====================

#[tauri::command]
pub fn check_ffmpeg() -> bool {
    std::process::Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

// ===================== stop =====================

#[tauri::command]
pub async fn stop_ffmpeg_native(
    state: State<'_, FfmpegProcess>,
) -> Result<(), String> {
    let mut lock = state.0.lock().await;

    if let Some(mut child) = lock.take() {
        child.kill().await.map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("没有运行中的任务".into())
    }
}

// ===================== utils =====================

fn parse_time_to_secs(t: &str) -> f64 {
    let parts: Vec<f64> = t
        .split(':')
        .filter_map(|p| p.parse::<f64>().ok())
        .collect();

    if parts.len() == 3 {
        parts[0] * 3600.0 + parts[1] * 60.0 + parts[2]
    } else {
        0.0
    }
}

// 获取视频时长
async fn get_duration(input: &str) -> f64 {
    let output = Command::new("ffmpeg")
        .args(["-i", input])
        .stderr(Stdio::piped())
        .output()
        .await;

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stderr);

        for line in text.lines() {
            if let Some(pos) = line.find("Duration:") {
                let sub = &line[pos + 9..];
                let time = sub.split(',').next().unwrap_or("").trim();
                return parse_time_to_secs(time);
            }
        }
    }

    0.0
}

// ===================== run =====================

#[tauri::command]
pub async fn run_ffmpeg_stream(
    window: Window,
    state: State<'_, FfmpegProcess>,
    input_path: String,
    output_path: String,
    args: Vec<String>,
) -> Result<(), String> {

    // ---------- 防并发 ----------
    {
        let lock = state.0.lock().await;
        if lock.is_some() {
            return Err("已有任务运行中".into());
        }
    }

    let duration = get_duration(&input_path).await;

    let mut full_args = vec![
        "-hide_banner".to_string(),
        "-progress".to_string(),
        "pipe:2".to_string(),
        "-i".to_string(),
        input_path.clone(),
    ];

    full_args.extend(args);
    full_args.push("-y".to_string());
    full_args.push(output_path);

    // ---------- 启动 FFmpeg ----------
    let mut child = Command::new("ffmpeg")
        .args(&full_args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动失败: {}", e))?;

    let stderr = child.stderr.take().ok_or("无法获取日志流")?;

    // ---------- 存入 state ----------
    {
        let mut lock = state.0.lock().await;
        *lock = Some(child);
    }

    let mut reader = BufReader::new(stderr).lines();

    let mut last_progress = 0.0;

    // ---------- 读取日志 ----------
    while let Ok(Some(line)) = reader.next_line().await {
        let _ = window.emit("ffmpeg-log", &line);

        if line.starts_with("out_time_ms=") {
            if let Ok(ms) = line[12..].parse::<f64>() {
                let current = ms / 1_000_000.0;

                if duration > 0.0 {
                    let progress = (current / duration).min(1.0);

                    if (progress - last_progress) > 0.005 {
                        last_progress = progress;
                        let _ = window.emit("ffmpeg-progress", progress);
                    }
                }
            }
        }
    }

    // ---------- 回收进程 ----------
    let mut child = {
        let mut lock = state.0.lock().await;
        lock.take().ok_or("进程丢失")?
    };

    let status = child.wait().await.map_err(|e| e.to_string())?;

    if status.success() {
        let _ = window.emit("ffmpeg-progress", 1.0);
        Ok(())
    } else {
        Err("FFmpeg 执行失败".into())
    }
}