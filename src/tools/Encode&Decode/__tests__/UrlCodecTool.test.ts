import { describe, it, expect } from 'vitest';
import { urlEncode, urlDecode } from '../UrlCodecTool';

describe('URL 编解码逻辑', () => {

    it('应当正确编码中文字符', () => {
        expect(urlEncode('你好')).toBe('%E4%BD%A0%E5%A5%BD');
    });

    it('应当正确解码百分比编码', () => {
        expect(urlDecode('%E4%BD%A0%E5%A5%BD')).toBe('你好');
    });

    it('应当区分全编码与保留结构编码', () => {
        const url = 'http://example.com/测试?a=1&b=2';

        // 全部编码 (encodeURIComponent)
        expect(urlEncode(url, true)).toContain('%3A%2F%2F');

        // 结构保留 (encodeURI)
        const result = urlEncode(url, false);
        expect(result).toContain('http://');
        expect(result).toContain('%E6%B5%8B%E8%AF%95');
    });

    it('应当能够处理特殊符号和空格', () => {
        expect(urlEncode('A&B C')).toBe('A%26B%20C');
    });

    it('解码非法格式时应当抛出错误', () => {
        // 单个百分号或不完整的序列
        expect(() => urlDecode('%E4%BD')).toThrow('无效的 URL 编码格式');
    });

    it('应当满足可逆性', () => {
        const original = 'key=value&name=张三#anchor';
        expect(urlDecode(urlEncode(original))).toBe(original);
    });
});