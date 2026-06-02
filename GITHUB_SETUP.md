# 改用 GitHub Pages 托管（取代 Netlify，零部署費用）

每晚抓完票價後，`run_nightly.py` 會自動 `git push` 最新的 `data/live-fares.json`，
GitHub Pages 約 1 分鐘後自動更新。公開 repo 不限部署次數、完全免費，
不再有 Netlify「每次部署扣 15 credit」的問題。

## 你要做的一次性設定（憑證是你的，Claude 不經手）

### 1. 在 GitHub 建一個「公開」repo
- 例如取名 `japan-fare-radar`。
- **不要**勾「Add a README」（本機已經有檔案）。

### 2. 準備 Personal Access Token（你正在開的那個分頁）
- Classic token 勾 **`repo`** 權限即可；或 Fine-grained token 對該 repo 給 **Contents: Read and write**。
- 產生後**自己保管**。第一次 `git push` 會要求登入，把這個 token 當「密碼」貼上，
  Windows 認證管理員會記住，之後不必再輸入。

### 3. 在本機接上 repo 並首次推送
Claude 已經幫你 `git init`、寫好 `.gitignore`（擋掉所有機密/大型檔）、`git add` 暫存好並
驗證過「不會外洩 cookie/密鑰」。剩下你做（把 `<…>` 換成你的）：

```powershell
cd C:\Users\USER\Documents\機票

# (a) 設定 commit 作者身分（會公開顯示，填你想用的名字與信箱；只需做一次）
git config user.name  "你的名字"
git config user.email "你的信箱@example.com"

# (b) 第一個 commit
git commit -m "init: 日本機票雷達 網站 + 資料"

# (c) 接上 GitHub repo 並推送
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo名>.git
git push -u origin main
```
> 跳出登入時：帳號填 GitHub 使用者名稱，密碼貼上第 2 步的 token。

### 4. 開啟 GitHub Pages
GitHub 上該 repo → **Settings → Pages** →
- Source：**Deploy from a branch**
- Branch：**main** ／ 資料夾 **/(root)** → **Save**

約 1 分鐘後網站會在：`https://<你的帳號>.github.io/<repo名>/`

### 5. 把網址告訴 Claude
我會幫你開最終確認：資料有正確載入、三家航空卡片正常、無錯誤。

---

## 之後的日常
- **資料更新**：全自動。每晚排程抓完 → 自動 push → Pages 自動更新（免費）。
- **改網站外觀/程式（html/js/css）**：這些不會自動 push，需手動：
  ```powershell
  cd C:\Users\USER\Documents\機票
  git add -A
  git commit -m "說明這次改了什麼"
  git push
  ```

## 安全提醒（已由 .gitignore 處理）
以下**絕不會**被上傳到公開 repo：
- `scraper/`（含 `profile/` 312MB 登入 cookie、`netlify_secret.json`、爬蟲程式、logs、debug）
- 各種快取與暫存截圖

公開的只有：`index.html`、`app.js`、`styles.css`、`manifest.webmanifest`、
`service-worker.js`、`assets/`、`data/live-fares.json`（純票價數字，公開無妨）。

## Netlify 怎麼辦
- 切到 GitHub Pages 後，Netlify 那個站可以不管它（不再自動部署，不會再扣 credit）。
- 想保留當備援也行；想收掉就到 Netlify 刪站。
- `deploy_netlify.py` 留著當手動備援，但夜間排程已改成推 GitHub，不會再自動部署 Netlify。
