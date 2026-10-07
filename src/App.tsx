import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  createPost,
  createStory,
  fetchAccountWallet,
  fetchCurrentUserLikes,
  fetchPayoutHistory,
  fetchPosts,
  fetchProfiles,
  fetchReferralCount,
  fetchStories,
  saveProfile as saveProfileToSupabase,
  setPostLiked,
  supabase,
  supabaseConfigured,
  updatePostContent,
  uploadAvatar,
  uploadPostPhoto,
  uploadStoryPhoto,
  type PublicProfile,
  type AccountWallet,
  type PayoutRequest,
  type SocialPost,
  type SupabaseStory,
} from './lib/supabase'
import { initializeAdMob } from './ads'
import AdBanner from './components/AdBanner'
import AdEarn from './components/AdEarn'
import AdminPayouts from './components/AdminPayouts'
import FeedAd from './components/FeedAd'
import WithdrawModal from './components/WithdrawModal'
import {
  Bell,
  Bookmark,
  Camera,
  Copy,
  Compass,
  CreditCard,
  Flag,
  Heart,
  Home,
  ImagePlus,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
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

type Page = 'feed' | 'profile' | 'friends' | 'explore' | 'saved'

type Story = SupabaseStory

type Profile = PublicProfile

const SAVED_POSTS_STORAGE_KEY = 'nagesh-saved-posts'

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
  const colors: Record<string, string> = {
    'Aarav Sharma': 'bg-orange-600',
    'Priya Patel': 'bg-rose-600',
    'Rohan Verma': 'bg-emerald-700',
  }
  const dimensions = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-14 w-14 text-base' }

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white ${colors[name] ?? 'bg-slate-600'} ${dimensions[size]}`} aria-label={`${name} avatar`}>
      {image ? <img src={image} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(name)}
    </div>
  )
}

function PostCard({
  post,
  currentUserName,
  isLiked,
  isSaved,
  onView,
  onDelete,
  onEdit,
  onCopyLink,
  onReport,
  onLike,
  onSave,
  onComment,
  onShare,
  currentUserId,
}: {
  post: Post
  currentUserName: string
  currentUserId: string
  isLiked: boolean
  isSaved: boolean
  onView: (postId: number | string) => void
  onDelete: (postId: number | string) => void
  onEdit: (post: Post) => void
  onCopyLink: (post: Post) => void
  onReport: (post: Post) => void
  onLike: (postId: number | string) => void
  onSave: (postId: number | string) => void
  onComment: (postId: number | string, comment: string) => void
  onShare: (post: Post) => void
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
  const postEarnings = post.likes / 10
  const authorName = post.profiles?.full_name || post.profiles?.username || 'Unknown User'
  const authorAvatar = post.profiles?.avatar_url || undefined
  const isOwnPost = post.user_id === currentUserId
  const chooseOption = (action: () => void) => {
    setOptionsOpen(false)
    action()
  }

  return (
    <article id={`post-${post.id}`} ref={articleRef} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_3px_16px_rgba(31,41,55,0.035)]">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={authorName} image={authorAvatar} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">{authorName}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{post.time} <span className="px-1">·</span> Everyone</p>
          </div>
        </div>
        <div ref={menuRef} className="relative flex items-center gap-1">
          {isOwnPost && (
            <button type="button" onClick={() => onDelete(post.id)} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700" aria-label="Delete your post" title="Delete post">
              <Trash2 size={15} /> <span className="hidden sm:inline">Delete</span>
            </button>
          )}
          <button type="button" onClick={() => setOptionsOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100" aria-label="More post options" aria-expanded={optionsOpen} aria-haspopup="menu"><MoreHorizontal size={20} /></button>
          {optionsOpen && (
            <div role="menu" aria-label="Post options" className="absolute right-0 top-10 z-20 min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {isOwnPost && <button type="button" role="menuitem" onClick={() => chooseOption(() => onEdit(post))} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><Pencil size={16} /> Edit Post</button>}
              <button type="button" role="menuitem" onClick={() => chooseOption(() => onCopyLink(post))} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><Copy size={16} /> Copy Link</button>
              {isOwnPost
                ? <button type="button" role="menuitem" onClick={() => chooseOption(() => onDelete(post.id))} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"><Trash2 size={16} /> Delete</button>
                : <button type="button" role="menuitem" onClick={() => chooseOption(() => onReport(post))} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><Flag size={16} /> Report</button>}
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
        <span>💙 {post.views.toLocaleString()} Blue</span><span className="text-slate-300">|</span>
        <span className="text-teal-800">₹{postEarnings.toFixed(2)} Earned</span>
      </div>

      <div className="mx-5 flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white"><ThumbsUp size={11} fill="currentColor" /></span>{post.likes} likes</span>
        <span>{post.comments?.length ? `${post.comments.length} comments` : 'No comments yet'}</span>
      </div>
      <div className="grid grid-cols-4 gap-1 px-3 py-2">
        <button type="button" onClick={() => onLike(post.id)} className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition hover:bg-slate-50 ${isLiked ? 'text-rose-600' : 'text-slate-600'}`}><Heart size={17} fill={isLiked ? 'currentColor' : 'none'} /> Like</button>
        <button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()} className="flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><MessageCircle size={17} /> Comment</button>
        <button type="button" onClick={() => onShare(post)} className="flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><Share2 size={17} /> Share</button>
        <button type="button" onClick={() => onSave(post.id)} aria-label={isSaved ? 'Remove saved post' : 'Save post'} title={isSaved ? 'Remove saved post' : 'Save post'} className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition hover:bg-slate-50 ${isSaved ? 'text-teal-700' : 'text-slate-600'}`}><Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} /><span className="hidden sm:inline">Save</span></button>
      </div>
      <div className="border-t border-slate-100 px-4 py-3">
        {(post.comments ?? []).map((comment, index) => <p key={`${post.id}-comment-${index}`} className="mb-2 text-sm text-slate-700"><span className="font-semibold text-slate-900">{currentUserName}</span> {comment}</p>)}
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
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [myStoryImage, setMyStoryImage] = useState<string | null>(null)
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
  const [page, setPage] = useState<Page>('feed')
  const [notice, setNotice] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signUpName, setSignUpName] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [signingIn, setSigningIn] = useState(false)
  const currentUser = profile.fullName
  const currentUserId = profile.id ?? ''

  useEffect(() => {
    void initializeAdMob()
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const postMediaInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const postOwnersRef = useRef(new Map(posts.map((post) => [post.id, post.user])))
  const userTotalViews = posts
    .filter((post) => post.user_id === currentUserId)
    .reduce((total, post) => total + post.views, 0)

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
      if (!signedInProfile) throw new Error('Your account profile could not be loaded.')
      setProfile(signedInProfile)
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
    const loadAccountData = async () => {
      try {
        await refreshAccountData()
      } catch (error) {
        console.error('Wallet, referral, or payout data could not be loaded:', error)
        if (active) setNotice(error instanceof Error ? error.message : 'Account data could not be loaded.')
      }
    }
    void loadAccountData()
    return () => {
      active = false
    }
  }, [currentUserId, refreshAccountData])

  useEffect(() => {
    postOwnersRef.current = new Map(posts.map((post) => [post.id, post.user]))
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

  const handleView = useCallback((postId: number | string) => {
    setPosts((currentPosts) => currentPosts.map((post) => post.id === postId ? { ...post, views: post.views + 1 } : post))
  }, [])

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
        throw new Error('Supabase is not configured; photo posts cannot be saved remotely.')
      }

      let imageUrl: string | null = null
      if (sourcePhoto) {
        const compressedPhoto = await compressPhoto(sourcePhoto)
        if (!compressedPhoto) throw new Error('Could not process the selected photo.')
        imageUrl = await uploadPostPhoto(compressedPhoto)
      }

      if (!supabaseConfigured) {
        throw new Error('Supabase is not configured; posts cannot be published.')
      }
      await createPost(trimmedText, imageUrl)
      const refreshedPosts = await fetchPosts()
      setPosts(refreshedPosts)
      console.log('Posts:', refreshedPosts)
      setNotice('Your post is live.')
    } catch (error) {
      console.error('Post could not be saved:', error)
      setNotice(error instanceof Error ? error.message : 'Post could not be saved to Supabase.')
    } finally {
      setUploadingPhoto(false)
      window.setTimeout(() => setNotice(''), 4000)
    }
  }

  const deletePost = (id: number | string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return
    const remainingPosts = posts.filter((post) => post.id !== id)
    postOwnersRef.current.delete(id)
    setPosts(remainingPosts)
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
      window.setTimeout(() => setNotice(''), 3000)
    }
  }

  const copyPostLink = async (post: Post) => {
    try {
      const postUrl = new URL(window.location.href)
      postUrl.hash = `post-${post.id}`
      await navigator.clipboard.writeText(postUrl.toString())
      setNotice('Link copied!')
    } catch (error) {
      console.error('Post link could not be copied:', error)
      setNotice('Could not copy the post link in this browser.')
    }
    window.setTimeout(() => setNotice(''), 3000)
  }

  const reportPost = (post: Post) => {
    console.info('Post report requested:', post.id)
    setNotice('Reported - thanks!')
    window.setTimeout(() => setNotice(''), 3500)
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
    window.setTimeout(() => setNotice(''), 3000)
  }

  const toggleLike = async (id: number | string) => {
    if (!supabaseConfigured) {
      setNotice('Add VITE_SUPABASE_ANON_KEY to .env to save likes.')
      return
    }

    const alreadyLiked = likedPosts.includes(id)
    const post = posts.find((candidate) => candidate.id === id)
    if (!post) return

    const nextLikes = Math.max(0, post.likes + (alreadyLiked ? -1 : 1))
    try {
      await setPostLiked(id, alreadyLiked)
    } catch (error) {
      console.error('Your like could not be saved to the likes table:', error)
      setNotice(error instanceof Error
        ? `Your like could not be saved: ${error.message}`
        : 'Your like could not be saved. Check the likes-table relationship and RLS policies.')
      return
    }

    setLikedPosts((currentLikes) => alreadyLiked
      ? currentLikes.filter((likedId) => likedId !== id)
      : [...currentLikes, id])
    setPosts((currentPosts) => currentPosts.map((post) => post.id === id
      ? { ...post, likes: Math.max(0, nextLikes) }
      : post))
  }

  const addComment = (postId: number | string, comment: string) => {
    setPosts((currentPosts) => currentPosts.map((post) => post.id === postId
      ? { ...post, comments: [...(post.comments ?? []), comment] }
      : post))
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
    if (!file.type.startsWith('image/')) {
      setNotice('Choose an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('Choose an image under 2 MB.')
      return
    }
    setSelectedPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleStoryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice('Choose an image file for your story.')
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
      const compressedFile = await compressPhoto(file)
      if (!compressedFile) throw new Error('Could not process the selected story photo.')
      const imageUrl = await uploadStoryPhoto(compressedFile)
      const story = await createStory(profile.fullName, imageUrl)
      setMyStoryImage(imageUrl)
      setStories((currentStories) => [story, ...currentStories])
      setNotice('Your story is live.')
    } catch (error) {
      console.error('Story could not be uploaded:', error)
      setNotice(error instanceof Error ? error.message : 'Story could not be uploaded.')
    } finally {
      setUploadingStory(false)
      window.setTimeout(() => setNotice(''), 4000)
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
      window.setTimeout(() => setNotice(''), 2600)
    }
  }

  const sharePost = async (post: Post) => {
    try {
      await navigator.clipboard.writeText(`${post.user}: ${post.text}`)
      setNotice('Post copied to clipboard.')
    } catch {
      setNotice('Sharing is not available in this browser.')
    }
    window.setTimeout(() => setNotice(''), 2400)
  }

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
          currentUserName={currentUser}
          currentUserId={currentUserId}
          isLiked={likedPosts.includes(post.id)}
          isSaved={savedPostIds.includes(post.id)}
          onView={handleView}
          onDelete={deletePost}
          onEdit={openPostEditor}
          onCopyLink={(selectedPost) => void copyPostLink(selectedPost)}
          onReport={reportPost}
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
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-5 px-4 sm:px-7">
          <button type="button" onClick={() => setPage('feed')} className="flex shrink-0 items-center gap-2.5" aria-label="Nagesh Social home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"><Sparkles size={21} /></span>
            <span className="font-bold tracking-tight text-slate-900">nagesh<span className="text-teal-700">.</span><span className="hidden text-slate-500 sm:inline">social</span></span>
          </button>

          <label className="hidden h-10 w-full max-w-[360px] items-center gap-2.5 rounded-full bg-slate-100 px-4 text-slate-400 md:flex">
            <Search size={17} />
            <input className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="Search people and posts" aria-label="Search people and posts" />
          </label>

          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-teal-50 hover:text-teal-800 md:hidden" aria-label="Search"><Search size={18} /></button>
            <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-teal-50 hover:text-teal-800" aria-label="Notifications"><Bell size={18} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" /></button>
            <button type="button" onClick={() => setPage('profile')} className="flex h-10 items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 text-teal-900 transition hover:bg-teal-100" aria-label={`Wallet: ₹${accountWallet.balance.toFixed(2)}, ${accountWallet.bluePoints} Blue Points`}>
              <Wallet size={17} /> <span className="text-xs font-bold">₹{accountWallet.balance.toFixed(2)}</span><span className="hidden text-[11px] font-semibold text-teal-700 sm:inline">💙 {accountWallet.bluePoints.toLocaleString()}</span>
            </button>
            <button type="button" onClick={() => setPage('profile')} className="hidden items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-slate-100 sm:flex" aria-label="Open profile"><Avatar name={profile.fullName} image={profile.avatarUrl} size="sm" /><span className="text-sm font-semibold text-slate-700">{profile.fullName || 'Sign in'}</span></button>
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
            <button type="button" onClick={() => setAuthMode((mode) => mode === 'signin' ? 'signup' : 'signin')} className="mt-3 text-sm font-semibold text-teal-800 hover:underline">
              {authMode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
            </button>
          </section>}
          {page === 'feed' ? <>
          <section aria-label="Stories" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_16px_rgba(31,41,55,0.035)] sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div><h1 className="text-base font-bold text-slate-900">Stories</h1><p className="mt-0.5 text-xs text-slate-500">A glimpse into their day</p></div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-teal-700 hover:text-teal-900">See all</button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative h-[164px] w-[104px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left sm:h-[184px] sm:w-[116px]">
                {myStoryImage && <img src={myStoryImage} alt="Your story" className="absolute inset-0 h-full w-full object-cover" />}
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
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-teal-700 p-[2px]"><Avatar name={story.name} size="sm" /></span>
                  <span className="absolute inset-x-2 bottom-2 text-xs font-bold leading-tight text-white">{story.name}</span>
                </button>
              ))}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => void handleStoryUpload(event)} className="hidden" aria-label="Upload a story image" />
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
                <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><Avatar name={profile.fullName} image={profile.avatarUrl} size="lg" /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-teal-800">Creator profile</p><h1 className="mt-1 truncate text-xl font-bold text-slate-900">{profile.fullName}</h1><p className="mt-1 max-w-md text-sm text-slate-600">{profile.bio || 'Add a short bio about yourself.'}</p></div></div><button type="button" onClick={openProfileEditor} className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"><Pencil size={16} /> Edit Profile</button></div>
                <p className="mt-7 text-sm font-semibold text-slate-600">Total Earnings</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">₹{accountWallet.balance.toFixed(2)}</p>
                <button type="button" onClick={() => setWithdrawModalOpen(true)} className="mt-5 flex h-10 items-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white transition hover:bg-teal-900"><CreditCard size={16} /> Withdraw</button>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-3">
                <div className="p-5"><p className="text-xs font-semibold text-slate-500">Your post views</p><p className="mt-1 text-xl font-bold text-slate-900">{userTotalViews.toLocaleString()}</p></div>
                <div className="p-5"><p className="text-xs font-semibold text-slate-500">Blue Points</p><p className="mt-1 text-xl font-bold text-sky-700">💙 {accountWallet.bluePoints.toLocaleString()}</p></div>
                <div className="col-span-2 border-t border-slate-100 p-5 sm:col-span-1 sm:border-l-0 sm:border-t-0"><p className="text-xs font-semibold text-slate-500">Reward conversion</p><p className="mt-1 text-xl font-bold text-slate-900">100 points <span className="text-sm font-medium text-slate-500">= ₹10</span></p></div>
              </div>
            </section>

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
            {activeStory.mediaType === 'video'
              ? <video src={activeStory.image} autoPlay controls playsInline className="h-full w-full object-contain" />
              : <img src={activeStory.image} alt={`${activeStory.name}'s story`} className="h-full w-full object-cover" />}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
              <div className="flex items-center gap-2.5"><Avatar name={activeStory.name} size="sm" /><span className="text-sm font-bold text-white">{activeStory.name}</span><span className="text-xs text-white/75">2h</span></div>
              <button type="button" onClick={() => setActiveStory(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white" aria-label="Close story"><X size={20} /></button>
            </div>
          </div>
        </div>
      )}

      {withdrawModalOpen && (
        <WithdrawModal
          availableBalance={accountWallet.balance}
          onClose={() => setWithdrawModalOpen(false)}
          onSubmitted={async () => {
            await refreshAccountData()
            setNotice('Withdraw request sent! Bank me 24hr me ayega')
          }}
        />
      )}
    </div>
  )
}

function App() {
  if (window.location.pathname === '/admin-payouts') return <AdminPayouts />
  return <SocialApp />
}

export default App