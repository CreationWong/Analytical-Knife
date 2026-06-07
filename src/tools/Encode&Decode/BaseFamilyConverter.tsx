import { useState, useMemo, useCallback } from 'react';
import {
    Stack, Textarea, Title, Group, ActionIcon,
    Tooltip, CopyButton, Space, Text, Paper, Divider, Box, Button,
    SegmentedControl, Select, Badge, Collapse,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCopy, IconCheck, IconExchange, IconTrash, IconSearch, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { showNotification } from '@/utils/notifications';
import { useAppSettings } from '@/hooks/useAppSettings';

// ─── Base 系列编码类型 ───────────────────────────────────

type BaseVariant = 'base16' | 'base32' | 'base58' | 'base62' | 'base64';

interface BaseInfo {
    label: string;
    alphabet: string;
    description: string;
}

const BASE_INFO: Record<BaseVariant, BaseInfo> = {
    base16: { label: 'Base16', alphabet: '0-9 A-F', description: 'Hex 十六进制' },
    base32: { label: 'Base32', alphabet: 'A-Z 2-7', description: 'RFC 4648' },
    base58: { label: 'Base58', alphabet: '1-9 A-Z a-z(去 0OIl)', description: 'Bitcoin 地址' },
    base62: { label: 'Base62', alphabet: '0-9 A-Z a-z', description: '纯字母数字' },
    base64: { label: 'Base64', alphabet: 'A-Z a-z 0-9 +/ =', description: 'RFC 4648' },
};

// ─── 编码算法 ─────────────────────────────────────────────

const ALPHABETS = {
    base16: '0123456789ABCDEF',
    base32: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    base62: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
} as const;

/** string → Uint8Array (UTF-8) */
function toBytes(s: string): Uint8Array {
    return new TextEncoder().encode(s);
}

/** Uint8Array → string (UTF-8) */
function fromBytes(b: Uint8Array): string {
    return new TextDecoder().decode(b);
}

// ── Base16 ──
function base16Encode(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}
function base16Decode(s: string): Uint8Array | null {
    const clean = s.replace(/\s/g, '').toUpperCase();
    if (!clean) return new Uint8Array(0);
    if (!/^[0-9A-F]+$/.test(clean) || clean.length % 2 !== 0) return null;
    return Uint8Array.from(clean.match(/.{2}/g)!, b => parseInt(b, 16));
}

// ── Base32 (RFC 4648) ──
function base32Encode(bytes: Uint8Array): string {
    const alpha = ALPHABETS.base32;
    let result = '';
    // 5 字节 → 8 字符
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

// ── Base58 (Bitcoin) ──
function base58Encode(bytes: Uint8Array): string {
    const alpha = ALPHABETS.base58;
    if (bytes.length === 0) return '';

    // 计算前导零
    let zeroCount = 0;
    while (zeroCount < bytes.length && bytes[zeroCount] === 0) zeroCount++;

    // 大数转换
    let num = BigInt(0);
    for (const b of bytes) {
        num = num * BigInt(256) + BigInt(b);
    }

    let result = '';
    const base = BigInt(58);
    while (num > 0) {
        const rem = Number(num % base);
        result = alpha[rem] + result;
        num = num / base;
    }
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
    for (const ch of clean) {
        num = num * base + BigInt(alpha.indexOf(ch));
    }

    const bytes: number[] = [];
    while (num > 0) {
        bytes.unshift(Number(num & BigInt(0xFF)));
        num = num >> BigInt(8);
    }
    // 补前导零
    for (let i = 0; i < zeroCount; i++) bytes.unshift(0);
    return Uint8Array.from(bytes);
}

// ── Base62 ──
function base62Encode(bytes: Uint8Array): string {
    const alpha = ALPHABETS.base62;
    if (bytes.length === 0) return '';

    // 记录前导零字节
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

    // 记录前导零
    let zeroCount = 0;
    while (zeroCount < clean.length && clean[zeroCount] === '0') zeroCount++;

    let num = BigInt(0);
    const base = BigInt(62);
    for (const ch of clean) num = num * base + BigInt(alpha.indexOf(ch));

    const bytes: number[] = [];
    while (num > 0) {
        bytes.unshift(Number(num & BigInt(0xFF)));
        num = num >> BigInt(8);
    }
    for (let i = 0; i < zeroCount; i++) bytes.unshift(0);
    return Uint8Array.from(bytes);
}

// ── Base64 ──
function base64Encode(bytes: Uint8Array): string {
    const bin = Array.from(bytes, b => String.fromCharCode(b)).join('');
    return btoa(bin);
}
function base64Decode(s: string): Uint8Array | null {
    const clean = s.replace(/\s/g, '');
    if (!clean) return new Uint8Array(0);

    // 补全等号
    const diff = clean.length % 4;
    const padded = diff === 0 ? clean : clean + '='.repeat(4 - diff);

    try {
        const bin = atob(padded);
        return Uint8Array.from(bin, c => c.charCodeAt(0));
    } catch { return null; }
}

// ─── 编码器映射 ───────────────────────────────────────────

interface Encoders {
    encode: (bytes: Uint8Array) => string;
    decode: (s: string) => Uint8Array | null;
}

const ENCODERS: Record<BaseVariant, Encoders> = {
    base16: { encode: base16Encode, decode: base16Decode },
    base32: { encode: base32Encode, decode: base32Decode },
    base58: { encode: base58Encode, decode: base58Decode },
    base62: { encode: base62Encode, decode: base62Decode },
    base64: { encode: base64Encode, decode: base64Decode },
};

// ─── 自动检测 ─────────────────────────────────────────────

interface AutoDetectResult {
    variant: BaseVariant;
    label: string;
    data: string;
    score: number;
    reason: string;
}

function autoDetect(input: string): AutoDetectResult[] {
    const clean = input.replace(/\s/g, '');
    if (!clean) return [];

    const results: AutoDetectResult[] = [];

    for (const [variant, engine] of Object.entries(ENCODERS)) {
        const bytes = engine.decode(input);
        if (bytes === null) continue;

        const data = fromBytes(bytes);
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
                reason = `仅 Base58 字符集（无 0OIl），可读率 ${(textRatio * 100).toFixed(0)}%`;
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
        }

        if (data.trim() === input.trim()) {
            score *= 0.3;
            reason += '（解码与原文相同）';
        }

        results.push({ variant: variant as BaseVariant, label: BASE_INFO[variant as BaseVariant].label, data, score, reason });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
}

// ─── UI 组件 ──────────────────────────────────────────────

export default function BaseFamilyConverter() {
    const [settings] = useAppSettings();
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'encode' | 'decode'>('encode');
    const [variant, setVariant] = useState<BaseVariant>('base64');
    const [detectResults, setDetectResults] = useState<AutoDetectResult[]>([]);
    const [detecting, setDetecting] = useState(false);
    const [detectOpened, { toggle: toggleDetect, open: openDetect }] = useDisclosure(false);

    const info = BASE_INFO[variant];
    const engine = ENCODERS[variant];

    const result = useMemo(() => {
        if (!input.trim()) return { data: '', error: false };
        try {
            if (mode === 'encode') {
                const bytes = toBytes(input);
                return { data: engine.encode(bytes), error: false };
            } else {
                const bytes = engine.decode(input);
                if (!bytes) return { data: '解码失败 — 无效格式', error: true };
                return { data: fromBytes(bytes), error: false };
            }
        } catch {
            return { data: '编码/解码异常', error: true };
        }
    }, [input, mode, engine]);

    const handleSwap = () => {
        if (result.data && !result.error) {
            setInput(result.data);
            setMode(m => m === 'encode' ? 'decode' : 'encode');
            showNotification({ type: 'info', message: '内容已交换并切换模式' });
        }
    };

    const handleDetect = useCallback(() => {
        if (!input.trim()) return;
        setDetecting(true);
        // 给 UI 更新机会
        setTimeout(() => {
            const results = autoDetect(input);
            setDetectResults(results);
            setDetecting(false);
            if (results.length > 0) {
                openDetect();
                // 自动选择最佳匹配
                setVariant(results[0].variant);
                setMode('decode');
                showNotification({
                    type: 'info',
                    message: `检测到 ${results[0].label}（可信度 ${results[0].score.toFixed(0)}%）`,
                });
            } else {
                showNotification({ type: 'error', message: '未能识别出任何已知的 Base 编码' });
            }
        }, 50);
    }, [input]);

    const getByteSize = (s: string) => toBytes(s).length;

    const variants = Object.entries(BASE_INFO).map(([key, v]) => ({
        value: key,
        label: `${v.label} (${v.description})`,
    }));

    return (
        <Stack gap="md">
            <Paper p="md" withBorder shadow="xs">
                <Group justify="space-between" mb="md" wrap="nowrap">
                    <Title order={4} style={{ whiteSpace: 'nowrap' }}>Base 家族转换器</Title>
                    <SegmentedControl
                        size="xs"
                        value={mode}
                        onChange={(v) => setMode(v as 'encode' | 'decode')}
                        data={[
                            { label: '编码', value: 'encode' },
                            { label: '解码', value: 'decode' },
                        ]}
                    />
                </Group>

                <Group gap="xs" align="end" mb="sm">
                    <Select
                        size="xs"
                        data={variants}
                        value={variant}
                        onChange={(v) => v && setVariant(v as BaseVariant)}
                        style={{ flex: 1 }}
                        comboboxProps={{ shadow: 'md' }}
                    />
                    {mode === 'decode' && (
                        <Button size="xs" variant="light" color="violet"
                            leftSection={<IconSearch size={14} />}
                            onClick={handleDetect}
                            loading={detecting}
                        >
                            自动检测
                        </Button>
                    )}
                </Group>

                <Group gap="xs" mb="xs">
                    <Text size="xs" c="dimmed">{info.alphabet}</Text>
                    <Text size="xs" c="dimmed">·</Text>
                    <Text size="xs" c="dimmed">{info.description}</Text>
                </Group>

                <Textarea
                    placeholder={mode === 'encode'
                        ? '输入原文进行编码…'
                        : `输入 ${info.label} 字符串进行解码…`}
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value)}
                    minRows={4}
                    autosize
                    styles={{ input: { fontFamily: 'var(--mantine-font-family-mono)' } }}
                    error={result.error ? (result.data as string) : false}
                />

                <Group mt="xs" gap="xs">
                    <Tooltip label="交换内容并切换模式">
                        <ActionIcon variant="light" color="orange"
                            onClick={handleSwap}
                            disabled={!result.data || result.error}
                        >
                            <IconExchange size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="清空输入">
                        <ActionIcon variant="light" color="red" onClick={() => setInput('')}>
                            <IconTrash size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Space style={{ flex: 1 }} />
                </Group>
            </Paper>

            {/* 自动检测结果 */}
            {detectResults.length > 0 && (
                <Paper withBorder p="xs" bg="var(--mantine-color-violet-light)">
                    <Group gap="xs" mb="xs">
                        <Text size="sm" fw={600}>自动检测结果</Text>
                        <ActionIcon size="sm" variant="subtle" onClick={toggleDetect}>
                            {detectOpened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                        </ActionIcon>
                    </Group>
                    <Collapse in={detectOpened}>
                        <Stack gap={4}>
                            {detectResults.map((r, i) => (
                                <Group key={r.variant} gap="xs" wrap="nowrap"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => { setVariant(r.variant); setInput(r.data); setMode('decode'); }}
                                >
                                    <Badge size="sm" color={i === 0 ? 'violet' : 'gray'} variant={i === 0 ? 'filled' : 'outline'}>
                                        {r.label}
                                    </Badge>
                                    <Text size="xs" c="dimmed" style={{ flex: 1 }} truncate>{r.reason}</Text>
                                    <Text size="xs" fw={700} c={r.score > 60 ? 'green' : 'orange'}>
                                        {r.score.toFixed(0)}%
                                    </Text>
                                    {i === 0 && <Badge size="xs" color="violet" variant="light">推荐</Badge>}
                                </Group>
                            ))}
                        </Stack>
                    </Collapse>
                </Paper>
            )}

            <Paper p="md" withBorder bg="var(--mantine-color-default-hover)">
                <Group justify="space-between" mb="xs">
                    <Text fw={600} size="sm">
                        {mode === 'encode' ? '编码结果' : '解码原文'}
                    </Text>
                    <CopyButton value={result.data}>
                        {({ copied, copy }) => (
                            <Button size="xs" variant="light"
                                color={copied ? 'teal' : settings.primaryColor}
                                onClick={copy}
                                disabled={result.error || !result.data}
                                leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            >
                                {copied ? '已复制' : '复制结果'}
                            </Button>
                        )}
                    </CopyButton>
                </Group>
                <Divider mb="sm" variant="dashed" />
                <Box
                    component="pre"
                    style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        fontFamily: 'var(--mantine-font-family-mono)',
                        fontSize: 'var(--mantine-font-size-sm)',
                        minHeight: '40px',
                        color: result.error ? 'var(--mantine-color-red-6)' : 'inherit',
                    }}
                >
                    {result.data || '等待输入...'}
                </Box>

                {input && !result.error && result.data && (
                    <Group mt="md" gap="xl">
                        <Box>
                            <Text size="xs" c="dimmed">输入大小</Text>
                            <Text size="sm" fw={500}>{getByteSize(input)} B</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">输出大小</Text>
                            <Text size="sm" fw={500}>{getByteSize(result.data)} B</Text>
                        </Box>
                        {mode === 'encode' && (
                            <Box>
                                <Text size="xs" c="dimmed">膨胀率</Text>
                                <Text size="sm" fw={500} c="orange">
                                    +{Math.round((getByteSize(result.data) / getByteSize(input) - 1) * 100)}%
                                </Text>
                            </Box>
                        )}
                    </Group>
                )}
            </Paper>
        </Stack>
    );
}
