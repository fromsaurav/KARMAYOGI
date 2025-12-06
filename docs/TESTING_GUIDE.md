# Testing Guide: RBAC & Job Submission

## 🔧 Issues Fixed

### 1. Job Submission Error ✅
**Problem**: "Internal server error while submitting job"

**Root Cause**:
- Backend expects `payload` field, frontend was sending `data`
- Backend expects priority as `HIGH/MEDIUM/LOW`, frontend was sending numbers (1-10)

**Solution**: Updated `karmayogi-frontend/src/lib/api.ts` `submitJob()` method to:
- Map `data` → `payload`
- Convert priority: 7-10 → HIGH, 4-6 → MEDIUM, 1-3 → LOW

### 2. Role Differentiation Not Working
**Debugging Steps Added**:
- Added `RoleDebug` component (bottom-right corner in dev mode)
- Added console logging to dashboard
- Fixed middleware JWT decoding (removed dependency on `jsonwebtoken` library)

---

## 🧪 Testing Instructions

### Step 1: Create Test Users

1. **Create USER role account**
   ```
   Name: Test User
   Username: testuser
   Email: user@test.com
   Password: password123
   Role: USER
   ```

2. **Create MANAGER role account**
   ```
   Name: Test Manager
   Username: testmanager
   Email: manager@test.com
   Password: password123
   Role: MANAGER
   ```

3. **Create ADMIN role account**
   ```
   Name: Test Admin
   Username: testadmin
   Email: admin@test.com
   Password: password123
   Role: ADMIN
   ```

### Step 2: Test USER Role

**Login as**: `user@test.com` / `password123`

**Expected Navigation Items**:
- ✅ Dashboard
- ✅ Submit Job
- ✅ My Jobs
- ✅ Settings
- ❌ Team Analytics (should NOT appear)
- ❌ Team Management (should NOT appear)
- ❌ System Health (should NOT appear)

**Expected Dashboard**:
- Title: "My Tasks Dashboard"
- Shows: Personal job statistics (My Active Jobs, Completed, Failed, In Queue)
- Shows: My Recent Jobs (only your jobs)
- Shows: Quick Actions (Submit New Job, View All My Jobs)

**Test Job Submission**:
1. Click "Submit Job"
2. Select any job type (e.g., "Email Task")
3. Set priority (1-10)
4. Click "Submit Job"
5. **Expected**: Job submits successfully, redirects to /jobs

**Test Restricted Access**:
1. Try to manually navigate to `/analytics`
   - **Expected**: Redirected to `/dashboard`
2. Try to manually navigate to `/team`
   - **Expected**: Redirected to `/dashboard`

### Step 3: Test MANAGER Role

**Login as**: `manager@test.com` / `password123`

**Expected Navigation Items**:
- ✅ Dashboard
- ✅ Submit Job
- ✅ My Jobs
- ✅ Team Analytics
- ✅ Team Management
- ✅ Settings
- ❌ System Health (should NOT appear)
- ❌ User Management (should NOT appear)

**Expected Dashboard**:
- Title: "Team Management Dashboard"
- Shows: Team overview stats (Team Members, Active Team Jobs, Completion Rate, Pending Reviews)
- Shows: System Performance (Total Active Jobs, Completed Today, Failed Jobs, Queue Length)
- Shows: Team Status (list of team members with performance)
- Shows: Recent Team Activity (team jobs)

**Test Manager-Only Features**:
1. Click "Team Management" in sidebar
   - **Expected**: Shows team management page with member table
2. Click "Team Analytics" in sidebar
   - **Expected**: Shows analytics page
3. Try to manually navigate to `/health`
   - **Expected**: Redirected to `/dashboard` (admin only)

**Test Job Submission**:
1. Submit a job (same as USER test)
2. **Expected**: Should work successfully

### Step 4: Test ADMIN Role

**Login as**: `admin@test.com` / `password123`

**Expected Navigation Items**:
- ✅ Dashboard
- ✅ Submit Job
- ✅ My Jobs
- ✅ Team Analytics
- ✅ Team Management
- ✅ System Health
- ✅ User Management
- ✅ Settings

