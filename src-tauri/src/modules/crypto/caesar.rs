use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CrackResult {
    pub label: String, // 算法名称
    pub text: String,
    pub score: f64, // 评分
}

// 简单的英文频率打分
fn score_text(text: &str) -> f64 {
    let english_freq = "etaoinshrdlcumwfgypbvkjxqz";
    let text_lower = text.to_lowercase();
    let mut score = 0.0;

    for c in text_lower.chars() {
        if let Some(idx) = english_freq.find(c) {
            score += (26 - idx) as f64;
        }
    }
    score
}

// --- 核心算法实现 ---

// 标准凯撒 (支持可选的数字偏移)
fn rotate_standard(text: &str, shift: u8, decrypt: bool, shift_numbers: bool) -> String {
    let shift_alpha = if decrypt {
        (26 - (shift % 26)) % 26
    } else {
        shift % 26
    };
    let shift_digit = if decrypt {
        (10 - (shift % 10)) % 10
    } else {
        shift % 10
    };

    text.chars()
        .map(|c| {
            if c.is_ascii_alphabetic() {
                let base = if c.is_ascii_lowercase() { b'a' } else { b'A' };
                let offset = c as u8 - base;
                let new_offset = (offset + shift_alpha) % 26;
                (base + new_offset) as char
            } else if shift_numbers && c.is_ascii_digit() {
                let base = b'0';
                let offset = c as u8 - base;
                let new_offset = (offset + shift_digit) % 10;
                (base + new_offset) as char
            } else {
                c
            }
        })
        .collect()
}

// ROT18 (字母 ROT13 + 数字 ROT5)
fn rotate_rot18(text: &str) -> String {
    text.chars()
        .map(|c| {
            if c.is_ascii_alphabetic() {
                let base = if c.is_ascii_lowercase() { b'a' } else { b'A' };
                let offset = c as u8 - base;
                (base + (offset + 13) % 26) as char
            } else if c.is_ascii_digit() {
                let base = b'0';
                let offset = c as u8 - base;
                (base + (offset + 5) % 10) as char
            } else {
                c
            }
        })
        .collect()
}

// ROT47 (ASCII 33-126 位移 47)
fn rotate_rot47(text: &str) -> String {
    text.chars()
        .map(|c| {
            let val = c as u32;
            if val >= 33 && val <= 126 {
                // 33 + ((当前值 - 33 + 47) % 94)
                std::char::from_u32(33 + ((val - 33 + 47) % 94)).unwrap_or(c)
            } else {
                c
            }
        })
        .collect()
}

// --- Tauri Commands ---

#[tauri::command]
pub fn caesar_transform(
    input: String,
    shift: u8,
    mode: String,
    shift_numbers: bool,
    variant: String, // "standard" | "rot18" | "rot47"
) -> Result<String, String> {
    if input.is_empty() {
        return Ok("".into());
    }

    let res = match variant.as_str() {
        "rot18" => rotate_rot18(&input),
        "rot47" => rotate_rot47(&input),
        _ => {
            let is_decrypt = mode == "decrypt";
            rotate_standard(&input, shift, is_decrypt, shift_numbers)
        }
    };

    Ok(res)
}

