import api from '../api';

export type UserProfile = {
    id: string;
    email?: string | null;
    name?: string | null;
    avatar_url?: string | null;
    metadata?: any;
};

/**
 * Fetch user profile by id from backend API.
 * Adjust endpoint to match your backend (`/users/:id` is a common pattern).
 */
export async function fetchUser(userId: string): Promise<UserProfile> {
    const res = await api.get(`/users/${encodeURIComponent(userId)}`);
    return res as UserProfile;
}

export default { fetchUser };
