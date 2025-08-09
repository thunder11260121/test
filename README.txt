適用内容（全て“後方互換”の小粒パッチ）
1) utils.js 追加：距離計算・Overpass取得（ミラー＆タイムアウト）・統一エラーメッセージ・2分キャッシュ
2) styles.css 追記：バッジ/ローディング/ボタン/タブの見た目統一、カード影
3) spots.js 改修：utils利用・取得中「検索中…」・ボタン無効化・無名ベンチ除外（任意で無名attractionも除外）・2分キャッシュ
4) meals.js 改修：utils利用・取得中「検索中…」・ボタン無効化・2分キャッシュ・統一エラーメッセージ
5) 各HTML：<script src="utils.js"> をページJSより前に追加（?v=付与は任意）
6) sw-v12.js：skipWaiting/clients.claim追加＆古いキャッシュを自動削除

反映手順
- 下記ファイルを上書きアップロード → Commit
  - utils.js / styles.css / spots.js / meals.js / sw-v12.js
  - index.html / spots.html / meals.html（utils読み込みタグを追加するだけ）
- その後 iPhoneで `unregister.html` を開いてキャッシュ削除 → 各ページを再読み込み

補足
- 無名除外の拡張：spots.js 冒頭の `EXCLUDE_UNNAMED_ATTRACTION=false` を true にすれば、無名の `tourism=attraction` も除外します。
