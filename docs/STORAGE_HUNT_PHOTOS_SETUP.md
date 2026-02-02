# Hunt Photos Storage Bucket Setup

Success records show **total photos: 0** and the **hunt_photos** table stays empty until the storage bucket exists and uploads succeed.

## 1. Create the bucket

1. In **Supabase Dashboard** go to **Storage**.
2. Click **New bucket**.
3. Name: **`hunt-photos`** (exactly).
4. Choose **Private** (recommended; the app uses signed URLs to display photos).
5. Click **Create bucket**.

## 2. Allow uploads (policy)

The closeout API uses the **service role** to upload, so the bucket must allow the service role to write.

1. Open the **hunt-photos** bucket.
2. Go to **Policies**.
3. Click **New policy** → **For full customization**.
4. Add a policy that allows **INSERT** and **SELECT** (for signed URLs):

- **Policy name:** `Service role can manage hunt photos`
- **Allowed operation:** Check **INSERT** and **SELECT** (and **UPDATE** if you want to allow overwrites).
- **Target roles:** Leave default or use `service_role`.
- **USING expression (for SELECT):** `true`
- **WITH CHECK expression (for INSERT):** `true`

Or use this SQL in **SQL Editor** (adjust if your project uses different auth):

```sql
-- Allow service role to upload and read (for closeout API and signed URLs)
CREATE POLICY "Service role full access hunt-photos"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'hunt-photos')
WITH CHECK (bucket_id = 'hunt-photos');
```

If you use **authenticated** users instead of service role for uploads, create a policy for `authenticated` with the same bucket and operations.

## 3. Verify

1. In the app, add a **manual success entry** (Success Library → Add Manual Entry) and attach at least one photo.
2. Submit the form.
3. In Supabase: **Storage → hunt-photos** should show a new file; **Table Editor → hunt_photos** should show a new row; **Success Library** should show **total photos: 1** and the image.

If upload still fails, the API response will now include the exact error (e.g. "Bucket not found" or "new row violates row-level security").
