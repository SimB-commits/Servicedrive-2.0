// utils/sessionHelper.ts
import { Session } from 'next-auth';

/**
 * Helper function to refresh the session data after changes
 * This forces NextAuth to refetch the session
 */
export async function refreshSession() {
  // Trigger the visibilitychange event that NextAuth listens for
  const event = new Event('visibilitychange');
  document.dispatchEvent(event);
}