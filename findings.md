# 調査知見

- 非公式APIはread-only利用に限定し、認証・更新・管理APIを実装しない。全responseとHTTPS画像URLをruntime検証し、頻度を抑える。
- Tauri pluginはnpm版とRust crate版のmajor/minorを揃える。片側だけのDependabot PRはWindows/Android両方でcompile失敗するため、公開済みnpm版を確認して同じPRで更新する。
- npm向けDependabotは `package.json` だけ変えてBun lockを更新しない場合がある。CIと同じBunでlockを再生成し、frozen installを確認する。自動修復commitがあるPRはrebase拒否時にrecreateする。
- jsdom更新では親が要求するundici範囲を外すoverrideを残さない。監査だけでなくDOM testとChrome E2Eを実行する。Linux software WebGLのpage curlはframe内でcanvas表示とpixelを観測し、外部50ms pollingだけに頼らない。
- minimatch の GHSA-g3hv-75wg-m249 は 11.0.1 で修正される。ESLint と typescript-eslint は 10 系を要求するため、両者が追従するまで override の互換性を lint と CI で確認する。
- `/search/query` は `query` をserver条件に使わない。`name/authors/genres/magazines/status` だけを送信し、genresは `{name}` object配列。章coverの空/nullは未設定として扱う。
- release versionは `package.json`、`src-tauri/Cargo.toml`、`tauri.conf.json` の3箇所とtagを一致させる。tag後の一時障害はtagを動かさず、既存tagを指定してworkflowを再実行する。
- WindowsのAndroid buildは `jniLibs` symlink作成権限が必要。権限がない環境ではRust target compileまでとし、Linux CIでAPK生成を必ず確認する。
- Tauri updater鍵とAndroid keystoreは別。紛失すると既存installへ更新できず、漏えい時はSecret差替えだけで安全移行できない。repoやcommand historyへ秘密を残さない。
