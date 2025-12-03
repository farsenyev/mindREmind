import { KnownUser } from "../types/user";

const usersById = new Map<number, KnownUser>();
const usersByUsername = new Map<string, KnownUser>();

export const registerUser = (id: number, username?: string | null, firstName?: string | null, ) => {
    const user: KnownUser = {id, username, firstName};

    usersById.set(id, user);

    if (username) {
        usersByUsername.set(username.toLowerCase(), user)
    }
}

export const getUserByUsername = (username: string): KnownUser | undefined => {
    return usersByUsername.get(username.toLowerCase());
}

export const getUsersById = (id: number): KnownUser | undefined => {
    return usersById.get(id)
}