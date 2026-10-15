# n-mgram の実現手段と調査知見

作業着手前にこの文書を全文読む。共通方針と目的・行動義務・禁止事項は [AGENTS.md](AGENTS.md) を参照する。

## 共通方針に対する固有の実現手段

- 対象の共通ルール: 設計と実装方針・検証のBunバンドラー原則。
- 理由: Tauriの既存フロントエンドはViteで生成され、RustとAndroidのビルドも必要なため。
- 適用範囲: package.jsonとsrc-tauriの既存ビルド。
- 代替手段・検証: bun run check、Cargoの書式検査、WindowsとAndroidのCIを使う。
- 文書構成: 実現手段・環境・過去の調査知見はこの文書を正本とする。利用者向け導入・使用法はREADME、更新の入口はhow-to-update、実測結果はverification、変更意図はCHANGELOGに残す。共通方針の品質・秘密情報保護・ユーザー指示を免除しない。
- 移行基準: 2026-10-16の既定ブランチ `f35dcb08b67a6895f1b2a5552f03ba9ade745aba`。以下は出典の本文を移動したもので、過去の確認日時・適用条件・未検証事項を維持する。

<a id="agents-2"></a>

移動元: [AGENTS.md](AGENTS.md)。

## プロジェクト概要

- アプリ名は `n-mgram`。
- Tauri 2、React、TypeScript、Vite で構成するデスクトップ漫画ビューア。
- 読み取り先は `https://business.wel.my.id` の非公式API。APIが返すHTTPS画像URLはランタイム検証して表示する。
- 認証系、更新系、管理系APIは実装・呼び出ししない。

<a id="agents-3"></a>

移動元: [AGENTS.md](AGENTS.md)。

## 開発コマンド

```powershell
bun install
bun run dev
bun run tauri dev
bun run check
bun run tauri build --no-bundle
```

APIは非公式仕様なので、レスポンスを必ずランタイム検証し、アクセス頻度を抑える。

<a id="agents-4"></a>

移動元: [AGENTS.md](AGENTS.md)。

## 依存更新の注意

- Tauriプラグインはnpm版とRustクレート版のmajor/minorが一致しないとデスクトップ・Androidのコンパイルが失敗する。Dependabotのcargo PRをマージする前に `bun pm view` で対応するnpm版の存在を確認し、同じPRで両方を更新する。2026-10-11にhttp npm 2.8.2とRust 2.8.1の組み合わせを確認した。PR #22のRust版だけの更新では両CIがバージョン不一致で失敗した。
- 旧ベースのDependabot PRでCIが失敗する場合は `@dependabot rebase` で最新mainに追従させると解消することがある（prettier修正や先行マージとの競合時）。2026-10-11のPR #19・#20・#22では自動修復コミットがあるためrebaseが拒否され、`@dependabot recreate` で再作成してからCIを再実行した。

<a id="agents-5"></a>

移動元: [AGENTS.md](AGENTS.md)。

## 依存更新の確認

- npm向けDependabot PRでは `package.json` だけが変わり、Bunのロックが更新されない場合がある（PR #1で確認）。CI定義と同じBunで `bun install` を実行し、`bun.lock` の差分と `bun install --frozen-lockfile` の成功を確認する。
- 2026-09-23以降は Dependabot の `bun` エコシステムを使用し、CI 再失敗時の自動修復は `bun.lock` だけを変更する。修復後は `workflow_dispatch` で読み取り権限の CI を実行し、checkout の認証情報を残さない。根拠は `.github/dependabot.yml` と `.github/workflows/dependabot-automation.yml`。
- 間接依存の脆弱性はPR対象外にも発生するため、更新時は `bun audit` と `bun run check` を実行する。overridesを解除・変更するときも、監査0件と既存テストを維持する。
- 開発用依存の変更だけで配布版を更新するかは、アプリ・Rust・本番依存の差分と、同じ環境で作った既存タグ／更新後の `dist/` のファイル一覧・ハッシュで判断する。Vitestの更新番号だけを理由に配布版を上げない。2026-09-13の比較結果は `verification.md` を参照する。

<a id="agents-6"></a>

移動元: [AGENTS.md](AGENTS.md)。

## CI監査修復の注意

- 2026-10-05: jsdom30.1.2はundici ^8.11.2を要求する。旧override7.29.0は公式range外で新規脆弱性も残すため解除した。jsdom更新時は親packageの要求範囲を確認し、監査だけでなくVitestのDOMテストとChrome E2Eも実行する。
- 2026-10-11: `source-map-js` 1.2.1は `jsdom` と `vite` の両経路から導入され、`bun audit` のGHSA-68fv-2mgg-jv7qに該当した。`package.json` のoverrideで1.2.2へ固定し、`bun.lock` と監査結果を同時に確認する。WindowsのChrome E2Eは、この環境でAdGuardによるlocalhostへのスクリプト注入が観測され、初回のViteモジュール読み込みが10秒を超えたため、初回履歴タブの待機を30秒にしている。根拠は `scripts/e2e-history-progress.mjs` と2026-10-11の実測。
- 2026-10-11: Linux CIのソフトウェアWebGLでは、ページカールの一時表示をCDPで50msごとにポーリングすると描画を見逃すことがあった。E2Eではクリック直後からページ内の描画フレームでcanvasの表示とピクセルを観測し、実画像色を確認する。根拠は `scripts/e2e-history-progress.mjs` とmain CI run 38124517008。
- 2026-10-11: `typescript-eslint` 8.71.1の公式peer範囲はTypeScript `<6.1.0`で、TypeScript 7.0.2をまだ適用できない。`bun pm view typescript-eslint@8.71.1 peerDependencies`で再確認してから更新する。

