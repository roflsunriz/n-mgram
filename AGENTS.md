# n-mgram 開発ガイド

## 作業開始前の必須手順（最優先・例外なし）

1. エージェントは、調査、計画、コマンド実行、スキル利用、ファイル編集、コミット、プッシュを始める前に、必ずリポジトリ直下の `.\COMMON-AGENTS.md` を開き、先頭から末尾まで全文を読む。
2. `COMMON-AGENTS.md` はGit管理外のシンボリックリンクである。`git`や既定のignore設定が有効な`rg --files`の検索結果だけで、ファイルが存在しないと判断してはならない。PowerShellでは最初に次を実行する。

```powershell
Get-Content -Raw -LiteralPath .\COMMON-AGENTS.md
```

3. 読み取りに失敗した場合、出力が省略された場合、または末尾まで読めたことを確認できない場合は、一切の作業を開始せず、パスとシンボリックリンク先を確認して全文を再取得する。必要なら分割して末尾まで読む。
4. 全文を読了するまで、ローカル `AGENTS.md` だけを根拠に作業を続けてはならない。読了後は `COMMON-AGENTS.md` を最優先の指針とし、読了直後の最初の進捗報告で全文を読了したことを明示する。

## プロジェクト概要

- アプリ名は `n-mgram`。
- Tauri 2、React、TypeScript、Vite で構成するデスクトップ漫画ビューア。
- 読み取り先は `https://business.wel.my.id` の非公式API。APIが返すHTTPS画像URLはランタイム検証して表示する。
- 認証系、更新系、管理系APIは実装・呼び出ししない。

## 開発コマンド

```powershell
bun install
bun run dev
bun run tauri dev
bun run check
bun run tauri build --no-bundle
```

APIは非公式仕様なので、レスポンスを必ずランタイム検証し、アクセス頻度を抑える。

## 依存更新の確認

- npm向けDependabot PRでは `package.json` だけが変わり、Bunのロックが更新されない場合がある（PR #1で確認）。CI定義と同じBunで `bun install` を実行し、`bun.lock` の差分と `bun install --frozen-lockfile` の成功を確認する。
- 間接依存の脆弱性はPR対象外にも発生するため、更新時は `bun audit` と `bun run check` を実行する。overridesを解除・変更するときも、監査0件と既存テストを維持する。
- 開発用依存の変更だけで配布版を更新するかは、アプリ・Rust・本番依存の差分と、同じ環境で作った既存タグ／更新後の `dist/` のファイル一覧・ハッシュで判断する。Vitestの更新番号だけを理由に配布版を上げない。2026-09-13の比較結果は `verification.md` を参照する。
