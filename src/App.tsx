import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  addCommentToPost,
  createPost,
  createNotification,
  createStory,
  fetchAccountWallet,
  fetchCurrentUserLikes,
  fetchProfileById,
  fetchPostComments,
  fetchPostLikeCount,
  fetchPostEarnings,
  fetchNotifications,
  fetchPayoutHistory,
  fetchPosts,
  fetchProfiles,
  fetchReferralCount,
  fetchStories,
  incrementPostShareCount,
  incrementPostViews,
  markNotificationsRead,
  fetchUnreadNotificationCount,
  saveProfile as saveProfileToSupabase,
  searchProfilesByName,
  setPostLiked,
  supabase,
  supabaseConfigured,
  updatePostContent,
  uploadAvatar,
  uploadPostPhoto,
  uploadStoryMedia,
  type PublicProfile,
  type AccountWallet,
  type PayoutRequest,
  type SocialPost,
  type SocialNotification,
  type SupabaseStory,
} from './lib/supabase'
import { initializeAdMob } from './ads'
import AdBanner from './components/AdBanner'
import AdEarn from './components/AdEarn'
import AdminPayouts from './components/AdminPayouts'
import AdminWithdrawals from './components/AdminWithdrawals'
import FeedAd from './components/FeedAd'
import WithdrawModal from './components/WithdrawModal'
import Onboarding from './components/Onboarding'
import SettingsPage from './components/SettingsPage'
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Camera,
  Copy,
  Compass,
  CreditCard,
  Heart,
  Home,
  ImagePlus,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  Send,
  Share2,
  Smile,
  Sparkles,
  ThumbsUp,
  Trash2,
  Users,
  X,
  Wallet,
} from 'lucide-react'

type Post = SocialPost

type Page = 'feed' | 'profile' | 'user-profile' | 'friends' | 'explore' | 'saved' | 'search' | 'settings'

type Story = SupabaseStory

type Profile = PublicProfile

const SAVED_POSTS_STORAGE_KEY = 'nagesh-saved-posts'
const SITE_OWNER_NAME = 'Chhavinath Nagesh'

function readSavedPostIds(): (number | string)[] {
  try {
    const saved = window.localStorage.getItem(SAVED_POSTS_STORAGE_KEY)
    const parsed: unknown = saved ? JSON.parse(saved) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is number | string => typeof id === 'number' || typeof id === 'string') : []
  } catch {
    return []
  }
}

async function compressPhoto(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 800 / bitmap.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return null
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.6))
    if (!blob) return null

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return null
  }
}

function getInitials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

