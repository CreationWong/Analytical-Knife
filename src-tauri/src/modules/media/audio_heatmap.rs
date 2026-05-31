use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;
use std::process::{Command, Stdio};

use byteorder::{LittleEndian, ReadBytesExt};
use rayon::prelude::*;
use serde::Serialize;

const EPSILON: f32 = 1e-12;
const DEFAULT_FFT_SIZE: usize = 2048;
const DEFAULT_BAND_COUNT: usize = 96;
const DEFAULT_TARGET_COLUMNS: usize = 640;
const DEFAULT_MIN_FREQUENCY: f32 = 40.0;
const DEFAULT_MAX_FREQUENCY: f32 = 16_000.0;
const DEFAULT_FFMPEG_SAMPLE_RATE: u32 = 44_100;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioHeatmapAnalysis {
    width: usize,
    height: usize,
    intensities: Vec<f32>,
    average_band_intensity: Vec<f32>,
    band_centers: Vec<f32>,
    duration_sec: f32,
    peak_amplitude: f32,
    average_rms: f32,
    peak_rms: f32,
    dominant_frequency: f32,
    db_range: [f32; 2],
    sample_rate: u32,
    channels: u16,
    decoder: String,
    file_size: u64,
}

struct DecodedAudio {
    samples: Vec<f32>,
    sample_rate: u32,
    channels: u16,
    decoder: String,
}

#[derive(Clone)]
struct BandRange {
    start_bin: usize,
    end_bin: usize,
    center_hz: f32,
}

struct FrameAnalysis {
    rms: f32,
    band_db: Vec<f32>,
    band_energy: Vec<f32>,
}

#[tauri::command]
pub fn analyze_audio_heatmap(
    file_path: String,
    fft_size: Option<usize>,
    band_count: Option<usize>,
    target_columns: Option<usize>,
    min_frequency: Option<f32>,
    max_frequency: Option<f32>,
) -> Result<AudioHeatmapAnalysis, String> {
    let metadata = std::fs::metadata(&file_path).map_err(|e| format!("无法读取文件元数据: {}", e))?;
    let decoded = decode_audio_file(&file_path)?;

    Ok(analyze_samples(
        &decoded.samples,
        decoded.sample_rate,
        decoded.channels,
        decoded.decoder,
        metadata.len(),
        fft_size,
        band_count,
        target_columns,
        min_frequency,
        max_frequency,
    ))
}

fn decode_audio_file(file_path: &str) -> Result<DecodedAudio, String> {
    let is_wav = Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("wav") || ext.eq_ignore_ascii_case("wave"))
        .unwrap_or(false);

    if is_wav {
        return decode_wav_file(file_path).or_else(|wav_error| {
            if has_ffmpeg() {
                decode_with_ffmpeg(file_path).map_err(|ffmpeg_error| {
                    format!("WAV 解析失败: {}; FFmpeg 解码也失败: {}", wav_error, ffmpeg_error)
                })
            } else {
                Err(wav_error)
            }
        });
    }

    if has_ffmpeg() {
        return decode_with_ffmpeg(file_path);
    }

    Err("未检测到 FFmpeg，当前 Rust 后端仅能直接解析 WAV 文件".into())
}

fn decode_with_ffmpeg(file_path: &str) -> Result<DecodedAudio, String> {
    let output = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-i",
            file_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            &DEFAULT_FFMPEG_SAMPLE_RATE.to_string(),
            "-f",
            "f32le",
            "-acodec",
            "pcm_f32le",
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("无法启动 FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg 解码失败: {}", stderr.trim()));
    }

    let samples = output
        .stdout
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect::<Vec<_>>();

    if samples.is_empty() {
        return Err("FFmpeg 返回了空音频流".into());
    }

    Ok(DecodedAudio {
        samples,
        sample_rate: DEFAULT_FFMPEG_SAMPLE_RATE,
        channels: 1,
        decoder: "rust-backend/ffmpeg".into(),
    })
}

