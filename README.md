# AWS Multi-Session Custom Alias Chrome Extension

AWS マルチセッション機能で、アカウント ID に個人用のカスタムエイリアスを設定・表示する Chrome 拡張機能です。

## 概要

この拡張機能を使用すると、AWS コンソールで表示されるアカウント ID（例：`1234-5678-9012`）に、分かりやすいエイリアス（例：`本番環境`）を追加表示できます。

![AWS Multi-Session Custom Alias Screenshot](images/SCREENSHOT.png)

## 主な機能

- **カスタムエイリアス**: アカウント ID に個人用の名前を設定
- **スマート表示**: ナビゲーション部分では全ページ、コンテンツ部分は home ページのみ
- **安全な除外**: ARN やリソース ID などには影響しない
- **データ管理**: 設定のインポート/エクスポート機能

## インストール

1. [Chrome 拡張機能ページ](chrome://extensions/) を開く
2. 「開発者モード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このフォルダを選択

## 使い方

1. **エイリアス設定**: 拡張機能アイコンをクリックしてアカウント ID とエイリアス名を入力
2. **表示確認**: AWS コンソール（マルチセッション URL）でエイリアスが表示されることを確認

### 対応 URL

- マルチセッション URL: `https://<accountid>-xxx.<region>.console.aws.amazon.com/`

## 技術仕様

- **対応ブラウザ**: Google Chrome (Manifest V3)
- **権限**: ローカルストレージ、AWS コンソールでの動作のみ
- **データ保存**: ブラウザのローカルストレージのみ（外部送信なし）

## ライセンス

MIT License

## バージョン情報

各バージョンの詳細な更新内容については、[リリースページ](https://github.com/s3kzk/AWS-Multi-Session-Custom-Alias/releases)をご確認ください。
