import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
export const supabaseConfigured = Boolean(
  supabaseUrl
  && supabaseAnonKey
  && !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY'),
)

export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'supabase-is-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  },
)

export type PostProfile = {
  id: string | null
  full_name: string | null
  avatar_url: string | null
  username: string | null
}

export type PostComment = {
  id: number | string
  content: string
  userId: string
  userName: string
  avatarUrl: string | null
  createdAt: string
}

export type SocialPost = {
  id: number | string
  user_id: string | null
  text: string
  user: string
  time: string
  likes: number
  views: number
  shareCount: number
  earnedAmount: number
  photo?: string
  mediaType?: 'image' | 'video'
  comments?: PostComment[]
  profiles: PostProfile | null
}

export type SupabaseStory = {
  id?: number | string
  userId?: string
  name: string
  image: string
  mediaType?: 'photo' | 'video'
  avatarUrl?: string
  color: string
}

export type PublicProfile = {
  id?: string
  fullName: string
  username?: string
  bio: string
  avatarUrl: string
  referralCode?: string
  referredBy?: string | null
}

export type AccountWallet = {
  balance: number
  bluePoints: number
}

export type PayoutRequest = {
  id: number | string
  name: string
  upiOrAccount: string
  ifsc: string | null
  amount: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  createdAt: string
}

function mapPost(record: Record<string, unknown>): SocialPost {
  const relatedProfile = record.profiles
  const profileRecord = Array.isArray(relatedProfile)
    ? relatedProfile[0]
    : relatedProfile
  const profiles = profileRecord && typeof profileRecord === 'object'
    ? {
        id: typeof profileRecord.id === 'string' ? profileRecord.id : null,
        full_name: typeof profileRecord.full_name === 'string' ? profileRecord.full_name : null,
        avatar_url: typeof profileRecord.avatar_url === 'string' ? profileRecord.avatar_url : null,
        username: typeof profileRecord.username === 'string' ? profileRecord.username : null,
      }
    : null
  const mediaUrl = [
    record.media_url,
    record.video_url,
    record.image_url,
    record.photo,
  ].find((value): value is string => typeof value === 'string' && value.length > 0)
  const mediaType = record.media_type === 'video'
    || (mediaUrl ? /\.(mp4|webm|ogg)(\?|$)/i.test(mediaUrl) : false)
    ? 'video'
    : 'image'

  return {
    id: typeof record.id === 'number' || typeof record.id === 'string' ? record.id : Date.now(),
    user_id: typeof record.user_id === 'string' ? record.user_id : null,
    text: typeof record.content === 'string'
      ? record.content
      : typeof record.caption === 'string'
        ? record.caption
        : typeof record.text === 'string'
          ? record.text
          : '',
    user: profiles?.full_name || profiles?.username || 'Unknown User',
    time: typeof record.created_at === 'string' ? new Date(record.created_at).toLocaleString() : 'Just now',
    likes: typeof record.likes === 'number' ? record.likes : 0,
    views: typeof record.views === 'number' ? record.views : 0,
    shareCount: typeof record.share_count === 'number' ? record.share_count : 0,
    earnedAmount: Number(record.earned_amount ?? 0),
    photo: mediaUrl,
    mediaType,
    comments: [],
    profiles,
  }
}

