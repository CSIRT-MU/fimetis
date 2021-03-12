export class UserProfile {
    id: number;
    username: string;
    preferred_username: string;
    name:string;
    email: string;
    is_external: boolean;
    groups = [];
    is_super_admin: boolean;
    token?: string;
}
