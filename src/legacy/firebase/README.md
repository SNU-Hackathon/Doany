# 🚫 Legacy Firebase Code - DEPRECATED

**Date Deprecated**: 2025-10-09  
**Reason**: Migrated to REST API v1.3  
**New Location**: `src/api/*`, `src/hooks/*`, `src/state/*`

---

## ⚠️ DO NOT USE THESE FILES

All Firebase code has been replaced with REST API endpoints. These files are kept temporarily for reference only and will be deleted once the migration is verified stable.

## 🔄 Migration Mapping

| Old (Firebase) | New (REST API) |
|----------------|----------------|
| `services/firebase.ts` | `lib/http.ts`, `config/api.ts` |
| `services/auth.ts` | `api/auth.ts`, `state/auth.store.ts` |
| `services/goalService.ts` | `api/goals.ts`, `hooks/useGoals.ts` |
| `services/feedService.ts` | `api/feed.ts`, `hooks/useFeed.ts` |
| `services/questService.ts` | `api/goals.ts` (quest endpoints) |
| `hooks/useAuth.tsx` | `state/auth.store.ts` |
| `types/firestore.ts` | `api/types.ts` |

## 📚 Documentation

See `README-API.md` for complete REST API usage guide.

---

**These files will be permanently deleted after migration verification (~1-2 weeks).**

