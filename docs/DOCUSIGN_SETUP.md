# DocuSign setup for hunt contracts

The app uses DocuSign JWT (OAuth 2.0 JWT) to send hunt contracts and get embedded signing URLs. Without these env vars set, you’ll see **“DocuSign not configured”** when sending a contract to DocuSign.

## Required environment variables

Add these to `.env.local` (or your deployment env):

| Variable | Description |
|----------|-------------|
| `DOCUSIGN_INTEGRATION_KEY` | Integration Key (Client ID) from DocuSign Admin |
| `DOCUSIGN_ACCOUNT_ID` | Your DocuSign account ID (GUID) |
| `DOCUSIGN_USER_ID` | User GUID of the DocuSign user who will “send” envelopes (API user) |
| `DOCUSIGN_PRIVATE_KEY` | RSA private key (PEM) for the app – DocuSign uses this to verify JWT |

Optional:

| Variable | Description |
|----------|-------------|
| `DOCUSIGN_BASE_URL` | API base URL. Omit for **demo** (default: `https://demo.docusign.net/restapi`). Use `https://www.docusign.net/restapi` for **production**. |

## How to get the values

1. **DocuSign account**  
   Use a [DocuSign Developer](https://developers.docusign.com/) account for testing, or your production account.

2. **Go to Admin**  
   DocuSign Admin → **Apps and Keys** (or **Settings** → **API and Keys**).

3. **Integration Key (Client ID)**  
   - Add an application or use an existing one.  
   - Copy the **Integration Key** → set as `DOCUSIGN_INTEGRATION_KEY`.

4. **RSA keypair**  
   - In the same app, under **Service Integration**, create an **RSA keypair**.  
   - Download or copy the **private key** (PEM, including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`).  
   - Put the full PEM into `DOCUSIGN_PRIVATE_KEY`.  
   - If the key has newlines, you can keep them or replace with `\n` in the env value.

5. **User ID (GUID)**  
   - In DocuSign: **Settings** → **API and Keys** (or **My Preferences** → **API and Keys**).  
   - Find **User ID** (a GUID).  
   - Set as `DOCUSIGN_USER_ID`.

6. **Account ID**  
   - Same page often shows **Account ID**, or take it from the account URL in the DocuSign UI.  
   - Set as `DOCUSIGN_ACCOUNT_ID`.

7. **Consent (one-time)**  
   - For JWT, DocuSign requires one-time consent for the Integration Key + User.  
   - Use the consent URL DocuSign shows in Apps and Keys (e.g. `https://account-d.docusign.com/oauth/auth?response_type=code&scope=...`).  
   - Log in as the same user whose GUID you used for `DOCUSIGN_USER_ID` and accept.

## Example `.env.local` (minimal)

```bash
DOCUSIGN_INTEGRATION_KEY=your-integration-key-guid
DOCUSIGN_ACCOUNT_ID=your-account-id-guid
DOCUSIGN_USER_ID=your-user-id-guid
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"
```

For **production**, add:

```bash
DOCUSIGN_BASE_URL=https://www.docusign.net/restapi
```

Restart the Next.js dev server (or redeploy) after changing env vars.