<a id="readme-2"></a>

移動元: [README.md](README.md)。

## 開発

Windows版の前提: Bun、Rust stable、Windows WebView2。

```powershell
bun install
bun run tauri dev
```

品質チェックと署名不要のデスクトップコンパイルは、次のコマンドで実行します。

```powershell
bun run check
bun run tauri build --no-bundle
```

Android版にはAndroid Studio、JDK 17、Android SDK、NDK、RustのAndroidターゲットが必要です。初回にプロジェクトの生成が必要な場合は`bun run tauri android init`を使います。APKの確認ビルドは次のコマンドで実行します。

```powershell
bun run tauri android build --debug --apk --target aarch64 --ci
```

Android版はGitHub ReleaseでAPKを配布します。

<a id="readme-4"></a>

移動元: [README.md](README.md)。

## 依存更新の自動処理

Dependabot は対象の依存関係を毎週確認します。patch／minor 更新は PR のチェック（CI）が成功した後に自動で squash merge されます。CI の失敗ジョブは 1 回だけ再実行します。再失敗時は指定した lockfile を再生成し、CI を再実行します。major 更新は手動で確認します。

<a id="update-1"></a>

移動元: [how-to-update.md](how-to-update.md)。

## Dependabot PR の更新

前提は `.github/dependabot.yml` と PR 用 CI（CI）です。更新 PR の head SHA と `gh pr checks <PR番号>` の結果を確認してください。patch／minor は全チェック成功後に自動取り込みされます。初回 CI 失敗は failed jobs のみを 1 回再実行し、再失敗時は指定した lockfile を再生成し、CI を再実行します。

TauriプラグインのRust版を更新するPRでは、対応するnpm版の公開状況を`bun pm view`で確認し、同じPRで両版のmajor/minorを揃えます。WindowsデスクトップとAndroid APKのCIが通るまでマージしません。自動ロック修復のコミットがあるPRは `@dependabot rebase` が拒否される場合があります。生成物だけの変更だと確認できた場合に限り `@dependabot recreate` で最新mainから再作成し、全CIを再確認します。

設定を変えたときは `actionlint .github/workflows/dependabot-automation.yml` と実際の PR の Actions 結果を確認します。問題があれば呼び出し先の共通 workflow SHA を直前の検証済み値へ戻すコミットを push します。取り込まれた依存更新に問題があれば通常の revert コミットで復旧します。

CI 完了より Dependabot の分類が遅れる場合は、`callback_workflow_file` が指す呼び出し側 workflow を `workflow_dispatch` し、同じ PR 番号・head SHA・全チェックを再確認する。呼び出し側のファイル名を変える際はこの入力も一緒に更新する。

<a id="update-detail-7"></a>

移動元: [how-to-update.md](how-to-update.md)。

### 復旧

- Release失敗: GitHub Actionsのログ、3か所のバージョン一致、Windows用とAndroid用の署名Secretsを確認する。Release未作成なら、修正後のmainから既存タグを指定して手動実行する。公開済みタグの付け替えは避け、成果物が公開済みの場合は新しいパッチバージョンを作る。
- 更新配信停止: 問題のReleaseをLatestから外し、修正版をより大きいSemVerで公開する。Updaterは標準設定でダウングレードしない。
- ローカルビルド障害: `node_modules`と`src-tauri/target`を再生成する。アプリデータを削除しない限り、履歴、読書位置、お気に入りは保持される。
- 秘密鍵漏えい: 直ちにReleaseを停止する。既存アプリへ組み込まれた公開鍵は自動で差し替えられないため、単純なSecret変更だけでは安全な鍵移行にならない。
- Android署名鍵の紛失・漏えい: 既存アプリと同じIDへの安全な更新ができなくなる。キーストアのバックアップを確認し、漏えい時はAPK配布を停止して利用者へ明示する。

<a id="update-detail-6"></a>

移動元: [how-to-update.md](how-to-update.md)。

### API仕様変更時

`src/api/client.ts`にAPIの接続先、互換ヘッダー、レスポンススキーマ、データ正規化、画像取得と除外判定を集約している。実レスポンスに合わせてこのファイルを更新し、異常系を含むテストを追加する。認証系・更新系・管理系APIは対象外とする。

`POST /search/query`は、2026-07-21時点では`query`を検索条件として使用しない。`name`、`authors`、`genres`、`magazines`、`status`（`Any`、`Ongoing`、`Completed`）をサーバー検索へ使い、それ以外は読み込み済みレスポンスへローカル適用する。

