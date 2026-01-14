import { describe, it, expect } from 'vitest';
import { valuesEncode, valuesDecode } from '../CoreValuesTool'; // 向上级引用

describe('核心价值观算法测试', () => {

    it('应当正确编码数字 1145 为特定词组', () => {
        // 1145 -> Hex(31313435) -> 3,1,3,1,3,4,3,5
        const result = valuesEncode('1145');
        expect(result).toBe('和谐民主和谐民主和谐自由和谐平等');
    });

    it('NSSCTF 真实题目测试', () => {
        const secret = '公正公正公正诚信文明公正民主公正法治法治诚信民主自由敬业公正友善公正平等平等法治民主平等平等和谐敬业自由诚信平等和谐平等公正法治法治平等平等爱国和谐公正平等敬业公正敬业自由敬业平等自由法治和谐平等文明自由诚信自由平等富强公正敬业平等民主公正诚信和谐公正文明公正爱国自由诚信自由平等文明公正诚信富强自由法治法治平等平等自由平等富强法治诚信和谐';
        const flag = 'flag{IlUqU9O5guX6YiITsRNPiQmbhNRjGuTP}';

        expect(valuesDecode(secret)).toBe(flag);
    });
});