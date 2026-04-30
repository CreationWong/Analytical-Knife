# Analytical Knife (分析刀)

一个为 CTF 选手和安全研究人员设计的本地化分析工具，集成了多种实用功能于一体桌面应用。

## 项目概述

Analytical Knife 是一个基于现代 Web 技术构建的桌面应用，专门用于 CTF 比赛。它提供了从编码解码、密码分析到网络数据处理的多种工具，所有操作都在本地完成，确保数据安全。

>**注意:**
>
>本项目采用 **Vibe Coding** 方式开发。利用大语言模型（如 Gemini, DeepSeek, ChatGPT, Qwen 等）生成 90% 的核心代码，通过 “AI 生成算法 + NSSCTF 实战验证” 的方式混合开发。
>
>部分工具可能存在一些算法 BUG ，如果存在请通过 issues 向我反馈。
>
>如果你有好的建议或帮助我改进代码，欢迎向仓库发起 PR。

## 主要特性

### 核心功能模块
- **编码/解码工具**：支持 Base64、URL、HTML 等多种编码格式
- **密码学分析**：包含凯撒密码、RSA、常见加密算法分析
- **网络工具**：HTTP 请求分析、数据包处理等
- **图像处理**：隐写分析、元数据提取
- **CTF专用工具**：Flag 格式化
- **思维导图**：内置 Excalidraw 用于绘制分析流程图

### 技术优势
- **本地运行**：所有数据处理都在本地完成，无需网络连接
- **跨平台**：基于 Tauri 构建，支持 Windows、macOS、Linux
- **现代化界面**：使用React + TypeScript + Mantine 构建
- **模块化设计**：工具可独立使用，按需加载
- **性能优化**：Vite 构建，快速启动和响应

## 快速开始

### 环境要求
- Node.js
- Rust (用于Tauri构建)
- npm

### 安装步骤
#### Git LFS

本项目使用了 Git LFS，在拉取代码时请配置 LFS！

```bash
# 克隆项目
git clone https://github.com/CreationWong/Analytical-Knife.git
cd analytical-knife

# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 构建应用
npm run tauri build
```

## 使用说明

### 界面布局
应用采用侧边栏导航设计：
- 左侧：工具分类导航树
- 中间：当前工具操作区域

### 工具使用
1. 在侧边栏选择需要的工具类别
2. 点击具体工具进入操作界面
3. 按照界面提示输入数据或上传文件
4. 查看分析结果并导出

## 开发指南

### 添加新工具
1. 在 `src/tools/` 对应分类下创建工具组件
2. 在 `src/registry/` 中注册工具
3. 添加工具图标和描述
4. 测试工具功能

### 代码规范
- 使用 TypeScript 进行类型检查
- 遵循 Rust 代码规范
- 组件采用函数式组件和 Hooks
- 工具模块保持独立性和可测试性

## 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。在提交代码前请确保：
1. 代码通过 TypeScript 类型检查
2. 通过 单元测试
3. 添加必要的测试
4. 更新相关文档

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
