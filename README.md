# Strength PWA

這是一個可安裝到手機主畫面的靜態 PWA。訓練紀錄、個人進度與教練調整都只存在瀏覽器 localStorage，
不會寫進 GitHub repository。

## 部署到 GitHub Pages

1. 建立一個 GitHub repository。
2. 把這個資料夾內的檔案全部放到 repository 根目錄。
3. GitHub → Settings → Pages。
4. Source 選 Deploy from a branch，選 `main` 與 `/ (root)`。
5. 等 Pages 產生固定 HTTPS 網址後，用手機開啟。
6. 第一次使用，在「紀錄 → 匯入舊版備份」貼上你的私人初始化 JSON。
7. 私人初始化 JSON **不要 commit 到 GitHub**。

## 手機安裝

- iPhone / Safari：分享 → 加入主畫面。
- Android / Chrome：選單 → 安裝應用程式；支援時 App 右上角也會顯示「安裝」。

## 日常使用

1. App 內完成訓練並選「太輕 / 剛好 / 太重」。
2. 完成後按「回報 / 分享今天摘要」，用系統分享選單傳到 ChatGPT，或複製後貼到原對話。
3. ChatGPT 依紀錄調整後，會提供 `strength_coach_update` JSON。
4. App → 紀錄 →「貼上教練更新碼」→ 貼上 → 套用。
5. 這類課表調整 **不用更新 GitHub**。

只有 App UI、功能、bug 修正或離線程式碼變更時，才需要更新 GitHub。

## 教練更新碼格式

```json
{
  "type": "strength_coach_update",
  "schema": 1,
  "issuedAt": "2026-01-01T12:00:00+08:00",
  "note": "範例",
  "updates": {
    "progress": {
      "bw_squat": {"target": 12, "levelIndex": 0, "sets": 2}
    },
    "settings": {
      "cardioLevel": 0
    }
  }
}
```

教練更新只合併到後續課表，不會改寫歷史紀錄。


## Cloud sync — PWA 1.1

This build uses Supabase Email/Password Auth and stores each signed-in user's full app state in
`public.strength_state`. Row Level Security restricts each account to its own row.

LocalStorage remains the offline source. Changes sync automatically when online.
