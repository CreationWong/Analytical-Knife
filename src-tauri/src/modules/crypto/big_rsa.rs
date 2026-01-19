use num_bigint::BigInt;
use num_integer::Integer;
use num_traits::{One, Zero};

#[tauri::command]
pub fn solve_multi_layer_rsa(n_list: Vec<String>, e_str: String, c_str: String) -> Result<String, String> {
    let mut b_n_list = Vec::new();
    for (idx, n_s) in n_list.iter().enumerate() {
        let parsed = BigInt::parse_bytes(n_s.trim().as_bytes(), 10)
            .ok_or(format!("N{} 格式错误", idx + 1))?;
        if parsed.is_zero() { return Err(format!("N{} 不能为零", idx + 1)); }
        b_n_list.push(parsed);
    }

    if b_n_list.len() < 2 { return Err("需要至少两个模数".into()); }

    let e = BigInt::parse_bytes(e_str.trim().as_bytes(), 10).ok_or("E 格式错误")?;
    let mut current_m = BigInt::parse_bytes(c_str.trim().as_bytes(), 10).ok_or("C 格式错误")?;

    for i in (0..b_n_list.len()).rev() {
        let n_current = &b_n_list[i];

        let mut q = BigInt::one();
        for (j, other_n) in b_n_list.iter().enumerate() {
            if i == j { continue; }
            let g = n_current.gcd(other_n);
            if g > BigInt::one() {
                q = g;
                break;
            }
        }

        if q <= BigInt::one() {
            return Err(format!("无法找到 N{} 的共享素数", i + 1));
        }

        let p = n_current / &q;
        let phi = (&q - BigInt::one()) * (&p - BigInt::one());
        
        if phi.is_zero() {
            return Err(format!("第 {} 层 phi 为零（可能 N 包含重复质因数）", i + 1));
        }

        let d = e.modinv(&phi).ok_or(format!("无法计算第 {} 层的私钥 (e 与 phi 不互质)", i + 1))?;

        current_m = current_m.modpow(&d, n_current);
    }

    Ok(format!("{:x}", current_m))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multi_layer_rsa_logic() {
        let q = BigInt::from(101u64);
        let n1 = &q * BigInt::from(103u64);
        let n2 = &q * BigInt::from(107u64);
        let n3 = &q * BigInt::from(109u64);
        let e = "7".to_string(); // 修改为 7
        let e_bi = BigInt::from(7u64);

        let m = BigInt::from(42u64);
        let c1 = m.modpow(&e_bi, &n1);
        let c2 = c1.modpow(&e_bi, &n2);
        let c3 = c2.modpow(&e_bi, &n3);

        let n_list = vec![n1.to_string(), n2.to_string(), n3.to_string()];
        let result_hex = solve_multi_layer_rsa(n_list, e, c3.to_string()).expect("应该解密成功");
        assert_eq!(result_hex, "2a");
    }

    #[test]
    fn test_invalid_n_format() {
        let n_list = vec!["not_a_number".into(), "10807".into()];
        let result = solve_multi_layer_rsa(n_list, "65537".into(), "123".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("格式错误"));
    }
}