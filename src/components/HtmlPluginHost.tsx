import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Loader, Group } from '@mantine/core';
import { ToolDefinition } from '../registry/types';
import { buildPluginRuntimeUrl } from '../utils/customPlugins';

interface HtmlPluginHostProps {
    tool: ToolDefinition;
}

export default function HtmlPluginHost({ tool }: HtmlPluginHostProps) {
    const iframeSrc = useMemo(() => buildPluginRuntimeUrl(tool), [tool]);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const nudgeTimeoutsRef = useRef<number[]>([]);
    const nudgeAnimationFrameRef = useRef<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewportNudge, setViewportNudge] = useState(0);

    const clearPendingNudges = () => {
        nudgeTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
        nudgeTimeoutsRef.current = [];

        if (nudgeAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(nudgeAnimationFrameRef.current);
            nudgeAnimationFrameRef.current = null;
        }
    };

    const nudgeIframeViewport = () => {
        if (nudgeAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(nudgeAnimationFrameRef.current);
        }

        setViewportNudge(1);
        window.dispatchEvent(new Event('resize'));

        nudgeAnimationFrameRef.current = window.requestAnimationFrame(() => {
            setViewportNudge(0);
            nudgeAnimationFrameRef.current = null;
        });
    };

    const scheduleViewportNudges = () => {
        clearPendingNudges();

        [0, 60, 180, 360].forEach(delay => {
            const timeoutId = window.setTimeout(() => {
                nudgeIframeViewport();
            }, delay);

            nudgeTimeoutsRef.current.push(timeoutId);
        });
    };

    useEffect(() => {
        setLoading(true);
        setViewportNudge(0);

        return () => {
            clearPendingNudges();
        };
    }, [iframeSrc]);

    useEffect(() => {
        if (!containerRef.current || typeof ResizeObserver === 'undefined') return;

        const resizeObserver = new ResizeObserver(() => {
            if (!loading) {
                nudgeIframeViewport();
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [loading]);

    return (
        <Box
            ref={containerRef}
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
                    scheduleViewportNudges();
                }}
                onError={() => {
                    setLoading(false);
                    clearPendingNudges();
                }}
                style={{
                    width: viewportNudge ? 'calc(100% - 1px)' : '100%',
                    height: viewportNudge ? 'calc(100% - 1px)' : '100%',
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
