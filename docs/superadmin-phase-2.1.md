# Super Admin Phase 2.1 — File Upload Security (SAR-005)

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **QA report:** `docs/52-super-admin-qa-report.md` (SAR-005, Medium risk)
> **Duration:** ~0.5 day
> **Type:** Security hardening (add validation, scanning, secure paths)

---

## Context

The super admin file upload surface consists primarily of the white-label branding upload (logo + favicon) via `/api/enterprise/branding/upload`. A file validation library exists at `lib/security/file-validation.ts` with magic-byte detection but is **not used** by the branding upload route. Additionally, the `brand-assets` storage bucket has **no migration, no RLS policies, and no bucket-level MIME/size enforcement**.

### What Already Exists

**File Validation Library** (`lib/security/file-validation.ts`):
- Magic-byte detection for JPEG, PNG, WebP, PDF
- `validateAllowedFile()` — checks browser MIME + validates magic bytes
- **Not used** by the branding upload endpoint

**Branding Upload** (`/app/api/enterprise/branding/upload/route.ts`):
- MIME type check (image/png, image/jpeg, image/svg+xml, image/x-icon, image/vnd.microsoft.icon)
- 2MB size limit
- Uploads to `brand-assets` bucket
- No magic-byte validation — relies on browser MIME only (trivially spoofable)
- No filename sanitization — uses `file.name.split(".").pop()` directly (path traversal risk)
- No virus scanning
- No rate limiting

**Storage Buckets**: 5 buckets properly created in migrations (`avatars`, `invoices`, `member-documents`, `trainer-certificates`, `progress-photos`). **3 buckets missing migrations**: `brand-assets`, `attachments`, `hr-documents`.

### What's MISSING

1. **No magic-byte/signature validation** on branding upload — browser MIME is trivially spoofable
2. **No virus/malware scanning** anywhere in the system
3. **No filename sanitization** — extension taken directly from `file.name`
4. **No `brand-assets` bucket migration** — must be created manually; no RLS policies
5. **No server-side image dimension validation** for logos/favicons
6. **No rate limiting** on the upload endpoint
7. **No content-length pre-check** before reading file into memory

---

## Tasks

### Task 1: Add Magic-Byte Validation to Branding Upload

**Current:** `/api/enterprise/branding/upload/route.ts` checks browser MIME type only.

**Required:** Wire `lib/security/file-validation.ts` into the upload route:
- After browser MIME check, call `validateAllowedFile(file, allowedTypes, "Invalid file signature")`
- Add `image/svg+xml` magic-byte detection to `file-validation.ts` if not present (SVG starts with `<?xml` or `<svg`)
- Return 400 with proper error message on signature mismatch

**File to modify:**
- `app/api/enterprise/branding/upload/route.ts` — call `validateAllowedFile`
- `lib/security/file-validation.ts` — add SVG magic-byte detection if missing

---

### Task 2: Add Filename Sanitization

**Current:** Line `const ext = file.name.split(".").pop()?.toLowerCase()` takes extension directly from user-supplied filename — path traversal risk (`../../etc/passwd.png`).

**Required:**
1. Create `sanitizeFilename(filename: string): string` in `lib/security/sanitize.ts`:
   - Strip all non-alphanumeric characters except `-`, `_`, `.`
   - Remove leading dots
   - Truncate to 64 chars max
   - Return sanitized base name
2. In the branding upload route, use `sanitizeFilename(file.name)` instead of `file.name`
3. Similarly fix the extension extraction: use `path.extname(sanitizedName)` or last-dot-split on sanitized name

**Files to modify:**
- `lib/security/sanitize.ts` — add `sanitizeFilename()`
- `app/api/enterprise/branding/upload/route.ts` — use sanitized filename
- Apply same fix to other upload endpoints: `/api/hr/documents`, `/api/support/attachments`

---

### Task 3: Add Image Dimension Validation

**Required:** Add server-side dimension validation for logo and favicon uploads:
- Logo: max 512×512px (enforce min 64×64)
- Favicon: max 256×256px, must be square (enforce min 16×16)
- Use `sharp` (already in dependencies) or native `Buffer` parsing to read dimensions
- Return 400 with proper error message on dimension violation

**File to modify:**
- `app/api/enterprise/branding/upload/route.ts` — add dimension check before upload

---

### Task 4: Add Rate Limiting to Upload Endpoint

**Current:** No rate limiting on `/api/enterprise/branding/upload`.

**Required:** Wire `lib/rate-limit.ts` (exists in the codebase):
- Rate limit: 10 uploads per 60 seconds per IP
- Return 429 with retry-after header on limit exceeded

**File to modify:**
- `app/api/enterprise/branding/upload/route.ts` — add `checkRateLimit` before processing

---

### Task 5: Create `brand-assets` Bucket Migration

**Current:** The `brand-assets` bucket is created manually — no migration, no RLS, no MIME/size constraints.

**Required:** Create migration `supabase/migrations/YYYYMMDD_create_brand_assets_bucket.sql`:
- Create `brand-assets` storage bucket
- Set public: false
- Set file size limit: 2MB
- Set allowed MIME types: `image/png`, `image/jpeg`, `image/svg+xml`, `image/x-icon`, `image/vnd.microsoft.icon`
- Add RLS policy: super_admin full access, authenticated read
- Add RLS policy: INSERT for authenticated users with `is_super_admin()` check

**File to create:**
- `supabase/migrations/YYYYMMDD_create_brand_assets_bucket.sql`

---

### Task 6: Add Content-Length Pre-Check

**Current:** The upload route does `Buffer.from(await file.arrayBuffer())` — reads the entire file into memory before checking anything.

**Required:** Add a content-length check BEFORE reading the file:
- Check `request.headers.get("content-length")` or iterate `file.stream()` with a byte counter
- Return 413 if content exceeds 2MB before fully reading
- This prevents memory exhaustion attacks

**File to modify:**
- `app/api/enterprise/branding/upload/route.ts` — add stream-based size check

---

### Task 7: UI Polish — Upload Progress & Preview

**Required:**
1. In `FileUploadZone.tsx` (used by super admin white-label dashboard):
   - Add upload progress bar (percentage) during upload
   - Show image preview after upload completes
   - Add "Remove" button to clear uploaded logo/favicon
   - Add error state display with retry button
   - Show dimension info after upload (e.g., "Logo: 120×120px")

**Files to modify:**
- `features/enterprise/components/FileUploadZone.tsx` — add progress, preview, remove, error states

---

## Verification Checklist

- [ ] Uploading a file with wrong magic bytes (e.g., rename `.exe` to `.png`) is rejected with 400
- [ ] Uploading a file with path traversal in filename (`../../etc/passwd.png`) is sanitized
- [ ] Uploading an overlarge logo (>512×512px) is rejected with dimension error
- [ ] Uploading a non-square favicon is rejected
- [ ] Exceeding 10 uploads/minute gets 429 rate limit response
- [ ] `brand-assets` bucket has migration, RLS, and MIME/size enforcement
- [ ] uploads >2MB are rejected BEFORE reading into memory
- [ ] UI shows upload progress, preview, remove, and error states
- [ ] All existing uploads continue to work (no regression)
- [ ] `npm run typecheck` passes
