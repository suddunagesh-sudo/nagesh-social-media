import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import {
  Bell,
  Eye,
  LockKeyhole,
  Monitor,
  Moon,
  Shield,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'

type Preferences = {
  postAudience: 'Everyone' | 'Friends'
  commentAudience: 'Everyone' | 'Friends'
  messageAudience: 'Everyone' | 'Friends'
  likeNotifications: boolean
  commentNotifications: boolean
  followNotifications: boolean
  darkMode: boolean
  autoplayVideos: boolean
  showEarnings: boolean
}

const defaultPreferences: Preferences = {
  postAudience: 'Everyone',
  commentAudience: 'Everyone',
  messageAudience: 'Everyone',
  likeNotifications: true,
  commentNotifications: true,
  followNotifications: true,
  darkMode: false,
  autoplayVideos: true,
  showEarnings: true,
}

const preferenceColumns: Record<keyof Preferences, string> = {
  postAudience: 'post_audience',
  commentAudience: 'comment_audience',
  messageAudience: 'message_audience',
  likeNotifications: 'like_notifications',
  commentNotifications: 'comment_notifications',
  followNotifications: 'follow_notifications',
  darkMode: 'dark_mode',
  autoplayVideos: 'autoplay_videos',
  showEarnings: 'show_earnings',
}

function mapPreferences(row: Record<string, unknown>): Preferences {
  return {
    postAudience: row.post_audience === 'Friends' ? 'Friends' : 'Everyone',
    commentAudience: row.comment_audience === 'Friends' ? 'Friends' : 'Everyone',
    messageAudience: row.message_audience === 'Friends' ? 'Friends' : 'Everyone',
    likeNotifications: typeof row.like_notifications === 'boolean' ? row.like_notifications : true,
    commentNotifications: typeof row.comment_notifications === 'boolean' ? row.comment_notifications : true,
    followNotifications: typeof row.follow_notifications === 'boolean' ? row.follow_notifications : true,
    darkMode: typeof row.dark_mode === 'boolean' ? row.dark_mode : false,
    autoplayVideos: typeof row.autoplay_videos === 'boolean' ? row.autoplay_videos : true,
    showEarnings: typeof row.show_earnings === 'boolean' ? row.show_earnings : true,
  }
}

function toDatabaseSettings(preferences: Preferences) {
  return {
    post_audience: preferences.postAudience,
    comment_audience: preferences.commentAudience,
    message_audience: preferences.messageAudience,
    like_notifications: preferences.likeNotifications,
    comment_notifications: preferences.commentNotifications,
    follow_notifications: preferences.followNotifications,
    dark_mode: preferences.darkMode,
    autoplay_videos: preferences.autoplayVideos,
    show_earnings: preferences.showEarnings,
  }
}

function Section({ icon, title, description, children }: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="mt-0.5 text-teal-700">{icon}</span>
        <div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-sm text-slate-500">{description}</p></div>
      </div>
      <div className="divide-y divide-slate-100 px-5">{children}</div>
    </section>
  )
}

function Toggle({ label, description, checked, onChange, disabled = false }: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={`flex items-center justify-between gap-4 py-4 ${disabled ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
      <span><span className="block text-sm font-semibold text-slate-800">{label}</span>{description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-teal-700' : 'bg-slate-300'} after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition after:content-[''] ${checked ? 'after:translate-x-5' : ''}`} />
    </label>
  )
}

function AudienceSelect({ label, value, onChange, disabled = false }: {
  label: string
  value: 'Everyone' | 'Friends'
  onChange: (value: 'Everyone' | 'Friends') => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-4">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as 'Everyone' | 'Friends')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-600 disabled:opacity-60">
        <option>Everyone</option><option>Friends</option>
      </select>
    </label>
  )
}