`genres`は`[{ "name": "psychological" }]`のようなオブジェクト配列で送る。`["psychological"]`はHTTP 400になる。

章レスポンスの`cover`は、カバーが登録されていない章で空文字または`null`になることがある。クライアントはこの欠損値を未設定として扱い、空でない値はHTTPS画像URLとして検証する。

<a id="update-detail-5"></a>

移動元: [how-to-update.md](how-to-update.md)。

### リリース

1. `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`の3か所を同じSemVerへ更新する。
2. `CHANGELOG.md`の`Unreleased`をリリース内容として整える。
3. `bun install`でロックファイルを更新し、`bun run check`を通す。
4. `bun audit`でJavaScript依存に既知の脆弱性がないことを確認する。
5. 変更を`main`へpushし、CI成功を確認する。
6. 同じバージョンのタグをpushする。

例: `0.2.0`を公開する場合

```powershell
git tag -a v0.2.0 -m "n-mgram v0.2.0"
git push origin v0.2.0
```

Releaseワークフローはタグと3つのプロジェクトバージョンが一致しない場合に停止する。成功時は通常のセットアップEXE、Windows更新署名、`latest.json`、`n-mgram-vX.Y.Z-android.apk`、APKのSHA-256ファイルが同じGitHub Releaseへ公開される。

タグpush後に一時的なrunner障害などでReleaseが作成されなかった場合は、タグを削除・付け替えず、GitHub Actionsの`Release`ワークフローを`Run workflow`から実行して既存タグを入力する。CLIでは次のように実行する。

```powershell
gh workflow run Release --repo roflsunriz/n-mgram --ref main -f release_tag=v0.1.0
```

手動実行も入力タグのコミットをcheckoutし、タグと3か所のバージョン一致を検証してから公開する。

Android端末では初回だけブラウザまたはファイル管理アプリに「不明なアプリのインストール」を許可する場合がある。APKはAndroidの確認画面から導入し、この権限を常時広く許可する必要はない。以後の更新も同じ署名のAPKを上書きインストールする。

<a id="update-detail-4"></a>

移動元: [how-to-update.md](how-to-update.md)。

### 通常の開発更新

依存関係を変更する場合は、CI定義のBunバージョンを使って `bun install` で `bun.lock` を再生成し、`package.json` と一緒に差分を確認する。npm向けDependabot PRでもロック更新は別途必要になる場合がある。`--frozen-lockfile` を外したままCIを通す運用にはしない。問題があれば依存定義とロックを同じコミット単位で戻して再検証する。

```powershell
git pull --ff-only
bun install --frozen-lockfile
bun audit
bun run check
bun run tauri build --no-bundle
bun run tauri android build --debug --apk --target aarch64 --ci
```

WindowsでAndroidビルドを実行する場合、TauriがRustライブラリを`jniLibs`へシンボリックリンクするため、WindowsのDeveloper Modeまたは`SeCreateSymbolicLinkPrivilege`が必要になる。権限を利用できない環境では、RustのAndroidターゲットのコンパイル成功だけをローカルで確認し、GitHub ActionsのLinux環境でAPK生成まで成功することを必ず確認する。

ローカルで署名付きインストーラーも確認する場合:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY=Get-Content -Raw "$env:USERPROFILE\.tauri\n-mgram.key"
bun run tauri build
```

NSISインストーラーと`.sig`は`src-tauri/target/release/bundle/nsis/`へ出力される。

<a id="update-detail-3"></a>

移動元: [how-to-update.md](how-to-update.md)。

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

<a id="update-detail-2"></a>

移動元: [how-to-update.md](how-to-update.md)。

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

<a id="update-detail-1"></a>

移動元: [how-to-update.md](how-to-update.md)。

### 自動化の構成

- `.github/workflows/ci.yml`: `main`へのpush、Pull Request、手動実行で、JavaScript依存の脆弱性検査、lint、format、型検査、機能・結合・単体テスト、Chrome E2E、Webビルド、WindowsデスクトップとAndroid APKのコンパイルを行う。
- `.github/workflows/release.yml`: `vX.Y.Z`タグのpushまたは手動実行時に、通常CIと同じJavaScript依存の脆弱性検査、品質検査、Chrome E2Eを行ってから、Windows NSIS版とAndroid APKをビルドし、それぞれ署名して同じGitHub Releaseへ公開する。Windows用には`latest.json`と更新署名も公開する。
- アプリの「アップデート」ページ: Windowsは`latest.json`からより新しい署名済み成果物を取得して更新・再起動する。AndroidはGitHub Release APIで新しいバージョンとAPKを確認し、ブラウザからAPKをダウンロードする。

Tauri updaterは更新用成果物を検証してアプリ内更新する仕組みであり、バイト単位のバイナリ差分パッチ（bsdiff等）ではない。Windowsでは署名済みNSIS更新成果物を取得する。Tauri updaterはAndroidを対象にしていないため、Android版はOSの安全確認を迂回せず、署名済みAPKをブラウザと標準インストーラーで更新する。
