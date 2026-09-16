import { supabase } from './supabase/client';

export const fetchInboundPhotoRequests = async (currentUserId: string) => {
  // Step 1: Fetch pending permissions
  const { data: requests, error: reqErr } = await supabase
    .from('photo_permissions')
    .select('id, requestor_id, status, created_at')
    .eq('target_id', currentUserId)
    .eq('status', 'pending');

  if (reqErr || !requests || requests.length === 0) return [];

  // Step 2: Fetch corresponding profile details
  const requestorIds = requests.map((r) => r.requestor_id);
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, city, profession')
    .in('id', requestorIds);

  if (profErr || !profiles) return requests;

  // Step 3: Merge in JavaScript
  return requests.map((req) => ({
    ...req,
    profiles: profiles.find((p) => p.id === req.requestor_id) || null
  }));
};

export async function sendPhotoPermissionRequest(requestorId: string, targetId: string) {
  const { data, error } = await supabase
    .from('photo_permissions')
    .upsert(
      {
        requestor_id: requestorId,
        target_id: targetId,
        status: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'requestor_id,target_id' }
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error('[PhotoPermission] Failed to request photo unblur:', error);
    // Fallback to server API if direct Supabase insert fails
    try {
      const res = await fetch('/api/photo-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: requestorId, targetUserId: targetId, status: 'pending' }),
      });
      const json = await res.json();
      return json.permission;
    } catch (apiErr) {
      throw error;
    }
  }
  return data;
}