export default function SettingsPage({ profileName, email, userId, onSaveName, onChangePassword }: {
  profileName: string
  email: string
  userId: string
  onSaveName: (name: string) => Promise<void>
  onChangePassword: (password: string) => Promise<void>
}) {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingPreference, setSavingPreference] = useState(false)
  const [name, setName] = useState(profileName)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!userId) {
      setLoadingSettings(false)
      setStatus('Sign in to load your settings.')
      return
    }
    let active = true
    const loadSettings = async () => {
      setLoadingSettings(true)
      setStatus('')
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw error

        let settingsRow = data
        if (!settingsRow) {
          const { data: insertedSettings, error: insertError } = await supabase
            .from('user_settings')
            .insert({ user_id: userId, ...toDatabaseSettings(defaultPreferences) })
            .select('*')
            .single()
          if (insertError) throw insertError
          settingsRow = insertedSettings
        }
        if (active) setPreferences(mapPreferences(settingsRow as Record<string, unknown>))
      } catch (error) {
        console.error('User settings could not be loaded:', error)
        if (active) setStatus(error instanceof Error ? error.message : 'Settings could not be loaded.')
      } finally {
        if (active) setLoadingSettings(false)
      }
    }
    void loadSettings()
    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    document.documentElement.classList.toggle('app-dark-mode', preferences.darkMode)
    return () => document.documentElement.classList.remove('app-dark-mode')
  }, [preferences.darkMode])

  useEffect(() => setName(profileName), [profileName])

  const update = async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    if (!userId || loadingSettings || savingPreference) return
    setSavingPreference(true)
    setStatus('')
    try {
      const { data: updatedSettings, error } = await supabase
        .from('user_settings')
          .upsert({
            user_id: userId,
            [preferenceColumns[key]]: value,
          }, { onConflict: 'user_id' })
        .select('user_id')
          .single()
      if (error) throw error
      if (!updatedSettings) throw new Error('Your settings row could not be updated.')
      setPreferences((current) => ({ ...current, [key]: value }))
    } catch (error) {
      console.error('User setting could not be saved:', error)
      setStatus(error instanceof Error ? error.message : 'Setting could not be saved.')
    } finally {
      setSavingPreference(false)
    }
  }

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSaveName(name)
      setStatus('Your name was updated.')
    } catch (error) {
      console.error('Profile name could not be updated:', error)
      setStatus(error instanceof Error ? error.message : 'Your name could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onChangePassword(password)
      setPassword('')
      setStatus('Your password was updated.')
    } catch (error) {
      console.error('Password could not be updated:', error)
      setStatus(error instanceof Error ? error.message : 'Your password could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="Settings" className="mx-auto max-w-3xl space-y-5">
      {loadingSettings && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading your settings…</p>}
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><SlidersHorizontal size={21} /></span><div><h1 className="text-xl font-bold text-slate-900">Settings</h1><p className="text-sm text-slate-500">Manage your account and preferences</p></div></div>
      </header>

      <Section icon={<UserRound size={19} />} title="Account settings" description="Update your account information">
        <form onSubmit={saveName} className="flex flex-wrap items-end gap-3 py-4">
          <label className="min-w-[180px] flex-1 text-sm font-semibold text-slate-700">Name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-teal-600" /></label>
          <button disabled={saving || name.trim() === profileName} className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">Save name</button>
        </form>
        <div className="py-4"><p className="text-sm font-semibold text-slate-800">Email</p><p className="mt-1 text-sm text-slate-500">{email || 'Sign in to view your email'}</p></div>
        <form onSubmit={(event) => void savePassword(event)} className="flex flex-wrap items-end gap-3 py-4">
          <label className="min-w-[180px] flex-1 text-sm font-semibold text-slate-700">Change password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="At least 8 characters" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-teal-600" /></label>
          <button disabled={saving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Update password</button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-semibold text-slate-800">Delete account</p><p className="text-xs text-slate-500">Account deletion needs secure server-side support.</p></div><button type="button" disabled title="Account deletion is not configured for this project" className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 opacity-60">Delete account</button></div>
      </Section>

      <Section icon={<Shield size={19} />} title="Privacy settings" description="Choose who can interact with your content">
        <AudienceSelect label="Who can see your posts" value={preferences.postAudience} disabled={loadingSettings || savingPreference} onChange={(value) => void update('postAudience', value)} />
        <AudienceSelect label="Who can comment" value={preferences.commentAudience} disabled={loadingSettings || savingPreference} onChange={(value) => void update('commentAudience', value)} />
        <AudienceSelect label="Who can message you" value={preferences.messageAudience} disabled={loadingSettings || savingPreference} onChange={(value) => void update('messageAudience', value)} />
      </Section>

      <Section icon={<Bell size={19} />} title="Notification settings" description="Choose which notifications you receive">
        <Toggle label="Like notifications" checked={preferences.likeNotifications} disabled={loadingSettings || savingPreference} onChange={(value) => void update('likeNotifications', value)} />
        <Toggle label="Comment notifications" checked={preferences.commentNotifications} disabled={loadingSettings || savingPreference} onChange={(value) => void update('commentNotifications', value)} />
        <Toggle label="Follow notifications" checked={preferences.followNotifications} disabled={loadingSettings || savingPreference} onChange={(value) => void update('followNotifications', value)} />
      </Section>

      <Section icon={<Monitor size={19} />} title="Appearance" description="Personalize how the app looks">
        <Toggle label="Dark mode" description="Use a darker appearance on this device" checked={preferences.darkMode} disabled={loadingSettings || savingPreference} onChange={(value) => void update('darkMode', value)} />
        <div className="flex items-center gap-2 pb-4 text-xs text-slate-500"><Moon size={15} /> Preference is saved to your account.</div>
      </Section>

      <Section icon={<LockKeyhole size={19} />} title="Post settings" description="Adjust your feed experience">
        <Toggle label="Auto-play videos" checked={preferences.autoplayVideos} disabled={loadingSettings || savingPreference} onChange={(value) => void update('autoplayVideos', value)} />
        <Toggle label="Show earned money" checked={preferences.showEarnings} disabled={loadingSettings || savingPreference} onChange={(value) => void update('showEarnings', value)} />
      </Section>

      <Section icon={<Eye size={19} />} title="About" description="Nagesh Social">
        <div className="flex justify-between py-4 text-sm"><span className="font-semibold text-slate-800">App version</span><span className="text-slate-500">1.0.0</span></div>
        <div className="flex gap-5 py-4 text-sm"><a href="/terms" className="font-semibold text-teal-800 hover:underline">Terms</a><a href="/privacy" className="font-semibold text-teal-800 hover:underline">Privacy</a></div>
      </Section>
      {status && <p role="status" className="rounded-lg bg-slate-900 px-4 py-3 text-sm text-white">{status}</p>}
    </section>
  )
}
