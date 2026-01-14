# API

## 1. 统一通知弹窗 (`showNotification`)

位于 `src/utils/notifications.ts`。它是对 Mantine Notifications 的高级封装，内置了基于类型的样式策略。

### 1.1 参数定义 (Interface)

| **参数**            | **类型**                         | **默认值**                    | **说明**                        |
|-------------------|--------------------------------|----------------------------|-------------------------------|
| `message`         | `string ｜ ReactNode`           | **必填**                     | 通知内容。字符串会自动处理换行 (`pre-wrap`)  |
| `type`            | `'info' ｜ 'warning' ｜ 'error'` | `'info'`                   | 决定颜色、默认标题及自动关闭逻辑              |
| `title`           | `string`                       | 根据 `type` 自动生成             | 顶部标题（如“提示”、“警告”、“错误”）         |
| `id`              | `string`                       | `${type}-notification`     | 唯一 ID。相同 ID 的通知会相互覆盖，防止弹窗堆叠   |
| `autoClose`       | `number ｜ boolean`             | `info: 5000` / `其他: false` | 自动关闭的毫秒数。设为 `false` 则需要手动点击关闭 |
| `withCloseButton` | `boolean`                      | `true`                     | 是否显示右上角的关闭按钮                  |

### 1.2 逻辑行为

- **内容渲染**：当 `message` 为字符串时，系统会自动将其包裹在一个带有 `white-space: pre-wrap` 样式的 `div` 中，确保后端返回的格式化文本（如换行符）能正确显示。
- **去重机制**：高频触发同一 ID 的通知时，只会更新内容而不会弹出多个窗口。

------

## 2. 统一异常处理器 (`handleAppError`)

位于 `src/utils/error.ts`。专门用于处理 `try-catch` 中的异常，尤其是涉及 Tauri 后端 `invoke` 调用时。

### 2.1 参数定义 (Interface)

| **参数**                | **类型**       | **默认值**             | **说明**                              |
|-----------------------|--------------|---------------------|-------------------------------------|
| `error`               | `any`        | **必填**              | 捕获到的错误对象。支持 `Error` 实例、字符串或后端返回的对象  |
| `options.title`       | `string`     | 根据 `isWarning` 切换   | 弹窗标题                                |
| `options.message`     | `string`     | `error.message`     | 强制覆盖显示的错误描述                         |
| `options.isWarning`   | `boolean`    | `false`             | `true` 为黄色警告（非阻塞），`false` 为红色错误（阻塞） |
| `options.autoReload`  | `boolean`    | `false`             | 是否开启自动倒计时重载页面                       |
| `options.reloadDelay` | `number`     | `3000`              | 自动重载的延迟时间（毫秒）                       |
| `options.onRetry`     | `() => void` | `location.reload()` | 用户点击“重试”或自动倒计时结束后的回调逻辑              |

### 2.2 工作流逻辑

1. **日志记录**：函数会自动在控制台输出 `[App Error]:` 前缀的原始错误信息，便于调试。
2. **自动恢复模式** (`autoReload: true`)：
   - 通知会显示一个加载动画 (`loading: true`)。
   - 消息末尾会自动追加倒计时文案：“程序将在 X 秒后自动尝试恢复...”。
   - 计时结束后，执行 `onRetry` 逻辑。
3. **手动交互模式**：
   - 在红色错误（`isWarning: false`）模式下，通知内会渲染一个醒目的“立即刷新重试”按钮。
   - 点击按钮会立即触发 `onRetry` 并关闭当前通知。

------

## 3. 开发规范要求

1. **后端命令调用**：所有 `invoke` 命令必须被 `try-catch` 包裹，且 `catch` 块必须调用 `handleAppError(err)`。
2. **异步原子性**：如果在 `onRetry` 中传入了自定义请求逻辑，请确保在执行前先调用 `notifications.hide(id)` 清理旧的错误状态。

```typescript
// 规范示例
const fetchData = async () => {
  try {
    const data = await invoke('get_complex_data');
    showNotification({ message: '数据同步成功' });
  } catch (err) {
    handleAppError(err, {
      title: '同步失败',
      onRetry: () => fetchData(), // 用户点击重试时重新执行函数
      autoReload: false
    });
  }
};
```