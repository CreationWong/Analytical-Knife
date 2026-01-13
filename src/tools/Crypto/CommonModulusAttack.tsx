import { useState } from 'react';
import {
    Stack,
    Paper,
    Textarea,
    Button,
    Group,
    Code, Text,
} from '@mantine/core';
import { IconKey, IconShieldLock} from '@tabler/icons-react';
import { showNotification } from '../../utils/notifications';
import { handleAppError } from '../../utils/error';
import { invoke } from '@tauri-apps/api/core';

/**
 * 共模攻击工具组件
 * 适用于两个 RSA 密文使用相同模数 N、不同公钥指数 e1/e2 且 gcd(e1, e2) = 1 的场景
 */
export default function CommonModulusAttack() {
    const [n, setN] = useState<string>('');
    const [e1, setE1] = useState<string>('');
    const [c1, setC1] = useState<string>('');
    const [e2, setE2] = useState<string>('');
    const [c2, setC2] = useState<string>('');
    const [result, setResult] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const validateInputs = () => {
        if (!n || !e1 || !c1 || !e2 || !c2) {
            throw new Error('所有字段均为必填项');
        }
        // 简单校验是否为十六进制或十进制大整数
        const hexOrDec = /^[0-9a-fA-F]+$/;
        if (![n, e1, c1, e2, c2].every(v => hexOrDec.test(v))) {
            throw new Error('请输入有效的十六进制或十进制整数');
        }
    };

    const handleAttack = async () => {
        try {
            setLoading(true);
            validateInputs();

            const plaintext = await invoke<string>('common_modulus_attack', {
                n: n.trim(),
                e1: e1.trim(),
                c1: c1.trim(),
                e2: e2.trim(),
                c2: c2.trim(),
            });

            setResult(plaintext);
            showNotification({
                type: 'info',
                title: '攻击成功',
                message: '已成功恢复明文！',
            });
        } catch (err) {
            if (err instanceof Error) {
                handleAppError(err, {
                    title: '共模攻击出错',
                    isWarning: false,
                });
            } else {
                showNotification({
                    type: 'error',
                    title: '共模攻击失败',
                    message: String(err),
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Stack gap="md">
            <Paper p="md" withBorder>
                <Group justify="space-between">
                    <Group gap="xs">
                        <Text fw={600}>共模攻击</Text>
                    </Group>
                </Group>
                <br/>

                <Stack>
                    <Textarea
                        label="模数 N（十六进制或十进制）"
                        placeholder="例如：a1b2c3... 或 1234567890"
                        value={n}
                        onChange={(e) => setN(e.currentTarget.value)}
                        minRows={4}
                        maxRows={8}
                        spellCheck={false}
                    />
                    <Group grow>
                        <Textarea
                            label="公钥指数 e1"
                            placeholder="例如：65537"
                            value={e1}
                            onChange={(e) => setE1(e.currentTarget.value)}
                            minRows={2}
                            spellCheck={false}
                        />
                        <Textarea
                            label="密文 c1"
                            placeholder="十六进制或十进制"
                            value={c1}
                            onChange={(e) => setC1(e.currentTarget.value)}
                            minRows={2}
                            spellCheck={false}
                        />
                    </Group>
                    <Group grow>
                        <Textarea
                            label="公钥指数 e2"
                            placeholder="例如：17"
                            value={e2}
                            onChange={(e) => setE2(e.currentTarget.value)}
                            minRows={2}
                            spellCheck={false}
                        />
                        <Textarea
                            label="密文 c2"
                            placeholder="十六进制或十进制"
                            value={c2}
                            onChange={(e) => setC2(e.currentTarget.value)}
                            minRows={2}
                            spellCheck={false}
                        />
                    </Group>

                    <Button
                        leftSection={<IconShieldLock size={16} />}
                        onClick={handleAttack}
                        loading={loading}
                        disabled={!n || !e1 || !c1 || !e2 || !c2}
                    >
                        执行共模攻击
                    </Button>
                </Stack>
            </Paper>

            {result && (
                <Paper p="md" withBorder>
                    <Stack>
                        <Group align="center">
                            <IconKey size={20} />
                            <strong>恢复的明文</strong>
                        </Group>
                        <Code block style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>
                            {result}
                        </Code>
                    </Stack>
                </Paper>
            )}
        </Stack>
    );
}