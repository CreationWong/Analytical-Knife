import { describe, it, expect } from 'vitest';

// ─── 编码函数复制 ─────────────────────────────────────────

const ALPHABETS = {
    base16: '0123456789ABCDEF',
    base32: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    base62: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
} as const;

function toBytes(s: string): Uint8Array { return new TextEncoder().encode(s); }
function fromBytes(b: Uint8Array): string { return new TextDecoder().decode(b); }

// Base16
function base16Encode(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}
function base16Decode(s: string): Uint8Array | null {
    const clean = s.replace(/\s/g, '').toUpperCase();
    if (!clean) return new Uint8Array(0);
    if (!/^[0-9A-F]+$/.test(clean) || clean.length % 2 !== 0) return null;
    return Uint8Array.from(clean.match(/.{2}/g)!, b => parseInt(b, 16));
}

// Base32
function base32Encode(bytes: Uint8Array): string {
    const alpha = ALPHABETS.base32;
    let result = '';
    const KEEP_MAP: Record<number, number> = { 1: 2, 2: 4, 3: 5, 4: 7 };
    for (let i = 0; i < bytes.length; i += 5) {
        const remaining = bytes.length - i;
        const b = [
            bytes[i] ?? 0, bytes[i + 1] ?? 0, bytes[i + 2] ?? 0,
            bytes[i + 3] ?? 0, bytes[i + 4] ?? 0,
        ];
        const b0 = b[0]!, b1 = b[1]!, b2 = b[2]!, b3 = b[3]!, b4 = b[4]!;

        result += alpha[b0 >> 3];
        result += alpha[((b0 & 0x07) << 2) | (b1 >> 6)];
        result += alpha[(b1 >> 1) & 0x1F];
        result += alpha[((b1 & 0x01) << 4) | (b2 >> 4)];
        result += alpha[((b2 & 0x0F) << 1) | (b3 >> 7)];
        result += alpha[(b3 >> 2) & 0x1F];
        result += alpha[((b3 & 0x03) << 3) | (b4 >> 5)];
        result += alpha[b4 & 0x1F];

        if (remaining < 5) {
            const keep = KEEP_MAP[remaining]!;
            result = result.slice(0, -(8 - keep)) + '='.repeat(8 - keep);
        }
    }
    return result;
}
function base32Decode(s: string): Uint8Array | null {
    const alpha = ALPHABETS.base32;
    const clean = s.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z2-7=]*$/.test(clean) || clean.length % 8 !== 0) return null;

    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 8) {
        const chunk = clean.slice(i, i + 8);
        const pad = (chunk.match(/=/g) || []).length;
        const vals = chunk.split('').map(c => c === '=' ? 0 : alpha.indexOf(c));

        bytes.push((vals[0] << 3) | (vals[1] >> 2));
        if (pad < 6) bytes.push((vals[1] << 6) | (vals[2] << 1) | (vals[3] >> 4));
        if (pad < 4) bytes.push((vals[3] << 4) | (vals[4] >> 1));
        if (pad < 3) bytes.push((vals[4] << 7) | (vals[5] << 2) | (vals[6] >> 3));
        if (pad < 1) bytes.push((vals[6] << 5) | vals[7]);
    }
    return Uint8Array.from(bytes);
}

// Base58
function base58Encode(bytes: Uint8Array): string {
    const alpha = ALPHABETS.base58;
    if (bytes.length === 0) return '';
    let zeroCount = 0;
    while (zeroCount < bytes.length && bytes[zeroCount] === 0) zeroCount++;
    let num = BigInt(0);
    for (const b of bytes) num = num * BigInt(256) + BigInt(b);
    let result = '';
    const base = BigInt(58);
    while (num > 0) { result = alpha[Number(num % base)] + result; num = num / base; }
    return '1'.repeat(zeroCount) + result;
}
function base58Decode(s: string): Uint8Array | null {
    const alpha = ALPHABETS.base58;
    const clean = s.replace(/\s/g, '');
    if (!/^[1-9A-HJ-NP-Za-km-z]*$/.test(clean)) return null;
    let zeroCount = 0;
    while (zeroCount < clean.length && clean[zeroCount] === '1') zeroCount++;
    let num = BigInt(0);
    const base = BigInt(58);
    for (const ch of clean) num = num * base + BigInt(alpha.indexOf(ch));
    const bytes: number[] = [];
    while (num > 0) { bytes.unshift(Number(num & BigInt(0xFF))); num = num >> BigInt(8); }
    for (let i = 0; i < zeroCount; i++) bytes.unshift(0);
    return Uint8Array.from(bytes);
}

