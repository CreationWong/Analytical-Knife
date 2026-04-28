# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**重要：全程使用中文交流与回答。**

## Project Overview

Analytical Knife (分析刀) is a Tauri v2 desktop app for CTF players and security researchers. It provides encoding/decoding, cryptography analysis, network tools, image steganography, and payload generation — all running locally.

## Build & Development Commands

- `npm run dev` — Start Vite dev server (frontend-only)
- `npm run tauri dev` — Full-stack dev mode (Vite + Tauri with hot-reload)
- `npm run build` — TypeScript check + Vite production build
- `npm run tauri build` — Build production Tauri desktop app
- `npm run preview` — Preview Vite production build
- `npm test` — Run all Vitest frontend tests
- `npm run sync-version` — Sync version across package.json/Cargo.toml
- `cargo test` — Run Rust backend unit tests
- `npx vitest run path/to/test.test.ts` — Run a single test file
- `npx vitest --ui` — Run tests with Vitest UI
- `npx tsc --noEmit` — Type-check without emitting

## Project Architecture

### Frontend (React 19 + TypeScript + Mantine 8 + Vite 7)

```
src/
├── main.tsx                  # Entry point, MantineProvider setup
├── App.tsx                   # Shell layout, sidebar nav tree, tool routing
├── components/
│   ├── ErrorBoundary.tsx     # Per-tool error boundary
│   ├── Home.tsx              # About page (markdown)
│   └── UISettings.tsx        # Theme/color settings panel
├── hooks/
│   └── useAppSettings.ts     # LocalStorage-backed theme/color settings
├── registry/
│   ├── index.ts              # TOOLS_REGISTRY — all tool metadata
│   ├── types.ts              # ToolDefinition type
│   └── sidebarIcons.ts       # Path-segment → icon mapping for sidebar folders
├── tools/
│   ├── [Category]/
│   │   ├── [ToolName].tsx    # Tool component (view + optional inline logic)
│   │   └── __tests__/
│   │       └── [ToolName].test.ts
│   ├── Crypto/               # RSA, Caesar, Vigenere, WordFreq, SmartReplacer
│   ├── Encode&Decode/        # Base64, URL, CoreValues
│   ├── CTF/                  # BatchFlagReformatter
│   ├── Images/               # ImageStructureAnalyzer, MirageTank
│   ├── Network/              # LogAnalyzer
│   ├── Security/             # Webshell, ReverseShell, XSS, Curl, TrafficFilter
│   └── idea/                 # Excalidraw
└── utils/
    ├── error.tsx             # handleAppError — unified error handler for Tauri invoke
    ├── notifications.tsx     # showNotification — wrapped Mantine notifications
    └── fileSave.ts           # saveBase64File / saveTextFile via Tauri dialog+fs
```

### Backend (Rust + Tauri v2)

```
src-tauri/
└── src/
    ├── main.rs               # Entry (windows_subsystem + run())
    ├── lib.rs                # Tauri builder, plugin init, command registration
    └── modules/
        ├── mod.rs            # Top-level hub (crypto, encode_decode, images, network)
        ├── crypto/           # big_rsa, caesar, common_modulus, replacer, word_freq
        ├── encode_decode/    # vigenere
        ├── images/           # image_structure_analyzer, mirage_tank, formats/
        └── network/          # log_analyzer
```

### Registry Pattern

All tools are registered in `src/registry/index.ts` via the `ToolDefinition` interface:

- `id` — unique camelCase identifier
- `name` — display name (Chinese)
- `description` — short description (~10 chars)
- `icon` — Tabler icon component
- `path` — sidebar menu path (e.g. `'密码学/RSA/bigRsaSolver'`), null for hidden
- `component` — `lazy(() => import(...))` for code-splitting
- `windowMaxWidth` — optional max-width override (default 1200, `'none'` for full-width)

### Key Conventions

- **前后端分工**：简单编解码、生成器等低性能开销的场景使用前端实现；大量计算和分析的工具**必须使用后端 Rust** 实现。
- **添加新工具流程**：(1) 在 `src/tools/[Category]/` 下创建组件和 `__tests__/` 测试；(2) 在 `src/registry/index.ts` 中注册元数据；(3) 如需后端逻辑，在 `src-tauri/src/modules/` 下添加 Rust 模块。**Rust 后端必须完成三级注册**：模块级 `mod.rs` 挂载 → 顶层 `modules/mod.rs` 挂载 → `lib.rs` 的 `generate_handler!` 注册。
- **Rust 后端必须包含内部单元测试**：每个工具 `.rs` 文件末尾必须包含 `#[cfg(test)] mod tests { ... }`。
- **UI 规范**：使用 Mantine 主题 CSS 变量（`var(--mantine-color-body)` 等），严禁硬编码颜色值。容器优先使用 `<Paper withBorder shadow="xs" />`。通过 `useAppSettings` hook 获取用户主题色：`settings.primaryColor`。
- **Error handling**：所有 `invoke()` 调用必须用 try-catch 包裹，且 catch 块必须调用 `handleAppError(err)`。
- **Testing**：改完代码后必须同时跑 `npm test`（前端 Vitest）和 `cargo test`（后端 Rust）。
- **Icons**：仅使用 `@tabler/icons-react` 或 `lucide-react` 中的图标。
- **File operations**：使用 `@tauri-apps/plugin-dialog` 的 save/confirm 弹窗和 `@tauri-apps/plugin-fs` 进行文件读写。
