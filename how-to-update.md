# n-mgram 更新・リリース手順

### 自動化の構成

- `.github/workflows/ci.yml`: `main`へのpush、Pull Request、手動実行で、lint、format、型検査、テスト、Webビルド、WindowsデスクトップとAndroid APKのコンパイルを行う。
- `.github/workflows/release.yml`: `vX.Y.Z`タグをpushするとWindows NSIS版とAndroid APKをビルドし、それぞれ署名して同じGitHub Releaseへ公開する。Windows用には`latest.json`と更新署名も公開する。
- アプリの「アップデート」ページ: Windowsは`latest.json`からより新しい署名済み成果物を取得して更新・再起動する。AndroidはGitHub Release APIで新しいバージョンとAPKを確認し、ブラウザからAPKをダウンロードする。

Tauri updaterは更新用成果物を検証してアプリ内更新する仕組みであり、バイト単位のバイナリ差分パッチ（bsdiff等）ではない。Windowsでは署名済みNSIS更新成果物を取得する。Tauri updaterはAndroidを対象にしていないため、Android版はOSの安全確認を迂回せず、署名済みAPKをブラウザと標準インストーラーで更新する。

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

### 初回のみ: Android APK署名鍵

Androidは同じアプリを更新し続けるために、初回公開時から同じキーストアでAPKへ署名する必要がある。キーストア、エイリアス、パスワードはリポジトリへ追加しない。

1. `keytool`でPKCS12キーストアを生成し、パスワード管理された安全な保管先へバックアップする。紛失すると既存Android版へ更新を配信できない。
2. キーストアをBase64へ変換し、GitHub Actions Secret `ANDROID_KEY_BASE64`へ登録する。
3. エイリアスを`ANDROID_KEY_ALIAS`、キーストアと鍵に共通で設定したパスワードを`ANDROID_KEY_PASSWORD`へ登録する。
4. ローカル署名ビルドでは`src-tauri/gen/android/keystore.properties`を作成する。このファイルはGit管理対象外である。

例:

```powershell
keytool -genkeypair -v -keystore "$env:USERPROFILE\.tauri\n-mgram-android.jks" `
  -storetype PKCS12 -keyalg RSA -keysize 2048 -validity 10000 `
  -alias n-mgram -dname "CN=n-mgram, O=n-mgram"

$keyBase64 = [Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("$env:USERPROFILE\.tauri\n-mgram-android.jks")
)
$keyBase64 | gh secret set ANDROID_KEY_BASE64 --repo roflsunriz/n-mgram
gh secret set ANDROID_KEY_ALIAS --repo roflsunriz/n-mgram --body n-mgram
gh secret set ANDROID_KEY_PASSWORD --repo roflsunriz/n-mgram
```

`ANDROID_KEY_PASSWORD`はコマンド引数や履歴へ直接書かず、`gh`の対話入力から登録する。

### 通常の開発更新

```powershell
git pull --ff-only
bun install --frozen-lockfile
bun run check
bun run tauri build --no-bundle
bun run tauri android build --debug --apk --target aarch64 --ci
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

Releaseワークフローはタグと3つのプロジェクトバージョンが一致しない場合に停止する。成功時は通常のセットアップEXE、Windows更新署名、`latest.json`、`n-mgram-vX.Y.Z-android.apk`、APKのSHA-256ファイルが同じGitHub Releaseへ公開される。

Android端末では初回だけブラウザまたはファイル管理アプリに「不明なアプリのインストール」を許可する場合がある。APKはAndroidの確認画面から導入し、この権限を常時広く許可する必要はない。以後の更新も同じ署名のAPKを上書きインストールする。

### API仕様変更時

`src/api/client.ts`にAPIの接続先、互換ヘッダー、レスポンススキーマ、データ正規化、画像取得と除外判定を集約している。実レスポンスに合わせてこのファイルを更新し、異常系を含むテストを追加する。認証系・更新系・管理系APIは対象外とする。

`POST /search/query`は、2026-07-21時点では`query`を検索条件として使用しない。`name`、`authors`、`genres`、`magazines`、`status`（`Any`、`Ongoing`、`Completed`）をサーバー検索へ使い、それ以外は読み込み済みレスポンスへローカル適用する。

`genres`は`[{ "name": "psychological" }]`のようなオブジェクト配列で送る。`["psychological"]`はHTTP 400になる。

### 復旧

- Release失敗: GitHub Actionsのログ、3か所のバージョン一致、Windows用とAndroid用の署名Secretsを確認し、修正後に失敗ジョブを再実行する。公開済みタグの付け替えは避け、新しいパッチバージョンを作る。
- 更新配信停止: 問題のReleaseをLatestから外し、修正版をより大きいSemVerで公開する。Updaterは標準設定でダウングレードしない。
- ローカルビルド障害: `node_modules`と`src-tauri/target`を再生成する。アプリデータを削除しない限り、履歴、読書位置、お気に入りは保持される。
- 秘密鍵漏えい: 直ちにReleaseを停止する。既存アプリへ組み込まれた公開鍵は自動で差し替えられないため、単純なSecret変更だけでは安全な鍵移行にならない。
- Android署名鍵の紛失・漏えい: 既存アプリと同じIDへの安全な更新ができなくなる。キーストアのバックアップを確認し、漏えい時はAPK配布を停止して利用者へ明示する。
