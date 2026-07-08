import type { Database } from './database';

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

export type Household = Tables<'households'>;
export type Membership = Tables<'household_memberships'>;
export type MemberRole = Enums<'member_role'>;

export type MembershipWithHousehold = Membership & {
  households: Household | null;
};
