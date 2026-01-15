import { describe, it, expect } from 'vitest';
import { base64Encode, base64Decode } from '../Base64Tool';

describe('Base64 编解码算法测试', () => {

    describe("Base64 编码测试", () =>{
        it('应当正确编码普通英文字符串', () => {
            expect(base64Encode('hello')).toBe('aGVsbG8=');
            expect(base64Encode('123456')).toBe('MTIzNDU2');
        });

        it('应当能够正确处理 UTF-8 字符', () => {
            const text = '你好，世界！';
            const encoded = base64Encode(text);
            expect(encoded).toBe('5L2g5aW977yM5LiW55WM77yB');
            expect(base64Decode(encoded)).toBe(text);
        });

        it('应当能够处理 Emoji 表情', () => {
            const emoji = '🚀 2026';
            const encoded = base64Encode(emoji);
            expect(base64Decode(encoded)).toBe(emoji);
        });
    })

    describe('Base64 解码测试', () => {
        it('应当正确解码出普通英文字符串', () => {
            expect(base64Decode('aGVsbG8=')).toBe('hello');
            expect(base64Decode('MTIzNDU2')).toBe('123456');
        });

        it('非法 Base64 解码时应返回 null', () => {
            const result = base64Decode('!!!');
            expect(result).toBeNull();
        });

        it('应当自动补齐等号解码', () => {
            expect(base64Decode('TlNTQ1RGe2Jhc2U2NCEhfQ')).toBe('NSSCTF{base64!!}');
        });
    });

    describe('综合测试', () => {
        it('对于空输入应当返回空字符串', () => {
            expect(base64Encode('')).toBe('');
            expect(base64Decode('')).toBe('');
        });

        it('应当满足编解码对称性', () => {
            const original = 'www.0d000721.com/?p=你好';
            const encoded = base64Encode(original);
            const decoded = base64Decode(encoded);
            expect(decoded).toBe(original);
        });
    });
});