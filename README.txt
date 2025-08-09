適用方法（更新が必要なファイルだけ上書き）
1. 下記のうち、変更したいファイルだけをリポジトリに上書きアップロード → Commit
   - index.html（ヘッダー整理・カード内導線）
   - spots.html（gmaps_helper読み込み順の統一）
   - meals.html（gmaps_helper読み込み順の統一）
   - spots.js（無名ベンチ除外・説明文統一・検索中表示）
   - meals.js（検索中表示＋二重送信防止）
   - sw-v12.js（キャッシュ名バンプ）
2. Safariで `unregister.html` を開いてキャッシュを削除（あるいはWebサイトデータ消去）
3. 各ページを再読み込みして確認
