# Task Breakdown

## 里程碑總覽

### M0
- 建立 repo、安裝基礎依賴、整理啟動方式
- 寫好 `AGENTS.md`
- 建立任務拆解文件與驗收條件
- 做出 M1-ready 的 Three.js 最小骨架

### M1
- 匯入 BIM 匯出的 `IFC` 檔或官方 sample
- 讀出空間階層、主要 element 與 property
- 完成相機、軌道控制、光照與畫面 layout
- 確保桌機瀏覽器流暢渲染
- 預留設備 ID 與區域 ID，為即時資料映射做準備

### M2
- 建立模擬 telemetry schema
- 用原生 `WebSocket` 餵設備狀態與環境數據
- 讓設備依狀態改變顏色、亮度或告警效果
- 處理斷線重連、初始空資料與錯誤狀態

### M3
- 做 raycasting 點擊互動
- 彈出設備狀態卡
- 做簡化 OEE / 稼動率面板
- 加入樓層切換或異常區域高亮其一

### M4
- 完成部署與產品文件
- 補 README 截圖、操作說明、資料流設計
- 建立對外展示與內部開發流程

## 每個里程碑的建議任務切法

### M1 任務切法
1. 載入一個 sample `IFC`，確認瀏覽器端可成功解析
2. 把 IFC 的空間樹整理成前端可用的 scene / registry 結構
3. 選定第一批要映射的 element，例如 `space`、`equipment proxy`、`utility zone`
4. 整理相機初始視角與限制範圍
5. 評估哪些幾何要直接顯示、哪些之後要轉 `GLB` 或 fragments 優化

### M2 任務切法
1. 定義資料格式：設備狀態、OEE、溫濕度、壓差
2. 定義 telemetry 要如何對到 IFC element id / custom property
3. 建立本機 telemetry mock server
4. 串接前端接收與狀態映射
5. 做 reconnect 與 stale data UI 提示

### M3 任務切法
1. 點擊設備後顯示基本卡片
2. 在側欄顯示設備 KPI
3. 加入單台設備與單區域的篩選
4. 做樓層切換或異常區域高亮
5. 整理操作 flow，確保 demo 時 30 秒內能講完重點

## 推薦的驗收條件寫法

### 範例：M2 設備狀態變色
- 畫面載入後 3 秒內可看到至少 6 台設備有不同狀態
- `normal`、`warning`、`alert` 三種狀態有明顯視覺差異
- 當 mock server 停止推送時，前端在 5 秒內顯示 stale data 提示
- `npm run build` 通過

### 範例：M3 點擊互動
- 使用者點到設備時，右側面板顯示對應 IFC element id、狀態、OEE、最後更新時間
- 點空白區域會清除選取狀態
- 在 1440px 寬桌機畫面下不發生版面溢出
- `npm run build` 通過

## 建議給 Codex 的任務格式

```md
背景：
這是 M2 的第 2 個任務，我已經能從 IFC 建立 placeholder 設備與右側欄位。

目標：
接上一個本機 WebSocket mock server，讓設備狀態每秒更新一次。

驗收條件：
1. 畫面中的設備會依資料切換 normal / warning / alert 色彩
2. 斷線後畫面會顯示 reconnecting
3. 不引入任何新前端框架
4. npm run build 必須通過

不要做：
- 不處理後端持久化
- 不做登入
- 不加圖表套件
```

## Product導向提醒
- 每個新增模組都要能回答「它在產品裡的角色是什麼」
- BIM 匯入要能講清楚為什麼選 `IFC`、解析了哪些層級、哪些欄位用來對 telemetry
- 即時資料要能講清楚資料格式、節流方式、斷線策略與恢復策略
- 3D 場景要能講清楚座標系、設備 mapping、效能取捨與圖層控制策略
- 所有 viewer 功能都應盡量朝 `multi-model / layer-aware / operator-first` 演進
