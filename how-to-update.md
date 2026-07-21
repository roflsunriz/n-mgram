# n-mgram 更新・リリース手順 / Update and release guide

## 日本語

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

---

## English

### Automation overview

- `.github/workflows/ci.yml` runs linting, formatting, type checks, tests, the web build, and a Windows desktop compile on pushes to `main`, pull requests, and manual runs.
- `.github/workflows/release.yml` reacts to a `vX.Y.Z` tag and publishes a signed Windows NSIS installer, GitHub Release, updater signatures, and `latest.json`.
- The in-app Updates page checks `latest.json`, downloads only a newer signed release, installs it, and restarts the application.

The Tauri updater validates and installs an updater artifact. It is not a byte-level binary patch system such as bsdiff; on Windows it downloads the signed NSIS updater artifact.

### One-time updater signing setup

The public key is embedded in `src-tauri/tauri.conf.json`. Never commit the private key.

The private key generated on this workstation is stored at:

```text
C:\Users\UserName\.tauri\n-mgram.key
```

1. Back it up in a secure, password-protected location. Losing it prevents future updates from being delivered to existing installations.
2. In `Settings > Secrets and variables > Actions`, create `TAURI_SIGNING_PRIVATE_KEY` containing the complete private key file.
3. Create `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` only if the key has a password. The currently generated key has no password.
4. Ensure repository or organization policy permits GitHub Actions to create Releases. The release workflow requests only `contents: write`.

CLI alternative:

```powershell
Get-Content -Raw "$env:USERPROFILE\.tauri\n-mgram.key" |
  gh secret set TAURI_SIGNING_PRIVATE_KEY --repo roflsunriz/n-mgram
```

### Regular development update

```powershell
git pull --ff-only
bun install --frozen-lockfile
bun run check
bun run tauri build --no-bundle
```

To verify signed local installer artifacts:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY=Get-Content -Raw "$env:USERPROFILE\.tauri\n-mgram.key"
bun run tauri build
```

The NSIS installer and its `.sig` file are written to `src-tauri/target/release/bundle/nsis/`.

### Release procedure

1. Set the same SemVer in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Turn the relevant `CHANGELOG.md` Unreleased entries into release notes.
3. Refresh locks with `bun install`, then run `bun run check`.
4. Push to `main` and wait for CI to pass.
5. Push a matching annotated tag.

Example for version `0.2.0`:

```powershell
git tag -a v0.2.0 -m "n-mgram v0.2.0"
git push origin v0.2.0
```

The release workflow stops if the tag and the three project versions differ. A successful run uploads the setup EXE, signature, and updater `latest.json` to the same GitHub Release.

### API compatibility updates

Keep endpoint configuration, compatibility headers, response schemas, normalization, image transport, and blocking rules in `src/api/client.ts`. Match real responses and add success and failure tests. Authentication, mutation, and administrative endpoints remain out of scope.

As of 2026-07-21, `POST /search/query` ignores `query`. Server-side filters are `name`, `authors`, `genres`, `magazines`, and `status` (`Any`, `Ongoing`, or `Completed`). Other metadata filters are applied to loaded results locally.

Send genres as objects, for example `[{ "name": "psychological" }]`. A string array such as `["psychological"]` returns HTTP 400.

### Recovery

- Failed Release: inspect Actions logs, verify all three versions and both signing Secrets, fix the cause, and rerun the failed job. Avoid moving a published tag; publish a new patch version.
- Bad update: remove the problematic Release from Latest and publish a fixed, higher SemVer. The updater does not downgrade by default.
- Local build failure: regenerate `node_modules` and `src-tauri/target`. Local history, progress, and favorites remain unless application data is deleted.
- Leaked private key: stop releases immediately. Changing only the GitHub Secret cannot safely rotate the public key embedded in existing installations.
