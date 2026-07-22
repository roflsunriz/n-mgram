# n-mgram

[![CI](https://github.com/roflsunriz/n-mgram/actions/workflows/ci.yml/badge.svg)](https://github.com/roflsunriz/n-mgram/actions/workflows/ci.yml)

WindowsデスクトップとAndroidに対応するビューアです。

## 開発

Windows版の前提: Bun、Rust stable、Windows WebView2。

```powershell
bun install
bun run tauri dev
```

品質チェックと署名不要のデスクトップコンパイル:

```powershell
bun run check
bun run tauri build --no-bundle
```

Android版の前提: Android Studio、JDK 17、Android SDK、NDK、RustのAndroidターゲット。初回だけAndroidプロジェクトを生成する場合は`bun run tauri android init`、APKの確認ビルドは次のコマンドを使います。

```powershell
bun run tauri android build --debug --apk --target aarch64 --ci
```

Android版はGitHub ReleaseでAPKを配布します。

## ライセンス

ソースコードは [MIT License](LICENSE) で公開します。

リリースと更新署名の運用は [how-to-update.md](how-to-update.md) を参照してください。
