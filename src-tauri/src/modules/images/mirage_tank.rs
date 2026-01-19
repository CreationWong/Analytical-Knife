use base64::{engine::general_purpose, Engine as _};
use image::{GenericImageView, ImageBuffer, ImageFormat, Rgba, RgbaImage};
use rayon::prelude::*;
use std::cmp::min;
use std::io::Cursor;

#[tauri::command]
pub fn generate_mirage_tank(
    img_f_bytes: Vec<u8>,
    img_b_bytes: Vec<u8>,
    brightness_f: f64,
    brightness_b: f64,
) -> Result<String, String> {
    // 加载图片
    let img_f =
        image::load_from_memory(&img_f_bytes).map_err(|e| format!("无法加载表图: {}", e))?;
    let img_b =
        image::load_from_memory(&img_b_bytes).map_err(|e| format!("无法加载里图: {}", e))?;

    let (w_f, h_f) = img_f.dimensions();
    let (w_b, h_b) = img_b.dimensions();

    // 计算公共尺寸 (取较小值)
    let w_min = min(w_f, w_b);
    let h_min = min(h_b, h_f);

    // 准备裁剪参数 (居中裁剪逻辑复刻)
    let trans_f_x = (w_f - w_min) / 2;
    let trans_f_y = (h_f - h_min) / 2;
    let trans_b_x = (w_b - w_min) / 2;
    let trans_b_y = (h_b - h_min) / 2;

    // 创建新画布
    let mut new_image: RgbaImage = ImageBuffer::new(w_min, h_min);

    // 并行处理像素 (Rayon加速)
    // 并行迭代器
    new_image
        .enumerate_pixels_mut()
        .par_bridge()
        .for_each(|(x, y, pixel)| {
            // 获取对应坐标的原始像素
            // 注意加上偏移量
            let p_f = img_f.get_pixel(trans_f_x + x, trans_f_y + y);
            let p_b = img_b.get_pixel(trans_b_x + x, trans_b_y + y);

            // 提取 RGB (0-255)
            let r_f = p_f[0] as f64;
            let g_f = p_f[1] as f64;
            let b_f = p_f[2] as f64;

            let r_b = p_b[0] as f64;
            let g_b = p_b[1] as f64;
            let b_b = p_b[2] as f64;

            // --- 核心算法复刻 (开始) ---
            // 亮度修正
            let a_factor = brightness_f / 10.0;
            let b_factor = brightness_b / 10.0;

            let r_f_mod = r_f * a_factor;
            let g_f_mod = g_f * a_factor;
            let b_f_mod = b_f * a_factor;

            let r_b_mod = r_b * b_factor;
            let g_b_mod = g_b * b_factor;
            let b_b_mod = b_b * b_factor;

            let delta_r = r_b_mod - r_f_mod;
            let delta_g = g_b_mod - g_f_mod;
            let delta_b = b_b_mod - b_f_mod;

            // 复杂系数计算
            let coe_a = 8.0 + 255.0 / 256.0 + (delta_r - delta_b) / 256.0;
            let coe_b = 4.0 * delta_r
                + 8.0 * delta_g
                + 6.0 * delta_b
                + ((delta_r - delta_b) * (r_b_mod + r_f_mod)) / 256.0
                + (delta_r.powi(2) - delta_b.powi(2)) / 512.0;

            let a_new_val = 255.0 + coe_b / (2.0 * coe_a);

            // 边界修正与最终颜色计算
            let (r_new, g_new, b_new, a_new);

            if a_new_val <= 0.0 {
                a_new = 0;
                r_new = 0;
                g_new = 0;
                b_new = 0;
            } else if a_new_val >= 255.0 {
                a_new = 255;
                // 避免除以 255 导致微小误差
                // A_new=255，即 R_b_mod
                r_new = r_b_mod.round() as u8;
                g_new = g_b_mod.round() as u8;
                b_new = b_b_mod.round() as u8;
            } else {
                // 正常范围
                let a_denom = a_new_val;
                r_new = ((255.0 * r_b_mod) / a_denom).clamp(0.0f64, 255.0f64) as u8;
                g_new = ((255.0 * g_b_mod) / a_denom).clamp(0.0f64, 255.0f64) as u8;
                b_new = ((255.0 * b_b_mod) / a_denom).clamp(0.0f64, 255.0f64) as u8;
                a_new = a_new_val.round() as u8;
            }
            // --- 核心算法复刻 (结束) ---

            *pixel = Rgba([r_new, g_new, b_new, a_new]);
        });

    // 导出图片为 Base64 字符串
    let mut buffer = Cursor::new(Vec::new());
    new_image
        .write_to(&mut buffer, ImageFormat::Png)
        .map_err(|e| format!("生成图片失败: {}", e))?;

    let base64_str = general_purpose::STANDARD.encode(buffer.get_ref());
    Ok(format!("data:image/png;base64,{}", base64_str))
}

// 后端算法单元测试
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mirage_logic() {
        // 创建两个 1x1 的简单图片进行逻辑验证
        let img1 = RgbaImage::from_pixel(1, 1, Rgba([255, 255, 255, 255])); // 白
        let img2 = RgbaImage::from_pixel(1, 1, Rgba([0, 0, 0, 255])); // 黑

        let mut buf1 = Cursor::new(Vec::new());
        img1.write_to(&mut buf1, ImageFormat::Png).unwrap();

        let mut buf2 = Cursor::new(Vec::new());
        img2.write_to(&mut buf2, ImageFormat::Png).unwrap();

        let res = generate_mirage_tank(buf1.into_inner(), buf2.into_inner(), 12.0, 7.0);

        assert!(res.is_ok());
        assert!(res.unwrap().starts_with("data:image/png;base64,"));
    }
}