fn decode_wav_file(file_path: &str) -> Result<DecodedAudio, String> {
    let file = File::open(file_path).map_err(|e| format!("无法打开 WAV 文件: {}", e))?;
    let mut reader = BufReader::new(file);

    let mut riff = [0u8; 4];
    reader.read_exact(&mut riff).map_err(|e| e.to_string())?;
    if &riff != b"RIFF" {
        return Err("文件不是有效的 RIFF/WAVE 格式".into());
    }

    reader
        .read_u32::<LittleEndian>()
        .map_err(|e| format!("读取 WAV 大小失败: {}", e))?;

    let mut wave = [0u8; 4];
    reader.read_exact(&mut wave).map_err(|e| e.to_string())?;
    if &wave != b"WAVE" {
        return Err("文件不是有效的 WAVE 音频".into());
    }

    let mut audio_format = 0u16;
    let mut channels = 0u16;
    let mut sample_rate = 0u32;
    let mut bits_per_sample = 0u16;
    let mut pcm_data = Vec::new();

    loop {
        let mut chunk_id = [0u8; 4];
        if reader.read_exact(&mut chunk_id).is_err() {
            break;
        }

        let chunk_size = reader
            .read_u32::<LittleEndian>()
            .map_err(|e| format!("读取 WAV chunk 大小失败: {}", e))?;

        match &chunk_id {
            b"fmt " => {
                audio_format = reader.read_u16::<LittleEndian>().map_err(|e| e.to_string())?;
                channels = reader.read_u16::<LittleEndian>().map_err(|e| e.to_string())?;
                sample_rate = reader.read_u32::<LittleEndian>().map_err(|e| e.to_string())?;
                reader.read_u32::<LittleEndian>().map_err(|e| e.to_string())?;
                reader.read_u16::<LittleEndian>().map_err(|e| e.to_string())?;
                bits_per_sample = reader.read_u16::<LittleEndian>().map_err(|e| e.to_string())?;

                if chunk_size > 16 {
                    reader
                        .seek(SeekFrom::Current((chunk_size - 16) as i64))
                        .map_err(|e| format!("跳过 fmt 扩展块失败: {}", e))?;
                }
            }
            b"data" => {
                pcm_data.resize(chunk_size as usize, 0);
                reader
                    .read_exact(&mut pcm_data)
                    .map_err(|e| format!("读取音频数据失败: {}", e))?;
            }
            _ => {
                reader
                    .seek(SeekFrom::Current(chunk_size as i64))
                    .map_err(|e| format!("跳过 chunk 失败: {}", e))?;
            }
        }

        if chunk_size % 2 == 1 {
            reader
                .seek(SeekFrom::Current(1))
                .map_err(|e| format!("跳过 WAV padding 失败: {}", e))?;
        }
    }

    if channels == 0 || sample_rate == 0 || bits_per_sample == 0 {
        return Err("WAV 头信息不完整".into());
    }

    if pcm_data.is_empty() {
        return Err("WAV 数据块为空".into());
    }

    let bytes_per_sample = (bits_per_sample / 8) as usize;
    if bytes_per_sample == 0 {
        return Err("无效的位深".into());
    }

    let frame_size = bytes_per_sample * channels as usize;
    if frame_size == 0 {
        return Err("无效的帧大小".into());
    }

    let frame_count = pcm_data.len() / frame_size;
    let mut mono_samples = Vec::with_capacity(frame_count);

    for frame_index in 0..frame_count {
        let frame_offset = frame_index * frame_size;
        let mut frame_sum = 0.0f32;

        for channel_index in 0..channels as usize {
            let sample_offset = frame_offset + channel_index * bytes_per_sample;
            let sample = decode_wav_sample(
                audio_format,
                bits_per_sample,
                &pcm_data[sample_offset..sample_offset + bytes_per_sample],
            )?;
            frame_sum += sample;
        }

        mono_samples.push(frame_sum / channels as f32);
    }

    Ok(DecodedAudio {
        samples: mono_samples,
        sample_rate,
        channels,
        decoder: "rust-backend/wav".into(),
    })
}

