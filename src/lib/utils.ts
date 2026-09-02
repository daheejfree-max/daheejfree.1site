export function getDisplayName(profile?: {
  full_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  gender?: string | null;
} | null): string {
  if (!profile) return 'Candidate';
  const rawName = profile.full_name || (profile as any as any).name || (profile as any as any).first_name;
  if (rawName && typeof rawName === 'string' && rawName.trim().length > 0) {
    return rawName.trim();
  }
  // Clean fallback if name is completely empty in DB:
  const isFemale = profile.gender === 'female' || profile.gender === 'Sister';
  const prefix = isFemale ? 'Sister' : 'Brother';
  return `${prefix} (Candidate)`;
}
