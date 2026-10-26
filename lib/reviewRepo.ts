import type { SupabaseClient } from '@supabase/supabase-js'
import { EMPTY_SUMMARY, REVIEW_PAGE_SIZE, summarizeReviews, type PublicReview, type ReviewSummary } from './reviews'

/**
 * 商品評價的資料庫查詢（伺服器端）。
 * product_reviews.sql 還沒執行時，查詢會失敗 —— 一律當成「還沒有評價」，
 * 商品頁照常顯示，不能因為評價壞掉整頁。
 */
export const PUBLIC_REVIEW_COLUMNS =
  'id, display_name, rating, content, tags, variant_name, verified_purchase, admin_reply, admin_reply_at, created_at'

export async function fetchReviewSummary(db: SupabaseClient, productId: number): Promise<{ ready: boolean; summary: ReviewSummary }> {
  const { data, error } = await db.from('product_reviews')
    .select('rating, verified_purchase')
    .eq('product_id', productId).eq('status', 'published')
    .limit(5000)
  if (error) return { ready: false, summary: EMPTY_SUMMARY }
  return { ready: true, summary: summarizeReviews(data || []) }
}

export interface ReviewFilter { rating?: number; verified?: boolean; offset?: number; limit?: number }

export async function fetchReviews(db: SupabaseClient, productId: number, filter: ReviewFilter = {}): Promise<{ reviews: PublicReview[]; hasMore: boolean }> {
  const limit = filter.limit ?? REVIEW_PAGE_SIZE
  const offset = filter.offset ?? 0
  let query = db.from('product_reviews')
    .select(PUBLIC_REVIEW_COLUMNS)
    .eq('product_id', productId).eq('status', 'published')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + limit)      // 多拿一筆，判斷還有沒有下一頁
  if (filter.rating && filter.rating >= 1 && filter.rating <= 5) query = query.eq('rating', filter.rating)
  if (filter.verified) query = query.eq('verified_purchase', true)
  const { data, error } = await query
  if (error || !data) return { reviews: [], hasMore: false }
  return { reviews: (data as PublicReview[]).slice(0, limit), hasMore: data.length > limit }
}