fn decode_wav_sample(audio_format: u16, bits_per_sample: u16, bytes: &[u8]) -> Result<f32, String> {
    match (audio_format, bits_per_sample) {
        (1, 8) => Ok((bytes[0] as f32 - 128.0) / 128.0),
        (1, 16) => {
            let value = i16::from_le_bytes([bytes[0], bytes[1]]);
            Ok(value as f32 / 32768.0)
        }
        (1, 24) => {
            let raw = (bytes[0] as i32) | ((bytes[1] as i32) << 8) | ((bytes[2] as i32) << 16);
            let signed = if raw & 0x80_0000 != 0 {
                raw | !0xFF_FFFF
            } else {
                raw
            };
            Ok(signed as f32 / 8_388_608.0)
        }
        (1, 32) => {
            let value = i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
            Ok(value as f32 / 2_147_483_648.0)
        }
        (3, 32) => Ok(f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])),
        (3, 64) => {
            let value = f64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            ]);
            Ok(value as f32)
        }
        _ => Err(format!(
            "暂不支持的 WAV 编码格式: audio_format={}, bits_per_sample={}",
            audio_format, bits_per_sample
        )),
    }
}

fn analyze_samples(
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
    decoder: String,
    file_size: u64,
    fft_size: Option<usize>,
    band_count: Option<usize>,
    target_columns: Option<usize>,
    min_frequency: Option<f32>,
    max_frequency: Option<f32>,
) -> AudioHeatmapAnalysis {
    let duration_sec = samples.len() as f32 / sample_rate as f32;
    let peak_amplitude = get_peak_amplitude(samples);
    let fft_size = normalize_power_of_two(fft_size.unwrap_or(DEFAULT_FFT_SIZE), 256, 8192);
    let band_count = clamp_usize(band_count.unwrap_or(DEFAULT_BAND_COUNT), 24, 256);
    let target_columns = clamp_usize(target_columns.unwrap_or(DEFAULT_TARGET_COLUMNS), 48, 1600);
    let nyquist = sample_rate as f32 / 2.0;
    let min_frequency = clamp_f32(
        min_frequency.unwrap_or(DEFAULT_MIN_FREQUENCY),
        10.0,
        (nyquist / 2.0).max(20.0),
    );
    let max_frequency = clamp_f32(
        max_frequency.unwrap_or(DEFAULT_MAX_FREQUENCY),
        (min_frequency * 2.0).max(100.0),
        nyquist,
    );

    if samples.is_empty() || peak_amplitude < EPSILON {
        return create_silent_result(
            duration_sec,
            band_count,
            target_columns,
            min_frequency,
            max_frequency,
            sample_rate,
            channels,
            decoder,
            file_size,
        );
    }

    let frame_count = get_frame_count(samples.len(), fft_size, target_columns);
    let frame_starts = build_frame_starts(samples.len(), fft_size, frame_count);
    let window = build_hann_window(fft_size);
    let band_ranges = build_band_ranges(sample_rate, fft_size, band_count, min_frequency, max_frequency);

    let frames = frame_starts
        .par_iter()
        .map(|&frame_start| analyze_frame(samples, frame_start, fft_size, &window, &band_ranges))
        .collect::<Vec<_>>();

    let mut intensities_db = vec![0.0f32; frame_count * band_count];
    let mut average_band_energy = vec![0.0f64; band_count];
    let mut average_rms = 0.0f32;
    let mut peak_rms = 0.0f32;
    let mut peak_db = f32::NEG_INFINITY;

    for (frame_index, frame) in frames.iter().enumerate() {
        average_rms += frame.rms;
        peak_rms = peak_rms.max(frame.rms);

        for band_index in 0..band_count {
            let band_db = frame.band_db[band_index];
            intensities_db[band_index * frame_count + frame_index] = band_db;
            average_band_energy[band_index] += frame.band_energy[band_index] as f64;
            peak_db = peak_db.max(band_db);
        }
    }

    average_rms /= frame_count as f32;

    let floor_db = (peak_db - 78.0).max(-110.0);
    let ceiling_db = peak_db;
    let mut intensities = vec![0.0f32; intensities_db.len()];
    for (index, value) in intensities_db.iter().enumerate() {
        intensities[index] = normalize_db(*value, floor_db, ceiling_db);
    }

    let mut average_band_intensity = vec![0.0f32; band_count];
    let mut dominant_frequency = 0.0f32;
    let mut dominant_energy = f64::NEG_INFINITY;

    for band_index in 0..band_count {
        let average_energy = average_band_energy[band_index] / frame_count as f64;
        average_band_intensity[band_index] =
            normalize_db(10.0 * ((average_energy as f32 + EPSILON).log10()), floor_db, ceiling_db);

        if average_energy > dominant_energy {
            dominant_energy = average_energy;
            dominant_frequency = band_ranges[band_index].center_hz;
        }
    }

    AudioHeatmapAnalysis {
        width: frame_count,
        height: band_count,
        intensities,
        average_band_intensity,
        band_centers: band_ranges.iter().map(|band| band.center_hz).collect(),
        duration_sec,
        peak_amplitude,
        average_rms,
        peak_rms,
        dominant_frequency,
        db_range: [floor_db, ceiling_db],
        sample_rate,
        channels,
        decoder,
        file_size,
    }
}