function Avatar({ name, image, size = 'md' }: { name: string; image?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [imageFailed, setImageFailed] = useState(false)
  const colors: Record<string, string> = {
    'Aarav Sharma': 'bg-orange-600',
    'Priya Patel': 'bg-rose-600',
    'Rohan Verma': 'bg-emerald-700',
  }
  const dimensions = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-14 w-14 text-base' }

  useEffect(() => {
    setImageFailed(false)
  }, [image])

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white ${colors[name] ?? 'bg-slate-600'} ${dimensions[size]}`} aria-label={`${name} avatar`}>
      {image ? <img src={imageFailed ? '/default-avatar.png' : image} alt="" onError={(event) => {
        if (imageFailed) event.currentTarget.hidden = true
        else setImageFailed(true)
      }} className="h-full w-full rounded-full object-cover" /> : getInitials(name)}
    </div>
  )
}

function PostCard({
  post,
  isLiked,
  isLikePending,
  isSaved,
  onView,
  onDelete,
  onEdit,
  onCopyLink,
  onLike,
  onSave,
  onComment,
  onShare,
  onOpenProfile,
  isSiteOwner,
  currentUserId,
}: {
  post: Post
  currentUserId: string
  isLiked: boolean
  isLikePending: boolean
  isSaved: boolean
  onView: (postId: number | string) => void
  onDelete: (postId: number | string, isAdmin?: boolean) => void
  onEdit: (post: Post) => void
  onCopyLink: (post: Post) => void
  onLike: (postId: number | string) => void
  onSave: (postId: number | string) => void
  onComment: (postId: number | string, comment: string) => void
  onShare: (post: Post) => void
  onOpenProfile: (userId: string) => void
  isSiteOwner: boolean
}) {
  const articleRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [optionsOpen, setOptionsOpen] = useState(false)

  useEffect(() => {
    const article = articleRef.current
    if (!article || typeof IntersectionObserver === 'undefined') return

    let timer = 0
    let counted = false
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        window.clearTimeout(timer)
        timer = 0
        return
      }
      if (counted || timer) return

      timer = window.setTimeout(() => {
        counted = true
        onView(post.id)
      }, 3000)
    }, { threshold: 0.35 })

    observer.observe(article)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [onView, post.id])

  useEffect(() => {
    if (!optionsOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOptionsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOptionsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [optionsOpen])

  const displayViews = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(post.views)
  const postEarnings = post.earnedAmount
  const authorName = post.profiles?.full_name || post.profiles?.username || 'Unknown User'
  const authorAvatar = post.profiles?.avatar_url || undefined
  const isOwnPost = post.user_id === currentUserId || post.profiles?.id === currentUserId
  const isOwnerPost = post.profiles?.full_name === SITE_OWNER_NAME
  const canDeletePost = isOwnPost || isSiteOwner
  const authorId = post.user_id ?? post.profiles?.id
  useEffect(() => {
    console.log('Post owner IDs:', { postUserId: post.user_id, profileUserId: post.profiles?.id, currentUserId })
  }, [post.user_id, post.profiles?.id, currentUserId])
  const chooseOption = (action: () => void) => {
    setOptionsOpen(false)
    action()
  }

  return (
    <article id={`post-${post.id}`} ref={articleRef} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_3px_16px_rgba(31,41,55,0.035)]">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => authorId && onOpenProfile(authorId)} disabled={!authorId} className="flex min-w-0 items-center gap-3 text-left disabled:cursor-default">
            <Avatar name={authorName} image={authorAvatar} />
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-bold text-slate-900">{authorName}</span>
                {isOwnerPost && <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800" aria-label="Owner">👑 Owner</span>}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">{post.time} <span className="px-1">·</span> Everyone</span>
            </span>
          </button>
        </div>
        <div ref={menuRef} className="relative flex items-center gap-1">
          <button type="button" onClick={() => setOptionsOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100" aria-label="More post options" aria-expanded={optionsOpen} aria-haspopup="menu"><MoreHorizontal size={20} /></button>
          {optionsOpen && (
            <div role="menu" aria-label="Post options" className="absolute right-0 top-10 z-20 min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              <button type="button" role="menuitem" onClick={() => chooseOption(() => onCopyLink(post))} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><Copy size={16} /> Copy Link</button>
              <button type="button" role="menuitem" disabled={!isOwnPost} onClick={() => chooseOption(() => onEdit(post))} className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 ${isOwnPost ? '' : 'disabled:cursor-not-allowed disabled:opacity-45'}`}><Pencil size={16} /> Edit Post</button>
              <button type="button" role="menuitem" disabled={!canDeletePost} onClick={() => chooseOption(() => onDelete(post.id, isSiteOwner))} className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 ${canDeletePost ? '' : 'disabled:cursor-not-allowed disabled:opacity-45'}`}><Trash2 size={16} /> {isSiteOwner ? 'Delete (Admin)' : 'Delete'}</button>
            </div>
          )}
        </div>
      </div>

      <p className="whitespace-pre-wrap px-5 pb-4 pt-4 text-[15px] leading-7 text-slate-700">{post.text}</p>
      {post.photo && (post.mediaType === 'video'
        ? <video src={post.photo} controls playsInline preload="metadata" className="max-h-[560px] w-full bg-slate-100" />
        : <img src={post.photo} alt={`Photo shared by ${authorName}`} loading="lazy" className="max-h-[560px] w-full bg-slate-100 object-contain" />)}
      <div className="mx-5 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-[#f4f8f7] px-3 py-2 text-[11px] font-semibold text-slate-600 sm:text-xs">
        <span>👁️ {displayViews} Views</span><span className="text-slate-300">|</span>
        <span>💙 {post.views.toLocaleString()} Blue</span>
        {post.user_id === currentUserId && <><span className="text-slate-300">|</span><span className="text-teal-800">₹{postEarnings.toFixed(2)} Earned</span></>}
      </div>

      <div className="mx-5 flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white"><ThumbsUp size={11} fill="currentColor" /></span>{post.likes} likes</span>
        <span>{post.comments?.length ? `${post.comments.length} comments` : 'No comments yet'}</span>
      </div>
      <div className="grid grid-cols-4 gap-1 px-3 py-2">
        <button type="button" onClick={() => onLike(post.id)} disabled={isLikePending} aria-pressed={isLiked} className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 ${isLiked ? 'text-sky-600' : 'text-slate-600'}`}><ThumbsUp size={17} fill={isLiked ? 'currentColor' : 'none'} /> Like</button>
        <button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()} className="flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><MessageCircle size={17} /> Comment</button>
        <button type="button" onClick={() => onShare(post)} className="flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><Share2 size={17} /> Share</button>
        <button type="button" onClick={() => onSave(post.id)} aria-label={isSaved ? 'Remove saved post' : 'Save post'} title={isSaved ? 'Remove saved post' : 'Save post'} className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition hover:bg-slate-50 ${isSaved ? 'text-teal-700' : 'text-slate-600'}`}><Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} /><span className="hidden sm:inline">Save</span></button>
      </div>
      <div className="border-t border-slate-100 px-4 py-3">
        {(post.comments ?? []).map((comment) => <p key={comment.id} className="mb-2 text-sm text-slate-700"><span className="font-semibold text-slate-900">{comment.userName}</span> {comment.content}</p>)}
        <form onSubmit={(event) => {
          event.preventDefault()
          const comment = commentDraft.trim()
          if (!comment) return
          onComment(post.id, comment)
          setCommentDraft('')
        }} className="flex gap-2">
          <input id={`comment-${post.id}`} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Write a comment..." maxLength={300} aria-label="Write a comment" className="h-9 min-w-0 flex-1 rounded-lg bg-slate-100 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600/20" />
          <button type="submit" disabled={!commentDraft.trim()} className="h-9 rounded-lg px-3 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-40">Send</button>
        </form>
      </div>
    </article>
  )
}

function ProfilePage({
  userId,
  currentUserId,
  onBack,
}: {
  userId: string
  currentUserId: string
  onBack: () => void
}) {
  const [profileData, setProfileData] = useState<Profile | null>(null)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followPending, setFollowPending] = useState(false)
  const isOwner = profileData?.fullName === SITE_OWNER_NAME

  const refreshFollowData = useCallback(async () => {
    const [followers, following, relationship] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      currentUserId && currentUserId !== userId
        ? supabase.from('follows').select('*').eq('follower_id', currentUserId).eq('following_id', userId).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])
    if (followers.error) throw followers.error
    if (following.error) throw following.error
    if (relationship.error) throw relationship.error
    setFollowersCount(followers.count ?? 0)
    setFollowingCount(following.count ?? 0)
    setIsFollowing(Boolean(relationship.data))
  }, [currentUserId, userId])

  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      try {
        const fetchedProfile = await fetchProfileById(userId)
        if (active) setProfileData(fetchedProfile)
        await refreshFollowData()
      } catch (error) {
        console.error('Profile could not be loaded:', error)
      } finally {
        if (active) setLoading(false)
      }
    }
    setLoading(true)
    void loadProfile()
    const channel = supabase.channel(`profile-follows-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        void refreshFollowData().catch((error: unknown) => console.error('Profile follow counts could not be refreshed:', error))
      })
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [refreshFollowData, userId])

  const toggleFollow = async () => {
    if (!currentUserId || currentUserId === userId || followPending) return
    setFollowPending(true)
    try {
      if (isFollowing) {
        const { error } = await supabase.from('follows').delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: userId,
        })
        if (error) throw error
      }
      await refreshFollowData()
    } catch (error) {
      console.error('Follow status could not be updated:', error)
    } finally {
      setFollowPending(false)
    }
  }

  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading profile…</section>
  if (!profileData) return <section className="rounded-2xl border border-slate-200 bg-white p-6"><button type="button" onClick={onBack} className="text-sm font-semibold text-teal-800">← Back</button><p className="mt-4 text-sm text-slate-600">Profile could not be loaded.</p></section>

  return (
    <section aria-label={`${profileData.fullName} profile`} className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-teal-800 hover:underline">← Back</button>
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <Avatar name={profileData.fullName} image={profileData.avatarUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900">
            <span className="truncate">{profileData.fullName}</span>
            {isOwner && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">👑 Owner</span>}
          </h1>
          {profileData.username && <p className="text-sm text-slate-500">@{profileData.username}</p>}
          <p className="mt-1 text-sm text-slate-600">{profileData.bio || 'Nagesh Social member'}</p>
        </div>
        {currentUserId !== userId && <button type="button" onClick={() => void toggleFollow()} disabled={!currentUserId || followPending} className={`ml-auto shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${isFollowing ? 'border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-teal-700 text-white hover:bg-teal-800'}`}>{followPending ? 'Saving…' : isFollowing ? 'Following' : 'Follow'}</button>}
      </div>
      <div className="flex gap-6 px-1 text-sm text-slate-600" aria-live="polite">
        <span>Followers: <strong className="text-slate-900">{followersCount.toLocaleString()}</strong></span>
        <span>Following: <strong className="text-slate-900">{followingCount.toLocaleString()}</strong></span>
      </div>
    </section>
  )
}

function SocialApp() {
  const [posts, setPosts] = useState<Post[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [profile, setProfile] = useState<Profile>({ fullName: '', username: '', bio: '', avatarUrl: '' })
  const [directoryProfiles, setDirectoryProfiles] = useState<Profile[]>([])
  const [savedPostIds, setSavedPostIds] = useState<(number | string)[]>(readSavedPostIds)
  const [accountWallet, setAccountWallet] = useState<AccountWallet>({ balance: 0, bluePoints: 0 })
  const [payoutHistory, setPayoutHistory] = useState<PayoutRequest[]>([])
  const [referralCount, setReferralCount] = useState<number | null>(null)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [text, setText] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [likedPosts, setLikedPosts] = useState<(number | string)[]>([])
  const [pendingLikePosts, setPendingLikePosts] = useState<(number | string)[]>([])
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [myStory, setMyStory] = useState<Story | null>(null)
  const [uploadingStory, setUploadingStory] = useState(false)
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [profileNameDraft, setProfileNameDraft] = useState('')
  const [profileBioDraft, setProfileBioDraft] = useState('')
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [postContentDraft, setPostContentDraft] = useState('')
  const [savingPost, setSavingPost] = useState(false)
  const [page, setPage] = useState<Page>(() => window.location.pathname === '/settings' ? 'settings' : 'feed')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [notifications, setNotifications] = useState<SocialNotification[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signUpName, setSignUpName] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [signingIn, setSigningIn] = useState(false)
  const [accountEmail, setAccountEmail] = useState('')
  const [authUserId, setAuthUserId] = useState('')
  const currentUser = profile.fullName
  const currentUserId = authUserId
  const isSiteOwner = profile.fullName === SITE_OWNER_NAME
  const ownProfileId = page === 'profile' ? currentUserId : ''
  const isPostDetailRoute = /^\/post\/[^/]+\/?$/.test(window.location.pathname)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const refreshFollowData = useCallback(async () => {
    if (!ownProfileId) {
      setFollowersCount(0)
      setFollowingCount(0)
      return
    }

    const [followersResult, followingResult, relationshipResult] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', ownProfileId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', ownProfileId),
    ])
    if (followersResult.error) throw followersResult.error
    if (followingResult.error) throw followingResult.error

    setFollowersCount(followersResult.count ?? 0)
    setFollowingCount(followingResult.count ?? 0)
  }, [ownProfileId])

  useEffect(() => {
    if (!ownProfileId) return
    let active = true
    void refreshFollowData()
      .catch((error: unknown) => {
        if (active) console.error('Own profile follow counts could not be loaded:', error)
      })
    const channel = supabase.channel(`own-profile-follows-${ownProfileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        void refreshFollowData().catch((error: unknown) => console.error('Own profile follow counts could not be refreshed:', error))
      })
      .subscribe()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [ownProfileId, refreshFollowData])

  useEffect(() => {
    void initializeAdMob()
  }, [])

  useEffect(() => {
    const syncSettingsRoute = () => {
      setPage(window.location.pathname === '/settings' ? 'settings' : 'feed')
    }
    window.addEventListener('popstate', syncSettingsRoute)
    return () => window.removeEventListener('popstate', syncSettingsRoute)
  }, [])

  useEffect(() => {
    if (page === 'settings' && window.location.pathname !== '/settings') {
      window.history.pushState({}, '', '/settings')
    } else if (page !== 'settings' && window.location.pathname === '/settings') {
      window.history.pushState({}, '', '/')
    }
  }, [page])

  useEffect(() => {
    let active = true
    const loadAuthUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      if (active) {
        setAuthUserId(data.user?.id ?? '')
        setAccountEmail(data.user?.email ?? '')
      }
    }
    void loadAuthUser().catch((error: unknown) => console.error('Authenticated user could not be loaded:', error))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user.id ?? '')
      setAccountEmail(session?.user.email ?? '')
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const postMediaInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const postOwnersRef = useRef(new Map(posts.map((post) => [post.id, post.user])))
  const postOwnerIdsRef = useRef(new Map(posts.map((post) => [post.id, post.user_id])))
  const pendingLikePostIdsRef = useRef(new Set<number | string>())
  const userTotalViews = posts
    .filter((post) => post.user_id === currentUserId)
    .reduce((total, post) => total + post.views, 0)

  const openProfile = (userId: string) => {
    setSelectedUserId(userId)
    setPage('user-profile')
  }

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSigningIn(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      })
      if (error) throw error

      const { profile: signedInProfile, directory } = await fetchProfiles()
      setProfile(signedInProfile ?? { fullName: '', username: '', bio: '', avatarUrl: '' })
      setDirectoryProfiles(directory)
      setStories(await fetchStories())
      setLoginPassword('')
      setNotice('')
    } catch (error) {
      console.error('Sign-in failed:', error)
      setNotice(error instanceof Error ? error.message : 'Sign-in failed.')
    } finally {
      setSigningIn(false)
    }
  }

  const signInWithGoogle = async () => {
    setSigningIn(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      })
      if (error) throw error
    } catch (error) {
      console.error('Google Login Error:', error instanceof Error ? error.message : error)
      setNotice(error instanceof Error ? error.message : 'Google sign-in could not be started.')
      setSigningIn(false)
    }
  }

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSigningIn(true)
    try {
      const referralCode = new URLSearchParams(window.location.search).get('ref')?.trim()
      const { data, error } = await supabase.auth.signUp({
        email: loginEmail.trim(),
        password: loginPassword,
        options: {
          data: {
            full_name: signUpName.trim(),
            ...(referralCode ? { referral_code: referralCode } : {}),
          },
        },
      })
      if (error) throw error

      setLoginPassword('')
      if (data.session) {
        const { profile: signedUpProfile, directory } = await fetchProfiles()
        if (signedUpProfile) {
          setProfile(signedUpProfile)
          setDirectoryProfiles(directory)
        }
        setNotice(signedUpProfile?.referredBy ? 'You both received 100 Points' : 'Account created successfully.')
      } else {
        setNotice('Account created. Check your email to confirm your account.')
      }
    } catch (error) {
      console.error('Account creation failed:', error)
      setNotice(error instanceof Error ? error.message : 'Account creation failed.')
    } finally {
      setSigningIn(false)
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign-out failed:', error)
      setNotice('Sign-out failed. Please try again.')
      return
    }
    setProfile({ fullName: '', username: '', bio: '', avatarUrl: '' })
    setPosts([])
    setLikedPosts([])
    setAccountWallet({ balance: 0, bluePoints: 0 })
    setPayoutHistory([])
    setReferralCount(null)
  }

  const refreshAccountData = useCallback(async () => {
    if (!currentUserId) return
    const [wallet, history, referrals] = await Promise.all([
      fetchAccountWallet(currentUserId),
      fetchPayoutHistory(currentUserId),
      fetchReferralCount(currentUserId),
    ])
    setAccountWallet(wallet)
    setPayoutHistory(history)
    setReferralCount(referrals)
  }, [currentUserId])

  const refreshPostEarnings = useCallback(async (postId: number | string, postOwnerId: string | null) => {
    if (!currentUserId || postOwnerId !== currentUserId) return
    try {
      const earningsByPost = await fetchPostEarnings([postId])
      const earnedAmount = earningsByPost.get(String(postId)) ?? 0
      setPosts((currentPosts) => currentPosts.map((post) => post.id === postId ? { ...post, earnedAmount } : post))
      await refreshAccountData()
    } catch (error) {
      console.error('Post earnings could not be refreshed:', error)
    }
  }, [currentUserId, refreshAccountData])

  useEffect(() => {
    let active = true
    const loadSignedInProfile = async () => {
      try {
        const { profile: loadedProfile, directory } = await fetchProfiles()
        if (!active) return
        setDirectoryProfiles(directory)
        setProfile(loadedProfile ?? { fullName: '', username: '', bio: '', avatarUrl: '' })
      } catch (error) {
        console.error('Signed-in profile could not be loaded:', error)
      }
    }

    void loadSignedInProfile()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void loadSignedInProfile(), 0)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) {
      setAccountWallet({ balance: 0, bluePoints: 0 })
      setPayoutHistory([])
      setReferralCount(null)
      return
    }
    let active = true
    setAccountWallet({ balance: 0, bluePoints: 0 })
    const loadAccountData = async () => {
      try {
        await refreshAccountData()
      } catch (error) {
        console.warn('Account data could not be loaded; showing a fallback balance of ₹0.00:', error)
        if (active) setAccountWallet({ balance: 0, bluePoints: 0 })
      }
    }
    void loadAccountData()
    return () => {
      active = false
    }
  }, [currentUserId, refreshAccountData])

  useEffect(() => {
    if (!currentUserId) return
    const refresh = () => {
      void refreshAccountData().catch((error: unknown) => console.error('Wallet could not be refreshed:', error))
    }
    const channel = supabase.channel(`wallet-ledger-${currentUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reward_ledger',
        filter: `user_id=eq.${currentUserId}`,
      }, () => {
        void Promise.all([
          refreshAccountData(),
          fetchPostEarnings([...postOwnerIdsRef.current.keys()]),
        ]).then(([_, earningsByPost]) => {
          setPosts((currentPosts) => currentPosts.map((post) => ({
            ...post,
            earnedAmount: earningsByPost.get(String(post.id)) ?? 0,
          })))
        }).catch((error: unknown) => console.error('Wallet earnings could not be refreshed:', error))
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'withdrawals',
        filter: `user_id=eq.${currentUserId}`,
      }, refresh)
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentUserId, refreshAccountData])

  useEffect(() => {
    postOwnersRef.current = new Map(posts.map((post) => [post.id, post.user]))
    postOwnerIdsRef.current = new Map(posts.map((post) => [post.id, post.user_id]))
  }, [posts])

  useEffect(() => {
    let active = true
    const loadLikes = async () => {
      try {
        const likedIds = await fetchCurrentUserLikes()
        if (active) setLikedPosts(likedIds)
      } catch (error) {
        console.error('Current user likes could not be loaded:', error)
      }
    }

    void loadLikes()
    return () => {
      active = false
    }
  }, [currentUserId])

  useEffect(() => {
    if (!supabaseConfigured) return
    let active = true
    const loadPosts = async () => {
      if (!supabaseConfigured) {
        setNotice('Add VITE_SUPABASE_ANON_KEY to .env to enable Supabase.')
        return
      }

      try {
        const loadedPosts = await fetchPosts()
        if (!active) return
        setPosts(loadedPosts)
      } catch (error) {
        console.error('Posts could not be loaded from Supabase:', error)
        if (active) {
          setPosts([])
          setNotice('The feed is temporarily unavailable. Check the browser console for details.')
        }
        return
      }
    }

    void loadPosts()
    return () => {
      active = false
    }
  }, [currentUserId])

  useEffect(() => {
    if (!supabaseConfigured) return
    let active = true

    const loadPublicData = async () => {
      try {
        const loadedStories = await fetchStories()
        if (!active) return
        setStories(loadedStories)
      } catch (error) {
        console.error('Stories could not be loaded from Supabase:', error)
      }
    }

    void loadPublicData()
    return () => {
      active = false
    }
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId || !supabaseConfigured) {
      setNotifications([])
      setUnreadNotificationCount(0)
      return
    }

    let active = true
    const loadNotifications = async () => {
      setNotificationsLoading(true)
      try {
        const [loadedNotifications, unreadCount] = await Promise.all([
          fetchNotifications(currentUserId),
          fetchUnreadNotificationCount(currentUserId),
        ])
        if (active) setNotifications(loadedNotifications)
        if (active) setUnreadNotificationCount(unreadCount)
      } catch {
        console.log("notif error ignored")
        if (active) {
          setNotifications([])
          setUnreadNotificationCount(0)
        }
      } finally {
        if (active) setNotificationsLoading(false)
      }
    }

    void loadNotifications()
    return () => {
      active = false
    }
  }, [currentUserId])

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearchError('')
      setSearchLoading(false)
      return
    }

    let active = true
    const runSearch = async () => {
      setSearchLoading(true)
      setSearchError('')
      try {
        const results = await searchProfilesByName(searchQuery)
        if (active) setSearchResults(results)
      } catch (error) {
        console.error('Profile search failed:', error)
        if (active) {
          setSearchResults([])
          setSearchError(error instanceof Error ? error.message : 'Profile search failed.')
        }
      } finally {
        if (active) setSearchLoading(false)
      }
    }

    const timeout = window.setTimeout(() => {
      void runSearch()
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [searchQuery])

  useEffect(() => {
    window.localStorage.setItem(SAVED_POSTS_STORAGE_KEY, JSON.stringify(savedPostIds))
  }, [savedPostIds])

  useEffect(() => {
    if (!currentUserId) return
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void refreshAccountData().catch((error: unknown) => {
          console.error('Account rewards could not be refreshed:', error)
        })
      }
    }
    const interval = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [currentUserId, refreshAccountData])

  const handleView = useCallback(async (postId: number | string) => {
    setPosts((currentPosts) => currentPosts.map((post) => post.id === postId ? { ...post, views: post.views + 1 } : post))
    try {
      await incrementPostViews(postId)
      await refreshPostEarnings(postId, postOwnerIdsRef.current.get(postId) ?? null)
    } catch (error) {
      console.error('Post view could not be recorded:', error)
    }
  }, [refreshPostEarnings])

  const addPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedText = text.trim()
    if (!trimmedText && !selectedPhoto) return

    const sourcePhoto = selectedPhoto
    setText('')
    setSelectedPhoto(null)
    setPhotoPreview('')
    setUploadingPhoto(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error('Sign in to publish a post.')

      if (sourcePhoto && !supabaseConfigured) {
        throw new Error('Supabase is not configured; media posts cannot be saved remotely.')
      }

      let imageUrl: string | null = null
      let videoUrl: string | null = null
      if (sourcePhoto) {
        const isVideo = sourcePhoto.type.startsWith('video/')
        const mediaFile = isVideo ? sourcePhoto : await compressPhoto(sourcePhoto)
        if (!mediaFile) throw new Error('Could not process the selected media.')
        if (isVideo) {
          videoUrl = await uploadPostPhoto(mediaFile)
        } else {
          imageUrl = await uploadPostPhoto(mediaFile)
        }
      }

      if (!supabaseConfigured) {
        throw new Error('Supabase is not configured; posts cannot be published.')
      }
      await createPost(trimmedText, imageUrl, sourcePhoto?.type.startsWith('video/') ? 'video' : 'image', videoUrl)
      const refreshedPosts = await fetchPosts()
      setPosts(refreshedPosts)
      setNotice('Your post is live.')
    } catch (error) {
      console.error('Post could not be saved:', error)
      setNotice(error instanceof Error ? error.message : 'Post could not be saved to Supabase.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const deletePost = async (id: number | string, isAdmin = false) => {
    if (!window.confirm(isAdmin ? 'As the owner, are you sure you want to delete this post?' : 'Are you sure you want to delete this post?')) return
    try {
      let deletedPostId: number | string | null = null
      if (isAdmin && isSiteOwner) {
        const { data, error } = await supabase
          .from('posts')
          .delete()
          .eq('id', id)
          .select('id')
          .maybeSingle()
        if (error) throw error
        deletedPostId = data?.id ?? null
      } else {
        const { data, error } = await supabase
          .from('posts')
          .delete()
          .eq('id', id)
          .eq('user_id', currentUserId)
          .select('id')
          .maybeSingle()
        if (error) throw error
        deletedPostId = data?.id ?? null
      }
      if (deletedPostId === null) throw new Error('Post could not be deleted. Check your permissions.')
      const remainingPosts = posts.filter((post) => post.id !== id)
      postOwnersRef.current.delete(id)
      setPosts(remainingPosts)
      setNotice('Post deleted.')
    } catch (error) {
      console.error('Post could not be deleted:', error)
      setNotice(error instanceof Error ? error.message : 'Post could not be deleted.')
    }
  }

  const openPostEditor = (post: Post) => {
    setEditingPost(post)
    setPostContentDraft(post.text)
  }

  const savePostEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingPost) return

    const updatedText = postContentDraft.trim()
    if (!updatedText && !editingPost.photo) {
      setNotice('A post must include text or media.')
      return
    }

    setSavingPost(true)
    try {
      await updatePostContent(editingPost.id, updatedText)
      setPosts((currentPosts) => currentPosts.map((currentPost) => currentPost.id === editingPost.id
        ? { ...currentPost, text: updatedText }
        : currentPost))
      setEditingPost(null)
      setNotice('Post updated')
    } catch (error) {
      console.error('Post could not be updated:', error)
      setNotice(error instanceof Error ? error.message : 'Post could not be updated.')
    } finally {
      setSavingPost(false)
    }
  }

  const copyPostLink = async (post: Post) => {
    try {
      const postUrl = `${window.location.origin}/post/${post.id}`
      await navigator.clipboard.writeText(postUrl.toString())
      setNotice('Link copied')
    } catch (error) {
      console.error('Post link could not be copied:', error)
      setNotice('Could not copy the post link in this browser.')
    }
  }

  const copyReferralLink = async () => {
    if (!profile.referralCode) {
      setNotice('Your referral link is not ready yet.')
      return
    }
    try {
      await navigator.clipboard.writeText(`https://nagesh.social?ref=${encodeURIComponent(profile.referralCode)}`)
      setNotice('Referral link copied!')
    } catch (error) {
      console.error('Referral link could not be copied:', error)
      setNotice('Could not copy your referral link in this browser.')
    }
  }

  const toggleLike = async (id: number | string) => {
    if (!supabaseConfigured) {
      setNotice('Add VITE_SUPABASE_ANON_KEY to .env to save likes.')
      return
    }

    const alreadyLiked = likedPosts.includes(id)
    const post = posts.find((candidate) => candidate.id === id)
    if (!post || pendingLikePostIdsRef.current.has(id)) return

    pendingLikePostIdsRef.current.add(id)
    setPendingLikePosts((pending) => [...pending, id])

    try {
      await setPostLiked(id, alreadyLiked)
      setLikedPosts((currentLikes) => alreadyLiked
        ? currentLikes.filter((likedId) => likedId !== id)
        : [...currentLikes, id])
      const likes = await fetchPostLikeCount(id)
      setPosts((currentPosts) => currentPosts.map((currentPost) => currentPost.id === id
        ? { ...currentPost, likes }
        : currentPost))
      await refreshPostEarnings(id, post.user_id)
      if (!alreadyLiked && post.user_id) {
        try {
          await createNotification({ recipientId: post.user_id, postId: id, type: 'like' })
        } catch (notificationError) {
          console.log('Like notification unavailable:', notificationError)
          setNotice('Your like was saved, but the post owner was not notified.')
        }
      }
    } catch (error) {
      console.error('Your like could not be saved to the likes table:', error)
      setNotice(error instanceof Error
        ? error.message
        : 'Your like could not be saved or refreshed.')
    } finally {
      pendingLikePostIdsRef.current.delete(id)
      setPendingLikePosts((pending) => pending.filter((pendingId) => pendingId !== id))
    }
  }

  const addComment = async (postId: number | string, comment: string) => {
    try {
      await addCommentToPost(postId, comment)
      const comments = await fetchPostComments(postId)
      setPosts((currentPosts) => currentPosts.map((post) => post.id === postId
        ? { ...post, comments }
        : post))
      const post = posts.find((currentPost) => currentPost.id === postId)
      await refreshPostEarnings(postId, post?.user_id ?? null)
      let notificationFailed = false
      if (post?.user_id) {
        try {
          await createNotification({
            recipientId: post.user_id,
            postId,
            type: 'comment',
            content: comment,
          })
        } catch (notificationError) {
          console.log('Comment notification unavailable:', notificationError)
          notificationFailed = true
        }
      }
      if (notificationFailed) console.error('Comment was posted, but its owner was not notified.')
    } catch (error) {
      console.error('Comment could not be saved or refreshed:', error)
      setNotice(error instanceof Error ? error.message : 'Comment could not be saved.')
    }
  }

  const saveSettingsName = async (name: string) => {
    const updatedProfile = { ...profile, fullName: name.trim() }
    await saveProfileToSupabase(updatedProfile)
    setProfile(updatedProfile)
  }

  const changeAccountPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  const toggleSavedPost = (postId: number | string) => {
    setSavedPostIds((currentIds) => currentIds.includes(postId)
      ? currentIds.filter((savedId) => savedId !== postId)
      : [...currentIds, postId])
  }

  const handlePostPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isImage && !isVideo) {
      setNotice('Choose an image or video file.')
      return
    }
    if (file.size > (isVideo ? 25 : 2) * 1024 * 1024) {
      setNotice(isVideo ? 'Choose a video under 25 MB.' : 'Choose an image under 2 MB.')
      return
    }
    setSelectedPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleStoryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    const isPhoto = file.type.startsWith('image/')
    if (!isPhoto && !isVideo) {
      setNotice('Choose an image or video file for your story.')
      return
    }
    if (file.size > (isVideo ? 25 : 2) * 1024 * 1024) {
      setNotice(isVideo ? 'Choose a video under 25 MB.' : 'Choose an image under 2 MB.')
      return
    }
    if (!supabaseConfigured) {
      setNotice('Supabase is not configured; stories cannot be uploaded.')
      return
    }

    setUploadingStory(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error('Sign in to publish a story.')
      const mediaFile = isPhoto ? await compressPhoto(file) : file
      if (!mediaFile) throw new Error('Could not process the selected story photo.')
      const mediaUrl = await uploadStoryMedia(mediaFile, authData.user.id)
      const mediaType = isVideo ? 'video' : 'photo'
      const story = await createStory(profile.fullName, mediaUrl, mediaType, profile.avatarUrl)
      setMyStory(story)
      setStories((currentStories) => [story, ...currentStories])
      setNotice('Your story is live.')
    } catch (error) {
      console.error('Story could not be uploaded:', error)
      setNotice(error instanceof Error ? error.message : 'Story could not be uploaded.')
    } finally {
      setUploadingStory(false)
    }
  }

  const openProfileEditor = () => {
    setProfileNameDraft(profile.fullName)
    setProfileBioDraft(profile.bio)
    setProfilePhotoFile(null)
    setProfilePhotoPreview(profile.avatarUrl)
    setProfileEditorOpen(true)
  }

  const handleProfilePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice('Choose an image file for your profile photo.')
      return
    }
    setProfilePhotoFile(file)
    setProfilePhotoPreview(URL.createObjectURL(file))
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingProfile(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Please logout and login again')
      }

      const name = profileNameDraft.trim()
      if (!name) {
        setNotice('Name cannot be empty.')
        return
      }

      if (!supabaseConfigured) throw new Error('Supabase is not configured.')

      let avatarUrl = profile.avatarUrl
      if (profilePhotoFile) {
        const compressedFile = await compressPhoto(profilePhotoFile)
        if (!compressedFile) throw new Error('Could not process the profile photo.')
        avatarUrl = await uploadAvatar(compressedFile)
      }
      const updatedProfile = { ...profile, fullName: name, bio: profileBioDraft.trim(), avatarUrl }
      await saveProfileToSupabase(updatedProfile)

      setProfile(updatedProfile)
      setDirectoryProfiles((currentProfiles) => currentProfiles.map((currentProfile) =>
        currentProfile.id === updatedProfile.id ? updatedProfile : currentProfile))
      setProfileEditorOpen(false)
      setNotice('Profile updated.')
    } catch (error) {
      console.error('Profile could not be saved:', error)
      setNotice(error instanceof Error ? error.message : 'Profile could not be saved to Supabase.')
    } finally {
      setSavingProfile(false)
    }
  }

  const sharePost = async (post: Post) => {
    const shareUrl = new URL(`/post/${encodeURIComponent(post.id)}`, window.location.origin).toString()
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${post.user} on Nagesh Social`,
          text: post.text,
          url: shareUrl,
        })
        setNotice('Post shared.')
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setNotice('Post link copied to clipboard.')
      }
      try {
        await incrementPostShareCount(post.id)
        setPosts((currentPosts) => currentPosts.map((currentPost) => currentPost.id === post.id
          ? { ...currentPost, shareCount: currentPost.shareCount + 1 }
          : currentPost))
        await refreshPostEarnings(post.id, post.user_id)
      } catch (countError) {
        console.error('Post share count could not be updated:', countError)
        setNotice('Post shared, but its share count could not be updated.')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setNotice('Share cancelled.')
      } else {
        console.error('Post sharing failed:', error)
        setNotice('Sharing is not available in this browser.')
      }
    }
  }

  const toggleNotifications = async () => {
    const opening = !notificationsOpen
    setNotificationsOpen(opening)
    if (!opening || !currentUserId || !supabaseConfigured) return

    setNotificationsLoading(true)
    try {
      const [latestNotifications, unreadCount] = await Promise.all([
        fetchNotifications(currentUserId),
        fetchUnreadNotificationCount(currentUserId),
      ])
      setNotifications(latestNotifications)
      setUnreadNotificationCount(unreadCount)
      if (unreadCount > 0) {
        await markNotificationsRead(currentUserId)
        setNotifications(latestNotifications.map((notification) => ({ ...notification, isRead: true })))
        setUnreadNotificationCount(0)
      }
    } catch (error) {
      console.log('Notifications unavailable:', error)
      setNotifications([])
      setUnreadNotificationCount(0)
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    const postPathMatch = window.location.pathname.match(/^\/post\/([^/]+)\/?$/)
    if (!postPathMatch) return

    const postId = decodeURIComponent(postPathMatch[1])
    setPage('feed')
    if (posts.length === 0) return
    const targetPost = posts.find((post) => String(post.id) === postId)
    if (targetPost) {
      window.setTimeout(() => {
        document.getElementById(`post-${targetPost.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 0)
    } else {
      setNotice('This post is no longer available.')
    }
  }, [posts])

  const friends = new Map<string, Profile>()
  for (const publicProfile of directoryProfiles) friends.set(publicProfile.fullName, publicProfile)
  for (const post of posts) if (!friends.has(post.user)) friends.set(post.user, { fullName: post.user, bio: '', avatarUrl: '' })
  for (const story of stories) if (!friends.has(story.name)) friends.set(story.name, { fullName: story.name, bio: '', avatarUrl: '' })
  const friendList = [...friends.values()].filter((friend) => friend.fullName !== profile.fullName)
  const savedPosts = posts.filter((post) => savedPostIds.includes(post.id))

  function renderPosts(postList: Post[] = posts, emptyTitle = 'Your feed is quiet', emptyDescription = 'Be the first to share something with your people.') {
    if (postList.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700"><MessageCircle size={22} /></div>
          <h3 className="mt-4 font-semibold text-slate-900">{emptyTitle}</h3>
          <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
        </div>
      )
    }

    return postList.flatMap((post, index) => {
      const cards = [
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          isLiked={likedPosts.includes(post.id)}
          isLikePending={pendingLikePosts.includes(post.id)}
          isSaved={savedPostIds.includes(post.id)}
          onOpenProfile={openProfile}
          isSiteOwner={isSiteOwner}
          onView={handleView}
          onDelete={deletePost}
          onEdit={openPostEditor}
          onCopyLink={(selectedPost) => void copyPostLink(selectedPost)}
          onLike={toggleLike}
          onSave={toggleSavedPost}
          onComment={addComment}
          onShare={(selectedPost) => void sharePost(selectedPost)}
        />,
      ]

      if ((index + 1) % 3 === 0) {
        cards.push(
          <FeedAd key={`ad-feed-${post.id}`} />,
        )
      }

      return cards
    })
  }

  return (
    <div className="min-h-screen bg-[#f4f6f5] text-slate-800">
      {sidebarOpen && <button type="button" aria-label="Close sidebar overlay" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" />}
      <aside className={`fixed left-0 top-0 z-40 h-full w-[260px] transform border-r border-slate-200 bg-white p-4 shadow-xl transition-transform duration-200 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white"><Sparkles size={18} /></span>
            <span className="font-bold text-slate-900">nagesh<span className="text-teal-700">.</span>social</span>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="space-y-1" aria-label="Mobile navigation">
          <button type="button" onClick={() => { setPage('feed'); setSidebarOpen(false) }} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold ${page === 'feed' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-white'}`}><Home size={18} /> Home</button>
          <button type="button" onClick={() => { setPage('profile'); setSidebarOpen(false) }} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold ${page === 'profile' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-white'}`}><Wallet size={18} /> My wallet</button>
          <button type="button" onClick={() => { setPage('friends'); setSidebarOpen(false) }} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${page === 'friends' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 transition hover:bg-white'}`}><Users size={18} /> Friends</button>
          <button type="button" onClick={() => { setPage('explore'); setSidebarOpen(false) }} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${page === 'explore' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 transition hover:bg-white'}`}><Compass size={18} /> Explore</button>
          <button type="button" onClick={() => { setPage('saved'); setSidebarOpen(false) }} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${page === 'saved' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 transition hover:bg-white'}`}><Bookmark size={18} /> Saved</button>
          <button type="button" onClick={() => { setPage('settings'); setSidebarOpen(false) }} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${page === 'settings' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-white'}`}><SettingsIcon size={18} /> Settings</button>
        </nav>
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-5 px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 lg:hidden" aria-label="Open menu"><span className="flex flex-col gap-1.5"><span className="block h-0.5 w-4 rounded-full bg-current" /><span className="block h-0.5 w-4 rounded-full bg-current" /><span className="block h-0.5 w-4 rounded-full bg-current" /></span></button>
            <button type="button" onClick={() => setPage('feed')} className="flex shrink-0 items-center gap-2.5" aria-label="Nagesh Social home">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"><Sparkles size={21} /></span>
              <span className="font-bold tracking-tight text-slate-900">nagesh<span className="text-teal-700">.</span><span className="hidden text-slate-500 sm:inline">social</span></span>
            </button>
          </div>

          <div className="relative hidden h-10 w-full max-w-[360px] items-center gap-2.5 rounded-full bg-slate-100 px-4 text-slate-400 md:flex">
            <Search size={17} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage('search'); } }} className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="Search people and posts" aria-label="Search people and posts" />
            {searchLoading && <span className="text-[11px] font-semibold text-teal-700">Searching…</span>}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {searchResults.slice(0, 5).map((result) => (
                  <button key={result.id ?? result.fullName} type="button" onClick={() => result.id && openProfile(result.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
                    <Avatar name={result.fullName} image={result.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">{result.fullName}</span>
                      <span className="block text-[11px] text-slate-500">{result.username ? `@${result.username}` : 'Profile'}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setComposerOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-white shadow-sm transition hover:bg-teal-800" aria-label="Create a post"><Plus size={18} /></button>
            <button type="button" onClick={() => setPage('search')} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-teal-50 hover:text-teal-800 md:hidden" aria-label="Search"><Search size={18} /></button>
            <div className="relative">
              <button type="button" onClick={() => void toggleNotifications()} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-teal-50 hover:text-teal-800" aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={18} />{unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>}</button>
              {notificationsOpen && <div className="absolute right-0 top-12 z-40 w-[min(90vw,360px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">Notifications</div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsLoading ? <p className="p-4 text-sm text-slate-500">Loading notifications…</p> : notifications.length ? notifications.map((notification) => (
                    <button key={notification.id} type="button" onClick={() => {
                      setNotificationsOpen(false)
                      if (notification.postId !== null) {
                        setPage('feed')
                        window.setTimeout(() => document.getElementById(`post-${notification.postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
                      }
                    }} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${notification.isRead ? '' : 'bg-teal-50/70'}`}>
                      <Avatar name={notification.actorName} image={notification.actorAvatar} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-800"><strong>{notification.actorName}</strong> {notification.type === 'like' ? 'liked your post.' : 'commented on your post.'}</span>
                        {notification.content && <span className="block truncate text-xs text-slate-500">{notification.content}</span>}
                        <span className="mt-0.5 block text-[11px] text-slate-400">{new Date(notification.createdAt).toLocaleString()}</span>
                      </span>
                    </button>
                  )) : <p className="p-4 text-sm text-slate-500">No notifications yet.</p>}
                </div>
              </div>}
            </div>
            <button type="button" onClick={() => setPage('profile')} className="flex h-10 items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 text-teal-900 transition hover:bg-teal-100" aria-label={`Wallet: ₹${accountWallet.balance.toFixed(2)}, ${accountWallet.bluePoints} Blue Points`}>
              <Wallet size={17} /> <span className="text-xs font-bold">₹{accountWallet.balance.toFixed(2)}</span><span className="hidden text-[11px] font-semibold text-teal-700 sm:inline">💙 {accountWallet.bluePoints.toLocaleString()}</span>
            </button>
            <button type="button" onClick={() => setPage('profile')} className="hidden items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-slate-100 sm:flex" aria-label="Open profile"><Avatar name={profile.fullName} image={profile.avatarUrl} size="sm" /><span className="text-sm font-semibold text-slate-700">{profile.fullName || 'Sign in'}</span>{isSiteOwner && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Owner</span>}</button>
            {isSiteOwner && <a href="/admin" className="hidden rounded-lg px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 sm:inline-flex">Admin</a>}
            {currentUserId && <button type="button" onClick={() => void signOut()} className="flex h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" aria-label="Sign out"><LogOut size={16} /><span className="hidden md:inline">Sign out</span></button>}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 pb-10 pt-6 sm:px-7 lg:grid-cols-[210px_minmax(0,650px)_260px] lg:justify-center xl:gap-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-[92px] space-y-1" aria-label="Main navigation">
            <button type="button" onClick={() => setPage('feed')} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold ${page === 'feed' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-white'}`}><Home size={18} /> Home</button>
            <button type="button" onClick={() => setPage('profile')} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold ${page === 'profile' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-white'}`}><Wallet size={18} /> My wallet</button>
            <button type="button" onClick={() => setPage('friends')} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${page === 'friends' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 transition hover:bg-white'}`}><Users size={18} /> Friends</button>
            <button type="button" onClick={() => setPage('explore')} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${page === 'explore' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 transition hover:bg-white'}`}><Compass size={18} /> Explore</button>
            <button type="button" onClick={() => setPage('saved')} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${page === 'saved' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 transition hover:bg-white'}`}><Bookmark size={18} /> Saved</button>
            <button type="button" onClick={() => setPage('settings')} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${page === 'settings' ? 'bg-teal-50 text-teal-800' : 'text-slate-600 transition hover:bg-white'}`}><SettingsIcon size={18} /> Settings</button>
            <div className="my-5 border-t border-slate-200" />
            <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Your people</p>
            {stories.map((story) => (
              <button key={story.name} type="button" onClick={() => setActiveStory(story)} className="flex h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium text-slate-700 transition hover:bg-white">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ${story.color}`}>{getInitials(story.name)}</span>{story.name}
              </button>
            ))}
          </nav>
        </aside>

        <main id="home" className="min-w-0 space-y-5">
          {isPostDetailRoute && <button type="button" onClick={() => {
            if (window.history.length > 1) window.history.back()
            else window.location.assign('/')
          }} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-white"><ArrowLeft size={16} /> Back</button>}
          {!currentUserId && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h1 className="font-bold text-slate-900">{authMode === 'signin' ? 'Sign in to Nagesh Social' : 'Create your account'}</h1>
            <p className="mt-1 text-sm text-slate-600">{authMode === 'signin' ? 'Sign in to show your profile, publish posts, and like content.' : 'Join Nagesh Social and earn rewards when you are referred.'}</p>
            <form onSubmit={(event) => void (authMode === 'signin' ? signIn(event) : signUp(event))} className="mt-3 flex flex-col gap-2">
              {authMode === 'signup' && <input required maxLength={80} autoComplete="name" value={signUpName} onChange={(event) => setSignUpName(event.target.value)} placeholder="Full name" aria-label="Full name" className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm" />}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="email" autoComplete="username" required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="Email" aria-label="Email" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
                <input type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Password" aria-label="Password" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
                <button type="submit" disabled={signingIn} className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50">{signingIn ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
              </div>
            </form>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={signingIn}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-black transition hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.3-5.7 7.5-11.3 7.5-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.5 5.1 29.5 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21c10.5 0 20.5-7.5 20.5-21 0-1.4-.1-2.7-.3-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.8 13 24 13c3.1 0 5.9 1.2 8 3.1l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.6 7.2 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 43c5.4 0 10.3-1.9 14-5l-6.6-4.8C29.5 34.9 26.9 36 24 36c-5.3 0-9.7-3.2-11.3-7.5l-6.6 5.1C9.4 40.8 16.2 45 24 45z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 1.9-1.9 3.6-3.5 4.9l.1.1 6.6 4.8c-.5.5 7.3-5.3 7.3-17.3 0-1.4-.1-2.7-.2-3.5z" />
              </svg>
              Continue with Google
            </button>
            <button type="button" onClick={() => setAuthMode((mode) => mode === 'signin' ? 'signup' : 'signin')} className="mt-3 text-sm font-semibold text-teal-800 hover:underline">
              {authMode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
            </button>
          </section>}
          {page === 'settings' ? <SettingsPage
            profileName={profile.fullName}
            email={accountEmail}
            userId={currentUserId}
            onSaveName={saveSettingsName}
            onChangePassword={changeAccountPassword}
          /> : page === 'user-profile' && selectedUserId ? <div className="space-y-5">
            <ProfilePage userId={selectedUserId} currentUserId={currentUserId} onBack={() => setPage('search')} />
            <h2 className="text-lg font-bold text-slate-900">Posts</h2>
            <div className="space-y-4">{renderPosts(posts.filter((post) => post.user_id === selectedUserId), 'No posts yet', 'This profile has not shared any posts.')}</div>
          </div> : page === 'search' ? <section aria-label="Search results" className="space-y-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_16px_rgba(31,41,55,0.035)] sm:p-5">
              <div className="flex items-center gap-3 rounded-full bg-slate-100 px-4 py-2.5">
                <Search size={16} className="text-slate-500" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search for people" className="w-full bg-transparent text-sm text-slate-800 outline-none" aria-label="Search for people" />
              </div>
              <div className="mt-4 space-y-3">
                {searchLoading ? <p className="text-sm text-slate-500">Searching…</p> : searchError ? <p role="alert" className="text-sm text-rose-700">{searchError}</p> : searchResults.length ? searchResults.map((result) => (
                  <button key={result.id ?? result.fullName} type="button" onClick={() => result.id && openProfile(result.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50">
                    <Avatar name={result.fullName} image={result.avatarUrl} size="sm" />
                    <span className="min-w-0"><span className="block text-sm font-semibold text-slate-800">{result.fullName}</span><span className="block text-xs text-slate-500">{result.username ? `@${result.username}` : 'Profile'}</span></span>
                  </button>
                )) : <p className="text-sm text-slate-500">No people matched “{searchQuery || 'your search'}”.</p>}
              </div>
            </div>
          </section> : page === 'feed' ? <>
          <section aria-label="Stories" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_16px_rgba(31,41,55,0.035)] sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div><h1 className="text-base font-bold text-slate-900">Stories</h1><p className="mt-0.5 text-xs text-slate-500">A glimpse into their day</p></div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-teal-700 hover:text-teal-900">See all</button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative h-[164px] w-[104px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left sm:h-[184px] sm:w-[116px]">
                {myStory && (myStory.mediaType === 'video'
                  ? <video src={myStory.image} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                  : <img src={myStory.image} alt="Your story" className="absolute inset-0 h-full w-full object-cover" />)}
                <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900/65 to-transparent" />
                <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-teal-700 text-white shadow-md transition group-hover:scale-105"><Plus size={20} /></span>
                <span className="absolute inset-x-1 bottom-2 text-center text-xs font-bold text-white">{uploadingStory ? 'Uploading...' : 'Create story'}</span>
              </button>
              {stories.map((story) => (
                <button key={story.name} type="button" onClick={() => setActiveStory(story)} className="group relative h-[164px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-slate-300 text-left sm:h-[184px] sm:w-[116px]">
                  {story.mediaType === 'video'
                    ? <video src={story.image} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                    : <img src={story.image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/10" />
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-teal-700 p-[2px]"><Avatar name={story.name} image={story.avatarUrl || '/default-avatar.png'} size="sm" /></span>
                  <span className="absolute inset-x-2 bottom-2 text-xs font-bold leading-tight text-white">{story.name}</span>
                </button>
              ))}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={(event) => void handleStoryUpload(event)} className="hidden" aria-label="Upload a story image or video" />
          </section>

          <AdBanner placement="feed" title="Sponsored" className="mb-1" />

          <section aria-label="Create a post" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_16px_rgba(31,41,55,0.035)] sm:p-5">
            <form onSubmit={addPost}>
              <div className="flex gap-3">
                <Avatar name={profile.fullName} image={profile.avatarUrl} />
                <label className="flex min-h-12 flex-1 items-center rounded-full bg-slate-100 px-5 focus-within:ring-2 focus-within:ring-teal-600/30">
                  <span className="sr-only">Write a post</span>
                  <input value={text} onChange={(event) => setText(event.target.value)} placeholder="What’s on your mind?" className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500" />
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => postMediaInputRef.current?.click()} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"><ImagePlus size={17} className="text-emerald-600" /><span className="hidden sm:inline">Photo</span></button>
                  <button type="button" onClick={() => setText((currentText) => `${currentText}${currentText ? ' ' : ''}😊`)} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-amber-50 hover:text-amber-700"><Smile size={17} className="text-amber-600" /><span className="hidden sm:inline">Feeling</span></button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"><Camera size={17} className="text-rose-600" /><span className="hidden sm:inline">Story</span></button>
                </div>
                <button type="submit" disabled={uploadingPhoto || (!text.trim() && !selectedPhoto)} className="flex h-9 items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"><Send size={14} /> {uploadingPhoto ? 'Uploading...' : 'Post'}</button>
              </div>
              {photoPreview && <div className="mt-3 flex items-start gap-3 rounded-lg bg-slate-50 p-2"><img src={photoPreview} alt="Selected upload preview" className="h-20 w-20 rounded-md object-cover" /><button type="button" onClick={() => { setSelectedPhoto(null); setPhotoPreview('') }} className="text-xs font-semibold text-rose-700">Remove photo</button></div>}
              <input ref={postMediaInputRef} type="file" accept="image/*" onChange={handlePostPhotoChange} className="hidden" aria-label="Choose a post photo" />
            </form>
          </section>

          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Your feed</h2>
            <button type="button" onClick={() => setPosts((currentPosts) => [...currentPosts].reverse())} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white">Recent <span aria-hidden="true">⌄</span></button>
          </div>
          <div className="space-y-4">{renderPosts()}</div>
          </> : page === 'profile' ? <div className="space-y-5">
            <AdEarn />
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_3px_16px_rgba(31,41,55,0.035)]">
              <div className="bg-[#dcece7] px-6 pb-7 pt-6 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><Avatar name={profile.fullName} image={profile.avatarUrl} size="lg" /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-teal-800">Creator profile</p><h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900"><span className="truncate">{profile.fullName}</span>{isSiteOwner && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">👑 Owner</span>}</h1><p className="mt-1 max-w-md text-sm text-slate-600">{profile.bio || 'Add a short bio about yourself.'}</p></div></div><button type="button" onClick={openProfileEditor} className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"><Pencil size={16} /> Edit Profile</button></div>
                <p className="mt-7 text-sm font-semibold text-slate-600">Total Earnings</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">₹{accountWallet.balance.toFixed(2)}</p>
                <div className="mt-4 space-y-1 text-sm text-slate-700">
                  <p><span className="font-semibold">Available Balance:</span> ₹{accountWallet.balance.toFixed(2)}</p>
                  <p><span className="font-semibold">Minimum Withdrawal:</span> ₹100</p>
                </div>
                <button type="button" onClick={() => setWithdrawModalOpen(true)} disabled={accountWallet.balance < 100} className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"><CreditCard size={16} /> Withdraw to UPI/Bank</button>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-3">
                <div className="p-5"><p className="text-xs font-semibold text-slate-500">Your post views</p><p className="mt-1 text-xl font-bold text-slate-900">{userTotalViews.toLocaleString()}</p></div>
                <div className="p-5"><p className="text-xs font-semibold text-slate-500">Blue Points</p><p className="mt-1 text-xl font-bold text-sky-700">💙 {accountWallet.bluePoints.toLocaleString()}</p></div>
                <div className="col-span-2 border-t border-slate-100 p-5 sm:col-span-1 sm:border-l-0 sm:border-t-0"><p className="text-xs font-semibold text-slate-500">Reward conversion</p><p className="mt-1 text-xl font-bold text-slate-900">100 points <span className="text-sm font-medium text-slate-500">= ₹10</span></p></div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3" aria-live="polite">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">Followers</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{followersCount.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">Following</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{followingCount.toLocaleString()}</p>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_3px_16px_rgba(31,41,55,0.035)] sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900">My Referral Link</h2><p className="mt-1 text-sm text-slate-500">You and your friend earn 100 Blue Points (₹10) when they join using your link.</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Users size={20} /></span></div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input readOnly value={profile.referralCode ? `https://nagesh.social?ref=${profile.referralCode}` : 'Referral link is being prepared'} aria-label="My referral link" className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700" />
                <button type="button" onClick={() => void copyReferralLink()} disabled={!profile.referralCode} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800 disabled:opacity-50"><Copy size={16} /> Copy Link</button>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">{referralCount === null ? 'Referral count unavailable until rewards setup is applied.' : `You referred ${referralCount} ${referralCount === 1 ? 'user' : 'users'}.`}</p>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_3px_16px_rgba(31,41,55,0.035)] sm:p-6">
              <div className="flex items-center gap-2"><CreditCard size={19} className="text-teal-700" /><h2 className="font-bold text-slate-900">Withdraw History</h2></div>
              {payoutHistory.length ? (
                <div className="mt-4 divide-y divide-slate-100">
                  {payoutHistory.map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">₹{request.amount.toFixed(2)} · {request.upiOrAccount}</p><p className="mt-1 text-xs text-slate-500">{new Date(request.createdAt).toLocaleString()}{request.ifsc ? ` · IFSC ${request.ifsc}` : ''}</p></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${request.status === 'paid' ? 'bg-emerald-50 text-emerald-800' : request.status === 'rejected' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>{request.status}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-slate-500">No withdrawal requests yet.</p>}
            </section>
          </div> : page === 'explore' ? <section aria-label="Explore posts" className="space-y-5">
            <div><h1 className="text-xl font-bold text-slate-900">Explore</h1><p className="mt-1 text-sm text-slate-500">Posts shared by everyone</p></div>
            <div className="space-y-4">{renderPosts(posts, 'Nothing to explore yet', 'Posts from the community will appear here.')}</div>
          </section> : page === 'saved' ? <section aria-label="Saved posts" className="space-y-5">
            <div><h1 className="text-xl font-bold text-slate-900">Saved</h1><p className="mt-1 text-sm text-slate-500">Posts you bookmarked</p></div>
            <div className="space-y-4">{renderPosts(savedPosts, 'No saved posts yet', 'Bookmark a post to keep it here.')}</div>
          </section> : <section aria-label="Friends" className="space-y-5">
            <div><h1 className="text-xl font-bold text-slate-900">Friends</h1><p className="mt-1 text-sm text-slate-500">{friendList.length} people in your community</p></div>
            {friendList.length ? <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
              {friendList.map((friend) => (
                <div key={friend.fullName} className="flex items-center gap-3 py-4">
                    <Avatar name={friend.fullName} image={friend.avatarUrl} />
                    <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold text-slate-900">{friend.fullName}</h2><p className="mt-0.5 truncate text-xs text-slate-500">{friend.bio || 'Member of your community'}</p></div>
                    <button type="button" onClick={() => setNotice(`Friend request sent to ${friend.fullName}.`)} className="flex h-9 items-center gap-2 rounded-lg bg-teal-50 px-3 text-xs font-bold text-teal-800 hover:bg-teal-100"><Plus size={15} /> Add</button>
                </div>
              ))}
            </div> : <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">No users found yet.</div>}
          </section>}
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-[92px] space-y-5">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_3px_16px_rgba(31,41,55,0.035)]">
              <h2 className="text-sm font-bold text-slate-900">People you may know</h2>
              <div className="mt-4 space-y-4">
                {stories.slice(0, 2).map((story) => (
                  <div key={story.name} className="flex items-center gap-2.5">
                    <Avatar name={story.name} size="sm" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{story.name}</p><p className="text-[11px] text-slate-500">Suggested for you</p></div>
                    <button type="button" onClick={() => setNotice(`Friend request sent to ${story.name}.`)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-800 transition hover:bg-teal-100" aria-label={`Add ${story.name}`}><Plus size={17} /></button>
                  </div>
                ))}
              </div>
            </section>
            <AdBanner placement="sidebar" title="Sponsored" className="mt-4" />
            <section className="rounded-2xl bg-[#e4efec] p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-teal-700"><Sparkles size={18} /></div>
              <h2 className="mt-3 text-sm font-bold text-slate-900">Make it a good one.</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">Share a little moment with the people who make it matter.</p>
            </section>
            <p className="px-2 text-[11px] leading-5 text-slate-400">About <span className="px-1">·</span> Privacy <span className="px-1">·</span> Terms<br />Nagesh Social © 2026</p>
          </div>
        </aside>
      </div>

      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}

      {profileEditorOpen && (
        <div role="dialog" aria-modal="true" aria-label="Edit profile" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onClick={() => setProfileEditorOpen(false)}>
          <form onSubmit={saveProfile} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Edit Profile</h2><button type="button" onClick={() => setProfileEditorOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close edit profile"><X size={19} /></button></div>
            <div className="mb-5 flex items-center gap-4">
              <Avatar name={profileNameDraft || profile.fullName} image={profilePhotoPreview} size="lg" />
              <div><button type="button" onClick={() => avatarInputRef.current?.click()} className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ImagePlus size={16} /> Change photo</button><p className="mt-1 text-xs text-slate-500">Photo uploads to Supabase avatars.</p></div>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" aria-label="Choose profile photo" />
            </div>
            <label className="mb-4 block text-sm font-semibold text-slate-700">Name<input value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} maxLength={80} required className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15" /></label>
            <label className="block text-sm font-semibold text-slate-700">Bio<textarea value={profileBioDraft} onChange={(event) => setProfileBioDraft(event.target.value)} maxLength={240} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15" /></label>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setProfileEditorOpen(false)} className="h-10 rounded-lg px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" disabled={savingProfile} className="flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"><Pencil size={15} /> {savingProfile ? 'Saving...' : 'Save Profile'}</button></div>
          </form>
        </div>
      )}

      {editingPost && (
        <div role="dialog" aria-modal="true" aria-label="Edit post" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onClick={() => setEditingPost(null)}>
          <form onSubmit={savePostEdit} onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit Post</h2>
              <button type="button" onClick={() => setEditingPost(null)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close edit post"><X size={19} /></button>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Post text
              <textarea autoFocus value={postContentDraft} onChange={(event) => setPostContentDraft(event.target.value)} maxLength={5000} rows={6} aria-label="Post text" className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingPost(null)} disabled={savingPost} className="h-10 rounded-lg px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={savingPost} className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">{savingPost ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {activeStory && (
        <div role="dialog" aria-modal="true" aria-label={`${activeStory.name}'s story`} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setActiveStory(null)}>
          <div className="relative h-[min(78vh,680px)] w-full max-w-[390px] overflow-hidden rounded-2xl bg-slate-800" onClick={(event) => event.stopPropagation()}>
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
              <div className="flex items-center gap-2.5"><Avatar name={activeStory.name} size="sm" /><span className="text-sm font-bold text-white">{activeStory.name}</span><span className="text-xs text-white/75">2h</span></div>
              <button type="button" onClick={() => setActiveStory(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white" aria-label="Close story"><X size={20} /></button>
            </div>
            <div className="absolute inset-x-4 top-4 z-10 flex gap-1.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={`${activeStory.id}-progress-${index}`} className={`h-1 flex-1 rounded-full ${index === 0 ? 'bg-white/95' : 'bg-white/30'}`} />
              ))}
            </div>
            {activeStory.mediaType === 'video'
              ? <video src={activeStory.image} autoPlay controls playsInline className="h-full w-full object-contain" />
              : <img src={activeStory.image} alt={`${activeStory.name}'s story`} className="h-full w-full object-cover" />}
          </div>
        </div>
      )}

      {composerOpen && (
        <div role="dialog" aria-modal="true" aria-label="Create a post" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onClick={() => setComposerOpen(false)}>
          <form onSubmit={(event) => { void addPost(event); setComposerOpen(false) }} onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Create</h2>
              <button type="button" onClick={() => setComposerOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close create dialog"><X size={19} /></button>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={profile.fullName} image={profile.avatarUrl} />
              <div>
                <p className="text-sm font-bold text-slate-900">{profile.fullName || 'New post'}</p>
                <p className="text-xs text-slate-500">Share a moment with your network</p>
              </div>
            </div>
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder="What’s happening today?" className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15" />
            {photoPreview && <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2"><img src={photoPreview} alt="Selected media preview" className="max-h-56 w-full rounded-lg object-cover" /></div>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => postMediaInputRef.current?.click()} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ImagePlus size={16} /> Photo</button>
              <button type="button" onClick={() => postMediaInputRef.current?.click()} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Camera size={16} /> Video</button>
              <button type="submit" disabled={uploadingPhoto || (!text.trim() && !selectedPhoto)} className="flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">{uploadingPhoto ? 'Posting...' : 'Post'}</button>
            </div>
            <input ref={postMediaInputRef} type="file" accept="image/*,video/*" onChange={handlePostPhotoChange} className="hidden" aria-label="Choose a media file for your post" />
          </form>
        </div>
      )}

      {withdrawModalOpen && (
        <WithdrawModal
          availableBalance={accountWallet.balance}
          onClose={() => setWithdrawModalOpen(false)}
          onSubmitted={async () => {
            await refreshAccountData()
            setNotice('Withdrawal request submitted for manual payment.')
          }}
        />
      )}
    </div>
  )
}

function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return window.localStorage.getItem('hasSeenOnboarding') !== 'true'
    } catch {
      return true
    }
  })

  const completeOnboarding = () => {
    try {
      window.localStorage.setItem('hasSeenOnboarding', 'true')
    } catch {
      // Keep the current session usable if storage is unavailable.
    }
    setShowOnboarding(false)
  }

  if (window.location.pathname === '/admin') return <AdminWithdrawals />
  if (window.location.pathname === '/admin-payouts') return <AdminPayouts />
  if (showOnboarding) return <Onboarding onComplete={completeOnboarding} />
  return <SocialApp />
}

export default App