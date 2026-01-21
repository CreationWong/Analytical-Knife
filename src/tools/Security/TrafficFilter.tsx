import { useState, useMemo } from 'react';
import {
    Paper, Stack, TextInput, Select, Group, Code, Title, Text,
    ActionIcon, CopyButton, Button, Box, Textarea, Alert, Autocomplete, Tooltip, Badge
} from '@mantine/core';
import {
    IconPlus, IconTrash, IconParentheses, IconVariable,
    IconAlertCircle, IconLanguage, IconSearch, IconAnalyze, IconCheck, IconCircleX
} from '@tabler/icons-react';
import { useAppSettings } from '../../hooks/useAppSettings';

// --- 配置词典 ---
const PROTOCOL_DICT = [
    { value: 'http', label: 'HTTP 协议' },
    { value: 'tcp', label: 'TCP 协议' },
    { value: 'udp', label: 'UDP 协议' },
    { value: 'arp', label: 'ARP 协议' },
    { value: 'icmp', label: 'ICMP 协议' },
    { value: 'dns', label: 'DNS 协议' },
    { value: 'ssl', label: 'SSL/TLS 协议' },
    { value: 'telnet', label: 'Telnet 协议' },
    { value: 'tcp.port', label: 'TCP 端口' },
    { value: 'tcp.flags.syn', label: 'TCP 同步包(SYN)' },
    { value: 'http.host', label: 'HTTP 域名' },
    { value: 'http.response.code', label: 'HTTP 响应码' },
    { value: 'http.request.method', label: 'HTTP 请求方法' },
    { value: 'http.request.uri', label: 'HTTP 请求的 URL' },
    { value: 'http.content_type', label: 'HTTP 内容类型' },
    { value: 'http.content_length', label: 'HTTP 数据段长度' },
    { value: 'http.cookie', label: 'cookie' },
    { value: 'dns.qry.name', label: 'DNS 查询域名' },
    { value: 'ssl.handshake.type', label: 'TLS 握手类型' },
    { value: 'sctp', label: 'SCTP 流控制传输协议' },
    { value: 'sctp.port', label: 'SCTP 端口' },
    { value: 'sctp.chan', label: 'SCTP 块类型' },
    { value: 'ipv6', label: 'IPv6 协议' },
    { value: 'ipv6.addr', label: 'IPv6 地址' },
    { value: 'ipv6.src', label: '源 IPv6 地址' },
    { value: 'ipv6.dst', label: '目的 IPv6 地址' },
    { value: 'icmpv6', label: 'ICMPv6 协议' },
    { value: 'igmp', label: 'IGMP 组播协议' },
    { value: 'ospf', label: 'OSPF 开放最短路径优先协议' },
    { value: 'bgp', label: 'BGP 边界网关协议' },
    { value: 'rip', label: 'RIP 路由信息协议' },
    { value: 'ftp', label: 'FTP 文件传输协议' },
    { value: 'ftp.request.command', label: 'FTP 请求命令' },
    { value: 'ftp.response.code', label: 'FTP 响应码' },
    { value: 'smtp', label: 'SMTP 邮件发送协议' },
    { value: 'pop', label: 'POP 邮件接收协议' },
    { value: 'imap', label: 'IMAP 邮件访问协议' },
    { value: 'dhcp', label: 'DHCP 动态主机配置协议' },
    { value: 'dhcp.option.hostname', label: 'DHCP 主机名选项' },
    { value: 'dhcp.option.dhcp_server_id', label: 'DHCP 服务器ID选项' },
    { value: 'ntp', label: 'NTP 网络时间协议' },
    { value: 'snmp', label: 'SNMP 简单网络管理协议' },
    { value: 'smb', label: 'SMB 服务器消息块协议' },
    { value: 'smb2', label: 'SMB2 服务器消息块协议 v2' },
    { value: 'rtsp', label: 'RTSP 实时流传输协议' },
    { value: 'sip', label: 'SIP 会话初始协议' },
    { value: 'rtp', label: 'RTP 实时传输协议' },
    { value: 'mysql', label: 'MySQL 数据库协议' },
    { value: 'postgresql', label: 'PostgreSQL 数据库协议' },
    { value: 'redis', label: 'Redis 数据库协议' },
    { value: 'mqtt', label: 'MQTT 物联网消息协议' },
    { value: 'modbus', label: 'Modbus 工业通信协议' },
    { value: 'http2', label: 'HTTP/2 协议' },
    { value: 'quic', label: 'QUIC 传输协议 (通常用于 HTTP/3)' },
    { value: 'websocket', label: 'WebSocket 协议' },
    { value: 'coap', label: 'CoAP 受约束的应用协议' },
    { value: 'dtls', label: 'DTLS 数据报传输层安全协议' },
    { value: 'ssh', label: 'SSH 安全外壳协议' },
    { value: 'ldap', label: 'LDAP 轻量级目录访问协议' },
    { value: 'radius', label: 'RADIUS 远程用户拨号认证服务协议' },
    { value: 'ntp.time', label: 'NTP 时间戳' },
    { value: 'snmp.version', label: 'SNMP 版本' },
    { value: 'snmp.community', label: 'SNMP 团体名' },
    { value: 'sip.Request-Line', label: 'SIP 请求行' },
    { value: 'sip.Status-Line', label: 'SIP 状态行' },
    { value: 'rtp.ssrc', label: 'RTP 同步源标识符' },
    { value: 'rtp.payload_type', label: 'RTP 载荷类型' },
    { value: 'mysql.query', label: 'MySQL 查询语句' },
    { value: 'mqtt.msgtype', label: 'MQTT 消息类型' },
    { value: 'modbus.func', label: 'Modbus 功能码' },
    { value: 'tcp.flags.ack', label: 'TCP 确认包(ACK)' },
    { value: 'tcp.flags.psh', label: 'TCP 推送包(PSH)' },
    { value: 'tcp.flags.fin', label: 'TCP 结束包(FIN)' },
    { value: 'tcp.flags.rst', label: 'TCP 重置包(RST)' },
    { value: 'tcp.flags.urg', label: 'TCP 紧急包(URG)' },
    { value: 'tcp.flags.ece', label: 'TCP ECN 回应标志(ECE)' },
    { value: 'tcp.flags.cwr', label: 'TCP 拥塞窗口减小标志(CWR)' },
    { value: 'tcp.seq', label: 'TCP 序列号' },
    { value: 'tcp.ack', label: 'TCP 确认号' },
    { value: 'tcp.window_size', label: 'TCP 窗口大小' },
    { value: 'tcp.len', label: 'TCP 载荷长度' },
    { value: 'udp.port', label: 'UDP 端口' },
    { value: 'udp.length', label: 'UDP 长度' },
    { value: 'ip.addr', label: 'IP 地址' },
    { value: 'ip.src', label: '源 IP 地址' },
    { value: 'ip.dst', label: '目的 IP 地址' },
    { value: 'ip.id', label: 'IP 包标识符' },
    { value: 'ip.ttl', label: 'IP 生存时间(TTL)' },
    { value: 'ip.proto', label: 'IP 上层协议号' },
    { value: 'ip.len', label: 'IP 总长度' },
    { value: 'ip.hdr_len', label: 'IP 头部长度' },
    { value: 'ip.dsfield', label: 'IP 服务类型(DSCP/ECN)' },
    { value: 'eth', label: '以太网协议' },
    { value: 'eth.src', label: '源 MAC 地址' },
    { value: 'eth.dst', label: '目的 MAC 地址' },
    { value: 'eth.type', label: '以太网类型' },
    { value: 'frame.time', label: '数据包捕获时间' },
    { value: 'frame.number', label: '数据包编号' },
    { value: 'frame.interface_id', label: '捕获接口 ID' },
    { value: 'frame.len', label: '数据包总长度' },
    { value: 'frame.cap_len', label: '数据包捕获长度' },
];

