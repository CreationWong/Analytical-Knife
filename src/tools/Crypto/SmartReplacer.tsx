import {useState, useEffect, useMemo, useRef, JSX} from 'react';
import {
    Paper, Stack, Textarea, Box, Text, Group, ScrollArea,
    Loader, Grid, ColorSwatch, ActionIcon, CopyButton, Tooltip, Alert
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconCopy, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

// 使用 HSL 颜色旋转生成高对比度颜色
const getStrikingColor = (index: number) => {
    const hue = (index * 137.5) % 360;
    return `hsla(${hue}, 85%, 75%, 0.75)`;
};

export default function SmartReplacer() {
    const [input, setInput] = useState('');
    const [rules, setRules] = useState('A -> C\nB -> D');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [debouncedInput] = useDebouncedValue(input, 250);
    const [debouncedRules] = useDebouncedValue(rules, 250);

    const editorBackdropRef = useRef<HTMLDivElement>(null);

    // --- 逻辑：冲突检测 ---
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

    // --- 逻辑：后端通信 ---
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

    // --- 逻辑：渲染高亮 ---
    const renderHighlights = (content: string, highlights: any[]) => {
        if (!highlights || !content) return content;
        const chars = Array.from(content);
        const elements: (string | JSX.Element)[] = [];
        let lastPos = 0;

        highlights.forEach((hl, idx) => {
            if (hl.start > lastPos) elements.push(chars.slice(lastPos, hl.start).join(''));
            elements.push(
                <mark key={idx} style={{ backgroundColor: getStrikingColor(hl.rule_index), color: 'inherit', borderRadius: '2px' }}>
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
            {/* 左侧：规则映射控制台 */}
            <Grid.Col span={3}>
                <Stack gap="sm">
                    <Textarea
                        label="规则表 (A -> B)"
                        value={rules}
                        onChange={(e) => setRules(e.currentTarget.value)}
                        minRows={8}
                        autosize
                        error={hasConflict}
                        styles={{
                            input: { fontFamily: 'monospace' }
                        }}
                    />

                    {hasConflict && (
                        <Alert icon={<IconAlertTriangle size={16} />} title="规则冲突" color="red" variant="light" styles={{ title: { fontSize: '12px' } }}>
                            <Text size="xs" style={{userSelect: 'none'}}>检测到以下起始字符重复：{Array.from(conflicts).join(', ')}</Text>
                        </Alert>
                    )}

                    <Paper withBorder p="xs" bg="gray.0">
                        <Text size="xs" fw={700} mb="xs" style={{userSelect: 'none'}}>颜色映射索引</Text>
                        <ScrollArea.Autosize>
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

            {/* 右侧：双栏编辑器 */}
            <Grid.Col span={9}>
                <Stack gap="md">
                    {/* 上栏：原文字编辑器 */}
                    <Box pos="relative" h={280} style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>
                        <Group justify="space-between" p="6px 12px" bg="gray.1" style={{ borderBottom: '1px solid #dee2e6', userSelect: 'none' }}>
                            <Text size="xs" fw={700}>原始输入</Text>
                            {loading && <Loader size="xs" />}
                        </Group>
                        <Box pos="relative" h="calc(100% - 33px)">
                            {/* 高亮层 */}
                            <div ref={editorBackdropRef} style={{ ...commonStyle, zIndex: 1, color: 'transparent', overflow: 'auto' }}>
                                {result ? renderHighlights(input, result.original_highlights) : input}
                            </div>
                            {/* 输入层 */}
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.currentTarget.value)}
                                onScroll={(e) => editorBackdropRef.current && (editorBackdropRef.current.scrollTop = e.currentTarget.scrollTop)}
                                spellCheck={false}
                                style={{ ...commonStyle, zIndex: 2, background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: 'auto' }}
                            />
                        </Box>
                    </Box>

                    {/*<Divider label="替换结果" labelPosition="center" />*/}

                    {/* 下栏：结果展示区 */}
                    <Box pos="relative" h={280} style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>
                        <Group justify="space-between" p="6px 12px" bg="blue.0" style={{ borderBottom: '1px solid #dee2e6', userSelect: 'none' }}>
                            <Text size="xs" fw={700} c="blue.9">处理结果</Text>
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
                        <ScrollArea h="calc(100% - 33px)" p="md" offsetScrollbars bg="white">
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