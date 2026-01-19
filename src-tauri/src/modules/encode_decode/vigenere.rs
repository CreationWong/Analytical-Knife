use serde::Serialize;

const ENGLISH_IC: f64 = 0.067; // 英文标准重合指数
const ENGLISH_FREQ: [f64; 26] = [
    0.08167, 0.01492, 0.02782, 0.04253, 0.12702, 0.02228, 0.02015,
    0.06094, 0.06966, 0.00153, 0.00772, 0.04025, 0.02406, 0.06749,
    0.07507, 0.01929, 0.00095, 0.05987, 0.06327, 0.09056, 0.02758,
    0.00978, 0.02360, 0.00150, 0.01974, 0.00074
];

#[derive(Serialize, Debug)]
pub struct CrackResult {
    key: String,
    key_length: usize,
    plaintext: String,
    ic_score: f64,
}

#[tauri::command]
pub fn vigenere_cipher(input: String, key: String, mode: String) -> Result<String, String> {
    if input.is_empty() { return Err("输入内容不能为空".into()); }

    let k_vec: Vec<u8> = key.chars()
        .filter(|c| c.is_ascii_alphabetic())
        .map(|c| c.to_ascii_uppercase() as u8 - b'A')
        .collect();

    if k_vec.is_empty() { return Err("密钥必须包含有效的英文字母".into()); }

    let is_encrypt = match mode.as_str() {
        "encrypt" => true,
        "decrypt" => false,
        _ => return Err("无效的操作模式".into()),
    };

    let mut key_idx = 0;
    let k_len = k_vec.len();

    let result: String = input.chars().map(|char_in| {
        if char_in.is_ascii_alphabetic() {
            let base = if char_in.is_ascii_uppercase() { b'A' } else { b'a' };
            let m_i = char_in as u8 - base;
            let k_i = k_vec[key_idx % k_len];
            key_idx += 1;

            let val = if is_encrypt {
                (m_i + k_i) % 26
            } else {
                (m_i + 26 - k_i) % 26
            };
            (base + val) as char
        } else {
            char_in
        }
    }).collect();

    Ok(result)
}

#[tauri::command]
pub fn crack_vigenere_auto(ciphertext: String) -> Result<CrackResult, String> {
    let clean_text: Vec<u8> = ciphertext.chars()
        .filter(|c| c.is_ascii_alphabetic())
        .map(|c| c.to_ascii_uppercase() as u8)
        .collect();

    if clean_text.len() < 20 {
        return Err("密文太短，无法进行统计分析".into());
    }

    // 1. 计算所有候选长度的 IC 值
    let max_try_len = 20.min(clean_text.len() / 2);
    let mut candidates: Vec<(usize, f64)> = Vec::new();

    for len in 1..=max_try_len {
        let mut total_ic = 0.0;
        for i in 0..len {
            let group: Vec<u8> = clean_text.iter().skip(i).step_by(len).cloned().collect();
            total_ic += calculate_ic(&group);
        }
        let avg_ic = total_ic / len as f64;
        candidates.push((len, avg_ic));
    }

    // 2. 智能选择最佳长度
    // 策略：先按“距离英文IC(0.067)的接近程度”排序
    // 这样，6 和 12 都会排在 3 前面 (因为 3 的 IC 只有 0.05 左右，而 6 是 0.067)
    candidates.sort_by(|a, b| {
        let diff_a = (a.1 - ENGLISH_IC).abs();
        let diff_b = (b.1 - ENGLISH_IC).abs();
        diff_a.partial_cmp(&diff_b).unwrap()
    });

    // 取出最接近的那个（可能是 6，也可能是 12）
    let (mut best_len, best_ic) = candidates[0];

    // 3. 倍数约简 (Factor Reduction)
    // 如果最佳长度是 12，我们要检查它的因子（如 6, 4, 3）是否也足够好。
    // 如果因子也 > 0.060，说明 12 只是倍数，因子才是真身。
    // 我们从小到大检查因子。
    let mut reduced_len = best_len;
    for check_len in 1..best_len {
        // 如果是因子
        if best_len % check_len == 0 {
            // 查找这个因子的 IC
            if let Some(&(_, factor_ic)) = candidates.iter().find(|(l, _)| *l == check_len) {
                // 如果因子的 IC 也非常高 (说明它是单表代换)，则优先选因子
                if factor_ic > 0.060 {
                    reduced_len = check_len;
                    break; // 找到最小的合格因子即可
                }
            }
        }
    }
    best_len = reduced_len;

    // 4. 确定密钥内容
    let mut key_bytes = Vec::new();
    for i in 0..best_len {
        let group: Vec<u8> = clean_text.iter().skip(i).step_by(best_len).cloned().collect();
        let best_char = solve_caesar_shift(&group);
        key_bytes.push(best_char);
    }

    let key = String::from_utf8(key_bytes).unwrap();
    let decrypted = vigenere_cipher(ciphertext, key.clone(), "decrypt".into())?;

    Ok(CrackResult {
        key,
        key_length: best_len,
        plaintext: decrypted,
        ic_score: best_ic,
    })
}