// 逻辑符号映射
const OP_DICT: Record<string, string> = {
    '==': '==', 'eq': '==',
    '!=': '!=', 'ne': '!=',
    'contains': 'contains',
    'matches': '~ (matches)',
    '>': '>', 'gt': '>',
    '<': '<', 'lt': '<',
    '>=': '>=', 'ge': '>=',
    '<=': '<=', 'le': 'le',
    'exists': 'exists',
    '!': '!'
};

// 中文说明映射 (仅用于 UI 辅助提示)
const OP_DESCR: Record<string, string> = {
    '==': '等于', 'eq': '等于',
    '!=': '不等于', 'ne': '不等于',
    'contains': '包含内容',
    'matches': '正则匹配',
    '>': '大于', 'gt': '大于',
    '<': '小于', 'lt': '小于',
    '>=': '大于等于', 'ge': '大于等于',
    '<=': '小于等于', 'le': '小于等于',
    'exists': '协议/字段存在',
    '!': '排除该协议'
};

const LOGIC_DICT: Record<string, string> = {
    '&&': '并且',
    '||': '或者'
};

// --- 类型定义 ---
type LogicOp = '&&' | '||';
interface FilterNode {
    id: string;
    type: 'condition' | 'group';
    logic: LogicOp;
    field: string;
    op: string;
    val: string;
    children?: FilterNode[];
}

