import { describe, it, expect } from 'vitest';

// ─── 纯函数复制（与组件同步） ─────────────────────────

function buildGrid(content: string, rows: number, cols: number): string[][] {
    const chars = [...content];
    const grid: string[][] = [];
    for (let r = 0; r < rows; r++) {
        const row = chars.slice(r * cols, r * cols + cols);
        while (row.length < cols) row.push('');
        grid.push(row);
    }
    return grid;
}

function buildMap(grid: string[][]): Map<string, string> {
    const map = new Map<string, string>();
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const ch = grid[r][c];
            if (ch && ch !== ' ') map.set(ch, `${r + 1}${c + 1}`);
        }
    }
    return map;
}

function encrypt(text: string, grid: string[][], sep: string, keepNonAlpha: boolean): string {
    const map = buildMap(grid);
    const parts: string[] = [];
    for (const ch of text) {
        const code = map.get(ch);
        if (code) {
            parts.push(code);
        } else if (keepNonAlpha) {
            parts.push(ch);
        }
    }
    if (sep === 'none') return parts.join('');
    if (sep === 'comma') return parts.join(',');
    return parts.join(' ');
}

function decrypt(text: string, grid: string[][], sep: string, keepNonAlpha: boolean): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const w = String(Math.max(grid.length, grid[0]?.length || 0)).length + 1;

    let tokens: string[];
    if (sep === 'none') {
        tokens = [];
        const digits = normalized.replace(/[^1-9,]/g, '');
        for (let i = 0; i + w <= digits.length; i += w) {
            tokens.push(digits.slice(i, i + w));
        }
    } else if (sep === 'comma') {
        tokens = normalized.split(/\s*,\s*/);
    } else {
        tokens = normalized.split(/\s+/);
    }

    const result: string[] = [];
    for (const t of tokens) {
        const cleaned = t.trim();
        if (cleaned && /^\d+$/.test(cleaned) && cleaned.length === w) {
            const r = parseInt(cleaned.slice(0, -1), 10) - 1;
            const c = parseInt(cleaned.slice(-1), 10) - 1;
            result.push(grid[r]?.[c] ?? '?');
        } else if (keepNonAlpha && cleaned) {
            result.push(cleaned);
        }
    }
    return result.join('');
}

function defaultContent(rows: number, cols: number): string {
    const total = rows * cols;
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (total <= 26) return alpha.slice(0, total);
    return alpha.repeat(Math.ceil(total / 26)).slice(0, total);
}

// ─── 标准 5x5 网格（A-Y）
// Row 0: A B C D E     → 11 12 13 14 15
// Row 1: F G H I J     → 21 22 23 24 25
// Row 2: K L M N O     → 31 32 33 34 35
// Row 3: P Q R S T     → 41 42 43 44 45
// Row 4: U V W X Y     → 51 52 53 54 55
const STD_GRID = buildGrid('ABCDEFGHIJKLMNOPQRSTUVWXY', 5, 5);

// ─── 测试 ──────────────────────────────────────────────

