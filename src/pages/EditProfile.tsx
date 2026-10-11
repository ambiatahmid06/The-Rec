import { Camera } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, ErrorMessage, Spinner, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { updateProfile, uploadAvatar } from '../lib/profiles'
import { displayNameError } from '../lib/validation'

export function EditProfile() {
  const { profile, refreshProfile } = useAuth()
  const me = profile!
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(me.display_name)
  const [nickname, setNickname] = useState(me.nickname ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameProblem = displayNameError(displayName)

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow picking the same file again
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await uploadAvatar(me.id, file)
      await refreshProfile()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (nameProblem) return
    setSaving(true)
    setError(null)
    try {
      await updateProfile(me.id, {
        display_name: displayName.trim(),
        nickname: nickname.trim() || null,
      })
      await refreshProfile()
      navigate('/profile')
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Edit profile" backTo="/profile" />

      <div className="mb-6 flex flex-col items-center">
        <button
          type="button"
          className="relative rounded-full active:opacity-80"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          aria-label="Change photo"
        >
          <Avatar profile={me} size="lg" />
          <span className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full border-4 border-bg bg-accent text-black">
            {uploading ? <Spinner className="size-4 text-black" /> : <Camera className="size-4" />}
          </span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        <p className="mt-2 text-sm text-muted">@{me.username}</p>
      </div>

      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <TextField
            label="Display name"
            name="displayName"
            error={nameProblem}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <TextField
            label="Nickname (optional)"
            name="nickname"
            maxLength={40}
            placeholder="e.g. Chef Curry"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <ErrorMessage>{error}</ErrorMessage>
          <Button type="submit" full busy={saving} disabled={Boolean(nameProblem)}>
            Save
          </Button>
        </form>
      </Card>
    </>
  )
}
