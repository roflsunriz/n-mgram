# n-mgram

[![CI](https://github.com/roflsunriz/n-mgram/actions/workflows/ci.yml/badge.svg)](https://github.com/roflsunriz/n-mgram/actions/workflows/ci.yml)

WindowsデスクトップとAndroidに対応する漫画ビューアです。

## 使い始める

[GitHub Releases](https://github.com/roflsunriz/n-mgram/releases)から、Windows用インストーラーまたはAndroid用APKを取得します。更新方法は[更新手順](how-to-update.md)、不具合の相談は[サポート](SUPPORT.md)を参照してください。

## 開発

Windows版の前提: Bun、Rust stable、Windows WebView2。

```powershell
bun install
bun run tauri dev
```

品質チェックと署名不要のデスクトップコンパイルは、次のコマンドで実行します。

```powershell
bun run check
bun run tauri build --no-bundle
```

Android版にはAndroid Studio、JDK 17、Android SDK、NDK、RustのAndroidターゲットが必要です。初回にプロジェクトの生成が必要な場合は`bun run tauri android init`を使います。APKの確認ビルドは次のコマンドで実行します。

```powershell
bun run tauri android build --debug --apk --target aarch64 --ci
```

Android版はGitHub ReleaseでAPKを配布します。

## ライセンス

ソースコードは [MIT License](LICENSE) で公開します。

リリースと更新署名の運用は [how-to-update.md](how-to-update.md) を参照してください。

## 依存更新の自動処理

Dependabot は対象の依存関係を毎週確認します。patch／minor 更新は PR のチェック（CI）が成功した後に自動で squash merge されます。CI の失敗ジョブは 1 回だけ再実行します。再失敗時は指定した lockfile を再生成し、CI を再実行します。major 更新は手動で確認します。