// --- 2. 递归行组件 ---
const NodeRow = ({
                     node, index, settings, updateNode, addNode, removeNode
                 }: {
    node: FilterNode; index: number; settings: any;
    updateNode: (id: string, data: Partial<FilterNode>) => void;
    addNode: (parentId: string | null, type: 'condition' | 'group') => void;
    removeNode: (id: string) => void;
}) => {
    const isProtocolOnly = node.op === 'exists' || node.op === '!';
    const isNegatedGroup = node.type === 'group' && node.field === '!';

    return (
        <Paper withBorder p="xs" radius="sm" mb="xs" bg={node.type === 'group' ? 'var(--mantine-color-default-hover)' : 'transparent'}>
            <Stack gap="xs">
                <Group grow wrap="nowrap" gap="xs">
                    {index > 0 && (
                        <Select
                            size="xs" w={70} flex="none"
                            data={['&&', '||']}
                            value={node.logic}
                            onChange={(v) => updateNode(node.id, { logic: v as LogicOp })}
                            styles={{
                                input: {
                                    fontWeight: 800,
                                    color: 'var(--mantine-color-blue-filled)',
                                    textAlign: 'center'
                                }
                            }}
                        />
                    )}

                    {node.type === 'condition' ? (
                        <>
                            <Autocomplete
                                size="xs" flex={2}
                                placeholder="字段/协议"
                                data={PROTOCOL_DICT.map(item => item.value)}
                                value={node.field}
                                onChange={(v) => updateNode(node.id, { field: v.toLowerCase() })}
                                renderOption={({ option }) => {
                                    const info = PROTOCOL_DICT.find(d => d.value === option.value);
                                    return (
                                        <Group justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
                                            <Text size="xs" fw={600}>{option.value}</Text>
                                            <Text size="10px" c="dimmed">{info?.label}</Text>
                                        </Group>
                                    );
                                }}
                                leftSection={<IconSearch size={12} />}
                            />
                            <Select
                                size="xs" w={150} flex="none"
                                data={Object.entries(OP_DICT).map(([k, v]) => ({ value: k, label: v }))}
                                value={node.op}
                                onChange={(v) => updateNode(node.id, { op: v || '==' })}
                                renderOption={({ option }) => (
                                    <Group justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
                                        <Text size="xs" fw={700} style={{ fontFamily: 'monospace' }}>{option.value}</Text>
                                        <Text size="10px" c="dimmed">{OP_DESCR[option.value] || ''}</Text>
                                    </Group>
                                )}
                                styles={{ input: { fontFamily: 'monospace', fontWeight: 700 } }}
                            />
                            {!isProtocolOnly && (
                                <TextInput
                                    size="xs" flex={2}
                                    value={node.val}
                                    onChange={(e) => updateNode(node.id, { val: e.currentTarget.value })}
                                    placeholder="匹配值"
                                />
                            )}
                        </>
                    ) : (
                        <Group gap="xs" flex={1}>
                            <Text size="xs" fw={700} c={isNegatedGroup ? 'red' : settings.primaryColor}>
                                {isNegatedGroup ? '!( ... )' : '( ... )'}
                            </Text>
                            <Tooltip label={isNegatedGroup ? "取消取反" : "设为排除分组"}>
                                <ActionIcon
                                    size="xs"
                                    variant="outline"
                                    color={isNegatedGroup ? "red" : "gray"}
                                    onClick={() => updateNode(node.id, { field: isNegatedGroup ? '' : '!' })}
                                >
                                    {isNegatedGroup ? <IconCheck size={12} /> : <IconCircleX size={12} />}
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    )}

                    <Group gap={4} flex="none">
                        {node.type === 'group' && (
                            <ActionIcon variant="light" size="sm" onClick={() => addNode(node.id, 'condition')}><IconPlus size={14} /></ActionIcon>
                        )}
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeNode(node.id)}><IconTrash size={14} /></ActionIcon>
                    </Group>
                </Group>
                {node.children && (
                    <Box pl="xl" style={{ borderLeft: `1px dashed var(--mantine-color-default-border)` }}>
                        {node.children.map((child, i) => (
                            <NodeRow key={child.id} node={child} index={i} settings={settings} updateNode={updateNode} addNode={addNode} removeNode={removeNode} />
                        ))}
                    </Box>
                )}
            </Stack>
        </Paper>
    );
};