fn analyze_frame(
    samples: &[f32],
    frame_start: usize,
    fft_size: usize,
    window: &[f32],
    band_ranges: &[BandRange],
) -> FrameAnalysis {
    let mut real = vec![0.0f32; fft_size];
    let mut imag = vec![0.0f32; fft_size];
    let mut rms_sum = 0.0f32;

    for sample_index in 0..fft_size {
        let sample = samples.get(frame_start + sample_index).copied().unwrap_or(0.0);
        rms_sum += sample * sample;
        real[sample_index] = sample * window[sample_index];
    }

    fft_in_place(&mut real, &mut imag);

    let mut band_db = Vec::with_capacity(band_ranges.len());
    let mut band_energy = Vec::with_capacity(band_ranges.len());

    for band in band_ranges {
        let mut energy_sum = 0.0f32;
        let mut bin_count = 0usize;

        for bin in band.start_bin..=band.end_bin {
            let magnitude_squared = real[bin] * real[bin] + imag[bin] * imag[bin];
            energy_sum += magnitude_squared;
            bin_count += 1;
        }

        let normalized_energy = energy_sum / bin_count.max(1) as f32;
        band_energy.push(normalized_energy);
        band_db.push(10.0 * (normalized_energy + EPSILON).log10());
    }

    FrameAnalysis {
        rms: (rms_sum / fft_size as f32).sqrt(),
        band_db,
        band_energy,
    }
}

fn create_silent_result(
    duration_sec: f32,
    band_count: usize,
    target_columns: usize,
    min_frequency: f32,
    max_frequency: f32,
    sample_rate: u32,
    channels: u16,
    decoder: String,
    file_size: u64,
) -> AudioHeatmapAnalysis {
    let ratio = (max_frequency / min_frequency).powf(1.0 / (band_count.saturating_sub(1).max(1) as f32));
    let mut band_centers = vec![0.0f32; band_count];
    for (index, band_center) in band_centers.iter_mut().enumerate() {
        *band_center = min_frequency * ratio.powf(index as f32);
    }

    AudioHeatmapAnalysis {
        width: target_columns,
        height: band_count,
        intensities: vec![0.0; target_columns * band_count],
        average_band_intensity: vec![0.0; band_count],
        band_centers,
        duration_sec,
        peak_amplitude: 0.0,
        average_rms: 0.0,
        peak_rms: 0.0,
        dominant_frequency: 0.0,
        db_range: [-110.0, -30.0],
        sample_rate,
        channels,
        decoder,
        file_size,
    }
}

fn build_hann_window(size: usize) -> Vec<f32> {
    let divider = (size.saturating_sub(1)).max(1) as f32;
    (0..size)
        .map(|index| 0.5 - 0.5 * ((2.0 * std::f32::consts::PI * index as f32) / divider).cos())
        .collect()
}

