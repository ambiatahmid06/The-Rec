import { friendlyError } from './errors'
import { supabase } from './supabase'
import type { Profile } from './types'

export const PROFILE_COLUMNS =
  'id, username, display_name, nickname, avatar_url, height_in, weight_lb, primary_position, secondary_position'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()
  if (error) throw new Error(friendlyError(error))
  return data
}

export async function createProfile(userId: string, username: string, displayName: string) {
  const { error } = await supabase
    .from('profiles')
    .insert({ id: userId, username, display_name: displayName.trim() })
  if (error?.code === '23505') throw new Error('That username is taken. Try another.')
  if (error) throw new Error(friendlyError(error))
}

export async function updateProfile(
  userId: string,
  changes: Partial<Pick<Profile, 'display_name' | 'nickname' | 'avatar_url'>>,
) {
  const { error } = await supabase.from('profiles').update(changes).eq('id', userId)
  if (error) throw new Error(friendlyError(error))
}

const AVATAR_SIZE = 256

/** Center-crops and shrinks a photo to a small square JPEG in the browser. */
async function resizeToSquareJpeg(file: File): Promise<Blob> {
  const image = await createImageBitmap(file)
  const side = Math.min(image.width, image.height)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  canvas
    .getContext('2d')!
    .drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  image.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not read that image.'))), 'image/jpeg', 0.85),
  )
}

/** Uploads a new profile photo and saves its URL on the profile. Returns the URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await resizeToSquareJpeg(file)
  const path = `${userId}/avatar.jpg`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw new Error(friendlyError(error))

  // The file name never changes, so add a version to bust phone caches.
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = `${data.publicUrl}?v=${Date.now()}`
  await updateProfile(userId, { avatar_url: url })
  return url
}