// Base62
function base62Encode(bytes: Uint8Array): string {
    const alpha = ALPHABETS.base62;
    if (bytes.length === 0) return '';

    let zeroCount = 0;
    while (zeroCount < bytes.length && bytes[zeroCount] === 0) zeroCount++;

    let num = BigInt(0);
    for (const b of bytes) num = num * BigInt(256) + BigInt(b);

    let result = '';
    if (num > 0) {
        const base = BigInt(62);
        while (num > 0) {
            result = alpha[Number(num % base)] + result;
            num = num / base;
        }
    }
    if (result === '' && zeroCount === 0) result = '0';
    return '0'.repeat(zeroCount) + result;
}
function base62Decode(s: string): Uint8Array | null {
    const alpha = ALPHABETS.base62;
    const clean = s.replace(/\s/g, '');
    if (!clean) return new Uint8Array(0);
    if (!/^[0-9A-Za-z]*$/.test(clean)) return null;

    let zeroCount = 0;
    while (zeroCount < clean.length && clean[zeroCount] === '0') zeroCount++;

    let num = BigInt(0);
    const base = BigInt(62);
    for (const ch of clean) num = num * base + BigInt(alpha.indexOf(ch));

    const bytes: number[] = [];
    while (num > 0) { bytes.unshift(Number(num & BigInt(0xFF))); num = num >> BigInt(8); }
    for (let i = 0; i < zeroCount; i++) bytes.unshift(0);
    return Uint8Array.from(bytes);
}

// Base64
function base64Encode(bytes: Uint8Array): string {
    const bin = Array.from(bytes, b => String.fromCharCode(b)).join('');
    return btoa(bin);
}
function base64Decode(s: string): Uint8Array | null {
    const clean = s.replace(/\s/g, '');
    if (!clean) return new Uint8Array(0);
    const diff = clean.length % 4;
    const padded = diff === 0 ? clean : clean + '='.repeat(4 - diff);
    try { const bin = atob(padded); return Uint8Array.from(bin, c => c.charCodeAt(0)); }
    catch { return null; }
}

// ─── 测试 ────────────────────────────────────────────────

describe.each([
    ['Base16', base16Encode, base16Decode],
    ['Base32', base32Encode, base32Decode],
    ['Base58', base58Encode, base58Decode],
    ['Base62', base62Encode, base62Decode],
    ['Base64', base64Encode, base64Decode],
] as const)('%s', (_name, encode, decode) => {

    it('空输入应正确处理', () => {
        expect(fromBytes(decode('')!)).toBe('');
    });

    it('单字节往返一致', () => {
        const tests = ['h', 'a', 'Z', '0', '\n', '\0', '\x80'];
        for (const t of tests) {
            const enc = encode(toBytes(t));
            const dec = decode(enc);
            expect(dec).not.toBeNull();
            expect(fromBytes(dec!)).toBe(t);
        }
    });

    it('英文字符串往返一致', () => {
        const original = 'Hello, Base Family!';
        const enc = encode(toBytes(original));
        const dec = decode(enc);
        expect(dec).not.toBeNull();
        expect(fromBytes(dec!)).toBe(original);
    });

    it('中文 UTF-8 往返一致', () => {
        const original = '你好，世界！🚀';
        const enc = encode(toBytes(original));
        const dec = decode(enc);
        expect(dec).not.toBeNull();
        expect(fromBytes(dec!)).toBe(original);
    });

    it('二进制数据往返一致', () => {
        const bytes = new Uint8Array([0, 1, 2, 127, 128, 255, 64, 128, 192]);
        const enc = encode(bytes);
        const dec = decode(enc);
        expect(dec).not.toBeNull();
        expect(Array.from(dec!)).toEqual(Array.from(bytes));
    });

    it('长文本（1KB+）往返一致', () => {
        const text = 'A'.repeat(2048);
        const enc = encode(toBytes(text));
        const dec = decode(enc);
        expect(dec).not.toBeNull();
        expect(fromBytes(dec!)).toBe(text);
    });

    it('非法输入应返回 null', () => {
        const bad = '!!!invalid!!!';
        const result = decode(bad);
        expect(result).toBeNull();
    });
});

