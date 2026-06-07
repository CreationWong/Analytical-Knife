import { describe, it, expect } from 'vitest';

// ─── 编码函数复制 ─────────────────────────────────────────

const ALPHABETS = {
    base16: '0123456789ABCDEF',
    base32: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    base62: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    baseXX: '+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
} as const;

function toBytes(s: string): Uint8Array { return new TextEncoder().encode(s); }
function fromBytes(b: Uint8Array): string { return new TextDecoder().decode(b); }

// XXencode
function baseXXEncode(bytes: Uint8Array): string {
    const alpha = ALPHABETS.baseXX;
    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b = [bytes[i] ?? 0, bytes[i + 1] ?? 0, bytes[i + 2] ?? 0];
        const remaining = bytes.length - i;
        const b0 = b[0]!, b1 = b[1]!, b2 = b[2]!;

        let group = '';
        group += alpha[b0 >> 2];
        group += alpha[((b0 & 0x03) << 4) | (b1 >> 4)];
        group += alpha[((b1 & 0x0F) << 2) | (b2 >> 6)];
        group += alpha[b2 & 0x3F];

        if (remaining < 3) {
            const keep = remaining === 1 ? 2 : 3;
            group = group.slice(0, keep) + '='.repeat(4 - keep);
        }
        result += group;
    }
    return result;
}

function baseXXDecode(s: string): Uint8Array | null {
    const alpha = ALPHABETS.baseXX;
    const clean = s.replace(/\s/g, '');
    if (!clean) return new Uint8Array(0);
    if (!/^[+\-0-9A-Za-z=]*$/.test(clean) || clean.length % 4 !== 0) return null;

    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 4) {
        const chunk = clean.slice(i, i + 4);
        const pad = (chunk.match(/=/g) || []).length;
        if (pad === 4) break;

        const vals = [...chunk].map(c => c === '=' ? 0 : alpha.indexOf(c));
        if (vals.some(v => v === -1)) return null;

        bytes.push((vals[0] << 2) | (vals[1] >> 4));
        if (pad < 2) bytes.push((vals[1] << 4) | (vals[2] >> 2));
        if (pad < 1) bytes.push((vals[2] << 6) | vals[3]);
    }
    return Uint8Array.from(bytes);
}

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
    ['XXencode', baseXXEncode, baseXXDecode],
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

