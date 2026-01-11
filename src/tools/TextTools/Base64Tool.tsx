import { Stack, Textarea, Title } from '@mantine/core';
import { useState } from 'react';
import {handleAppError} from "../../utils/error.ts";

export default function Base64Tool() {
    try {
        const [text, setText] = useState('');
        const encoded = btoa(text || ''); // 未处理中文字符
        return (
            <Stack>
                <Title order={3}>Base64 转换器</Title>
                <Textarea
                    label="输入文本"
                    placeholder="在此输入内容..."
                    value={text}
                    onChange={(e) => setText(e.currentTarget.value)}
                />
                <Textarea
                    label="Base64 结果"
                    value={encoded}
                    readOnly
                />
            </Stack>
        );
    }
    catch (err) {
        handleAppError(err, {
            title: "内部错误",
            autoReload: true,
            reloadDelay: 3000,
        });
    }
}