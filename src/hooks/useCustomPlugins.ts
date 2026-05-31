import { useEffect, useState } from 'react';
import { CustomPluginRecord } from '../registry/types';
import { handleAppError } from '../utils/error';
import { CUSTOM_PLUGINS_CHANGED_EVENT, listCustomPlugins } from '../utils/customPlugins';

export function useCustomPlugins() {
    const [plugins, setPlugins] = useState<CustomPluginRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let disposed = false;

        const load = async () => {
            try {
                const records = await listCustomPlugins();

                if (!disposed) {
                    setPlugins(records);
                }
            } catch (error) {
                if (!disposed) {
                    setPlugins([]);
                }

                handleAppError(error, {
                    title: '插件加载失败',
                    message: '读取程序根目录的 plugins.xml 失败，请检查 XML 格式是否正确。',
                    isWarning: true,
                });
            } finally {
                if (!disposed) {
                    setLoading(false);
                }
            }
        };

        load();

        const handleReload = () => {
            setLoading(true);
            void load();
        };

        window.addEventListener(CUSTOM_PLUGINS_CHANGED_EVENT, handleReload);

        return () => {
            disposed = true;
            window.removeEventListener(CUSTOM_PLUGINS_CHANGED_EVENT, handleReload);
        };
    }, []);

    return { plugins, loading };
}
