import { useState, useMemo } from 'react';
import {
    Paper, TextInput, Button, Stack, Tabs, Group, Text, Textarea,
    SegmentedControl, Switch, CopyButton, Tooltip, ActionIcon, Table, Code,
    NumberInput,
} from '@mantine/core';
import { IconKey, IconLock, IconLockOpen, IconCopy, IconCheck, IconTable } from '@tabler/icons-react';
import { useAppSettings } from '../../hooks/useAppSettings';

// ─── 核心算法 ─────────────────────────────────────────────

/** 根据内容和尺寸生成网格 */
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

/** 构建字符→坐标映射 */
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

/** 坐标位数（行列最大值各占几位） */
function codeWidth(grid: string[][]): number {
    const rows = grid.length;
    const maxW = Math.max(rows, grid[0]?.length || 0);
    return maxW <= 9 ? 2 : 0; // 暂不支持超过 9
}

/** 加密 */
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

/** 解密 */
function decrypt(text: string, grid: string[][], sep: string, keepNonAlpha: boolean): string {
    // 先把 text 标准化：所有连续空白→单个空格
    const normalized = text.replace(/\s+/g, ' ').trim();
    const w = codeWidth(grid);

    let tokens: string[];
    if (sep === 'none') {
        // 按固定位数切
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

/** 显示友好的网格 */
function formatGrid(grid: string[][]): string[] {
    const maxLen = Math.max(...grid.flat().filter(Boolean).map(s => s.length), 1);
    return grid.map(row =>
        row.map(c => (c || '·').padStart(maxLen)).join('  ')
    );
}

/** 根据行列数计算推荐内容 */
function defaultContent(rows: number, cols: number): string {
    const total = rows * cols;
    // 如果正好 26，用 A-Z；否则按行填充 A-Z 循环
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (total <= 26) return alpha.slice(0, total);
    return alpha.repeat(Math.ceil(total / 26)).slice(0, total);
}

// ─── UI ───────────────────────────────────────────────────

export default function PolybiusSquare() {
    const [settings] = useAppSettings();
    const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
    const [input, setInput] = useState('');
    const [key, setKey] = useState('');
    const [rows, setRows] = useState(5);
    const [cols, setCols] = useState(5);
    const [contentTouched, setContentTouched] = useState(false);
    const [content, setContent] = useState('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const [fmt, setFmt] = useState<'space' | 'comma' | 'none'>('space');
    const [keepNonAlpha, setKeepNonAlpha] = useState(true);

    // 行列变化时自动更新内容（用户未手动改过才覆盖）
    const handleRowsColsChange = (r: number, c: number) => {
        setRows(r);
        setCols(c);
        if (!contentTouched) {
            setContent(defaultContent(r, c));
        }
    };

    // 用密钥扰乱网格内容
    const scrambledContent = useMemo(() => {
        if (!key.trim()) return content;
        const upper = key.toUpperCase().replace(/[^A-Z]/g, '');
        const seen = new Set<string>();
        const ordered: string[] = [];
        for (const ch of upper) {
            if (!seen.has(ch)) { seen.add(ch); ordered.push(ch); }
        }
        for (const ch of content) {
            if (!seen.has(ch)) { seen.add(ch); ordered.push(ch); }
        }
        return ordered.slice(0, rows * cols).join('');
    }, [key, content, rows, cols]);

    const grid = useMemo(() => buildGrid(scrambledContent, rows, cols), [scrambledContent, rows, cols]);

    const output = useMemo(() => {
        if (!input.trim()) return '';
        try {
            return mode === 'encrypt'
                ? encrypt(input, grid, fmt, keepNonAlpha)
                : decrypt(input, grid, fmt, keepNonAlpha);
        } catch { return '(解密失败 — 请检查输入格式)'; }
    }, [input, mode, grid, fmt, keepNonAlpha]);

    return (
        <Stack gap="sm">
            {/* 矩阵设置 */}
            <Paper withBorder p="sm" bg="var(--mantine-color-default-hover)">
                <Stack gap="xs">
                    <Group gap="xs" align="end" wrap="nowrap">
                        <NumberInput
                            label="行数"
                            value={rows}
                            onChange={(v) => handleRowsColsChange(Number(v) || 5, cols)}
                            min={2} max={9}
                            size="xs"
                            w={80}
                        />
                        <NumberInput
                            label="列数"
                            value={cols}
                            onChange={(v) => handleRowsColsChange(rows, Number(v) || 5)}
                            min={2} max={9}
                            size="xs"
                            w={80}
                        />
                        <TextInput
                            label="密钥（可选）"
                            placeholder="密钥扰乱网格排列"
                            leftSection={<IconKey size={14} />}
                            value={key}
                            onChange={(e) => setKey(e.currentTarget.value.toUpperCase())}
                            style={{ flex: 1 }}
                            size="xs"
                        />
                        <Button size="xs" variant="light" color="gray" onClick={() => {
                            setKey('');
                            setContentTouched(false);
                            setContent(defaultContent(rows, cols));
                        }}>
                            重置
                        </Button>
                    </Group>
                    <Group gap="xs" align="end">
                        <Textarea
                            label="网格内容"
                            description={`${rows}×${cols} = ${rows * cols} 格，当前 ${[...content].filter(c => c.trim()).length} 字符`}
                            placeholder="每格一个字符，按行填充"
                            value={content}
                            onChange={(e) => { setContent(e.currentTarget.value); setContentTouched(true); }}
                            size="xs"
                            autosize
                            minRows={1}
                            maxRows={2}
                            styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
                            style={{ flex: 1 }}
                        />
                    </Group>
                </Stack>
            </Paper>

            {/* 网格展示 */}
            <Paper withBorder p="sm" bg="var(--mantine-color-body)">
                <Group gap="md" align="start">
                    <div>
                        <Text size="xs" fw={700} c="dimmed" mb={4}>
                            <IconTable size={12} style={{ verticalAlign: -1 }} /> 波利比奥斯方阵
                        </Text>
                        <Code block style={{ fontSize: 13, lineHeight: 1.8 }}>
                            {formatGrid(grid).join('\n')}
                        </Code>
                    </div>
                    <div>
                        <Text size="xs" fw={700} c="dimmed" mb={4}>坐标参考</Text>
                        <Table withRowBorders={false} style={{ fontSize: 12 }}>
                            <Table.Tbody>
                                {grid.map((_, r) => (
                                    <Table.Tr key={r}>
                                        {grid[r].map((_, c) => (
                                            <Table.Td key={c} ta="center" p={2}
                                                style={{ color: 'var(--mantine-color-dimmed)', fontFamily: 'monospace' }}
                                            >
                                                {r + 1}{c + 1}
                                            </Table.Td>
                                        ))}
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </div>
                </Group>
            </Paper>

            {/* 主操作区 */}
            <Tabs value={mode} onChange={(v) => { setMode(v as 'encrypt' | 'decrypt'); setInput(''); }}>
                <Tabs.List mb="sm">
                    <Tabs.Tab value="encrypt" leftSection={<IconLock size={14} />}>加密</Tabs.Tab>
                    <Tabs.Tab value="decrypt" leftSection={<IconLockOpen size={14} />}>解密</Tabs.Tab>
                </Tabs.List>

                <Paper withBorder p="sm">
                    <Stack gap="sm">
                        {mode === 'encrypt' ? (
                            <Textarea
                                label="明文"
                                placeholder="输入要加密的文本…"
                                minRows={3} maxRows={6} autosize
                                value={input}
                                onChange={(e) => setInput(e.currentTarget.value)}
                                styles={{ input: { fontFamily: 'monospace' } }}
                            />
                        ) : (
                            <Textarea
                                label="密文（数字坐标）"
                                placeholder={`例如: 11 22 33 44 55`}
                                minRows={3} maxRows={6} autosize
                                value={input}
                                onChange={(e) => setInput(e.currentTarget.value)}
                                styles={{ input: { fontFamily: 'monospace' } }}
                            />
                        )}

                        <Group justify="space-between" wrap="nowrap">
                            <Group gap="xs">
                                {mode === 'encrypt' ? (
                                    <SegmentedControl
                                        size="xs"
                                        value={fmt}
                                        onChange={(v) => setFmt(v as 'space' | 'comma' | 'none')}
                                        data={[
                                            { value: 'space', label: '空格分隔' },
                                            { value: 'comma', label: '逗号分隔' },
                                            { value: 'none', label: '紧凑' },
                                        ]}
                                    />
                                ) : (
                                    <SegmentedControl
                                        size="xs"
                                        value={fmt}
                                        onChange={(v) => setFmt(v as 'space' | 'comma' | 'none')}
                                        data={[
                                            { value: 'space', label: '按空格' },
                                            { value: 'comma', label: '按逗号' },
                                            { value: 'none', label: '按两位' },
                                        ]}
                                    />
                                )}
                                <Switch
                                    size="xs"
                                    label="保留非字母字符"
                                    checked={keepNonAlpha}
                                    onChange={(e) => setKeepNonAlpha(e.currentTarget.checked)}
                                />
                            </Group>
                            <CopyButton value={output}>
                                {({ copied, copy }) => (
                                    <Tooltip label={copied ? '已复制' : '复制结果'}>
                                        <ActionIcon variant="light" color={copied ? 'green' : settings.primaryColor} onClick={copy}>
                                            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                        </ActionIcon>
                                    </Tooltip>
                                )}
                            </CopyButton>
                        </Group>

                        <Textarea
                            label={mode === 'encrypt' ? '密文' : '明文'}
                            minRows={2} maxRows={5} autosize readOnly
                            value={output}
                            styles={{ input: { fontFamily: 'monospace', color: 'var(--mantine-color-bright)' } }}
                        />
                    </Stack>
                </Paper>
            </Tabs>
        </Stack>
    );
}
