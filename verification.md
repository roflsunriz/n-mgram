# 検証手順

## CI修正・依存更新（2026-09-28）

- CI指定のBun 1.3.14でfrozen installと`bun run check`に成功。lint、format、型検査、130テスト、Web build、DevTools可変ポートを使うChrome E2Eが通り、`bun audit`は脆弱性0件。
- `cargo fmt`とWindowsデスクトップビルドに成功。Android ARM64 RustライブラリもJava 17でコンパイルしたが、Tauriは`jniLibs`へのシンボリックリンク作成時にWindows権限で停止したため、APK生成はGitHub ActionsのLinux jobで確認する。Java 25での先行試行はGradleの対応範囲外警告が出たため、以後はCIと同じJava 17で検証する。
- Tauriプラグインはnpm/Rustのmajor/minorを同期し、`cargo update -v`でsemver互換更新を確認した。http Rust 2.7.0はnpmに2.8.0が未公開のためexact pin。TypeScript 7は`typescript-eslint`のpeer範囲`<6.1.0`のため保留。`generic-array` 0.14.9も`crypto-common` 0.1.7のexact pinで選択できず、GTK向け旧toml群は`system-deps`の依存制約内に維持した。
- `cargo audit`は553依存を検査し脆弱性0件。7件の未保守／unsound警告はGTK 0.18（TauriのLinux Wry経路）とTauri HTTP 2.7.0が固定する`urlpattern` 0.3.0の推移依存で、Cargo treeで由来を確認した。警告を抑制せず、上流が互換修正版を出した時点で再評価する。

## 依存更新（2026-09-28）

- Tauri JavaScript API／CLIを2.12.0へ更新し、http 2.7.0・opener 2.6.0・process 2.4.0・updater 2.13.0のnpm版とRust版をmajor/minorで同期した。HTTP npm 2.8.0は未公開のためRust 2.7.0をexact pinした。React/React DOM 19.3.0、Zod 4.6.5とlint・test・build開発依存も確認済み最新版へ更新。
- TypeScript 7.0.2は`typescript-eslint` 8.70.1のpeer範囲が`<6.1.0`のため適用せず、TypeScript 6.0.3を維持した。次回はparserが対応してから同時更新する。
- `bun audit`は脆弱性0件。更新後はCI定義のBun 1.3.14でfrozen install、`bun run check`、Rust desktop/Android buildを確認する。

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

- DevToolsはChromeが割り当てた専用の空きポートへ接続し、ページ遷移中の一時的なCDP評価エラーから復帰する。
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

大量の Dependabot PR により CI 完了より分類が遅れる場合でも、分類後の `workflow_dispatch` が現在の PR 番号と head SHA を照合して再評価する。別の作成者、古い SHA、未完了の CI はマージしない。

## 2026-10-05: GitHub受付・READMEの整備（公開前）

- 比較元: `56b696231120827968abe419609e9aeba02f3c9c`（`main`）。
- 受付フォーム 2 件のYAML構造、重複キー・ID、入力型、選択肢、予約ファイル名を一括検査し、エラー0件。
- 既存の固有質問・入力例・必須条件を原文と照合。READMEのリンク・画像・コマンド・条件を確認し、裏付けがある誤記だけを訂正した。
- 既存のCI、Dependabot、labeler、ライセンスのファイル内容は比較元から変更していない。
- 製品のビルド・インストール・実機操作、GitHub上のフォーム表示、公開後CIは今回の静的検証に含めない。公開後に実際の受付表示と必要ラベルの適用を確認する。

## 2026-10-05: 公開後の依存監査修復

- 元の受付整備PRはマージ済みだが、同じmainのCIでは依存監査が失敗していた。既存CIや監査条件は変えず、依存定義とlockを修復した。
- 公式npm registryとGitHub Advisory Databaseで修正版と依存範囲を確認した。brace-expansion 5.0.12を採用し、固定lockと全依存監査（0件）、lint・型・ビルドを検証する。
- jsdom30.1.2とundici8.11.2の公式依存範囲を保持し、bun run checkのVitest・Chrome E2E・全体formatも確認する。WindowsとAndroidのコンパイルはPR CI結果で確認する。
- ローカル結果: CIと同じBun（1.3.14）で固定lockとbun audit成功（既知脆弱性0件）。bun run checkも成功し、25ファイル・130テストとChrome E2E（履歴移行、新着章、失敗時retry、削除、responsive、ページカール）を確認。
