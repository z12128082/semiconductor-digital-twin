# AGENTS.md

## 專案目標
- 這個 repo 用來做 `web-first` 的晶圓廠數位孿生產品原型，不是一次性的展示專案。
- 目標是逐步建立可擴充的產品核心：多模型 viewer、即時資料、空間結構、圖層控制、營運 dashboard。
- 所有實作都應偏向產品可持續演進，而不是只為了單次展示效果。

## 技術棧
- Runtime: `Vite + TypeScript + Three.js`
- BIM 解析: `IFC` 為主要交換格式，優先評估 `web-ifc` / That Open Company 工具鏈
- 即時資料: 原生 `WebSocket`
- 樣式: 原生 CSS，使用 design tokens 管理色彩、間距與字體
- 資產格式: `IFC` 為主要輸入，`glTF / GLB` 為可選的顯示優化或快取格式
- 圖表與指標: 先以原生 SVG / HTML 製作，只有在明確需要時才加套件

## 明確非目標
- 不引入 React、Vue、Svelte 或其他前端框架
- 不引入重型狀態管理套件
- 不在 M0-M2 導入後端框架；模擬資料優先用最小可行 server
- 不直接吃 Revit 原生檔；瀏覽器端入口以 `IFC` 等 BIM 匯出格式為主
- 不為了「看起來很厲害」而塞滿依賴，先保留可解釋性與可維護性
- 不把產品策略建立在「面試官會不會喜歡」這種單次場景上

## 目錄約定
- `src/app/`：應用啟動、DOM shell、場景初始化
- `src/app/scene/`：Three.js 場景、相機、燈光、互動與渲染循環
- `src/styles/`：全域樣式與畫面 layout
- `public/assets/ifc/`：BIM 匯出的 IFC 範例檔或測試檔
- `public/assets/models/`：GLB 模型
- `public/assets/textures/`：貼圖
- `docs/`：里程碑、任務拆解、專案說明與面試可用素材

## 資產與命名規範
- 檔名一律使用 `kebab-case`
- IFC 主輸入檔使用 `fab-shell.ifc` 或語意化名稱，例如 `cleanroom-zone-a.ifc`
- 衍生的顯示優化檔使用 `fab-shell.glb`
- 設備模型使用 `tool-<category>-<index>.glb`，例如 `tool-etch-01.glb`
- 貼圖使用 `tex-<surface>-<variant>.<ext>`
- 即時資料 topic / channel 名稱使用語意化命名，例如 `fab/area-a/upw-loop/status`

## 程式風格
- 模組小而明確，一個檔案只做一件事
- 優先使用具名常數，避免裸露 magic numbers
- 預設使用函式與小型 class；只有在生命週期管理明顯更清楚時才用 class
- 3D 場景、資料模型、UI 組裝分層處理，不把所有邏輯塞進 `main.ts`
- 只有在邏輯不直觀時才加註解，註解要解釋「為什麼」

## 與 Codex 協作規則
- 一次只交付一個小任務，且每個任務都要附驗收條件
- 架構決策由人類先定義，Codex 負責實作與重構
- 每次合併前必須能口頭解釋新增的程式碼
- 每次任務完成前至少跑一次 `npm run build`
- 如果功能牽涉 BIM 匯入，先定義要解析的是幾何、空間樹、屬性還是設備對照，不一次全做
- 視覺品質、材質、光照、FPS 與互動流暢度一定要由人類親自開瀏覽器驗證
- 優先做可累積的產品能力，例如：federated models、layer system、telemetry backend、state persistence

## 任務輸入模板
- 背景：這個功能放在哪個里程碑、為什麼現在做
- 目標：這次只要完成什麼
- 驗收條件：可以觀察與驗證的結果
- 不要做：這次明確不處理的範圍
- 交付物：要改哪些檔案、是否需要文件更新

## 完成定義
- 功能符合任務驗收條件
- `npm run build` 通過
- README 或 `docs/` 有同步更新必要說明
- 你自己能解釋這次新增的程式碼、資料結構與取捨
- 新增能力對產品演進路線有清楚位置，而不是孤立 feature
