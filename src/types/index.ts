// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Shared types
// ═══════════════════════════════════════════════════════
// Only what the console actually handles. The tenant clients carry a large
// barrel of domain interfaces (invoices, payroll, deliveries); none of it
// reaches a platform administrator, so none of it is here.

/**
 * The roles the server issues. `super_admin` is the only one this app serves —
 * the others exist so the sign-in guard can name what it is refusing.
 */
export type UserRole = 'admin' | 'staff' | 'delivery' | 'super_admin';

/** A platform administrator. No companyId: the console sits outside tenancy. */
export interface AdminUser {
  id: string;
  email: string;
  username?: string | null;
  displayName: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
}

/** What sign-in and /auth/me resolve to, once serialized. */
export interface Identity {
  user: AdminUser;
}