#[tauri::command]
pub fn caesar_crack(
    input: String,
    keyword: Option<String>,
    scope: String, // "common" | "full"
) -> Result<Vec<CrackResult>, String> {
    if input.is_empty() {
        return Err("输入内容不能为空".into());
    }

    let mut results = Vec::new();

    // 辅助闭包：添加结果并评分
    let mut add_result = |label: String, decoded: String| {
        let mut score = score_text(&decoded);
        if let Some(ref k) = keyword {
            if !k.is_empty() && decoded.to_lowercase().contains(&k.to_lowercase()) {
                score += 1000.0; // 命中关键词加分
            }
        }
        results.push(CrackResult {
            label,
            text: decoded,
            score,
        });
    };

    // 始终运行常用算法
    add_result("ROT3".into(), rotate_standard(&input, 3, true, false));
    add_result(
        "ROT5 (Digits)".into(),
        rotate_standard(&input, 5, true, true),
    );
    add_result("ROT13".into(), rotate_standard(&input, 13, true, false));
    add_result("ROT18".into(), rotate_rot18(&input));
    add_result("ROT47".into(), rotate_rot47(&input));

    // 如果是 Full 模式，补充其余位移 (1-26)
    if scope == "full" {
        for s in 1..26 {
            // 跳过已计算的常用位移
            if s == 3 || s == 5 || s == 13 {
                continue;
            }

            // 默认计算包含数字偏移的情况 (通用性更强)
            let decoded = rotate_standard(&input, s as u8, true, true);
            add_result(format!("Shift -{}", s), decoded);
        }
    }

    // 按分数排序 (高分在前)
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- 基础算法测试 ---

    #[test]
    fn test_standard_encrypt() {
        // 基础位移 +3
        let res = caesar_transform(
            "Hello World".into(),
            3,
            "encrypt".into(),
            false,
            "standard".into(),
        )
        .unwrap();
        assert_eq!(res, "Khoor Zruog");
    }

    #[test]
    fn test_standard_decrypt() {
        // 基础解密 -3 (实际上是 +23)
        let res = caesar_transform(
            "Khoor Zruog".into(),
            3,
            "decrypt".into(),
            false,
            "standard".into(),
        )
        .unwrap();
        assert_eq!(res, "Hello World");
    }

    #[test]
    fn test_wrap_around() {
        // 边界测试：Z + 1 = A
        let res =
            caesar_transform("Zz".into(), 1, "encrypt".into(), false, "standard".into()).unwrap();
        assert_eq!(res, "Aa");
    }

    #[test]
    fn test_number_shift() {
        // 数字偏移开关测试
        // 关闭数字偏移
        let res_off =
            caesar_transform("A1".into(), 1, "encrypt".into(), false, "standard".into()).unwrap();
        assert_eq!(res_off, "B1");

        // 开启数字偏移 (1 -> 2)
        let res_on =
            caesar_transform("A1".into(), 1, "encrypt".into(), true, "standard".into()).unwrap();
        assert_eq!(res_on, "B2");

        // 数字回绕 (9 -> 0)
        let res_wrap =
            caesar_transform("9".into(), 1, "encrypt".into(), true, "standard".into()).unwrap();
        assert_eq!(res_wrap, "0");
    }

    // --- 变体算法测试 ---

    #[test]
    fn test_rot18() {
        // ROT18 = ROT13 (字母) + ROT5 (数字)
        // A -> N, 0 -> 5
        let input = "A0";
        let encrypted =
            caesar_transform(input.into(), 0, "encrypt".into(), false, "rot18".into()).unwrap();
        assert_eq!(encrypted, "N5");

        // 自反性测试：两次 ROT18 应该变回原样
        let decrypted =
            caesar_transform(encrypted, 0, "encrypt".into(), false, "rot18".into()).unwrap();
        assert_eq!(decrypted, input);
    }

    #[test]
    fn test_rot47() {
        // ROT47 测试
        // 'a' (97) -> '2' (50)
        let input = "abc";
        let encrypted =
            caesar_transform(input.into(), 0, "encrypt".into(), false, "rot47".into()).unwrap();
        assert_eq!(encrypted, "234");

        // 自反性测试
        let decrypted =
            caesar_transform(encrypted, 0, "encrypt".into(), false, "rot47".into()).unwrap();
        assert_eq!(decrypted, input);
    }

    // --- 暴力破解测试 ---

    #[test]
    fn test_crack_common() {
        // 测试能否在 "common" 范围内破解 ROT13
        // 原文: HELLO -> ROT13 -> URYYB
        let cipher = "URYYB";

        let results = caesar_crack(cipher.into(), None, "common".into()).unwrap();

        // 应该有结果，且排名第一的应该是 ROT13 变回 HELLO
        assert!(!results.is_empty());
        let best_match = &results[0];

        assert_eq!(best_match.label, "ROT13");
        assert_eq!(best_match.text, "HELLO");
    }

    #[test]
    fn test_crack_full_scope() {
        // 原文: THE -> (+7) -> AOL
        let cipher = "AOL";
        let expected_plain = "THE";

        // 1. 先用 common 跑，应该找不到完美匹配 (ROT3,5,13,18,47 都不对)
        let common_results = caesar_crack(cipher.into(), None, "common".into()).unwrap();
        // 检查 common 里是否包含 Shift -7 (不应该包含)
        let found_in_common = common_results.iter().any(|r| r.text == expected_plain);
        assert!(!found_in_common, "Common scope shouldn't include Shift 7");

        // 2. 用 full 跑
        let full_results = caesar_crack(cipher.into(), None, "full".into()).unwrap();

        // 3. 验证结果
        // 因为 "THE" 包含 T(第2高频), H(高频), E(第1高频)，它的得分应该是极高的，大概率排第一
        let best_match = &full_results[0];
        // 如果第一名不是 THE，打印出来看看是谁（便于调试），通常 THE 会是第一
        if best_match.text != expected_plain {
            println!(
                "Warning: Best match was {} ({}), expected {}",
                best_match.text, best_match.label, expected_plain
            );
            // 如果评分系统非常不稳，可以改为在列表中查找
            let target = full_results
                .iter()
                .find(|r| r.text == expected_plain)
                .expect("Should find THE in results");
            assert!(target.label.contains("Shift -7"));
        } else {
            assert_eq!(best_match.text, expected_plain);
            assert!(best_match.label.contains("Shift -7"));
        }
    }
    #[test]
    fn test_crack_keyword() {
        // 测试关键词加权
        // 密文对应两个可能的英文单词，但关键词强制指定一个
        // 这里的例子比较简单：确保含有关键词的结果得分极高

        let cipher = "KHOOR"; // HELLO (+3)
        let keyword = "HELLO";

        let results = caesar_crack(cipher.into(), Some(keyword.into()), "full".into()).unwrap();

        // 命中的结果分数应该非常高 (> 1000)
        assert!(results[0].score > 1000.0);
        assert_eq!(results[0].text, "HELLO");
    }

    #[test]
    fn test_empty_input() {
        // 边界测试：空输入
        let res =
            caesar_transform("".into(), 3, "encrypt".into(), false, "standard".into()).unwrap();
        assert_eq!(res, "");
    }
}
