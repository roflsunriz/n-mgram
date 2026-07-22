# n-mgram

[![CI](https://github.com/roflsunriz/n-mgram/actions/workflows/ci.yml/badge.svg)](https://github.com/roflsunriz/n-mgram/actions/workflows/ci.yml)

WindowsデスクトップとAndroidに対応する漫画ビューアです。全メタデータを使った作品検索・フィルター・並べ替え、章選択、縦読み／右綴じページ読み、読書履歴・進捗・お気に入りのローカル保存、新着章の確認に対応します。

デスクトップでは右綴じ見開き、Androidの縦持ちでは1ページ表示を基本にし、左右スワイプと画面の左右タップでページを送れます。ピンチとダブルタップで1〜4倍に拡大でき、Windows版ではツールバー、タッチパッドのピンチ、`Ctrl++`・`Ctrl+-`・`Ctrl+0`からも倍率を操作できます。小さい画面では主要4ページを下部ナビゲーションへ置き、端末のセーフエリアも考慮します。

署名済みGitHub Releaseをアプリ内で確認できます。Windows版はアプリ内で更新して再起動し、Android版は公開APKをブラウザでダウンロードしてAndroidの確認画面から更新します。

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

Android版はGoogle Playへ公開せず、GitHub Releaseで署名済みAPKを直接配布します。

署名付きインストーラー、APK、リリースの生成方法は[更新・リリース手順](how-to-update.md)を参照してください。

## 注意

- 認証、投稿、更新、削除系APIは使用しません。
- API通信には解析元アプリと同じバージョン識別ヘッダーを付与しますが、認証情報や端末固有IDは送信しません。
- 画像や作品の権利は各権利者に帰属します。私的な閲覧用途で、アクセス頻度に配慮して利用してください。
- お気に入り、読書履歴、読書位置、更新確認日時は端末内のWebViewストレージだけに保存されます。

## ライセンス

ソースコードは [MIT License](LICENSE) で公開します。

リリースと更新署名の運用は [how-to-update.md](how-to-update.md) を参照してください。