async function uploadMedia(file: File, bucket: 'post-images' | 'stories', path: string): Promise<string> {
  const fileName = `${path}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
  const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl
}

export async function uploadPostPhoto(file: File): Promise<string> {
  return uploadMedia(file, 'post-images', 'posts')
}

export async function uploadStoryMedia(file: File, userId: string): Promise<string> {
  return uploadMedia(file, 'stories', userId)
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session?.user) throw new Error('Sign in to update your profile photo.')

  const fileName = `${session.user.id}/${Date.now()}.jpg`
  const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  })
  if (error) throw error

  return supabase.storage.from('avatars').getPublicUrl(data.path).data.publicUrl
}

export async function fetchPosts(): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, profiles(id, username, full_name, avatar_url)')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('POSTS ERROR:', error)
    throw error
  }
  const posts = (data ?? []).map((record) => mapPost(record as Record<string, unknown>))
  if (posts.length === 0) return posts

  const [commentsByPost, likeCounts] = await Promise.all([
    fetchCommentsByPost(posts.map((post) => post.id)),
    Promise.all(posts.map(async (post) => [String(post.id), await fetchPostLikeCount(post.id)] as const)),
  ])
  const earningsByPost = await fetchPostEarnings(posts.map((post) => post.id))
  const likeCountsByPost = new Map(likeCounts)
  return posts.map((post) => ({
    ...post,
    likes: likeCountsByPost.get(String(post.id)) ?? 0,
    earnedAmount: earningsByPost.get(String(post.id)) ?? 0,
    comments: commentsByPost.get(String(post.id)) ?? [],
  }))
}

export async function fetchPostEarnings(postIds: (number | string)[]): Promise<Map<string, number>> {
  const earnings = new Map<string, number>()
  if (postIds.length === 0) return earnings

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError && authError.name !== 'AuthSessionMissingError') throw authError
  if (!authData.user) return earnings

  const { data, error } = await supabase
    .from('reward_ledger')
    .select('event_key, amount_delta')
    .eq('user_id', authData.user.id)
  if (error) throw error

  const requestedPostIds = new Set(postIds.map(String))
  for (const entry of data ?? []) {
    const match = /^(?:like|view|comment|share):([^:]+):/.exec(entry.event_key)
    if (!match || !requestedPostIds.has(match[1])) continue
    earnings.set(match[1], (earnings.get(match[1]) ?? 0) + Number(entry.amount_delta ?? 0))
  }
  return earnings
}

async function fetchCommentsByPost(postIds: (number | string)[]): Promise<Map<string, PostComment[]>> {
  const commentsByPost = new Map<string, PostComment[]>()
  if (postIds.length === 0) return commentsByPost

  const { data: commentRows, error: commentsError } = await supabase
      .from('comments')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true })
  if (commentsError) throw commentsError

  const userIds = [...new Set((commentRows ?? [])
    .map((comment) => comment.user_id)
    .filter((userId): userId is string => typeof userId === 'string'))]
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
    : { data: [], error: null }
  if (profilesError) throw profilesError

  const profilesById = new Map((profiles ?? []).map((profile) => [
    profile.id,
    profile.full_name || profile.username || 'Unknown User',
  ]))
  for (const comment of commentRows ?? []) {
    const postId = String(comment.post_id)
    const userId = typeof comment.user_id === 'string' ? comment.user_id : ''
    const postComments = commentsByPost.get(postId) ?? []
    postComments.push({
      id: typeof comment.id === 'number' || typeof comment.id === 'string' ? comment.id : `${postId}-${postComments.length}`,
      content: typeof comment.content === 'string' ? comment.content : '',
      userId,
      userName: profilesById.get(userId) ?? 'Unknown User',
      avatarUrl: profiles?.find((profile) => profile.id === userId)?.avatar_url ?? null,
      createdAt: typeof comment.created_at === 'string' ? comment.created_at : '',
    })
    commentsByPost.set(postId, postComments)
  }
  return commentsByPost
}

export async function fetchPostLikeCount(postId: number | string): Promise<number> {
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)
  if (error) throw error
  return count ?? 0
}

export async function fetchPostComments(postId: number | string): Promise<PostComment[]> {
  const commentsByPost = await fetchCommentsByPost([postId])
  return commentsByPost.get(String(postId)) ?? []
}

export async function fetchStories(): Promise<SupabaseStory[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, user_id, name, image_url, media_url, video_url, media_type, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error

  const userIds = [...new Set((data ?? [])
    .map((record) => record.user_id)
    .filter((userId): userId is string => typeof userId === 'string'))]
  const { data: profileData, error: profileError } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
    : { data: [], error: null }
  if (profileError) throw profileError

  const profilesById = new Map((profileData ?? []).map((profile) => [profile.id, profile]))
  return (data ?? []).map((record, index): SupabaseStory => {
    const image = [record.media_url, record.video_url, record.image_url]
      .find((value): value is string => typeof value === 'string' && value.length > 0) ?? ''
    const storyProfile = typeof record.user_id === 'string' ? profilesById.get(record.user_id) : undefined
    return {
      id: record.id,
      userId: typeof record.user_id === 'string' ? record.user_id : undefined,
      name: typeof storyProfile?.full_name === 'string'
        ? storyProfile.full_name
        : typeof storyProfile?.username === 'string'
          ? storyProfile.username
          : typeof record.name === 'string'
            ? record.name
            : 'Unknown User',
      image,
      mediaType: record.media_type === 'video' || /\.(mp4|webm|ogg)(\?|$)/i.test(image) ? 'video' : 'photo',
      avatarUrl: typeof storyProfile?.avatar_url === 'string' ? storyProfile.avatar_url : undefined,
      color: ['bg-amber-500', 'bg-rose-500', 'bg-emerald-600'][index % 3],
    }
  }).filter((story) => story.image)
}

export async function createStory(
  name: string,
  mediaUrl: string,
  mediaType: 'photo' | 'video',
  avatarUrl?: string,
): Promise<SupabaseStory> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to publish a story.')

  const { data, error } = await supabase.from('stories').insert({
    user_id: authData.user.id,
    image_url: mediaUrl,
    media_url: mediaUrl,
    media_type: mediaType,
  }).select('id, image_url, media_url, video_url, media_type, created_at').single()
  if (error) throw error

  return {
    id: data.id,
    userId: authData.user.id,
    name,
    image: data.media_url || data.video_url || data.image_url || mediaUrl,
    mediaType,
    avatarUrl,
    color: 'bg-teal-600',
  }
}

export async function fetchProfiles(): Promise<{ directory: PublicProfile[]; profile: PublicProfile | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const { data: directoryData, error: directoryError } = await supabase
    .from('profiles')
    .select('id, full_name, username, bio, avatar_url, referral_code, referred_by')
  if (directoryError) throw directoryError

  const toProfile = (record: { id?: unknown; full_name?: unknown; username?: unknown; bio?: unknown; avatar_url?: unknown; referral_code?: unknown; referred_by?: unknown }): PublicProfile => ({
    id: typeof record.id === 'string' ? record.id : undefined,
    fullName: typeof record.full_name === 'string' ? record.full_name : '',
    username: typeof record.username === 'string' ? record.username : undefined,
    bio: typeof record.bio === 'string' ? record.bio : '',
    avatarUrl: typeof record.avatar_url === 'string' ? record.avatar_url : '',
    referralCode: typeof record.referral_code === 'string' ? record.referral_code : undefined,
    referredBy: typeof record.referred_by === 'string' ? record.referred_by : null,
  })

  const profiles = (directoryData ?? []).map(toProfile)
  if (userError) {
    if (userError.name === 'AuthSessionMissingError') return { directory: profiles, profile: null }
    throw userError
  }
  const user = userData.user
  if (!user) return { directory: profiles, profile: null }

  console.log('Current User:', user.id)

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, username, bio, avatar_url, referral_code, referred_by')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) throw profileError

  const profile = profileData ? toProfile(profileData) : null
  console.log('My Profile:', profileData)

  return {
    directory: profiles,
    profile,
  }
}

export async function searchProfilesByName(query: string): Promise<PublicProfile[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const pattern = `%${trimmed.replace(/[\\%_]/g, '\\$&')}%`
  const profileColumns = 'id, full_name, username, bio, avatar_url'
  const [nameResults, usernameResults] = await Promise.all([
    supabase
      .from('profiles')
      .select(profileColumns)
      .ilike('full_name', pattern)
      .limit(20),
    supabase
      .from('profiles')
      .select(profileColumns)
      .ilike('username', pattern)
      .limit(20),
  ])
  if (nameResults.error) throw nameResults.error
  if (usernameResults.error) throw usernameResults.error

  const profilesById = new Map<string, (typeof nameResults.data)[number]>()
  for (const profile of [...(nameResults.data ?? []), ...(usernameResults.data ?? [])]) {
    profilesById.set(profile.id, profile)
  }

  return [...profilesById.values()]
    .sort((first, second) => (first.full_name ?? '').localeCompare(second.full_name ?? ''))
    .slice(0, 20)
    .map((profile) => ({
    id: typeof profile.id === 'string' ? profile.id : undefined,
    fullName: typeof profile.full_name === 'string' ? profile.full_name : '',
    username: typeof profile.username === 'string' ? profile.username : undefined,
    bio: typeof profile.bio === 'string' ? profile.bio : '',
    avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : '',
  }))
}

export type SocialNotification = {
  id: string
  actorId: string
  actorName: string
  actorAvatar: string
  postId: number | string | null
  type: 'like' | 'comment'
  content: string | null
  isRead: boolean
  createdAt: string
}

export async function fetchNotifications(userId: string): Promise<SocialNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, actor_id, post_id, type, content, is_read, created_at, profiles!notifications_actor_id_fkey(full_name, username, avatar_url)')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error

  return (data ?? []).map((row) => {
    const relatedProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const actor = relatedProfile && typeof relatedProfile === 'object' ? relatedProfile : null
    return {
      id: row.id,
      actorId: row.actor_id,
      actorName: actor?.full_name || actor?.username || 'A user',
      actorAvatar: actor?.avatar_url || '',
      postId: row.post_id,
      type: row.type,
      content: row.content,
      isRead: row.is_read,
      createdAt: row.created_at,
    }
  })
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}

export async function createNotification(notification: {
  recipientId: string
  postId: number | string
  type: 'like' | 'comment'
  content?: string | null
}): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to notify the post owner.')
  if (notification.recipientId === authData.user.id) return

  const { error } = await supabase.from('notifications').insert({
    recipient_id: notification.recipientId,
    actor_id: authData.user.id,
    post_id: notification.postId,
    type: notification.type,
    content: notification.content ?? null,
  })
  if (error) throw error
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

export async function incrementPostShareCount(postId: number | string): Promise<void> {
  const { data, error } = await supabase.rpc('increment_post_share_count', { p_post_id: postId })
  if (error) throw error
  if (data === null) throw new Error('The post share count was not updated.')
}

export async function fetchAccountWallet(userId: string): Promise<AccountWallet> {
  const [ledgerResult, withdrawalsResult, accountResult] = await Promise.all([
    supabase
      .from('reward_ledger')
      .select('amount_delta')
      .eq('user_id', userId),
    supabase
      .from('withdrawals')
      .select('amount')
      .eq('user_id', userId)
      .in('status', ['pending', 'approved', 'paid']),
    supabase
      .from('accounts')
      .select('blue_points')
      .eq('id', userId)
      .maybeSingle(),
  ])
  if (ledgerResult.error) throw ledgerResult.error
  if (withdrawalsResult.error) throw withdrawalsResult.error
  if (accountResult.error) throw accountResult.error

  const earnedBalance = (ledgerResult.data ?? []).reduce((total, entry) => total + Number(entry.amount_delta ?? 0), 0)
  const withdrawnBalance = (withdrawalsResult.data ?? []).reduce((total, withdrawal) => total + Number(withdrawal.amount ?? 0), 0)
  return {
    balance: Math.max(0, earnedBalance - withdrawnBalance),
    bluePoints: Number(accountResult.data?.blue_points ?? 0),
  }
}

export async function fetchProfileById(userId: string): Promise<PublicProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, bio, avatar_url, referral_code, referred_by')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    return {
      id: userId,
      fullName: '',
      bio: '',
      avatarUrl: '',
      referredBy: null,
    }
  }

  return {
    id: data.id,
    fullName: data.full_name ?? '',
    username: data.username ?? undefined,
    bio: data.bio ?? '',
    avatarUrl: data.avatar_url ?? '',
    referralCode: data.referral_code ?? undefined,
    referredBy: data.referred_by ?? null,
  }
}

export async function fetchReferralCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', userId)
  if (error) throw error
  return count ?? 0
}

export async function fetchPayoutHistory(userId: string): Promise<PayoutRequest[]> {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*, profiles(full_name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((request) => {
    const row = request as Record<string, unknown>
    const relatedProfile = row.profiles
    const profileRecord = Array.isArray(relatedProfile) ? relatedProfile[0] : relatedProfile
    return {
      id: typeof row.id === 'string' || typeof row.id === 'number' ? row.id : '',
      name: profileRecord && typeof profileRecord === 'object' && typeof profileRecord.full_name === 'string'
        ? profileRecord.full_name
        : '',
      upiOrAccount: typeof row.upi_id === 'string' ? row.upi_id : '',
      ifsc: typeof row.ifsc === 'string' ? row.ifsc : null,
      amount: Number(row.amount ?? 0),
      status: row.status === 'approved' || row.status === 'paid' || row.status === 'rejected' ? row.status : 'pending',
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    }
  })
}

export async function createWithdrawalRequest(request: {
  amount: number
  upiId: string
  ifsc: string | null
}): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to request a withdrawal.')

  const { error } = await supabase.from('withdrawals').insert({
    user_id: authData.user.id,
    amount: request.amount,
    upi_id: request.upiId,
    ifsc: request.ifsc,
    status: 'pending',
  })
  if (error) throw error
}

export async function createPost(
  content: string,
  imageUrl: string | null,
  mediaType: 'image' | 'video' = 'image',
  videoUrl?: string | null,
): Promise<SocialPost> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to publish a post.')

  const { data, error } = await supabase.from('posts').insert({
    user_id: authData.user.id,
    content,
    image_url: mediaType === 'image' ? imageUrl : null,
    video_url: mediaType === 'video' ? (videoUrl ?? imageUrl ?? null) : null,
    media_type: mediaType,
    likes: 0,
  }).select('*, profiles!posts_user_id_fkey(full_name, avatar_url, username)').single()
  if (error) throw error
  return mapPost(data as Record<string, unknown>)
}

export async function addCommentToPost(postId: number | string, content: string): Promise<PostComment> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to comment.')

  const { data, error } = await supabase.from('comments').insert({
    post_id: postId,
    user_id: authData.user.id,
    content,
  }).select('id, post_id, user_id, content, created_at').single()
  if (error) throw error

  return {
    id: data.id,
    content: data.content,
    userId: data.user_id,
    userName: typeof authData.user.user_metadata?.full_name === 'string'
      ? authData.user.user_metadata.full_name
      : authData.user.email?.split('@')[0] ?? 'You',
    avatarUrl: typeof authData.user.user_metadata?.avatar_url === 'string'
      ? authData.user.user_metadata.avatar_url
      : null,
    createdAt: data.created_at,
  }
}

export async function reportPostForModeration(postId: number | string, reason = 'spam'): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to report a post.')

  const { error } = await supabase.from('reports').insert({
    post_id: postId,
    user_id: authData.user.id,
    reason,
  })
  if (error) throw error
}

export async function incrementPostViews(postId: number | string): Promise<void> {
  const { error } = await supabase.rpc('increment_post_views', { p_post_id: postId })
  if (error) {
    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('views')
      .eq('id', postId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!currentPost) return

    const nextViews = Number(currentPost.views ?? 0) + 1
    const { error: updateError } = await supabase
      .from('posts')
      .update({ views: nextViews })
      .eq('id', postId)

    if (updateError) throw updateError
  }
}

export async function updatePostContent(postId: number | string, content: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to edit your post.')

  const { data, error } = await supabase
    .from('posts')
    .update({ content })
    .eq('id', postId)
    .eq('user_id', authData.user.id)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Post could not be updated. Check that you own this post.')
}

export async function setPostLiked(postId: number | string, isLiked: boolean): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const user = authData.user
  if (!user) throw new Error('Login again')

  if (isLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)
    if (error) throw error
  } else {
    console.log('Inserting like:', { post_id_type: typeof postId, post_id: postId })
    const { error } = await supabase
      .from('likes')
      .insert({
        post_id: postId,
        user_id: user.id,
      })
    if (error) {
      console.error('Like insert failed:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      if (error.code !== '23505') throw error
    }
  }
}

export async function fetchCurrentUserLikes(): Promise<(number | string)[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) {
    if (authError.name === 'AuthSessionMissingError') return []
    throw authError
  }
  if (!authData.user) return []

  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', authData.user.id)
  if (error) throw error

  return (data ?? []).map((like) => like.post_id as number | string)
}

export async function saveProfile(profile: PublicProfile): Promise<void> {
  if (!profile.id) throw new Error('Cannot update the profile because its auth user ID was not loaded.')
  const { error } = await supabase.from('profiles').update({
    full_name: profile.fullName,
    username: profile.username ?? null,
    bio: profile.bio,
    avatar_url: profile.avatarUrl,
  }).eq('id', profile.id)
  if (error) throw error
}
