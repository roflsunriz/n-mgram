# n-mgram 開発ガイド

`COMMON-AGENTS.md` の共通ルールを最優先で参照する。

## プロジェクト概要

- アプリ名は `n-mgram`。
- Tauri 2、React、TypeScript、Vite で構成するデスクトップ漫画ビューア。
- 読み取り先は `https://business.wel.my.id` の非公式API、画像表示先は `https://ihlv1.xyz` 系CDN。
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
