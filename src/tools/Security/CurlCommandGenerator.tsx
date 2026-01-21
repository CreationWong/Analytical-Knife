import {
    Stack,
    TextInput,
    Select,
    Textarea,
    Paper,
    Button,
    Group,
    Badge,
    Switch,
    ActionIcon,
    Tooltip,
    Menu,
    Box,
    Title,
    Text,
} from '@mantine/core';
import { useState, useEffect, useRef } from 'react';
import {
    IconCopy,
    IconTerminal2,
    IconTemplate,
    IconHistory,
    IconTrash,
    IconSettings,
    IconBolt,
} from '@tabler/icons-react';
import { useClipboard, useDebouncedValue } from '@mantine/hooks';

// ===== 预设模板 =====
const TEMPLATES = {
    login: {
        method: 'POST',
        url: 'https://api.example.com/auth/login',
        headers: 'Content-Type: application/json',
        body: '{\n  "username": "admin",\n  "password": "secret123"\n}',
    },
    upload: {
        method: 'POST',
        url: 'https://api.example.com/upload',
        headers: 'Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
        body: '------WebKitFormBoundary7MA4YWxkTrZu0gW\nContent-Disposition: form-data; name="file"; filename="report.pdf"\n\n<binary data>\n------WebKitFormBoundary7MA4YWxkTrZu0gW--',
    },
    withCookie: {
        method: 'GET',
        url: 'https://app.example.com/user/profile',
        headers: 'Cookie: sessionid=abc123xyz; lang=en',
        body: '',
    },
};

type HistoryItem = {
    id: string;
    method: string;
    url: string;
    headers: string;
    body: string;
    timestamp: number;
};

const MAX_HISTORY = 5;

// ===== 工具函数 =====
const escapeShellArg = (str: string): string => {
    if (/^[a-zA-Z0-9_/.:-]+$/.test(str)) return str;
    return `'${str.replace(/'/g, "'\"'\"'")}'`;
};

const formatHeadersToFlags = (headersStr: string): string[] => {
    if (!headersStr.trim()) return [];
    return headersStr
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
            const [key, ...rest] = line.split(':');
            return `-H "${key.trim()}: ${rest.join(':').trim()}"`;
        });
};

