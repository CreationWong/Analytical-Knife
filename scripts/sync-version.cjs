const fs = require('fs');
const path = require('path');
const toml = require('toml');

// 文件路径配置
const CARGO_PATH = path.join(__dirname, '../src-tauri/Cargo.toml');
const TAURI_CONF_PATH = path.join(__dirname, '../src-tauri/tauri.conf.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json');

function syncVersions() {
    try {
        // 1. 读取并解析 Cargo.toml
        const cargoContent = fs.readFileSync(CARGO_PATH, 'utf-8');
        const cargoData = toml.parse(cargoContent);
        const newVersion = cargoData.package.version;

        console.log(`检测到 Cargo.toml 版本号: ${newVersion}`);

        // 2. 修改 package.json
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
        if (pkg.version !== newVersion) {
            pkg.version = newVersion;
            fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
            console.log('已更新 package.json');
        } else {
            console.log('package.json 版本已一致');
        }

        // 3. 修改 tauri.conf.json
        const tauriConf = JSON.parse(fs.readFileSync(TAURI_CONF_PATH, 'utf-8'));
        // 注意：Tauri v2 的版本路径通常在 version 字段
        if (tauriConf.version !== newVersion) {
            tauriConf.version = newVersion;
            fs.writeFileSync(TAURI_CONF_PATH, JSON.stringify(tauriConf, null, 2) + '\n');
            console.log('已更新 tauri.conf.json');
        } else {
            console.log('tauri.conf.json 版本已一致');
        }

    } catch (err) {
        console.error('同步失败:', err.message);
        process.exit(1);
    }
}

syncVersions();