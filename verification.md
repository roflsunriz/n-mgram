# 検証手順

## 依存更新（2026-09-13）

リリース要否の確認として、同じBun 1.3.14でv0.9.2と更新後をビルドした。`dist/` の8ファイルがSHA-256で全件一致し、`src/`・`src-tauri/`・`public/`・`scripts/`・`vite.config.ts` にも差分がなかったため、今回のテスト・lint依存更新では配布バイナリを更新しない。

- Bun 1.3.14でVitest 4.1.11へロックを再生成し、`bun install --frozen-lockfile` の成功を確認。
- `bun audit` で検出されたBrowserslist・baseline-browser-mappingを修正版へ固定し、既知脆弱性0件を確認。PR対象のVitestだけで監査を打ち切らない。
- `bun run check` のlint、format、型検査、25ファイル130テスト、Webビルド、既存Chrome E2Eが成功。
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` と `bun run tauri build --no-bundle` が成功。Android APKはGitHub Actionsの `Android APK compile` で確認する。WindowsでのAndroid APK生成はシンボリックリンク権限が必要なため、権限を利用できない場合の代替は `how-to-update.md` に従う。

## ページめくりの表裏画像

### 自動検証

```powershell
bun run check
bun audit
bun run tauri build --no-bundle
```

`bun run check` に含まれるChrome E2Eでは、次を確認する。

- 開発用画像中継が許可済みの `ihlv1.xyz` だけを受け付ける。
- ページ画像を検証後の `blob:` URLとして読み込む。
- `page-flip-2` の遅延chunkがVite開発サーバーから読み込まれる。
- WebGLページカールに不透明な紙面が描画され、そのピクセルの過半数にページ画像の色が含まれる。

### 手動確認

1. `bun run tauri dev` でアプリを起動する。
2. 4ページ以上ある章を開き、表示方式を「ページ読み」にする。
3. 左のページ送り、右のページ戻し、左スワイプ、右スワイプをそれぞれ操作する。
4. めくっている紙の表に移動前のページ、裏に移動後に右側へ来るページが表示されることを確認する。
5. めくり完了後に、右綴じの論理順と表示ページ番号が変わっていないことを確認する。

WebGL2を利用できない環境では従来描画へ自動復旧するため、画像が消えずにページ移動を継続できることも確認する。

## Dependabot 自動処理（2026-09-23）

`.github/workflows/dependabot-automation.yml` を actionlint で検査し、PR 用 workflow 名（CI）と一致することを確認する。Dependabot の patch／minor かつ全 PR チェック成功の場合だけ取り込み、major・古い SHA・再失敗は残す。

実際の Dependabot PR がまだない場合、動作経路は未検証として扱う。実 PR 発生後に自動化ジョブ、CI の再試行、マージ結果を確認する。

初回の GitHub CI は追加した Dependabot 設定と workflow の Prettier 書式で失敗した。該当 YAML を整形し、actionlint と Prettier の検査を再実行した。