// --- 3. 主页面组件 ---
export default function WiresharkUltraTool() {
    const [settings] = useAppSettings();
    const [tree, setTree] = useState<FilterNode[]>([
        { id: 'root-1', type: 'condition', field: 'http', op: 'exists', val: '', logic: '&&' }
    ]);
    const [rawInput, setRawInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    // 解析逻辑 (增强对 eq/ne 等字符操作符的支持)
    const handleAnalyze = () => {
        if (!rawInput.trim()) return;
        try {
            // 正则包含 eq|ne|gt|lt|ge|le
            const tokens = rawInput.match(/&&|\|\||<=|>=|==|!=|\(|\)|!|<|>|and|or|matches|contains|eq|ne|gt|lt|ge|le|[^\s()&|!<>=]+|"[^"]*"/g) || [];

            let i = 0;
            const parseRecursive = (): FilterNode[] => {
                const nodes: FilterNode[] = [];
                let currentLogic: LogicOp = '&&';
                let nextIsNegated = false;

                while (i < tokens.length) {
                    const token = tokens[i];

                    if (token === '(') {
                        i++;
                        nodes.push({
                            id: Math.random().toString(36).substring(7),
                            type: 'group', logic: currentLogic,
                            field: nextIsNegated ? '!' : '',
                            op: '', val: '',
                            children: parseRecursive()
                        });
                        nextIsNegated = false;
                    } else if (token === ')') {
                        i++; return nodes;
                    } else if (['&&', 'and'].includes(token)) {
                        currentLogic = '&&'; i++;
                    } else if (['||', 'or'].includes(token)) {
                        currentLogic = '||'; i++;
                    } else if (token === '!') {
                        nextIsNegated = true; i++;
                    } else {
                        const field = token;
                        const nextToken = tokens[i + 1];
                        const isOp = nextToken && Object.keys(OP_DICT).includes(nextToken);

                        if (isOp) {
                            const op = nextToken;
                            const val = (tokens[i + 2] || '').replace(/^"|"$/g, '');
                            nodes.push({
                                id: Math.random().toString(36).substring(7),
                                type: 'condition', logic: currentLogic,
                                field, op, val
                            });
                            i += 3;
                        } else {
                            nodes.push({
                                id: Math.random().toString(36).substring(7),
                                type: 'condition', logic: currentLogic,
                                field, op: nextIsNegated ? '!' : 'exists', val: ''
                            });
                            i += 1;
                        }
                        nextIsNegated = false;
                    }
                }
                return nodes;
            };

            const newTree = parseRecursive();
            if (newTree.length > 0) { setTree(newTree); setError(null); }
        } catch (e) {
            setError("解析失败：请检查语法结构");
        }
    };

    const updateNode = (id: string, data: Partial<FilterNode>) => {
        const mapNodes = (nodes: FilterNode[]): FilterNode[] => nodes.map(n =>
            n.id === id ? { ...n, ...data } : { ...n, children: n.children ? mapNodes(n.children) : undefined }
        );
        setTree(mapNodes(tree));
    };

    const addNode = (parentId: string | null, type: 'condition' | 'group') => {
        const newNode: FilterNode = {
            id: Math.random().toString(36).substring(7),
            type, logic: '&&', field: '', op: 'exists', val: '',
            children: type === 'group' ? [{ id: Math.random().toString(36).substring(7), type: 'condition', field: '', op: 'exists', val: '', logic: '&&' }] : undefined
        };
        if (!parentId) setTree([...tree, newNode]);
        else setTree(prev => {
            const update = (nodes: FilterNode[]): FilterNode[] => nodes.map(n =>
                n.id === parentId ? { ...n, children: [...(n.children || []), newNode] } :
                    { ...n, children: n.children ? update(n.children) : undefined }
            );
            return update(prev);
        });
    };

    const removeNode = (id: string) => {
        const filter = (nodes: FilterNode[]): FilterNode[] => nodes.filter(n => n.id !== id).map(n => ({
            ...n, children: n.children ? filter(n.children) : undefined
        }));
        if (tree.length > 1 || tree[0].id !== id) setTree(filter(tree));
    };

    const generatedFilter = useMemo(() => {
        const gen = (nodes: FilterNode[]): string => nodes.map((n, i) => {
            const prefix = i === 0 ? '' : ` ${n.logic} `;
            if (n.type === 'group') {
                const groupNot = n.field === '!' ? '!' : '';
                return `${prefix}${groupNot}(${gen(n.children || [])})`;
            }
            if (n.op === 'exists') return `${prefix}${n.field}`;
            if (n.op === '!') return `${prefix}!${n.field}`;
            const v = (!n.val || /^(0x)?[0-9.]+$/.test(n.val)) ? n.val : `"${n.val}"`;
            return `${prefix}${n.field} ${n.op} ${v || '""'}`;
        }).join('');
        return gen(tree);
    }, [tree]);

    const translateTree = useMemo(() => {
        const translate = (nodes: FilterNode[]): string => nodes.map((n, i) => {
            const logicText = i === 0 ? '' : ` ${LOGIC_DICT[n.logic]} `;
            if (n.type === 'group') return `${logicText}${n.field === '!' ? '排除' : ''}( ${translate(n.children || [])} )`;
            const fieldLabel = PROTOCOL_DICT.find(d => d.value === n.field)?.label || n.field;
            if (n.op === 'exists') return `${logicText}捕获 ${fieldLabel}`;
            if (n.op === '!') return `${logicText}排除 ${fieldLabel}`;
            // 翻译时将 eq 等转换回中文易懂形式
            const opLabel = OP_DESCR[n.op] || n.op;
            return `${logicText}${fieldLabel} ${opLabel} "${n.val || '空'}"`;
        }).join('');
        return translate(tree);
    }, [tree]);

    return (
        <Stack gap="lg" style={{ width: '100%', minHeight: '100%' }}>
            <Group justify="space-between">
                <Group gap="xs"><IconVariable size={24} color={`var(--mantine-color-${settings.primaryColor}-filled)`} />
                    <Title order={4}>Wireshark 语法构建器</Title>
                    <Badge variant="dot" color="green" size="md" radius="xl" styles={{ root: { textTransform: 'none' } }}>
                        字典库: V1.1
                    </Badge>
                </Group>
            </Group>

            <Paper withBorder p="md" radius="md">
                <Text size="xs" fw={700} mb={5} c="dimmed">解析命令 (支持 &&, eq, matches 等)</Text>
                <Group align="flex-start">
                    <Textarea flex={1} value={rawInput} onChange={(e) => setRawInput(e.currentTarget.value)} placeholder='例如: http.request.method == "GET" && tcp.port eq 80' />
                    <Button leftSection={<IconAnalyze size={16} />} onClick={handleAnalyze} color={settings.primaryColor}>分析并载入树</Button>
                </Group>
                {error && <Alert icon={<IconAlertCircle size={16} />} color="red" mt="sm" variant="light" py={5}>{error}</Alert>}
            </Paper>

            <Box>
                <Text size="xs" fw={700} mb={5} c="dimmed">逻辑树编辑</Text>
                {tree.map((node, i) => <NodeRow key={node.id} node={node} index={i} settings={settings} updateNode={updateNode} addNode={addNode} removeNode={removeNode} />)}
                <Group grow mt="md">
                    <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={() => addNode(null, 'condition')}>添加条件</Button>
                    <Button variant="light" size="xs" color="orange" leftSection={<IconParentheses size={14} />} onClick={() => addNode(null, 'group')}>添加逻辑分组</Button>
                </Group>
            </Box>

            <Stack gap="sm">
                <Paper withBorder p="md" bg="var(--mantine-color-default-hover)">
                    <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={700}>输出表达式:</Text>
                        <CopyButton value={generatedFilter}>
                            {({ copied, copy }) => (
                                <Button size="compact-xs" color={copied ? 'teal' : settings.primaryColor} onClick={copy}>
                                    {copied ? '已复制' : '复制'}
                                </Button>
                            )}
                        </CopyButton>
                    </Group>
                    <Code block fz="md" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{generatedFilter || '...'}</Code>
                </Paper>

                <Paper withBorder p="md" radius="md" style={{ borderLeft: `4px solid var(--mantine-color-${settings.primaryColor}-filled)` }}>
                    <Group gap="xs" mb={5}><IconLanguage size={16} color={`var(--mantine-color-${settings.primaryColor}-filled)`} /><Text size="xs" fw={700}>语义化翻译:</Text></Group>
                    <Text size="sm" c="dimmed" style={{ fontStyle: 'italic', lineHeight: 1.6 }}>{translateTree || '等待输入...'}</Text>
                </Paper>
            </Stack>
        </Stack>
    );
}