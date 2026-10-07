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

export type SocialPost = {
  id: number | string
  user_id: string | null
  text: string
  user: string
  time: string
  likes: number
  views: number
  photo?: string
  mediaType?: 'image' | 'video'
  comments?: string[]
  profiles: PostProfile | null
}

export type SupabaseStory = {
  id?: number | string
  name: string
  image: string
  mediaType?: 'image' | 'video'
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
  status: 'pending' | 'paid' | 'rejected'
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
    photo: mediaUrl,
    mediaType,
    comments: Array.isArray(record.comments)
      ? record.comments.filter((comment): comment is string => typeof comment === 'string')
      : [],
    profiles,
  }
}

async function uploadPhoto(file: File, folder: 'posts' | 'stories'): Promise<string> {
  const fileName = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
  const { data, error } = await supabase.storage.from('post-images').upload(fileName, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  return supabase.storage.from('post-images').getPublicUrl(data.path).data.publicUrl
}

export async function uploadPostPhoto(file: File): Promise<string> {
  return uploadPhoto(file, 'posts')
}

export async function uploadStoryPhoto(file: File): Promise<string> {
  return uploadPhoto(file, 'stories')
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
  console.log('Posts:', posts)
  return posts
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
    ? await supabase.from('profiles').select('id, full_name, username').in('id', userIds)
    : { data: [], error: null }
  if (profileError) throw profileError

  const profilesById = new Map((profileData ?? []).map((profile) => [profile.id, profile]))
  return (data ?? []).map((record, index): SupabaseStory => {
    const image = [record.media_url, record.video_url, record.image_url]
      .find((value): value is string => typeof value === 'string' && value.length > 0) ?? ''
    const storyProfile = typeof record.user_id === 'string' ? profilesById.get(record.user_id) : undefined
    return {
      id: record.id,
      name: typeof storyProfile?.full_name === 'string'
        ? storyProfile.full_name
        : typeof storyProfile?.username === 'string'
          ? storyProfile.username
          : typeof record.name === 'string'
            ? record.name
            : 'Unknown User',
      image,
      mediaType: record.media_type === 'video' || /\.(mp4|webm|ogg)(\?|$)/i.test(image) ? 'video' : 'image',
      color: ['bg-amber-500', 'bg-rose-500', 'bg-emerald-600'][index % 3],
    }
  }).filter((story) => story.image)
}

export async function createStory(name: string, imageUrl: string): Promise<SupabaseStory> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to publish a story.')

  const { data, error } = await supabase.from('stories').insert({
    user_id: authData.user.id,
    image_url: imageUrl,
    media_url: imageUrl,
    media_type: 'image',
  }).select('id, image_url, media_url, video_url, media_type, created_at').single()
  if (error) throw error

  return {
    id: data.id,
    name,
    image: data.media_url || data.image_url || imageUrl,
    mediaType: 'image',
    color: 'bg-teal-600',
  }
}

export async function fetchProfiles(): Promise<{ directory: PublicProfile[]; profile: PublicProfile | null }> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const { data: directoryData, error: directoryError } = await supabase
    .from('profiles')
    .select('id, full_name, username, bio, avatar_url, referral_code')
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
    .single()
  if (profileError) throw profileError

  const profile = toProfile(profileData)
  console.log('My Profile:', profileData)

  return {
    directory: profiles,
    profile,
  }
}

export async function fetchAccountWallet(userId: string): Promise<AccountWallet> {
  const readAccount = () => supabase
    .from('accounts')
    .select('balance, blue_points')
    .eq('id', userId)
    .maybeSingle()
  const { data, error } = await readAccount()
  if (!error && data) {
    return {
      balance: Number(data.balance ?? 0),
      bluePoints: Number(data.blue_points ?? 0),
    }
  }

  const { data: upsertedAccount, error: upsertError } = await supabase
    .from('accounts')
    .upsert(
      { id: userId, blue_points: 0, balance: 0 },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    .select('balance, blue_points')
    .maybeSingle()
  if (upsertError) {
    console.error('Account row could not be created or loaded:', { selectError: error, upsertError })
    throw new Error('Account data could not be loaded.')
  }

  if (upsertedAccount) {
    return {
      balance: Number(upsertedAccount.balance ?? 0),
      bluePoints: Number(upsertedAccount.blue_points ?? 0),
    }
  }

  const { data: existingAccount, error: retryError } = await readAccount()
  if (retryError) throw retryError
  if (!existingAccount) throw new Error('Account row was not returned after upsert.')

  return {
    balance: Number(existingAccount.balance ?? 0),
    bluePoints: Number(existingAccount.blue_points ?? 0),
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
    .from('withdrawal_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((request) => {
    const row = request as Record<string, unknown>
    return {
      id: typeof row.id === 'string' || typeof row.id === 'number' ? row.id : '',
      name: typeof row.name === 'string'
        ? row.name
        : typeof row.user_name === 'string'
          ? row.user_name
          : '',
      upiOrAccount: typeof row.upi_or_account === 'string'
        ? row.upi_or_account
        : typeof row.upi_id === 'string'
          ? row.upi_id
          : '',
      ifsc: typeof row.ifsc === 'string' ? row.ifsc : null,
      amount: Number(row.amount ?? 0),
      status: row.status as PayoutRequest['status'],
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    }
  })
}

export async function requestPayout(request: {
  name: string
  amount: number
  upiOrAccount: string
  ifsc: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('request_payout', {
    p_name: request.name,
    p_amount: request.amount,
    p_upi_or_account: request.upiOrAccount,
    p_ifsc: request.ifsc,
  })
  if (error) throw error
}

export async function createPost(content: string, imageUrl: string | null): Promise<SocialPost> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to publish a post.')

  const { data, error } = await supabase.from('posts').insert({
    user_id: authData.user.id,
    content,
    image_url: imageUrl,
    likes: 0,
  }).select('*, profiles!posts_user_id_fkey(full_name, avatar_url, username)').single()
  if (error) throw error
  return mapPost(data as Record<string, unknown>)
}

export async function updatePostContent(postId: number | string, content: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to edit your post.')

  const { error } = await supabase
    .from('posts')
    .update({ content })
    .eq('id', postId)
    .eq('user_id', authData.user.id)
  if (error) throw error
}

export async function setPostLiked(postId: number | string, isLiked: boolean): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in to like posts.')

  if (isLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', authData.user.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('likes').insert({
      user_id: authData.user.id,
      post_id: postId,
    })
    if (error) throw error
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
