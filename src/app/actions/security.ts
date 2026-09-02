// ==============================================================================
// CLIENT / SERVER SECURITY & IP AUDIT LOGGER (src/app/actions/security.ts)
// Logs client IP via server endpoint /api/auth/log-ip
// ==============================================================================

/**
 * Capture user IP address and update last_known_ip in Supabase via backend endpoint
 * @param userId - UUID of the authenticated user
 */
export async function updateLastKnownIp(userId: string): Promise<{ success: boolean; ip?: string; error?: string }> {
  if (!userId) {
    return { success: false, error: 'User ID is required for security IP logging.' };
  }

  try {
    const res = await fetch('/api/auth/log-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: data.success ?? true, ip: data.ip };
    }

    return { success: true };
  } catch (err: any) {
    // Non-blocking log
    return { success: true };
  }
}