fn calculate_ic(text: &[u8]) -> f64 {
    let len = text.len();
    if len <= 1 { return 0.0; }

    let mut counts = [0usize; 26];
    for &b in text {
        if b >= b'A' && b <= b'Z' { counts[(b - b'A') as usize] += 1; }
    }

    let numerator: usize = counts.iter().map(|&n| n * (n.saturating_sub(1))).sum();
    let denominator = len * (len - 1);

    numerator as f64 / denominator as f64
}

fn solve_caesar_shift(group: &[u8]) -> u8 {
    let len = group.len() as f64;
    let mut group_freq = [0.0; 26];
    for &b in group {
        if b >= b'A' && b <= b'Z' { group_freq[(b - b'A') as usize] += 1.0; }
    }
    for f in &mut group_freq { *f /= len; }

    let mut max_corr = 0.0;
    let mut best_shift = 0;

    for k in 0..26 {
        let mut correlation = 0.0;
        for c_idx in 0..26 {
            let p_idx = (c_idx + 26 - k) % 26;
            correlation += group_freq[c_idx] * ENGLISH_FREQ[p_idx];
        }
        if correlation > max_corr {
            max_corr = correlation;
            best_shift = k;
        }
    }
    best_shift as u8 + b'A'
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_cipher_vector() {
        let plaintext = "THISCRYPTOSYSTEMISNOTSECURE";
        let key = "CIPHER";
        let expected = "VPXZGIAXIVWPUBTTMJPWIZITWZT";
        assert_eq!(vigenere_cipher(plaintext.into(), key.into(), "encrypt".into()).unwrap(), expected);
        assert_eq!(vigenere_cipher(expected.into(), key.into(), "decrypt".into()).unwrap(), plaintext);
    }

    #[test]
    fn test_cracker_logic() {
        // 自然英语文本
        let plaintext_long = "\
            CRYPTOGRAPHYISAPRACTICEANDSTUDYOFTECHNIQUESFORSECURINGCOMMUNICATION\
            INTHEPRESENCEOFTHIRDARTIESCALLEDADVERSARIESMOREGENERALLYCRYPTOGRAPHY\
            ISABOUTCONSTRUCTINGANALYZINGPROTOCOLSTHATPREVENTTHIRDPARTIESORTHE\
            PUBLICFROMREADINGPRIVATEERMESSAGESVARIOUSASPECTSININFORMATION\
            SECURITYSUCHASDATACONFIDENTIALITYDATAINTEGRITYAUTHENTICATIONAND\
            NONREPUDIATIONARECENTRALTOMODERNCRYPTOGRAPHYMODERNCRYPTOGRAPHYIS\
            HEAVILYBASEDONMATHEMATICALTHEORYANDCOMPUTERPRACTICE";

        let key = "CIPHER";
        let ciphertext = vigenere_cipher(plaintext_long.into(), key.into(), "encrypt".into()).unwrap();

        let result = crack_vigenere_auto(ciphertext).unwrap();

        println!("破解结果 Key: {}", result.key);
        println!("推测长度: {}", result.key_length);

        // 验证：
        // 1. 长度应该是 6 (不再是 3，也不再是 12)
        assert_eq!(result.key_length, 6);
        // 2. 密钥内容正确
        assert_eq!(result.key, "CIPHER");
        // 3. 明文正确
        assert!(result.plaintext.starts_with("CRYPTOGRAPHY"));
    }
}