import { useState } from 'react';
import { Paper, Stack, TextInput, Button, Text, Textarea, Code, Tabs, Group, ActionIcon } from '@mantine/core';
import { IconLockOpen, IconHexagon, IconFileText, IconPlus, IconTrash } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { handleAppError } from '../../utils/error';

export default function BigRSASolver() {
    const [nList, setNList] = useState<string[]>(['', '']); // 默认两层
    const [e, setE] = useState('65537');
    const [c, setC] = useState('');
    const [hexResult, setHexResult] = useState('');
    const [loading, setLoading] = useState(false);

    // 动态增删 N 输入框
    const addLayer = () => setNList([...nList, '']);
    const removeLayer = (index: number) => {
        if (nList.length > 2) {
            const newList = [...nList];
            newList.splice(index, 1);
            setNList(newList);
        }
    };
    const updateN = (index: number, value: string) => {
        const newList = [...nList];
        newList[index] = value;
        setNList(newList);
    };

    const crackRSA = async () => {
        setLoading(true);
        setHexResult('');
        try {
            const result = await invoke<string>('solve_multi_layer_rsa', {
                nList: nList.filter(n => n.trim() !== ''),
                eStr: e,
                cStr: c,
            });
            setHexResult(result);
        } catch (err) {
            handleAppError(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Stack gap="md">
            <Paper withBorder p="md" shadow="xs">
                <Stack gap="sm">
                    <Text fw={500} size="sm">模数列表 (从 N1 到 Nn，解密将倒序执行)</Text>
                    {nList.map((n, index) => (
                        <Group key={index} align="flex-start">
                            <Textarea
                                placeholder={`输入 N${index + 1}`}
                                value={n}
                                onChange={(ev) => updateN(index, ev.currentTarget.value)}
                                style={{ flex: 1 }}
                                autosize minRows={1}
                            />
                            {nList.length > 2 && (
                                <ActionIcon color="red" variant="light" onClick={() => removeLayer(index)} mt={5}>
                                    <IconTrash size={16} />
                                </ActionIcon>
                            )}
                        </Group>
                    ))}

                    <Button variant="outline" leftSection={<IconPlus size={14} />} onClick={addLayer} size="xs">
                        增加嵌套层级
                    </Button>

                    <TextInput label="E" value={e} onChange={(ev) => setE(ev.currentTarget.value)} />
                    <Textarea label="C (密文)" placeholder="输入密文 c" autosize minRows={2} value={c} onChange={(ev) => setC(ev.currentTarget.value)} />

                    <Button onClick={crackRSA} loading={loading} leftSection={<IconLockOpen size={18} />} fullWidth mt="md">
                        执行解密
                    </Button>
                </Stack>
            </Paper>

            {hexResult && (
                <Paper withBorder p="md">
                    <Tabs defaultValue="text">
                        <Tabs.List mb="xs">
                            <Tabs.Tab value="text" leftSection={<IconFileText size={14} />}>明文 (UTF-8)</Tabs.Tab>
                            <Tabs.Tab value="hex" leftSection={<IconHexagon size={14} />}>十六进制 (Hex)</Tabs.Tab>
                        </Tabs.List>
                        <Tabs.Panel value="text">
                            <Code block>{hexToUtf8(hexResult)}</Code>
                        </Tabs.Panel>
                        <Tabs.Panel value="hex">
                            <Code block style={{ wordBreak: 'break-all' }}>{hexResult}</Code>
                        </Tabs.Panel>
                    </Tabs>
                </Paper>
            )}
        </Stack>
    );
}

function hexToUtf8(hex: string): string {
    try {
        const normalized = hex.length % 2 !== 0 ? '0' + hex : hex;
        const bytes = new Uint8Array(normalized.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
        return new TextDecoder().decode(bytes);
    } catch { return "解码失败"; }
}