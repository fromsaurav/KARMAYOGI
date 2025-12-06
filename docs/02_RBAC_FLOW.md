# Role-Based Access Control (RBAC) Implementation
## Authentication & Authorization Flow

---

## 🔐 RBAC Overview

KarmaYogi implements a **hierarchical role-based access control** system with 3 roles, where higher roles inherit permissions from lower roles.

### Role Hierarchy
```
ADMIN (Highest)
  │
  ├─── Full system access
  ├─── User management
  ├─── System configuration
  └─── Inherits MANAGER permissions
        │
        ├─── Team management
        ├─── View all jobs
        ├─── Analytics access
        └─── Inherits USER permissions
              │
              ├─── Submit jobs
              ├─── View own jobs
              └─── Basic features
```

---

## 👥 Role Definitions

### 1. USER Role
**Purpose**: Regular system users who submit and manage their own jobs

**Permissions**:
- ✅ Submit new jobs
- ✅ View own jobs
- ✅ Update own job status
- ✅ Delete own jobs
- ✅ Retry failed jobs
- ✅ Add comments to jobs
- ✅ Use job templates
- ✅ View personal dashboard
- ❌ View other users' jobs
- ❌ Manage users
- ❌ Access admin features

**Use Case**: Developers, data analysts, regular team members

---

### 2. MANAGER Role
**Purpose**: Team leads who oversee projects and team members

**Permissions** (includes all USER permissions plus):
- ✅ View all jobs in system
- ✅ View team members
- ✅ Access analytics dashboard
- ✅ View system metrics
- ✅ Hand off jobs to team members
- ✅ Monitor team performance
- ❌ Create/delete users
- ❌ Change user roles
- ❌ Access system configuration

**Use Case**: Team leads, project managers, supervisors

---

### 3. ADMIN Role
**Purpose**: System administrators with full control

**Permissions** (includes all MANAGER permissions plus):
- ✅ Create new users
- ✅ Update user information
- ✅ Delete users
- ✅ Change user roles
- ✅ View system logs
- ✅ Retry failed jobs globally
- ✅ Configure system settings
- ✅ Access all admin panels

**Use Case**: System administrators, IT staff, senior management

---

## 🔑 Authentication Flow

### 1. User Registration

**Endpoint**: `POST /api/auth/register`

**File**: `/src/routes/authRoutes.ts`, `/src/controllers/authController.ts`

```typescript
// Flow
Client                    Node.js API                    PostgreSQL
  │                            │                              │
  ├─ POST /auth/register       │                              │
  │  {                          │                              │
  │    email,                   │                              │
  │    password,                │                              │
  │    fullName                 │                              │
  │  }                          │                              │
  │                             │                              │
  │                             ├─ Validate input (Zod)       │
  │                             │                              │
  │                             ├─ Check if email exists ────>│
  │                             │                              │
  │                             │<──── Return existing user ───┤
  │                             │                              │
  │                             ├─ Hash password (bcrypt)     │
  │                             │  (10 salt rounds)            │
  │                             │                              │
  │                             ├─ Create user ──────────────>│
  │                             │  {                           │
  │                             │    email,                    │
  │                             │    password: hashedPassword, │
  │                             │    fullName,                 │
  │                             │    role: USER (default)      │
  │                             │  }                           │
  │                             │                              │
  │                             │<──── Return new user ────────┤
  │                             │                              │
  │                             ├─ Generate JWT token         │
  │                             │  (7 days expiry)             │
  │                             │                              │
  │                             ├─ Set HTTP-only cookie        │
  │                             │  (secure, sameSite)          │
  │                             │                              │
  │<── 201 Created ─────────────┤                              │
  │    {                        │                              │
  │      success: true,         │                              │
  │      user: { id, email, ... }                             │
  │    }                        │                              │
  │    Cookie: jwt=token        │                              │
```

**Code** (`/src/controllers/authController.ts:register`):
```typescript
export async function register(req: Request, res: Response) {
  const { email, password, fullName } = req.body;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'User already exists'
    });
  }

  // Hash password
  const hashedPassword = await bcryptjs.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullName,
      username: email.split('@')[0],
      role: 'USER' // Default role
    }
  });

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  // Set cookie
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.status(201).json({
    success: true,
    user: { id: user.id, email: user.email, role: user.role }
  });
}
```

---

### 2. User Login

**Endpoint**: `POST /api/auth/login`

