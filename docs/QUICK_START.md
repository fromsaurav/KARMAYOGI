# Quick Start Guide - KarmaYogi

## 🚀 Start Servers

```bash
# Terminal 1: Backend
cd /home/saurav/Saurav/Projects/KarmaYogi
npm run dev

# Terminal 2: Frontend
cd /home/saurav/Saurav/Projects/KarmaYogi/karmayogi-frontend
npm run dev
```

**URLs**:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

---

## ✅ Test Job Workflow (2 minutes)

1. **Login** to http://localhost:3001
2. **Click** "Submit Job"
3. **Select** "Email Task"
4. **Set** priority to 5
5. **Click** "Submit Job"
6. **Result**: Job appears in "My Jobs" ✅

---

## 🔍 Debug Tools

### Role Debug Widget
- **Location**: Bottom-right corner (dev mode)
- **Shows**: Role, email, auth status

### Browser Console
- **Open**: F12 → Console tab
- **Look for**: `📊 [Dashboard] User role: ...`

### Network Tab
- **Open**: F12 → Network tab
- **Check**: POST /api/jobs response
- **Verify**: `response.data.job` has `data` field (not `payload`)

---

## 📋 Quick Checklist

### Job Workflow
- [ ] Submit job succeeds
- [ ] Job appears in "My Jobs"
- [ ] Job type displays correctly
- [ ] Status badge shows right color
- [ ] Job details modal works

### RBAC
- [ ] USER sees personal dashboard
- [ ] MANAGER sees team dashboard
- [ ] ADMIN sees admin dashboard
- [ ] Navigation filters by role
- [ ] Role badge displays

---

## 🐛 Quick Fixes

### Jobs don't appear?
```javascript
// Clear cache (browser console)
localStorage.clear();
location.reload();
```

### Role not working?
1. Check Role Debug Widget
2. Logout → Login again
3. Verify JWT at https://jwt.io

### Backend errors?
```bash
# Restart backend
cd /home/saurav/Saurav/Projects/KarmaYogi
npm run dev
```

---

## 📚 Full Documentation

- **[COMPLETE_FIX_SUMMARY.md](COMPLETE_FIX_SUMMARY.md)** - All fixes explained
- **[JOB_WORKFLOW_FIX.md](JOB_WORKFLOW_FIX.md)** - Job workflow details
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Complete testing guide
- **[RBAC_FIX_SUMMARY.md](RBAC_FIX_SUMMARY.md)** - RBAC technical details

---

## ✨ What's Fixed

1. ✅ Job submission works
2. ✅ Jobs appear in "My Jobs"
3. ✅ Role-based dashboards
4. ✅ Auto-refresh every 5 seconds
5. ✅ Filter/search functionality
6. ✅ Debug tools available

**Everything should work now!** 🎉