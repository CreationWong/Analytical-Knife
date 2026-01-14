import { describe, it, expect } from 'vitest';
import { extractFlagContent, reformatFlagsLogic } from '../BatchFlagReformatter';

describe('BatchFlagReformatter 逻辑测试', () => {

    describe('extractFlagContent (提取核心)', () => {
        it('应当正确提取标准 Flag 内容', () => {
            expect(extractFlagContent('flag{hello_world}')).toBe('hello_world');
        });

        it('应当支持包含特殊字符的内容', () => {
            expect(extractFlagContent('NSSCTF{f1ag_is_h3r3!}')).toBe('f1ag_is_h3r3!');
        });

        it('应当处理内容中嵌套花括号的情况', () => {
            // 算法应以第一个 { 和最后一个 } 为界
            expect(extractFlagContent('php_serialize{a:1:{s:2:"id";i:1;}}')).toBe('a:1:{s:2:"id";i:1;}');
        });

        it('应当拒绝无效格式', () => {
            expect(extractFlagContent('no_braces_here')).toBeNull();
            expect(extractFlagContent('only_left{content')).toBeNull();
            expect(extractFlagContent('only_right}content')).toBeNull();
            expect(extractFlagContent('reversed}{')).toBeNull();
        });

        it('应当拒绝空内容的花括号', () => {
            expect(extractFlagContent('flag{}')).toBeNull();
        });
    });

    describe('reformatFlagsLogic (批量转换)', () => {
        it('应当正确批量更换前缀', () => {
            const input = 'flag{111}\nold_prefix{222}\n{333}';
            const prefix = 'NEW';
            const result = reformatFlagsLogic(input, prefix);

            // 验证输出结果
            expect(result.output).toBe('NEW{111}\nNEW{222}\nNEW{333}');
            // 验证统计数据
            expect(result.totalValid).toBe(3);
            expect(result.invalidCount).toBe(0);
        });

        it('应当跳过空行并识别无效行', () => {
            const input = 'flag{valid}\n\nthis_is_invalid\n{another_valid}';
            const prefix = 'CTF';
            const result = reformatFlagsLogic(input, prefix);

            expect(result.output).toBe('CTF{valid}\nCTF{another_valid}');
            expect(result.invalidCount).toBe(1); // 'this_is_invalid' 是一行无效数据
        });

        it('应当对前缀进行去空格处理', () => {
            const input = 'flag{test}';
            const prefix = '  GZCTF  ';
            const result = reformatFlagsLogic(input, prefix);

            // 预期前缀被 trim()
            expect(result.output).toBe('GZCTF{test}');
        });

        it('处理大数据量输入时不应崩溃', () => {
            const input = Array(100).fill('flag{test_data}').join('\n');
            const result = reformatFlagsLogic(input, 'BIG');
            expect(result.totalValid).toBe(100);
            expect(result.output.split('\n').length).toBe(100);
        });
    });
});