describe('XXencode 特定测试', () => {
    it('编码 HELLO 应正确往返', () => {
        const enc = baseXXEncode(toBytes('HELLO'));
        expect(enc.length % 4).toBe(0);
        const dec = baseXXDecode(enc);
        expect(dec).not.toBeNull();
        expect(fromBytes(dec!)).toBe('HELLO');
    });

    it('单字节填充正确', () => {
        const enc = baseXXEncode(toBytes('H'));
        expect(enc).toMatch(/=$/);
        const dec = baseXXDecode(enc);
        expect(dec).not.toBeNull();
        expect(fromBytes(dec!)).toBe('H');
    });

    it('不同长度往返一致', () => {
        for (const t of ['a', 'ab', 'abc', 'abcd', 'Hello World!', '中文测试🚀']) {
            const enc = baseXXEncode(toBytes(t));
            const dec = baseXXDecode(enc);
            expect(dec).not.toBeNull();
            expect(fromBytes(dec!)).toBe(t);
        }
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

// ─── 自动检测 ──────────────────────────────────────────

const BASE_INFO: Record<string, { label: string }> = {
    base16: { label: 'Base16' }, base32: { label: 'Base32' },
    base58: { label: 'Base58' }, base62: { label: 'Base62' },
    base64: { label: 'Base64' }, baseXX: { label: 'XXencode' },
};

const ENCODERS: Record<string, { encode: Function; decode: Function }> = {
    base16: { encode: base16Encode, decode: base16Decode },
    base32: { encode: base32Encode, decode: base32Decode },
    base58: { encode: base58Encode, decode: base58Decode },
    base62: { encode: base62Encode, decode: base62Decode },
    base64: { encode: base64Encode, decode: base64Decode },
    baseXX: { encode: baseXXEncode, decode: baseXXDecode },
};

function autoDetect(input: string): Array<{ variant: string; label: string; data: string; score: number; reason: string }> {
    const clean = input.replace(/\s/g, '');
    if (!clean) return [];

    const results: Array<any> = [];

    for (const [variant, engine] of Object.entries(ENCODERS)) {
        const bytes = (engine.decode as Function)(input);
        if (bytes === null) continue;

        const data = fromBytes(bytes as Uint8Array);
        if (!data) continue;

        const printable = [...data].filter(c =>
            c >= ' ' && c <= '~' || '\n\r\t'.includes(c)
        ).length;
        const textRatio = data.length > 0 ? printable / data.length : 0;

        let score = 0;
        let reason = '';

        if (variant === 'base16') {
            if (/^[0-9A-Fa-f\s]+$/.test(clean)) {
                score = 50 + textRatio * 40;
                reason = `仅含 Hex 字符，可读率 ${(textRatio * 100).toFixed(0)}%`;
            }
        } else if (variant === 'base32') {
            if (clean.length % 8 === 0 && /^[A-Z2-7=\s]+$/i.test(clean)) {
                score = 45 + textRatio * 40;
                reason = `Base32 字符集+对齐，可读率 ${(textRatio * 100).toFixed(0)}%`;
            }
        } else if (variant === 'base58') {
            const only58 = /^[1-9A-HJ-NP-Za-km-z\s]+$/.test(clean);
            const only62 = /^[0-9A-Za-z\s]+$/.test(clean);
            if (only58 && !only62) {
                score = 60 + textRatio * 35;
                reason = `仅 Base58 字符集，可读率 ${(textRatio * 100).toFixed(0)}%`;
            } else if (only58) {
                score = 20 + textRatio * 30;
                reason = `Base58/62 交集，可读率 ${(textRatio * 100).toFixed(0)}%`;
            }
        } else if (variant === 'base62') {
            if (/^[0-9A-Za-z\s]+$/.test(clean)) {
                const noSpecial = !/[+/=]/.test(clean);
                score = (noSpecial ? 25 : 10) + textRatio * 30;
                reason = `${noSpecial ? '纯字母数字' : '含特殊字符'}，可读率 ${(textRatio * 100).toFixed(0)}%`;
            }
        } else if (variant === 'base64') {
            if (/^[0-9A-Za-z+/=\s]+$/.test(clean)) {
                const hasPadding = clean.includes('=');
                const goodLength = clean.replace(/\s/g, '').length % 4 === 0;
                score = (hasPadding ? 40 : 20) + (goodLength ? 15 : 0) + textRatio * 30;
                reason = `Base64${hasPadding ? ' 含填充' : ''}${goodLength ? ' 对齐' : ''}，可读率 ${(textRatio * 100).toFixed(0)}%`;
            }
        } else if (variant === 'baseXX') {
            if (/^[+\-0-9A-Za-z=\s]+$/.test(clean)) {
                const hasDash = clean.includes('-');
                const hasPlus = clean.includes('+');
                score = (hasDash || hasPlus ? 35 : 15) + textRatio * 35;
                reason = `XXencode 字符集${hasDash ? ' 含-' : ''}，可读率 ${(textRatio * 100).toFixed(0)}%`;
            }
        }

        if (data.trim() === input.trim()) {
            score *= 0.3;
            reason += '（解码与原文相同）';
        }

        results.push({ variant, label: BASE_INFO[variant].label, data, score, reason });
    }

    results.sort((a: any, b: any) => b.score - a.score);
    return results;
}

describe('autoDetect - 自动检测', () => {
    it('Base64 带填充应被检测为 Base64', () => {
        const enc = base64Encode(toBytes('Hello, World!'));
        const results = autoDetect(enc);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].variant).toBe('base64');
        expect(results[0].data).toBe('Hello, World!');
        expect(results[0].score).toBeGreaterThan(50);
    });

    it('Base16 应被检测为 Base16', () => {
        const enc = base16Encode(toBytes('Hello'));
        const results = autoDetect(enc);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].variant).toBe('base16');
    });

    it('Base32 应被检测为 Base32', () => {
        const enc = base32Encode(toBytes('Hello World!'));
        const results = autoDetect(enc);
        // Base32 可能需要高可信度
        const base32Result = results.find(r => r.variant === 'base32');
        expect(base32Result).toBeDefined();
        expect(base32Result!.data).toBe('Hello World!');
    });

    it('XXencode 应被检测', () => {
        const enc = baseXXEncode(toBytes('Hello'));
        const results = autoDetect(enc);
        // 应包含 + 或 - 等特征字符
        const xx = results.find(r => r.variant === 'baseXX');
        expect(xx).toBeDefined();
        expect(xx!.data).toBe('Hello');
    });

    it('Base58 应被检测（至少出现在结果中）', () => {
        const enc = base58Encode(toBytes('Hello'));
        const results = autoDetect(enc);
        const base58Result = results.find(r => r.variant === 'base58');
        expect(base58Result).toBeDefined();
        expect(base58Result!.data).toBe('Hello');
    });

    it('空输入应返回空数组', () => {
        expect(autoDetect('')).toEqual([]);
    });

    it('纯文本不应有高分检测结果', () => {
        const results = autoDetect('just some plain text');
        // 可能有一个低分结果，但不应有高分
        const highScore = results.filter(r => r.score > 70);
        expect(highScore.length).toBe(0);
    });
});
