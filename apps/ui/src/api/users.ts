import { apiUrl, parseError, withAuthHeaders } from './client';

export type UserProfilePayload = {
  firstName: string;
  lastName: string;
};

export type UserProfile = UserProfilePayload & {
  userId: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
};

export const upsertUserProfile = async (payload: UserProfilePayload): Promise<UserProfile> => {
  const response = await fetch(apiUrl('/me/profile'), {
    method: 'PUT',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to save profile');
  }

  return (await response.json()) as UserProfile;
};

export const fetchUserProfile = async (): Promise<UserProfile | null> => {
  const response = await fetch(apiUrl('/me/profile'), {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    await parseError(response, 'Failed to load profile');
  }

  return (await response.json()) as UserProfile;
};