**File**: `/src/routes/authRoutes.ts`, `/src/controllers/authController.ts`

```typescript
// Flow
Client                    Node.js API                    PostgreSQL
  │                            │                              │
  ├─ POST /auth/login          │                              │
  │  {                          │                              │
  │    email,                   │                              │
  │    password                 │                              │
  │  }                          │                              │
  │                             │                              │
  │                             ├─ Find user by email ───────>│
  │                             │                              │
  │                             │<──── Return user with hash ──┤
  │                             │                              │
  │                             ├─ Compare passwords          │
  │                             │  bcrypt.compare(             │
  │                             │    plainPassword,            │
  │                             │    hashedPassword            │
  │                             │  )                           │
  │                             │                              │
  │                             ├─ Generate JWT token         │
  │                             │  Payload: {                  │
  │                             │    userId,                   │
  │                             │    email,                    │
  │                             │    role,                     │
  │                             │    fullName                  │
  │                             │  }                           │
  │                             │                              │
  │                             ├─ Set HTTP-only cookie        │
  │                             │                              │
  │<── 200 OK ──────────────────┤                              │
  │    {                        │                              │
  │      success: true,         │                              │
  │      user: {                │                              │
  │        id,                  │                              │
  │        email,               │                              │
  │        role,                │                              │
  │        fullName             │                              │
  │      }                      │                              │
  │    }                        │                              │
  │    Cookie: jwt=token        │                              │
```

**Security Features**:
- ✅ Password hashed with bcrypt (10 rounds)
- ✅ JWT stored in HTTP-only cookie (prevents XSS)
- ✅ Cookie has secure flag (HTTPS only in production)
- ✅ Cookie has sameSite=strict (prevents CSRF)
- ✅ Token expires after 7 days
- ✅ Rate limiting on login endpoint

---

### 3. Protected Route Access

**Middleware**: `protectRoute`

**File**: `/src/middleware/protectRoute.ts`

```typescript
// Flow
Client                    Node.js API
  │                            │
  ├─ GET /api/jobs             │
  │  Cookie: jwt=token         │
  │                            │
  │                            ├─ Extract JWT from cookie
  │                            │
  │                            ├─ Verify JWT signature
  │                            │  jwt.verify(token, JWT_SECRET)
  │                            │
  │                            ├─ Check expiration
  │                            │
  │                            ├─ Decode payload
  │                            │  {
  │                            │    userId: "user_123",
  │                            │    email: "user@example.com",
  │                            │    role: "USER",
  │                            │    iat: 1234567890,
  │                            │    exp: 1234567890
  │                            │  }
  │                            │
  │                            ├─ Attach to req.user
  │                            │
  │                            ├─ Call next() → Controller
  │                            │
  │<── 200 OK ─────────────────┤
  │    { jobs: [...] }         │
```

**Code** (`/src/middleware/protectRoute.ts`):
```typescript
export const protectRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract JWT from cookie
    const token = req.cookies.jwt;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
      return;
    }

    // 2. Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
      role: string;
      fullName: string;
    };

    // 3. Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      fullName: decoded.fullName
    };

    // 4. Continue to next middleware/controller
    next();

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};
```

---

## 🛡️ Authorization Flow

### Role-Based Middleware

**File**: `/src/middleware/roleMiddleware.ts`

```typescript
// requireAdmin Middleware
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required'
    });
    return;
  }
  next();
};

// requireManager Middleware (MANAGER or ADMIN)
export const requireManager = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const allowedRoles = ['MANAGER', 'ADMIN'];

  if (!req.user || !allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Manager access required'
    });
    return;
  }
  next();
};
```

### Middleware Chain Examples

**1. Public Endpoint** (No authentication)
```typescript
router.post('/auth/login', login);
// No middleware → Anyone can access
```

**2. USER Endpoint** (Authenticated only)
```typescript
router.get('/jobs', protectRoute, getJobs);
// protectRoute → Authenticated users only
```

**3. MANAGER Endpoint** (MANAGER or ADMIN)
```typescript
router.get('/analytics', protectRoute, requireManager, getAnalytics);
// protectRoute → requireManager → MANAGER/ADMIN only
```

**4. ADMIN Endpoint** (ADMIN only)
```typescript
router.post('/admin/users', protectRoute, requireAdmin, createUser);
// protectRoute → requireAdmin → ADMIN only
```

---

## 🎯 Role-Based UI Rendering

