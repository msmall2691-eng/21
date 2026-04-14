import { type RawAuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';

// AuthContextType represents the full auth context available on the request object
// after JWT authentication. This includes user, workspace, and other auth data.
export type AuthContextType = RawAuthContext;
