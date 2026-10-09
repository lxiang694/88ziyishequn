import { revalidatePath } from 'next/cache'

/**
 * 前台頁面（首頁、賣場、商品頁）改成每 60 秒重新產生一次，不再每次
 * 有人打開就查一次資料庫。代價是後台改了商品，前台最久 60 秒後才看到。
 *
 * 後台改到前台會顯示的資料時呼叫這個，前台下一次被打開就會拿到新內容，
 * 不必等那 60 秒。
 */
export function refreshStorefront() {
  try {
    revalidatePath('/', 'layout')
  } catch (e) {
    // 只是讓快取提早更新；失敗了頂多等 60 秒自動更新，不該讓後台的儲存失敗
    console.error('refreshStorefront failed', e)
  }
}