describe('PolybiusSquare 核心算法', () => {

    describe('buildGrid - 网格构建', () => {
        it('5x5 标准网格应正确填充', () => {
            const g = buildGrid('ABCDEFGHIJKLMNOPQRSTUVWXY', 5, 5);
            expect(g.length).toBe(5);
            expect(g[0]).toEqual(['A', 'B', 'C', 'D', 'E']);
            expect(g[4]).toEqual(['U', 'V', 'W', 'X', 'Y']);
        });

        it('6x5 网格（30 格，26 字母 + 4 空占位）', () => {
            const g = buildGrid('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6, 5);
            expect(g.length).toBe(6);
            expect(g[5]).toEqual(['Z', '', '', '', '']);
        });

        it('3×3 网格', () => {
            const g = buildGrid('ABCDEFGHI', 3, 3);
            expect(g[0]).toEqual(['A', 'B', 'C']);
            expect(g[2]).toEqual(['G', 'H', 'I']);
        });
    });

    describe('encrypt - 加密', () => {
        it('标准 5x5: HELLO → 23 15 32 32 35', () => {
            expect(encrypt('HELLO', STD_GRID, 'space', true)).toBe('23 15 32 32 35');
        });

        it('逗号分隔', () => {
            expect(encrypt('ABC', STD_GRID, 'comma', true)).toBe('11,12,13');
        });

        it('紧凑模式', () => {
            expect(encrypt('ABC', STD_GRID, 'none', true)).toBe('111213');
        });

        it('J 在标准 5x5 中占独立格（25）', () => {
            expect(encrypt('J', STD_GRID, 'space', true)).toBe('25');
        });

        it('保留非字母字符', () => {
            const out = encrypt('A!B', STD_GRID, 'space', true);
            expect(out).toContain('11');
            expect(out).toContain('12');
            expect(out).toContain('!');
        });

        it('不保留非字母字符时应丢弃', () => {
            expect(encrypt('A!B', STD_GRID, 'space', false)).toBe('11 12');
        });
    });

    describe('decrypt - 解密', () => {
        it('空格分隔: 23 15 32 32 35 → HELLO', () => {
            expect(decrypt('23 15 32 32 35', STD_GRID, 'space', true)).toBe('HELLO');
        });

        it('紧凑格式: 2315323235 → HELLO', () => {
            expect(decrypt('2315323235', STD_GRID, 'none', true)).toBe('HELLO');
        });

        it('逗号分隔: 11,12,13 → ABC', () => {
            expect(decrypt('11,12,13', STD_GRID, 'comma', true)).toBe('ABC');
        });

        it('多余空白应忽略', () => {
            expect(decrypt('  23   15  32  ', STD_GRID, 'space', true)).toBe('HEL');
        });
    });

    describe('对称性 - 加解密往返', () => {
        it('5x5 英文字母往返一致', () => {
            const original = 'THEQUICKBROWNFOX';
            const enc = encrypt(original, STD_GRID, 'space', true);
            const dec = decrypt(enc, STD_GRID, 'space', true);
            expect(dec).toBe(original);
        });

        it('5x5 紧凑模式往返一致', () => {
            const original = 'ATTACK';
            const enc = encrypt(original, STD_GRID, 'none', true);
            const dec = decrypt(enc, STD_GRID, 'none', true);
            expect(dec).toBe(original);
        });

        it('6x5 网格（含 Z）往返一致', () => {
            const g = buildGrid('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6, 5);
            const original = 'JAZZ';
            const enc = encrypt(original, g, 'space', true);
            const dec = decrypt(enc, g, 'space', true);
            expect(dec).toBe(original);
        });

        it('3x3 网格往返一致', () => {
            const g = buildGrid('ABCDEFGHI', 3, 3);
            const original = 'ABCDEFGHI';
            const enc = encrypt(original, g, 'comma', true);
            const dec = decrypt(enc, g, 'comma', true);
            expect(dec).toBe(original);
        });
    });

    describe('defaultContent - 默认内容推荐', () => {
        it('5×5 应返回 A-Y（前 25 字母）', () => {
            expect(defaultContent(5, 5)).toBe('ABCDEFGHIJKLMNOPQRSTUVWXY');
        });

        it('6×5 应返回 30 字符（A-Z 循环填充）', () => {
            expect(defaultContent(6, 5)).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZABCD');
        });

        it('3×3 应返回 A-I', () => {
            expect(defaultContent(3, 3)).toBe('ABCDEFGHI');
        });
    });

    describe('不同矩阵大小', () => {
        it('4×7 = 28 格的内容应正常工作', () => {
            const content = 'ABCDEFGHIJKLMNOPQRSTUVWXYZAB';
            const g = buildGrid(content, 4, 7);
            expect(g.length).toBe(4);
            expect(g[3][6]).toBe('B');
            const enc = encrypt('HELLO', g, 'space', true);
            const dec = decrypt(enc, g, 'space', true);
            expect(dec).toBe('HELLO');
        });
    });
});