// ===== 主组件 =====
export default function CurlCommandGenerator() {
    // 主状态
    const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
    const [url, setUrl] = useState('https://httpbin.org/get');
    const [headers, setHeaders] = useState<string>('');
    const [body, setBody] = useState('');
    const [followRedirects, setFollowRedirects] = useState(false);
    const [insecure, setInsecure] = useState(false);
    const [verbose, setVerbose] = useState(false);

    // 历史
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [copied, setCopied] = useState(false);

    // 生成命令
    const [curlCommand, setCurlCommand] = useState('');
    const clipboard = useClipboard({ timeout: 1000 });

    // 草稿自动保存（防丢失）
    const draftRef = useRef({ method, url, headers, body, followRedirects, insecure, verbose });
    const [debouncedDraft] = useDebouncedValue(draftRef.current, 1000);

    useEffect(() => {
        localStorage.setItem('curl-generator-draft', JSON.stringify(debouncedDraft));
    }, [debouncedDraft]);

    // 初始化：尝试恢复草稿
    useEffect(() => {
        const savedDraft = localStorage.getItem('curl-generator-draft');
        if (savedDraft) {
            try {
                const d = JSON.parse(savedDraft);
                setMethod(d.method || 'GET');
                setUrl(d.url || 'https://httpbin.org/get');
                setHeaders(d.headers || '');
                setBody(d.body || '');
                setFollowRedirects(!!d.followRedirects);
                setInsecure(!!d.insecure);
                setVerbose(!!d.verbose);
            } catch (e) {
                console.warn('Failed to restore draft');
            }
        }

        const savedHistory = localStorage.getItem('curl-generator-history');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory).slice(0, MAX_HISTORY));
            } catch (e) {
                console.warn('Failed to parse history');
            }
        }
    }, []);

    // 生成 curl 命令
    useEffect(() => {
        draftRef.current = { method, url, headers, body, followRedirects, insecure, verbose };

        const parts = ['curl'];
        if (verbose) parts.push('-v');
        if (followRedirects) parts.push('-L');
        if (insecure) parts.push('-k');
        parts.push('-X', method);
        parts.push(...formatHeadersToFlags(headers));
        if (method !== 'GET' && body.trim()) {
            parts.push('-d', escapeShellArg(body));
        }
        parts.push(escapeShellArg(url));

        setCurlCommand(parts.join(' \\\n  '));
    }, [method, url, headers, body, followRedirects, insecure, verbose]);

    // 操作函数
    const applyTemplate = (key: keyof typeof TEMPLATES) => {
        const t = TEMPLATES[key];
        setMethod(t.method as any);
        setUrl(t.url);
        setHeaders(t.headers);
        setBody(t.body);
    };

    const applyHistory = (item: HistoryItem) => {
        setMethod(item.method as any);
        setUrl(item.url);
        setHeaders(item.headers);
        setBody(item.body);
    };

    const saveToHistory = () => {
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            method,
            url,
            headers,
            body,
            timestamp: Date.now(),
        };
        const newHistory = [newItem, ...history.filter((h) => h.id !== newItem.id)].slice(0, MAX_HISTORY);
        setHistory(newHistory);
        localStorage.setItem('curl-generator-history', JSON.stringify(newHistory));
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem('curl-generator-history');
    };

    const copyCommand = () => {
        clipboard.copy(curlCommand);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
    };

    return (
        <Stack gap="md">
            {/* 快捷操作区 */}
            <Group justify="space-between" wrap="wrap" gap="xs">
                <Group gap="xs">
                    <Menu shadow="md" width={220}>
                        <Menu.Target>
                            <Button size="sm" leftSection={<IconTemplate size={16} />} variant="light">
                                模板
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Label>常用场景</Menu.Label>
                            <Menu.Item leftSection={<IconBolt size={16} />} onClick={() => applyTemplate('login')}>
                                登录请求
                            </Menu.Item>
                            <Menu.Item leftSection={<IconBolt size={16} />} onClick={() => applyTemplate('upload')}>
                                文件上传
                            </Menu.Item>
                            <Menu.Item leftSection={<IconBolt size={16} />} onClick={() => applyTemplate('withCookie')}>
                                带 Cookie
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            const contentType =
                                body.trim().startsWith('{') || body.trim().startsWith('[')
                                    ? 'application/json'
                                    : body.includes('<') && body.includes('>')
                                        ? 'application/xml'
                                        : 'text/plain';
                            if (!headers.includes('Content-Type')) {
                                setHeaders((prev) =>
                                    prev ? `${prev}\nContent-Type: ${contentType}` : `Content-Type: ${contentType}`
                                );
                            }
                        }}
                        disabled={!body.trim()}
                    >
                        补全 Content-Type
                    </Button>
                </Group>

                <Button
                    size="sm"
                    leftSection={<IconHistory size={16} />}
                    onClick={saveToHistory}
                    variant="outline"
                >
                    保存到历史
                </Button>
            </Group>

            {/* 请求配置区 */}
            <Paper p="md" radius="md" withBorder>
                <Title order={5} mb="sm" c="dimmed">
                    <IconSettings size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                    请求配置
                </Title>

                <Stack gap="sm">
                    <Group align="end" grow>
                        <Select
                            label="方法"
                            data={['GET', 'POST', 'PUT', 'DELETE']}
                            value={method}
                            onChange={(val) => val && setMethod(val as any)}
                            w={{ base: '100%', sm: 120 }}
                        />
                        <TextInput
                            label="URL"
                            placeholder="https://example.com/api"
                            value={url}
                            onChange={(e) => setUrl(e.currentTarget.value)}
                            styles={{ input: { fontFamily: 'monospace' } }}
                        />
                    </Group>

                    <Textarea
                        label={
                            <Group gap="xs">
                                Headers （每行一个：Key: Value）
                                <Badge color="gray" size="xs"># 开头为注释</Badge>
                            </Group>
                        }
                        placeholder="Content-Type: application/json\nAuthorization: Bearer xxx"
                        value={headers}
                        onChange={(e) => setHeaders(e.currentTarget.value)}
                        minRows={8}
                        autosize
                        styles={{ input: { fontFamily: 'monospace' } }}
                    />

                    {method !== 'GET' && (
                        <Textarea
                            label="Body"
                            placeholder='{ "key": "value" }'
                            value={body}
                            onChange={(e) => setBody(e.currentTarget.value)}
                            minRows={8}
                            autosize
                            styles={{ input: { fontFamily: 'monospace' } }}
                        />
                    )}

                    <Group gap="xl" mt="xs">
                        <Switch
                            label="-L (跟随重定向)"
                            checked={followRedirects}
                            onChange={(e) => setFollowRedirects(e.currentTarget.checked)}
                        />
                        <Switch
                            label="-k (跳过 SSL)"
                            checked={insecure}
                            onChange={(e) => setInsecure(e.currentTarget.checked)}
                        />
                        <Switch
                            label="-v (详细输出)"
                            checked={verbose}
                            onChange={(e) => setVerbose(e.currentTarget.checked)}
                        />
                    </Group>
                </Stack>
            </Paper>

            {/* 输出区 */}
            <Paper p="md" radius="md" withBorder>
                <Group justify="space-between" align="center" mb="sm">
                    <Title order={5} c="dimmed">
                        <IconTerminal2 size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        生成的命令
                    </Title>
                    <Group gap="xs">
                        <Tooltip label={copied ? '已复制！' : '复制 curl 命令'}>
                            <ActionIcon onClick={copyCommand} variant="light" color={copied ? 'green' : 'gray'}>
                                <IconCopy size={16} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                <Textarea
                    value={curlCommand}
                    readOnly
                    minRows={15}
                    autosize
                    styles={{
                        input: {
                            fontFamily: 'monospace',
                            fontSize: '0.9em',
                            backgroundColor: 'var(--mantine-color-default)',
                        },
                    }}
                />
            </Paper>

            {/* 历史记录 */}
            {history.length > 0 && (
                <Paper p="md" radius="md" withBorder>
                    <Group justify="space-between" align="center" mb="sm">
                        <Title order={5} c="dimmed">历史记录</Title>
                        <ActionIcon size="sm" onClick={clearHistory} color="red">
                            <IconTrash size={14} />
                        </ActionIcon>
                    </Group>
                    <Stack gap="xs">
                        {history.map((item) => (
                            <Paper key={item.id} p="xs" bg="gray.0" radius="sm" withBorder>
                                <Group justify="space-between" wrap="nowrap">
                                    <Box style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <Badge size="xs" color={item.method === 'GET' ? 'teal' : 'violet'} mr="xs">
                                            {item.method}
                                        </Badge>
                                        <Text span inherit c="dimmed" size="sm">
                                            {item.url}
                                        </Text>
                                    </Box>
                                    <Button size="xs" variant="subtle" onClick={() => applyHistory(item)}>
                                        应用
                                    </Button>
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                </Paper>
            )}
        </Stack>
    );
}