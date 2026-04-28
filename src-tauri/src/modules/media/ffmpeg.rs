use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::Emitter;

/// 检查系统是否安装 ffmpeg
#[tauri::command]
pub fn check_ffmpeg() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 运行 ffmpeg 并实时推送日志与进度
#[tauri::command]
pub async fn run_ffmpeg_stream(
    window: tauri::Window,
    input_path: String,
    output_path: String,
    args: Vec<String>,
) -> Result<(), String> {
    // 构造参数列表
    let mut full_args = vec!["-i".to_string(), input_path];
    full_args.extend(args);
    // 强制非交互模式，避免 ffmpeg 等待输入导致进程挂起
    full_args.push("-y".to_string());
    full_args.push(output_path);

    let mut child = Command::new("ffmpeg")
        .args(&full_args)
        .stdout(Stdio::null()) // 进度信息通常在 stderr 输出
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("无法启动 ffmpeg: {}", e))?;

    let stderr = child.stderr.take().ok_or("无法获取 stderr 管道")?;
    let reader = BufReader::new(stderr);

    // 在独立线程或异步任务中处理行读取，避免阻塞
    for line in reader.lines() {
        if let Ok(content) = line {
            // 推送原始日志
            let _ = window.emit("ffmpeg-log", &content);

            // 解析进度 (例如: time=00:00:05.12)
            if let Some(pos) = content.find("time=") {
                let end_pos = content[pos..].find(' ').unwrap_or(content.len() - pos);
                let timestamp = &content[pos + 5..pos + end_pos];
                let _ = window.emit("ffmpeg-progress", timestamp.trim());
            }
        }
    }

    let status = child.wait().map_err(|e| format!("等待进程结束时出错: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("ffmpeg 退出码非零: {:?}", status.code()))
    }
}