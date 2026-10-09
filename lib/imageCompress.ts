/**
 * 後台上傳圖片前，在瀏覽器裡先縮小、轉檔。
 *
 * 網站的圖片不經過任何伺服器端處理（next.config 的 images.unoptimized），
 * 上傳什麼原檔，客人就下載什麼原檔。手機拍的商品照常常是 3000～4000px、
 * 好幾 MB 的 PNG／JPG，首頁一次幾十張，用手機網路看就是慢。
 *
 * 為什麼在瀏覽器壓、不交給 Vercel 的圖片最佳化：那是照轉換次數計費的，
 * 這個專案先前已經因為用量被 Vercel 暫停、封鎖過，不再加一項會長的用量。
 * 在後台上傳時壓一次，之後每次瀏覽都是小檔，零額外成本。
 */

/** 長邊上限。商品卡片與商品頁最大顯示寬度約 700px，1600 留給高解析度螢幕 */
export const MAX_EDGE = 1600
/** WebP／JPEG 品質。0.82 肉眼幾乎看不出差別，檔案通常是原檔的一到兩成 */
export const QUALITY = 0.82
/** 小於這個大小的圖不值得重壓 */
export const MIN_BYTES_TO_COMPRESS = 150 * 1024

/** 等比例縮到長邊不超過 maxEdge；本來就夠小的不放大 */
export function targetSize(width: number, height: number, maxEdge = MAX_EDGE) {
  if (!(width > 0 && height > 0)) return { width: 0, height: 0 }
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * 壓完要不要用壓縮後的版本。
 *
 * GIF 可能是動圖，畫到 canvas 上只剩第一格，一律不碰。
 * 壓完沒有明顯變小（少於一成）就留原檔 —— 已經是小 WebP 的圖重壓只會更糊。
 */
export function preferCompressed(original: { type: string; size: number }, compressedSize: number) {
  if (original.type === 'image/gif') return false
  return compressedSize > 0 && compressedSize < original.size * 0.9
}

/** 換掉副檔名，讓上傳後的檔名與實際格式一致 */
export function renameForType(name: string, type: string) {
  const ext = type === 'image/webp' ? 'webp' : 'jpg'
  const base = name.replace(/\.[^./\\]+$/, '') || 'image'
  return `${base}.${ext}`
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
}

/**
 * 在瀏覽器裡縮小並轉成 WebP（不支援 WebP 編碼的瀏覽器改用 JPEG）。
 * 任何一步失敗都回傳原檔，絕不讓上傳因為壓縮而失敗。
 */
export async function compressImage(file: Blob & { name?: string; type: string }, maxEdge = MAX_EDGE): Promise<File> {
  const name = (file as File).name || 'image'
  const original = file instanceof File ? file : new File([file], name, { type: file.type })
  if (file.type === 'image/gif' || file.size < MIN_BYTES_TO_COMPRESS) return original
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = targetSize(bitmap.width, bitmap.height, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return original

    ctx.drawImage(bitmap, 0, 0, width, height)
    let blob = await toBlob(canvas, 'image/webp', QUALITY)
    // 舊版 Safari 不會編 WebP，會默默回傳 PNG —— 改用 JPEG。
    // JPEG 沒有透明，先鋪白底，否則去背的商品圖會變黑底。
    if (!blob || blob.type !== 'image/webp') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      blob = await toBlob(canvas, 'image/jpeg', QUALITY)
    }
    bitmap.close()
    if (!blob || !preferCompressed(original, blob.size)) return original
    return new File([blob], renameForType(name, blob.type), { type: blob.type })
  } catch {
    return original
  }
}
