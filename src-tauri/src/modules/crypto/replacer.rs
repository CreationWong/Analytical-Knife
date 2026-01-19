use serde::Serialize;

#[derive(Serialize)]
pub struct HighlightRange {
    pub start: usize,
    pub end: usize,
    pub rule_index: usize,
}

#[derive(Serialize)]
pub struct ReplaceResult {
    pub original_highlights: Vec<HighlightRange>, // 原文高亮索引
    pub replaced_content: String,                 // 替换后的文本
    pub replaced_highlights: Vec<HighlightRange>, // 结果高亮索引
}

#[tauri::command]
pub fn batch_replace(text: String, rules_raw: String) -> Result<ReplaceResult, String> {
    let rules: Vec<(Vec<char>, String)> = rules_raw
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split("->").collect();
            if parts.len() == 2 {
                Some((
                    parts[0].trim().chars().collect(),
                    parts[1].trim().to_string(),
                ))
            } else {
                None
            }
        })
        .collect();

    let input_chars: Vec<char> = text.chars().collect();
    let mut original_highlights = Vec::new();
    let mut replaced_content = String::new();
    let mut replaced_highlights = Vec::new();

    let mut i = 0;
    while i < input_chars.len() {
        let mut matched = false;
        for (idx, (from_chars, to_str)) in rules.iter().enumerate() {
            let from_len = from_chars.len();
            if i + from_len <= input_chars.len() && &input_chars[i..i + from_len] == from_chars {
                // 记录原文高亮位置
                original_highlights.push(HighlightRange {
                    start: i,
                    end: i + from_len,
                    rule_index: idx,
                });

                // 记录结果文本及其高亮位置
                let r_start = replaced_content.chars().count();
                replaced_content.push_str(to_str);
                let r_end = replaced_content.chars().count();
                replaced_highlights.push(HighlightRange {
                    start: r_start,
                    end: r_end,
                    rule_index: idx,
                });

                i += from_len;
                matched = true;
                break;
            }
        }
        if !matched {
            replaced_content.push(input_chars[i]);
            i += 1;
        }
    }
    Ok(ReplaceResult {
        original_highlights,
        replaced_content,
        replaced_highlights,
    })
}
