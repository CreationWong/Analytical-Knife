use num_bigint::BigUint;
use num_traits::{Num, One, ToPrimitive, Zero};
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

// 单元测试
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recover_plaintext_logic() {
        let n_str = "120294155186626082670474649118722298040433501930335450479777638508444129059776534554344361441717048531505985491664356283524886091709370969857047470362547600390987665105196367975719516115980157839088766927450099353377496192206005171597109864609567336679138620134544004766539483664270351472198486955623315909571";
        let e1_str = "38317";
        let e2_str = "63409";
        let c1_str = "42703138696187395030337205860503270214353151588149506110731264952595193757235229215067638858431493587093612397165407221394174690263691095324298012134779703041752810028935711214038835584823385108771901216441784673199846041109074467177891680923593206326788523158180637665813642688824593788192044139055552031622";
        let c2_str = "50460092786111470408945316270086812807230253234809303694007902628924057713984397041141665125615735752600114964852157684904429928771531639899496987905067366415806771003121954852465731110629459725994454904159277228514337278105207721011579794604761255522391446534458815389983562890631994726687526070228315925638";

        let n = parse_biguint(n_str).expect("Failed to parse n");
        let e1 = parse_biguint(e1_str).expect("Failed to parse e1");
        let e2 = parse_biguint(e2_str).expect("Failed to parse e2");
        let c1 = parse_biguint(c1_str).expect("Failed to parse c1");
        let c2 = parse_biguint(c2_str).expect("Failed to parse c2");

        let result = recover_plaintext(&n, &e1, &c1, &e2, &c2);

        assert!(result.is_ok());

        let plaintext_bytes = result.unwrap();
        let plaintext_string = String::from_utf8(plaintext_bytes).expect("Decrypted bytes are not valid UTF-8");

        assert_eq!(plaintext_string, "NSSCTF{same_module_attack!}");
    }

    #[test]
    fn test_recover_plaintext_non_coprime() {
        let n = BigUint::from(100u32); // 模数 n
        let e1 = BigUint::from(4u32);  // e1 = 4, gcd(4, 6) = 2
        let c1 = BigUint::from(10u32);
        let e2 = BigUint::from(6u32);  // e2 = 6
        let c2 = BigUint::from(20u32);

        let result = recover_plaintext(&n, &e1, &c1, &e2, &c2);

        assert!(result.is_err());
        let error_msg = result.unwrap_err();
        assert!(error_msg.contains("e1 与 e2 不互质"));
    }
    
    #[test]
    fn test_extended_gcd_edge_cases() {
        // Case: a > 0, b = 0 -> gcd(a, 0) = a, x=1, y=0
        let a = BigUint::from(10u32);
        let b = BigUint::zero();
        let (g, x, y) = extended_gcd(&a, &b);
        assert_eq!(g, a);
        assert_eq!(x, 1);
        assert_eq!(y, 0);

        // Verify identity: a*x + b*y = g
        // Calculate a*x (x is positive)
        let ax = &a * BigUint::from(x.unsigned_abs());
        // Calculate b*y (y is 0, so result is 0)
        let by = &b * BigUint::from(y.unsigned_abs());
        let calculated_g = &ax + &by; // Use reference to avoid moving a/b
        assert_eq!(calculated_g, g);

        // Case: a = 0, b > 0 -> gcd(0, b) = b, x=0, y=1
        let a = BigUint::zero();
        let b = BigUint::from(15u32);
        let (g, x, y) = extended_gcd(&a, &b);
        assert_eq!(g, b);
        assert_eq!(x, 0);
        assert_eq!(y, 1);

        // Verify identity: a*x + b*y = g
        // Calculate a*x (a is 0, so result is 0)
        let ax = &a * BigUint::from(x.unsigned_abs());
        // Calculate b*y (y is positive)
        let by = &b * BigUint::from(y.unsigned_abs());
        let calculated_g = &ax + &by;
        assert_eq!(calculated_g, g);

        // Case: a = 0, b = 0 -> gcd(0, 0) is often defined as 0, current impl returns (0, 1, 0)
        let a = BigUint::zero();
        let b = BigUint::zero();
        let (g, x, y) = extended_gcd(&a, &b);
        assert_eq!(g, BigUint::zero());
        assert_eq!(x, 1); // As per your function's output for (0,0)
        assert_eq!(y, 0); // As per your function's output for (0,0)

        // Verify identity: a*x + b*y = g
        // Calculate a*x (a is 0, x is positive)
        let ax = &a * BigUint::from(x.unsigned_abs());
        // Calculate b*y (b is 0, y is 0)
        let by = &b * BigUint::from(y.unsigned_abs());
        let calculated_g = &ax + &by;
        assert_eq!(calculated_g, g); // Should be 0 + 0 = 0
    }
}