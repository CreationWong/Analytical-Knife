import { useEffect, useMemo, useState } from 'react';
import { Box, Loader, Group } from '@mantine/core';
import { ToolDefinition } from '../registry/types';
import { buildPluginRuntimeUrl } from '../utils/customPlugins';

interface HtmlPluginHostProps {
    tool: ToolDefinition;
}

export default function HtmlPluginHost({ tool }: HtmlPluginHostProps) {
    const iframeSrc = useMemo(() => buildPluginRuntimeUrl(tool), [tool]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
    }, [iframeSrc]);

    return (
        <Box
            style={{
                flex: 1,
                minHeight: 0,
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <iframe
                key={`${tool.id}-${iframeSrc}`}
                title={tool.name}
                src={iframeSrc}
                onLoad={() => {
                    setLoading(false);
                }}
                onError={() => {
                    setLoading(false);
                }}
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                    background: 'white',
                }}
            />

            {loading ? (
                <Group
                    justify="center"
                    align="center"
                    h="100%"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(255, 255, 255, 0.92)',
                    }}
                >
                    <Loader size="lg" variant="dots" />
                </Group>
            ) : null}
        </Box>
    );
}
