# n-mgram 更新・リリース手順

### 自動化の構成

- `.github/workflows/ci.yml`: `main`へのpush、Pull Request、手動実行で、lint、format、型検査、テスト、Webビルド、Windowsデスクトップのコンパイルを行う。
- `.github/workflows/release.yml`: `vX.Y.Z`タグをpushするとWindows NSIS版をビルドし、署名、GitHub Release、`latest.json`、更新署名を公開する。
- アプリの「アップデート」ページ: `latest.json`を確認し、より新しい署名済みバージョンだけをダウンロード、インストール、再起動する。

Tauri updaterは更新用成果物を検証してアプリ内更新する仕組みであり、バイト単位のバイナリ差分パッチ（bsdiff等）ではない。Windowsでは署名済みNSIS更新成果物を取得する。

### 初回のみ: 更新署名鍵

公開鍵は`src-tauri/tauri.conf.json`へ組み込み済み。秘密鍵はリポジトリへ追加してはいけない。

この環境で生成した秘密鍵:

```text
C:\Users\UserName\.tauri\n-mgram.key
```

1. 秘密鍵をパスワード管理された安全な保管先へバックアップする。紛失すると、インストール済みアプリへ新しい更新を配信できなくなる。
2. GitHubの`Settings > Secrets and variables > Actions`で`TAURI_SIGNING_PRIVATE_KEY`を作成し、秘密鍵ファイルの内容全体を登録する。
3. 鍵にパスワードを付けた場合だけ`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`も登録する。現在生成済みの鍵はパスワードなし。
4. リポジトリまたは組織のポリシーでGitHub ActionsとRelease作成が許可されていることを確認する。Releaseワークフロー自身は`contents: write`だけを要求する。

CLIで登録する場合:

```powershell
Get-Content -Raw "$env:USERPROFILE\.tauri\n-mgram.key" |
  gh secret set TAURI_SIGNING_PRIVATE_KEY --repo roflsunriz/n-mgram
```

### 通常の開発更新

```powershell
git pull --ff-only
bun install --frozen-lockfile
bun run check
bun run tauri build --no-bundle
```

ローカルで署名付きインストーラーも確認する場合:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY=Get-Content -Raw "$env:USERPROFILE\.tauri\n-mgram.key"
bun run tauri build
```

NSISインストーラーと`.sig`は`src-tauri/target/release/bundle/nsis/`へ出力される。

### リリース

1. `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`の3か所を同じSemVerへ更新する。
2. `CHANGELOG.md`の`Unreleased`をリリース内容として整える。
3. `bun install`でロックファイルを更新し、`bun run check`を通す。
4. 変更を`main`へpushし、CI成功を確認する。
5. 同じバージョンのタグをpushする。

例: `0.2.0`を公開する場合

```powershell
git tag -a v0.2.0 -m "n-mgram v0.2.0"
git push origin v0.2.0
```

Releaseワークフローはタグと3つのプロジェクトバージョンが一致しない場合に停止する。成功時は通常のセットアップEXE、署名、更新用`latest.json`が同じGitHub Releaseへ公開される。

### API仕様変更時

`src/api/client.ts`にAPIの接続先、互換ヘッダー、レスポンススキーマ、データ正規化、画像取得と除外判定を集約している。実レスポンスに合わせてこのファイルを更新し、異常系を含むテストを追加する。認証系・更新系・管理系APIは対象外とする。

`POST /search/query`は、2026-07-21時点では`query`を検索条件として使用しない。`name`、`authors`、`genres`、`magazines`、`status`（`Any`、`Ongoing`、`Completed`）をサーバー検索へ使い、それ以外は読み込み済みレスポンスへローカル適用する。

`genres`は`[{ "name": "psychological" }]`のようなオブジェクト配列で送る。`["psychological"]`はHTTP 400になる。

### 復旧

- Release失敗: GitHub Actionsのログ、3か所のバージョン一致、2つの署名Secretsを確認し、修正後に失敗ジョブを再実行する。公開済みタグの付け替えは避け、新しいパッチバージョンを作る。
- 更新配信停止: 問題のReleaseをLatestから外し、修正版をより大きいSemVerで公開する。Updaterは標準設定でダウングレードしない。
- ローカルビルド障害: `node_modules`と`src-tauri/target`を再生成する。アプリデータを削除しない限り、履歴、読書位置、お気に入りは保持される。
- 秘密鍵漏えい: 直ちにReleaseを停止する。既存アプリへ組み込まれた公開鍵は自動で差し替えられないため、単純なSecret変更だけでは安全な鍵移行にならない。
