修正パッチ（フルJS差し替え）
- 直前のZIPに短縮版JSが入ってしまい検索が動かなくなっていました。
- `meals.js` と `spots.js` をフル実装に差し替え。これで検索が復活します。

適用:
1) ZIPを展開し、`meals.js` / `spots.js` を `/test` 直下に上書き
2) `unregister.html` を開いてキャッシュ削除 → `meals.html` / `spots.html` を再読み込み
