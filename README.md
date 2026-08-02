# 日本機票雷達

手機優先的日本機票推薦工具。主畫面先選台灣出發機場，再依中華航空、星宇航空、長榮航空分組顯示「可考慮購買」的日本票價。

## 目前功能

- 依桃園、松山、高雄篩選出發機場。
- 三家航空公司分組顯示推薦目的地與最低日期區間。
- 點目的地可看可買日期、票價、常態區間、近一年平均、近一年最低與趨勢圖。
- 星號收藏有興趣的推薦票價，不需要手動新增追蹤。
- 促銷提醒改為官方頁面的唯讀提醒，不再提供手動新增促銷表單。
- `server.ps1` 提供 `/api/live-fares`，讀取夜間 API 工作產生的票價資料。

## 啟動

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server.ps1 -Port 4177
```

打開：

```text
http://127.0.0.1:4177/
```

## 自動查價來源

- 星宇、長榮：航空公司公開低價日曆 API。
- 華航：Travelpayouts / Aviasales Data API 的近期搜尋票價快取。

華航抓取器不再開啟華航網站、不使用 Playwright，也不呼叫受防機器人保護的華航內部 API，
因此不會再因排程抓價觸發華航 CAPTCHA 或鎖定家用網路 IP。Data API 是快取資料，並非華航
結帳畫面的當下庫存；畫面會標示「近 48 小時快取」，訂票前仍應到華航官網確認。

## 華航一次性設定

1. 免費註冊 [Travelpayouts](https://www.travelpayouts.com/) 並在 Profile → API token 取得 token。
2. 開啟本機已建立的 `scraper/travelpayouts_secret.json`。
3. 把 `token` 的空字串換成自己的 token。
4. 執行設定檢查：

```powershell
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" .\scraper\scrape_ci_data_api.py --check-config
```

`travelpayouts_secret.json` 位於整個被 `.gitignore` 排除的 `scraper/` 目錄內，不會被推送到
公開 GitHub。也可以改用環境變數 `TRAVELPAYOUTS_TOKEN`。

缺少／失效 token 或 API 暫時故障時，程式會保留上次成功資料，並讓 Windows 工作排程回傳
非 0 錯誤；不會再像舊版一樣顯示成功卻默默沿用華航舊價。
