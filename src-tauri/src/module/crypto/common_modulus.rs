use num_bigint::BigUint;
use num_traits::{Zero, One, ToPrimitive, Num};
use std::str::FromStr;

pub fn extended_gcd(a: &BigUint, b: &BigUint) -> (BigUint, i64, i64) {
    if b.is_zero() {
        (a.clone(), 1, 0)
    } else {
        let (g, x1, y1) = extended_gcd(b, &(a % b));
        let x = y1;
        let y = x1 - ((a / b).to_i64().unwrap_or(0)) * y1;
        (g, x, y)
    }
}

pub fn parse_biguint(s: &str) -> Result<BigUint, String> {
    let s = s.trim();
    if s.starts_with("0x") || s.starts_with("0X") {
        BigUint::from_str_radix(&s[2..], 16)
            .map_err(|_| format!("无效十六进制: {}", s))
    } else {
        BigUint::from_str(s)
            .or_else(|_| BigUint::from_str_radix(s, 16))
            .map_err(|_| format!("无法解析为整数: {}", s))
    }
}

pub fn recover_plaintext(
    n: &BigUint,
    e1: &BigUint,
    c1: &BigUint,
    e2: &BigUint,
    c2: &BigUint,
) -> Result<Vec<u8>, String> {
    let (g, s, t) = extended_gcd(e1, e2);
    if !g.is_one() {
        return Err("e1 与 e2 不互质，无法进行共模攻击".into());
    }

    let modulus = n;
    let c1_inv = c1.modinv(modulus).ok_or("c1 在模 N 下不可逆")?;
    let c2_inv = c2.modinv(modulus).ok_or("c2 在模 N 下不可逆")?;

    let part1 = if s >= 0 {
        c1.modpow(&BigUint::from(s as u64), modulus)
    } else {
        c1_inv.modpow(&BigUint::from((-s) as u64), modulus)
    };

    let part2 = if t >= 0 {
        c2.modpow(&BigUint::from(t as u64), modulus)
    } else {
        c2_inv.modpow(&BigUint::from((-t) as u64), modulus)
    };

    let m = (part1 * part2) % modulus;
    Ok(m.to_bytes_be())
}