### Frontend Authorization

**File**: `/karmayogi-frontend/src/stores/authStore.ts`

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
  isUser: () => boolean;
  hasRole: (role: UserRole) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,

  isAdmin: () => get().user?.role === 'ADMIN',
  isManager: () => ['MANAGER', 'ADMIN'].includes(get().user?.role || ''),
  isUser: () => get().user?.role === 'USER',

  hasRole: (role: UserRole) => {
    const userRole = get().user?.role;
    if (role === 'USER') return true; // Everyone has USER permissions
    if (role === 'MANAGER') return ['MANAGER', 'ADMIN'].includes(userRole || '');
    if (role === 'ADMIN') return userRole === 'ADMIN';
    return false;
  }
}));
```

### Conditional Rendering Examples

**1. Show/Hide Based on Role**
```tsx
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';

export function DashboardPage() {
  const { user, isAdmin, isManager } = useAuthStore();

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Show to everyone */}
      <MyJobsSection />

      {/* Show to MANAGER and ADMIN */}
      {isManager() && (
        <TeamAnalyticsSection />
      )}

      {/* Show to ADMIN only */}
      {isAdmin() && (
        <UserManagementSection />
      )}
    </div>
  );
}
```

**2. Navigation Based on Role**
```tsx
// Sidebar.tsx
export function Sidebar() {
  const { user } = useAuthStore();

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', roles: ['USER', 'MANAGER', 'ADMIN'] },
    { label: 'My Jobs', href: '/jobs', roles: ['USER', 'MANAGER', 'ADMIN'] },
    { label: 'Team', href: '/admin/team', roles: ['MANAGER', 'ADMIN'] },
    { label: 'Analytics', href: '/analytics', roles: ['MANAGER', 'ADMIN'] },
    { label: 'Users', href: '/admin/users', roles: ['ADMIN'] },
  ];

  const filteredMenu = menuItems.filter(item =>
    item.roles.includes(user?.role || '')
  );

  return (
    <nav>
      {filteredMenu.map(item => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

**3. Route Protection**
```tsx
// app/admin/users/page.tsx
export default function UsersPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, isLoading]);

  if (user?.role !== 'ADMIN') {
    return <div>Access Denied</div>;
  }

  return <UserManagementComponent />;
}
```

---

## 📋 Complete Permission Matrix

| Feature | USER | MANAGER | ADMIN |
|---------|------|---------|-------|
| **Authentication** |
| Register/Login | ✅ | ✅ | ✅ |
| Logout | ✅ | ✅ | ✅ |
| **Job Management** |
| Submit job | ✅ | ✅ | ✅ |
| View own jobs | ✅ | ✅ | ✅ |
| View all jobs | ❌ | ✅ | ✅ |
| Update job status | ✅ (own) | ✅ (all) | ✅ (all) |
| Delete job | ✅ (own) | ✅ (all) | ✅ (all) |
| Retry failed job | ✅ (own) | ✅ (all) | ✅ (all) |
| **Team Management** |
| View team members | ❌ | ✅ | ✅ |
| Contact team member | ❌ | ✅ | ✅ |
| Assign tasks | ❌ | ✅ | ✅ |
| Schedule meetings | ❌ | ✅ | ✅ |
| **User Management** |
| Create user | ❌ | ❌ | ✅ |
| Update user | ❌ | ❌ | ✅ |
| Delete user | ❌ | ❌ | ✅ |
| Change user role | ❌ | ❌ | ✅ |
| **Analytics** |
| View personal stats | ✅ | ✅ | ✅ |
| View team stats | ❌ | ✅ | ✅ |
| View system metrics | ❌ | ✅ | ✅ |
| **Collaboration** |
| Add comments | ✅ | ✅ | ✅ |
| Watch jobs | ✅ | ✅ | ✅ |
| Hand off jobs | ❌ | ✅ | ✅ |
| **Templates** |
| Use templates | ✅ | ✅ | ✅ |
| Create templates | ✅ | ✅ | ✅ |
| Share templates | ❌ | ✅ | ✅ |
| **System** |
| View system logs | ❌ | ❌ | ✅ |
| Configure settings | ❌ | ❌ | ✅ |
| Retry all failed jobs | ❌ | ❌ | ✅ |

---

## 🔄 Role Change Flow

### Admin Changes User Role

**Endpoint**: `PUT /api/admin/users/:userId`

**File**: `/src/routes/admin.ts`

```typescript
// Flow
Admin Client              Node.js API                PostgreSQL
    │                         │                          │
    ├─ PUT /admin/users/123   │                          │
    │  {                      │                          │
    │    role: "MANAGER"      │                          │
    │  }                      │                          │
    │  Cookie: jwt=admin_token│                          │
    │                         │                          │
    │                         ├─ protectRoute            │
    │                         │  (Verify admin is logged in)
    │                         │                          │
    │                         ├─ requireAdmin            │
    │                         │  (Verify admin role)     │
    │                         │                          │
    │                         ├─ Validate new role       │
    │                         │  (Must be USER|MANAGER|ADMIN)
    │                         │                          │
    │                         ├─ Update user ──────────>│
    │                         │  UPDATE users            │
    │                         │  SET role = 'MANAGER'    │
    │                         │  WHERE id = '123'        │
    │                         │                          │
    │                         │<── Return updated user ──┤
    │                         │                          │
    │                         ├─ Log to audit_logs       │
    │                         │  {                       │
    │                         │    action: "UPDATE_USER_ROLE",
    │                         │    adminId,              │
    │                         │    userId,               │
    │                         │    changes: { role }     │
    │                         │  }                       │
    │                         │                          │
    │<── 200 OK ──────────────┤                          │
    │    {                    │                          │
    │      success: true,     │                          │
    │      user: {            │                          │
    │        id: "123",       │                          │
    │        role: "MANAGER"  │                          │
    │      }                  │                          │
    │    }                    │                          │
```

**Important**: User must log out and log back in for new role to take effect (new JWT token needed).

---

## 🚨 Security Best Practices Implemented

### 1. Password Security
✅ bcrypt hashing with 10 salt rounds
✅ Minimum password length (8 characters)
✅ Never store plain text passwords
✅ Never return password in API responses

### 2. Token Security
✅ JWT stored in HTTP-only cookie (not localStorage)
✅ Secure flag in production (HTTPS only)
✅ SameSite=strict (CSRF protection)
✅ Short expiration (7 days)
✅ Token includes minimal data (no sensitive info)

### 3. API Security
✅ CORS configured for specific origins
✅ Rate limiting on all endpoints
✅ Input validation with Zod
✅ SQL injection prevention (Prisma ORM)
✅ XSS protection (Content Security Policy)

### 4. Authorization Security
✅ Check permissions on every request
✅ Never trust client-side role checks
✅ Middleware validates JWT before role check
✅ Audit log for admin actions

### 5. Error Handling
✅ Generic error messages (don't reveal system details)
✅ Different messages for different scenarios:
   - "Not authenticated" (no token)
   - "Invalid token" (bad token)
   - "Forbidden" (wrong role)

---

## 🎯 Interview Talking Points

### Q: Explain your RBAC implementation

> "We implement hierarchical RBAC with 3 roles: USER, MANAGER, and ADMIN, where higher roles inherit lower role permissions. Authentication uses JWT tokens stored in HTTP-only cookies for XSS protection. Authorization happens through middleware chains - protectRoute validates the JWT, then requireAdmin/requireManager checks the role. Both frontend and backend enforce permissions, but backend is the source of truth. This ensures users can only access authorized resources even if they manipulate the frontend."

### Q: How do you secure JWTs?

> "We follow JWT best practices: tokens are stored in HTTP-only cookies (not localStorage) to prevent XSS attacks, have the secure flag for HTTPS-only transmission, use sameSite=strict for CSRF protection, and expire after 7 days. The token payload contains minimal non-sensitive data - just userId, email, and role. Tokens are signed with a secret key and verified on every protected request."

### Q: What happens if an admin changes a user's role?

> "Role changes are immediate in the database but require the user to re-authenticate for the new JWT token with updated role. We log all role changes to an audit_logs table for compliance. Admins can't delete or demote themselves, preventing accidental lockouts. The change triggers a notification to the affected user's email."

---

**Next**: Read [03_JOB_WORKFLOW.md](03_JOB_WORKFLOW.md) for job processing flow

**Files Referenced**:
- `/src/middleware/protectRoute.ts` - JWT validation
- `/src/middleware/roleMiddleware.ts` - Role checks
- `/src/controllers/authController.ts` - Auth logic
- `/karmayogi-frontend/src/stores/authStore.ts` - Frontend auth state

**Last Updated**: 2025-12-05
