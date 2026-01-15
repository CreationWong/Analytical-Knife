use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct AnalysisConfig {
    pub text: String,
    pub remove_punct: bool,
    pub remove_digits: bool,
    pub lowercase: bool,
    pub use_stop_words: bool,
    pub stop_words_custom: Option<String>,
    pub split_pattern: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct FreqResult {
    pub word: String,
    pub count: usize,
    pub percentage: f64,
}

#[derive(Serialize)]
pub struct AnalysisResponse {
    pub word_freq: Vec<FreqResult>,
    pub char_freq: Vec<FreqResult>,
}

#[tauri::command]
pub async fn analyze_text_advanced(config: AnalysisConfig) -> Result<AnalysisResponse, String> {
    let mut raw_text = config.text.clone();

    // 大小写转换
    if config.lowercase {
        raw_text = raw_text.to_lowercase();
    }

    // 统计字符频率 (Char Frequency)
    let char_freq = calculate_char_freq(&raw_text);

    // 去除标点和数字
    let mut processed_text = raw_text;
    if config.remove_punct || config.remove_digits {
        let pattern = match (config.remove_punct, config.remove_digits) {
            (true, true) => r"[^\p{L}\s]+",
            (true, false) => r"[^\p{L}\p{N}\s]+",
            (false, true) => r"\d+",
            _ => "",
        };
        if !pattern.is_empty() {
            let re = Regex::new(pattern).map_err(|e| e.to_string())?;
            processed_text = re.replace_all(&processed_text, " ").to_string();
        }
    }

    // 分词处理 (Word Frequency)
    let words: Vec<String> = if let Some(ref p) = config.split_pattern {
        if p.is_empty() {
            processed_text.par_split_whitespace().map(|s| s.to_string()).collect()
        } else {
            let re = Regex::new(p).map_err(|e| format!("正则错误: {}", e))?;
            re.split(&processed_text)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        }
    } else {
        processed_text.par_split_whitespace().map(|s| s.to_string()).collect()
    };

    // 过滤停用词
    let mut filtered_words = words;
    if config.use_stop_words {
        let mut stop_set: HashSet<String> = HashSet::new();
        let defaults = vec!["the", "is", "at", "which", "on", "in", "a", "an", "to", "and", "or", "of", "for", "with"];
        for d in defaults { stop_set.insert(d.to_string()); }

        if let Some(custom) = config.stop_words_custom {
            for s in custom.split(',').map(|s| s.trim()) {
                stop_set.insert(s.to_lowercase());
            }
        }
        filtered_words = filtered_words.into_par_iter()
            .filter(|w| !stop_set.contains(w))
            .collect();
    }

    let word_freq = calculate_word_freq(filtered_words);

    Ok(AnalysisResponse { word_freq, char_freq })
}

fn calculate_char_freq(text: &str) -> Vec<FreqResult> {
    let char_counts: HashMap<String, usize> = text
        .par_chars()
        .filter(|c| !c.is_whitespace()) // 密码学分析通常排除空格
        .fold(HashMap::new, |mut acc, c| {
            *acc.entry(c.to_string()).or_insert(0) += 1;
            acc
        })
        .reduce(HashMap::new, |mut a, b| {
            for (k, v) in b { *a.entry(k).or_insert(0) += v; }
            a
        });

    finalize_freq(char_counts)
}

fn calculate_word_freq(words: Vec<String>) -> Vec<FreqResult> {
    let word_counts: HashMap<String, usize> = words.into_par_iter()
        .fold(HashMap::new, |mut acc, w| {
            *acc.entry(w).or_insert(0) += 1;
            acc
        })
        .reduce(HashMap::new, |mut a, b| {
            for (k, v) in b { *a.entry(k).or_insert(0) += v; }
            a
        });

    finalize_freq(word_counts)
}

fn finalize_freq(counts: HashMap<String, usize>) -> Vec<FreqResult> {
    let total: usize = counts.values().sum();
    if total == 0 { return vec![]; }
    let mut results: Vec<FreqResult> = counts.into_iter()
        .map(|(word, count)| FreqResult {
            word,
            count,
            percentage: (count as f64 / total as f64) * 100.0,
        })
        .collect();
    results.sort_by(|a, b| b.count.cmp(&a.count));
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    // 辅助函数：快速创建一个默认配置
    fn mock_config(text: &str) -> AnalysisConfig {
        AnalysisConfig {
            text: text.to_string(),
            remove_punct: false,
            remove_digits: false,
            lowercase: false,
            use_stop_words: false,
            stop_words_custom: None,
            split_pattern: None,
        }
    }

    #[tokio::test]
    async fn test_basic_word_count() {
        let config = mock_config("Apple Banana Apple");
        let res = analyze_text_advanced(config).await.unwrap();

        // 验证词频：Apple 应该出现 2 次
        assert_eq!(res.word_freq[0].word, "Apple");
        assert_eq!(res.word_freq[0].count, 2);
        assert_eq!(res.word_freq[1].word, "Banana");
    }

    #[tokio::test]
    async fn test_cleaning_logic() {
        let mut config = mock_config("Data123! @Analysis");
        config.remove_punct = true;
        config.remove_digits = true;
        config.lowercase = true;

        let res = analyze_text_advanced(config).await.unwrap();

        // 验证标点和数字被移除，且转为小写
        // 结果应为 ["data", "analysis"]
        assert!(res.word_freq.iter().any(|r| r.word == "data"));
        assert!(res.word_freq.iter().any(|r| r.word == "analysis"));
        assert!(!res.word_freq.iter().any(|r| r.word.contains('1')));
    }

    #[tokio::test]
    async fn test_char_frequency() {
        let config = mock_config("AABBC");
        let res = analyze_text_advanced(config).await.unwrap();

        // 验证字符频率
        let a_item = res.char_freq.iter().find(|r| r.word == "A").unwrap();
        assert_eq!(a_item.count, 2);
        // 总字符 5 个，A 占 40%
        assert_eq!(a_item.percentage, 40.0);
    }

    #[tokio::test]
    async fn test_custom_split() {
        let mut config = mock_config("key1:val1|key2:val2");
        config.split_pattern = Some(r"[:|]".to_string());

        let res = analyze_text_advanced(config).await.unwrap();

        // 验证是否按正则切分成了 4 个部分
        assert_eq!(res.word_freq.len(), 4);
    }
}