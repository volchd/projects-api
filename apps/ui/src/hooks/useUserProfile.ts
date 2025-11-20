import { useCallback, useEffect, useState } from 'react';
import { fetchUserProfile, upsertUserProfile, type UserProfile, type UserProfilePayload } from '../api/users';

type UseUserProfileOptions = {
  enabled?: boolean;
  initialProfile?: Partial<UserProfile>;
};

export const useUserProfile = ({ enabled = true, initialProfile }: UseUserProfileOptions = {}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialProfile) {
      setProfile((prev) => ({ ...(prev ?? {}), ...(initialProfile as UserProfile) }));
    }
  }, [initialProfile]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchUserProfile();
      setProfile(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load profile';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const save = useCallback(
    async (payload: UserProfilePayload) => {
      setIsSaving(true);
      setError(null);
      try {
        const result = await upsertUserProfile(payload);
        setProfile(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to save profile';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void load();
  }, [enabled, load]);

  return {
    profile,
    error,
    isLoading,
    isSaving,
    refresh: load,
    save,
  };
};
