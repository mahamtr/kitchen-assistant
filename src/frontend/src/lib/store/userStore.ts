import { create } from 'zustand';
import supabase from '../supacase';
import { fetchUser, UserProfile } from '../services/userService';

type UserState = {
    UserId: string | null;
};

export const useUserStore = create<UserState>((set, get) => {
    return { UserId: null };
});



export default useUserStore;
