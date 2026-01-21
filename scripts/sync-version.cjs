const fs = require('fs');
const path = require('path');
const toml = require('toml');
const semver = require('semver'); // 引入 semver 用于可靠的版本比较

// 文件路径配置
const CARGO_PATH = path.join(__dirname, '../src-tauri/Cargo.toml');
const TAURI_CONF_PATH = path.join(__dirname, '../src-tauri/tauri.conf.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json');

function syncVersions() {
    try {
        const versions = [];

        // --- 1. 读取所有文件的版本号 ---

        // Cargo.toml
        const cargoContent = fs.readFileSync(CARGO_PATH, 'utf-8');
        const cargoData = toml.parse(cargoContent);
        const cargoVersion = cargoData.package.version;
        versions.push({ name: 'Cargo.toml', version: cargoVersion, path: CARGO_PATH, type: 'toml' });

        // package.json
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
        versions.push({ name: 'package.json', version: pkg.version, path: PACKAGE_JSON_PATH, type: 'json' });

        // tauri.conf.json
        const tauriConf = JSON.parse(fs.readFileSync(TAURI_CONF_PATH, 'utf-8'));
        // Tauri v2 逻辑：版本可能在 version 或 package.version，这里按你提供的代码逻辑处理
        const tauriVersion = tauriConf.version || (tauriConf.package && tauriConf.package.version);
        versions.push({ name: 'tauri.conf.json', version: tauriVersion, path: TAURI_CONF_PATH, type: 'json' });

        // --- 2. 比较并找出最高版本 ---

        // 过滤掉无效版本，按从大到小排序
        const sorted = versions
            .filter(v => semver.valid(v.version))
            .sort((a, b) => semver.rcompare(a.version, b.version));

        if (sorted.length === 0) {
            throw new Error('未能从任何文件中提取到有效的版本号');
        }

        const maxVersion = sorted[0].version;
        console.log(`-------------------------------------------`);
        console.log(`检测到版本分布:`);
        versions.forEach(v => console.log(` - ${v.name.padEnd(17)} : ${v.version}`));
        console.log(`>>> 选定最高版本号: ${maxVersion}`);
        console.log(`-------------------------------------------`);

        // --- 3. 同步回所有文件 ---

        let updatedAny = false;

        // 更新 package.json
        if (pkg.version !== maxVersion) {
            pkg.version = maxVersion;
            fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
            console.log('已更新 package.json');
            updatedAny = true;
        }

        // 更新 tauri.conf.json
        if (tauriConf.version !== maxVersion) {
            // 如果存在 package 字段 (Tauri v2)，也一并处理
            if (tauriConf.package) tauriConf.package.version = maxVersion;
            tauriConf.version = maxVersion;
            fs.writeFileSync(TAURI_CONF_PATH, JSON.stringify(tauriConf, null, 2) + '\n');
            console.log('已更新 tauri.conf.json');
            updatedAny = true;
        }

        // 更新 Cargo.toml (使用正则替换以保留注释和格式)
        if (cargoVersion !== maxVersion) {
            const updatedCargoContent = cargoContent.replace(
                /^(version\s*=\s*")(.+?)(")/m,
                `$1${maxVersion}$3`
            );
            fs.writeFileSync(CARGO_PATH, updatedCargoContent);
            console.log('已更新 Cargo.toml');
            updatedAny = true;
        }

        if (!updatedAny) {
            console.log('所有文件版本号已是最高，无需操作。');
        }

    } catch (err) {
        console.error('同步失败:', err.message);
        process.exit(1);
    }
}

syncVersions();