**Expected Dashboard**:
- Title: "System Administration"
- Shows: System overview (Total Users, Managers, System Uptime, Critical Alerts)
- Shows: System Performance (Active/Completed/Failed Jobs, Queue Length)
- Shows: Worker Status (Total/Active/Idle Workers, Error Rate)
- Shows: System Alerts (list of alerts)
- Shows: Quick Admin Actions

**Test Admin-Only Features**:
1. Click "System Health" in sidebar
   - **Expected**: Shows system health page
2. Click "User Management" in sidebar
   - **Expected**: Shows user management page
3. Access all manager features (Team Management, Analytics)
   - **Expected**: Full access

**Test Job Submission**:
1. Submit a job (same as previous tests)
2. **Expected**: Should work successfully

---

## 🐛 Debugging

### Check Role in Browser Console

1. Open browser DevTools (F12)
2. Look for console logs:
   ```
   📊 [Dashboard] User loaded: {...}
   📊 [Dashboard] User role: USER/MANAGER/ADMIN
   ```

### Check Role Debug Widget

In development mode, you should see a black debug box in the bottom-right corner showing:
- User name
- Email
- Role
- Role type

### Check Browser Cookies

1. Open DevTools → Application tab → Cookies
2. Find cookie named `jwt`
3. Copy the value
4. Go to [jwt.io](https://jwt.io)
5. Paste the token
6. Check the payload - should contain:
   ```json
   {
     "userId": "...",
     "email": "...",
     "role": "USER" | "MANAGER" | "ADMIN"
   }
   ```

---

## 🔍 Common Issues & Solutions

### Issue: Same dashboard for all roles

**Possible Causes**:
1. Role not in JWT token
2. Frontend not reading role correctly
3. Cache not cleared

**Solutions**:
1. Check JWT payload (see debugging section)
2. Clear browser cookies and localStorage:
   ```javascript
   // In browser console
   localStorage.clear();
   document.cookie.split(";").forEach(c => {
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   ```
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Job submission fails

**Error**: "Internal server error while submitting job"

**Solution**:
1. Check backend logs for detailed error
2. Verify backend is running
3. Check priority value is between 1-10
4. Verify job data is valid JSON

### Issue: Navigation items not filtering

**Possible Causes**:
1. User object not loaded
2. Role not properly set

**Solutions**:
1. Check RoleDebug widget
2. Verify user object has `role` field
3. Logout and login again

---

## ✅ Success Criteria

**USER Role**:
- [ ] Sees personal dashboard
- [ ] Cannot access /analytics, /team, /health
- [ ] Navigation shows only: Dashboard, Submit Job, My Jobs, Settings
- [ ] Can submit jobs successfully
- [ ] Shows blue "User" badge

**MANAGER Role**:
- [ ] Sees team management dashboard
- [ ] Can access /analytics and /team
- [ ] Cannot access /health
- [ ] Navigation shows: Dashboard, Submit Job, My Jobs, Team Analytics, Team Management, Settings
- [ ] Can submit jobs successfully
- [ ] Shows purple "Manager" badge

**ADMIN Role**:
- [ ] Sees system administration dashboard
- [ ] Can access all pages (/analytics, /team, /health)
- [ ] Navigation shows all items
- [ ] Can submit jobs successfully
- [ ] Shows yellow "Admin" badge

---

## 📝 Backend Commands

### Start Backend Server
```bash
cd /home/saurav/Saurav/Projects/KarmaYogi
npm run dev
```

### Start Frontend Server
```bash
cd /home/saurav/Saurav/Projects/KarmaYogi/karmayogi-frontend
npm run dev
```

### Check Backend Logs
```bash
# Backend runs on http://localhost:3000
# Frontend runs on http://localhost:3001
```

---

## 🔄 Reset Test Data

If you need to start fresh:

1. **Clear Database** (if using SQLite):
   ```bash
   cd /home/saurav/Saurav/Projects/KarmaYogi
   rm prisma/dev.db
   npx prisma migrate reset
   ```

2. **Clear Frontend Cache**:
   - Browser: Clear cookies, localStorage
   - Or use incognito/private browsing mode

3. **Restart Both Servers**