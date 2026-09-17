# chotto

[English README](README.en.md)

macOS 向けの、小さくてキーボード中心のタスクアプリ。
「ちょっと」の名のとおり、どこからでも一瞬でタスクを書き留めるためのものです。

## なぜ作ったか
- タスクを Apple メモで管理してきたが、
  - すぐ書き留めるためのグローバルショートカットが無い
  - 行の並び替えが面倒
  - 使わない機能でツールバーが埋まっている
  - テーマを変えられない
- 既存のタスクアプリは書き留めるまでが遅い (アプリを開く → 入力欄を探す → 打つ)
- Mac で最速のキャプチャが欲しい。テキストを選択 → ショートカット1回 → 完了

## コア機能 (MVP)
- [x] グローバルショートカットで出るポップアップ (Spotlight / Raycast 風)
  - タイトルバーも信号機ボタンも無い。リストだけ
  - `Esc` かフォーカス喪失で隠れる。ピン留めすれば最前面に残る
- [x] すべての行がチェックボックス付きのタスク
- [ ] 即時キャプチャ: どこかで選択したテキスト → ショートカット → タスクになる
- [ ] AI による解析: キャプチャしたテキストからタイトル / 期日 / タグを抽出
- [x] 完全なキーボード操作
  - すべての行が編集可能。`Enter` で下に新しい行
  - `↑↓` で行を移動、`⌘Enter` でチェック、`⌘↑↓` で行を子ごと移動
  - `⌘⌫` で行を削除、`⌘K` でテーマ切替、`⌘,` で設定
- [x] サブタスク: `Tab` / `Shift+Tab` でインデント
- [x] UI 言語: 英語 (既定) / 日本語
- [x] キーの再割り当て。グローバルショートカットも含む
- [x] テーマ: **flexoki-light (既定)**、flexoki-dark、Dracula、Nord
- [x] ローカル保存 (SQLite)

## 今後のアイデア
- [ ] `⌘K` コマンドパレット (現状はテーマの順送りのみ)
- [ ] 音声キャプチャ
- [ ] 完了タスクの扱いを選べるように (取り消し線 / 沈める / フェードアウト)
- [ ] Homebrew tap での配布 (Apple Developer の署名が必要)
- [ ] 自動アップデート (Tauri updater)

## 技術構成
- Tauri 2 (Rust のシェル部分は最小限)
- React + TypeScript
- SQLite (ローカル、`tauri-plugin-sql` 経由)
- Claude API (タスクの解析)

## 開発

[Rust](https://rustup.rs) と Node 20+ / pnpm が必要です。macOS のビルドには Xcode
Command Line Tools も要ります。

```sh
pnpm install
pnpm tauri dev                  # アプリを起動
pnpm build                      # 型チェック + フロントエンドのビルド
cd src-tauri && cargo check     # Rust 側のチェック
```

どこに何があるか:

- `src/lib/db.ts` — chotto が発行する SQL のすべて
- `src/lib/keymap.ts` — アクション、既定のキー、コードの解釈
- `src/lib/i18n.ts` — UI 文言のすべて (英語・日本語)
- `src/styles/themes.css` — テーマは CSS 変数数個分
- `src-tauri/src/lib.rs` — ウィンドウの挙動、グローバルショートカット、マイグレーション

グローバルショートカット: `⌘⇧Space` でポップアップを開閉します。

アプリ内のキー: `Enter` 新しい行 / `⌘Enter` チェック / `↑↓` 行の移動 / `⌘↑↓` 行を子ごと移動 / `⌫` 空行なら削除 / `⌘⌫` 行を削除 / `Tab` `⇧Tab` インデント / `⌘K` テーマ / `⌘L` 言語 / `⌘P` ピン留め / `⌘,` 設定 / `Esc` 隠す。

独立した入力欄はありません。すべての行が編集可能なフィールドで、chotto は常に最低1行を残します。

`⌘,` で設定パネルが開きます。ここですべてのキーを再割り当てできます。行をクリックして押したいキーを押すと、その場で反映されます。割り当ては `localStorage` の `chotto.keymap` に保存され、`⌘⇧Space` だけは Rust 側を経由して OS に登録し直します。

UI 言語の既定は英語で、`⌘L` か設定パネルの行から日本語に切り替えられます。選択は記憶されます。

データベースはアプリのデータディレクトリに `chotto.db` として置かれ、スキーマは
`src-tauri/src/lib.rs` のマイグレーションで管理します。タスクは並び順を `REAL` の
position、ネストを `indent` の深さとして別々に持つので、並び替えとインデントが互いを
壊しません。

## 設計上の判断
- Electron ではなく Tauri: バイナリが小さくメモリも少ない。速度が目的だから
- SwiftUI ではなく Tauri: テーマが CSS 変数で済む (1テーマ約20行)
- ポップアップ前提の UX: 既定では隠れていて、コンテキストを切り替えずに書き留められる
- すべての行がチェックボックス: 見出しもリッチテキストも無い。これはタスクリストであってメモアプリではない
- ローカルファースト: サーバーもアカウントも無く、データは手元に留まる
- フォントは参照ではなく同梱: chotto は一切ネットワークにアクセスしない

## 配布
- Phase 1: 自分用にローカルでビルド (Apple Developer アカウント不要)
- Phase 2: オープンソース化。各自でビルドする手順を用意
- Phase 3: 署名・公証したビルドを Homebrew tap で配布 (Apple Developer、年 $99)

## ライセンス
MIT

同梱フォント。いずれもアプリ内 (`src/assets/fonts/`) に含まれ、実行時に取得することは
ありません。

- [Comic Shanns Mono](https://github.com/jesusmgg/comic-shanns-mono) — Shannon Miwa、
  Jesus Gonzalez 作、MIT ライセンス。欧文
- [Klee One](https://github.com/fontworks-fonts/Klee) — Fontworks 作、SIL Open Font
  License 1.1。日本語