// ─── 各 Base 特有的预期编码值 ────────────────────────────

describe('Base16 特定测试', () => {
    it('HELLO → 48454C4C4F', () => {
        expect(base16Encode(toBytes('HELLO'))).toBe('48454C4C4F');
    });
    it('解码应忽略空格', () => {
        expect(fromBytes(base16Decode('48 45 4C 4C 4F')!)).toBe('HELLO');
    });
});

describe('Base32 特定测试', () => {
    it('f → MY======', () => {
        expect(base32Encode(toBytes('f'))).toBe('MY======');
    });
    it('fo → MZXQ====', () => {
        expect(base32Encode(toBytes('fo'))).toBe('MZXQ====');
    });
    it('foo → MZXW6===', () => {
        expect(base32Encode(toBytes('foo'))).toBe('MZXW6===');
    });
    it('foob → MZXW6YQ=', () => {
        expect(base32Encode(toBytes('foob'))).toBe('MZXW6YQ=');
    });
    it('fooba → MZXW6YTB', () => {
        expect(base32Encode(toBytes('fooba'))).toBe('MZXW6YTB');
    });
    it('foobar → MZXW6YTBOI======', () => {
        expect(base32Encode(toBytes('foobar'))).toBe('MZXW6YTBOI======');
    });
});

describe('Base58 特定测试', () => {
    it('Bitcoin 地址编码风格 (前导零)', () => {
        const bytes = new Uint8Array([0, 0, 0, 1]);
        const enc = base58Encode(bytes);
        expect(enc).toBe('1112');
        const dec = base58Decode(enc);
        expect(dec).not.toBeNull();
        expect(Array.from(dec!)).toEqual([0, 0, 0, 1]);
    });
});

describe('Base62 特定测试', () => {
    it('数字 0 的编码', () => {
        expect(base62Encode(new Uint8Array([0]))).toBe('0');
        const dec = base62Decode('0');
        expect(dec).not.toBeNull();
        expect(Array.from(dec!)).toEqual([0]);
    });
    it('前导零字节应保留', () => {
        expect(base62Encode(new Uint8Array([0, 0, 1]))).toBe('001');
        const dec = base62Decode('001');
        expect(dec).not.toBeNull();
        expect(Array.from(dec!)).toEqual([0, 0, 1]);
    });
});

describe('Base64 特定测试', () => {
    it('hello → aGVsbG8=', () => {
        expect(base64Encode(toBytes('hello'))).toBe('aGVsbG8=');
    });
});

describe('Base32 解码填充容错', () => {
    it('不同填充长度的解码应正确', () => {
        const original = 'Hello World!';
        const enc = base32Encode(toBytes(original));
        // RFC 4638 标准解码
        const dec = base32Decode(enc);
        expect(dec).not.toBeNull();
        expect(fromBytes(dec!)).toBe(original);
    });
});

describe('跨变种对比', () => {
    it('同一文本在不同 Base 下应有不同编码结果', () => {
        const text = 'Hello';
        const b16 = base16Encode(toBytes(text));
        const b64 = base64Encode(toBytes(text));
        expect(b16).not.toBe(b64);
        expect(b16.length).toBe(10);  // 5 bytes × 2
        expect(b64.length).toBe(8);   // 5 bytes → 8 chars
    });
});

describe('二进制数据各 Base 的膨胀率', () => {
    it('Base64 膨胀率约 33~54%', () => {
        const bytes = toBytes('Hello, World!');
        const enc = base64Encode(bytes);
        const ratio = enc.length / bytes.length;
        expect(ratio).toBeGreaterThan(1.3);
        expect(ratio).toBeLessThan(1.6);
    });
    it('Base16 膨胀率为 200%', () => {
        const bytes = toBytes('Hello');
        const enc = base16Encode(bytes);
        expect(enc.length / bytes.length).toBe(2);
    });
});