fn build_band_ranges(
    sample_rate: u32,
    fft_size: usize,
    band_count: usize,
    min_frequency: f32,
    max_frequency: f32,
) -> Vec<BandRange> {
    let frequency_resolution = sample_rate as f32 / fft_size as f32;
    let max_bin = (((sample_rate as f32 / 2.0) / frequency_resolution).floor() as usize).max(1);
    let log_ratio = (max_frequency / min_frequency).powf(1.0 / band_count as f32);
    let mut edges = vec![0.0f32; band_count + 1];

    for (index, edge) in edges.iter_mut().enumerate() {
        *edge = min_frequency * log_ratio.powf(index as f32);
    }

    (0..band_count)
        .map(|band_index| {
            let low_hz = edges[band_index];
            let high_hz = edges[band_index + 1];
            let mut start_bin = ((low_hz / frequency_resolution).floor() as usize).max(1);
            let mut end_bin = (((high_hz / frequency_resolution).ceil() as usize).saturating_sub(1)).max(start_bin);

            start_bin = start_bin.min(max_bin);
            end_bin = end_bin.min(max_bin);

            BandRange {
                start_bin,
                end_bin,
                center_hz: (low_hz * high_hz).sqrt(),
            }
        })
        .collect()
}

fn fft_in_place(real: &mut [f32], imag: &mut [f32]) {
    let size = real.len();
    let mut j = 0usize;

    for i in 1..size {
        let mut bit = size >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;

        if i < j {
            real.swap(i, j);
            imag.swap(i, j);
        }
    }

    let mut length = 2usize;
    while length <= size {
        let angle = -2.0 * std::f32::consts::PI / length as f32;
        let step_cos = angle.cos();
        let step_sin = angle.sin();

        let mut offset = 0usize;
        while offset < size {
            let mut unit_real = 1.0f32;
            let mut unit_imag = 0.0f32;
            let half_length = length >> 1;

            for inner in 0..half_length {
                let even_index = offset + inner;
                let odd_index = even_index + half_length;

                let odd_real = real[odd_index] * unit_real - imag[odd_index] * unit_imag;
                let odd_imag = real[odd_index] * unit_imag + imag[odd_index] * unit_real;

                let even_real = real[even_index];
                let even_imag = imag[even_index];

                real[even_index] = even_real + odd_real;
                imag[even_index] = even_imag + odd_imag;
                real[odd_index] = even_real - odd_real;
                imag[odd_index] = even_imag - odd_imag;

                let next_unit_real = unit_real * step_cos - unit_imag * step_sin;
                unit_imag = unit_real * step_sin + unit_imag * step_cos;
                unit_real = next_unit_real;
            }

            offset += length;
        }

        length <<= 1;
    }
}

fn build_frame_starts(sample_length: usize, fft_size: usize, frame_count: usize) -> Vec<usize> {
    let max_start = sample_length.saturating_sub(fft_size);
    if frame_count <= 1 {
        return vec![0];
    }

    (0..frame_count)
        .map(|frame_index| {
            ((max_start as f64 * frame_index as f64) / (frame_count - 1) as f64).round() as usize
        })
        .collect()
}

fn get_frame_count(sample_length: usize, fft_size: usize, target_columns: usize) -> usize {
    if sample_length <= fft_size {
        return 1;
    }

    let max_start = sample_length - fft_size;
    target_columns.min(max_start + 1).max(1)
}

fn get_peak_amplitude(samples: &[f32]) -> f32 {
    samples
        .iter()
        .fold(0.0f32, |peak, sample| peak.max(sample.abs()))
}

fn normalize_db(value: f32, floor_db: f32, ceiling_db: f32) -> f32 {
    if !value.is_finite() || ceiling_db <= floor_db {
        return 0.0;
    }

    clamp_f32((value - floor_db) / (ceiling_db - floor_db), 0.0, 1.0)
}

fn normalize_power_of_two(value: usize, min: usize, max: usize) -> usize {
    if value == 0 {
        return DEFAULT_FFT_SIZE;
    }

    let normalized = value.next_power_of_two();
    clamp_usize(normalized, min, max)
}

fn clamp_f32(value: f32, min: f32, max: f32) -> f32 {
    value.max(min).min(max)
}

fn clamp_usize(value: usize, min: usize, max: usize) -> usize {
    value.max(min).min(max)
}

fn has_ffmpeg() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}
