import React, { useState, useEffect, useMemo, useRef, JSX } from 'react';
import {
    Paper, Stack, Textarea, Box, Text, Group, ScrollArea,
    Loader, Grid, ColorSwatch, ActionIcon, CopyButton, Tooltip, Alert, useMantineColorScheme
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconCopy, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

export default function SmartReplacer() {
    const [input, setInput] = useState('');
    const [rules, setRules] = useState('A -> C\nB -> D');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // 获取当前主题模式
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const [debouncedInput] = useDebouncedValue(input, 250);
    const [debouncedRules] = useDebouncedValue(rules, 250);
    const editorBackdropRef = useRef<HTMLDivElement>(null);

    // 适配深色模式的高亮颜色生成
    const getStrikingColor = (index: number) => {
        const hue = (index * 137.5) % 360;
        // 深色模式下降低亮度，增加饱和度，避免刺眼
        return isDark
            ? `hsla(${hue}, 80%, 35%, 0.65)`
            : `hsla(${hue}, 85%, 75%, 0.75)`;
    };

    const { hasConflict, conflicts, parsedRuleEntries } = useMemo(() => {
        const lines = rules.split('\n');
        const map = new Map<string, number>();
        const conflictSet = new Set<string>();

        const entries = lines.map((line, idx) => {
            const [from, to] = line.split('->').map(s => s.trim());
            const isValid = from && to !== undefined;
            if (isValid) {
                map.set(from, (map.get(from) || 0) + 1);
                if (map.get(from)! > 1) conflictSet.add(from);
            }
            return { from, to, isValid, idx };
        });

        return {
            parsedRuleEntries: entries,
            conflicts: conflictSet,
            hasConflict: conflictSet.size > 0
        };
    }, [rules]);

    useEffect(() => {
        let ignore = false;
        if (!debouncedInput || hasConflict) {
            setResult(null);
            return;
        }
        setLoading(true);
        invoke('batch_replace', { text: debouncedInput, rulesRaw: debouncedRules })
            .then((res: any) => { if (!ignore) setResult(res); })
            .catch(err => console.error("Replace Error:", err))
            .finally(() => { if (!ignore) setLoading(false); });
        return () => { ignore = true; };
    }, [debouncedInput, debouncedRules, hasConflict]);

    const renderHighlights = (content: string, highlights: any[]) => {
        if (!highlights || !content) return content;
        const chars = Array.from(content);
        const elements: (string | JSX.Element)[] = [];
        let lastPos = 0;

        highlights.forEach((hl, idx) => {
            if (hl.start > lastPos) elements.push(chars.slice(lastPos, hl.start).join(''));
            elements.push(
                <mark key={idx} style={{
                    backgroundColor: getStrikingColor(hl.rule_index),
                    color: 'inherit',
                    borderRadius: '2px'
                }}>
                    {chars.slice(hl.start, hl.end).join('')}
                </mark>
            );
            lastPos = hl.end;
        });
        if (lastPos < chars.length) elements.push(chars.slice(lastPos).join(''));
        return elements;
    };

    const commonStyle: React.CSSProperties = {
        padding: '12px',
        fontFamily: '"Cascadia Code", Consolas, monospace',
        fontSize: '14px',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
    };

    return (
        <Grid gutter="md">
            <Grid.Col span={3}>
                <Stack gap="sm">
                    <Textarea
                        label="规则表 (A -> B)"
                        value={rules}
                        onChange={(e) => setRules(e.currentTarget.value)}
                        minRows={8}
                        autosize
                        error={hasConflict}
                        styles={{ input: { fontFamily: 'monospace' } }}
                    />

                    {hasConflict && (
                        <Alert icon={<IconAlertTriangle size={16} />} title="规则冲突" color="red" variant="light">
                            <Text size="xs">检测到起始字符重复：{Array.from(conflicts).join(', ')}</Text>
                        </Alert>
                    )}

                    {/* 使用默认主题背景，移除硬编码 gray.0 */}
                    <Paper withBorder p="xs" bg="var(--mantine-color-default-hover)">
                        <Text size="xs" fw={700} mb="xs" style={{userSelect: 'none'}}>颜色映射索引</Text>
                        <ScrollArea.Autosize mah={300}>
                            <Stack gap={4}>
                                {parsedRuleEntries.filter(r => r.isValid).map((rule, idx) => (
                                    <Group key={idx} gap="xs" style={{userSelect: 'none'}}>
                                        <ColorSwatch color={conflicts.has(rule.from) ? '#ff0000' : getStrikingColor(idx)} size={10} />
                                        <Text size="xs" c={conflicts.has(rule.from) ? 'red' : 'inherit'}>{rule.from} → {rule.to}</Text>
                                    </Group>
                                ))}
                            </Stack>
                        </ScrollArea.Autosize>
                    </Paper>
                </Stack>
            </Grid.Col>

            <Grid.Col span={9}>
                <Stack gap="md">
                    {/* 上栏：输入区 */}
                    <Box pos="relative" h={280} style={{
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                    }}>
                        <Group justify="space-between" p="6px 12px" bg="var(--mantine-color-default-hover)" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', userSelect: 'none' }}>
                            <Text size="xs" fw={700}>原始输入</Text>
                            {loading && <Loader size="xs" />}
                        </Group>
                        <Box pos="relative" h="calc(100% - 33px)">
                            <div ref={editorBackdropRef} style={{ ...commonStyle, zIndex: 1, color: 'transparent', overflow: 'auto' }}>
                                {result ? renderHighlights(input, result.original_highlights) : input}
                            </div>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.currentTarget.value)}
                                onScroll={(e) => editorBackdropRef.current && (editorBackdropRef.current.scrollTop = e.currentTarget.scrollTop)}
                                spellCheck={false}
                                style={{ ...commonStyle, zIndex: 2, background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: 'auto', color: 'inherit' }}
                            />
                        </Box>
                    </Box>

                    {/* 下栏：结果显示区 */}
                    <Box pos="relative" h={280} style={{
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                    }}>
                        <Group justify="space-between" p="6px 12px" bg={isDark ? "var(--mantine-color-blue-9)" : "blue.0"} style={{ borderBottom: '1px solid var(--mantine-color-default-border)', userSelect: 'none' }}>
                            <Text size="xs" fw={700} c={isDark ? "blue.0" : "blue.9"}>处理结果</Text>
                            <CopyButton value={result?.replaced_content || ''} timeout={2000}>
                                {({ copied, copy }) => (
                                    <Tooltip label={copied ? '已复制' : '复制结果'}>
                                        <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                                            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                        </ActionIcon>
                                    </Tooltip>
                                )}
                            </CopyButton>
                        </Group>
                        <ScrollArea h="calc(100% - 33px)" p="md" offsetScrollbars bg="var(--mantine-color-body)">
                            <Box style={{ fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {result ? renderHighlights(result.replaced_content, result.replaced_highlights) : <Text c="dimmed" size="xs">等待输入文本...</Text>}
                            </Box>
                        </ScrollArea>
                    </Box>
                </Stack>
            </Grid.Col>
        </Grid>
    );
}