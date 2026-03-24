# Meta Business Login Setup for AutoMonk

This project now connects Instagram through Instagram Business Login using the routes already built into the app. It does not use the older Facebook Page lookup flow for Instagram anymore.

---

## What This Repo Expects

Instagram connection in AutoMonk uses:

- Start route: `/auth/instagram/start`
- Callback route: `/auth/instagram/callback`
- Auth code exchange: `https://api.instagram.com/oauth/access_token`
- Long-lived token exchange: `https://graph.instagram.com/access_token`
- Profile lookup: `https://graph.instagram.com/v21.0/me`

Facebook and Threads still use the separate Meta flow at `/auth/meta/*`.

---

## Meta Dashboard Setup

### 1. Create the correct app

1. Go to `https://developers.facebook.com/`
2. Create a new app
3. Choose the Business app type
4. Add the Instagram product

### 2. Configure Instagram Login

In Meta Developer Dashboard:

1. Open `Instagram -> API setup with Instagram login`
2. Open the Business Login setup
3. Add this redirect URI exactly:

```text
https://YOUR_PUBLIC_APP_URL/auth/instagram/callback
```

4. Save the configuration
5. Copy the Instagram App ID and Instagram App Secret from the Instagram setup screen

Use the Instagram-specific credentials for this flow. Do not assume the Facebook app credentials are the same.

### 3. Required permissions

For AutoMonk's current implementation, enable:

- `instagram_business_basic`
- `instagram_business_content_publish`

If you later add DMs or comments features, request those scopes separately.

### 4. Development vs live

While the app is in Development mode:

- only test users/testers can connect
- the Instagram account must be added appropriately in Meta app roles/testing

Before real client use:

- add Privacy Policy URL
- add app icon
- switch the app to Live
- submit app review for any scopes you need beyond development access

---

## Environment Variables

Set these in `.env`:

```env
APP_URL=https://YOUR_PUBLIC_APP_URL
IG_APP_ID=your_instagram_app_id
IG_APP_SECRET=your_instagram_app_secret
```

Notes:

- `APP_URL` must be the public base URL of this app, not localhost unless you are tunneling it.
- The effective callback becomes `${APP_URL}/auth/instagram/callback`.
- `META_APP_ID` and `META_APP_SECRET` are still used for Facebook and Threads, not for the new Instagram Business Login path.

---

## AutoMonk Flow

### Operator flow

When an operator connects Instagram from Telegram or the dashboard, AutoMonk generates a URL like:

```text
https://YOUR_PUBLIC_APP_URL/auth/instagram/start?state=...
```

That route:

1. redirects the user to Instagram authorization
2. receives the auth code on `/auth/instagram/callback`
3. exchanges the code for a short-lived token
4. exchanges that for a long-lived token
5. fetches the Instagram profile from `/me`
6. stores the connected Instagram account in `platform_accounts`

### Stored values

The app saves:

- `platform = instagram`
- `account_id = Instagram professional account ID`
- `access_token = long-lived Instagram token`
- `token_expiry = long-lived token expiry when available`

Relevant files:

- `src/routes/oauth.js`
- `src/routes/clients.js`
- `src/bot/commands/connect.js`
- `src/adapters/instagram.js`

---

## Local Testing

If you are testing locally, expose the app over HTTPS with a tunnel such as ngrok and use that public URL for:

- `APP_URL`
- the Meta redirect URI

Example:

```env
APP_URL=https://abc123.ngrok-free.app
```

Redirect URI:

```text
https://abc123.ngrok-free.app/auth/instagram/callback
```

The redirect URI must match exactly.

---

## Manual Token Fallback

This repo still supports the manual token connect page for Instagram in `src/routes/tokenConnect.js`.

If used, the token is validated against:

```text
https://graph.instagram.com/v21.0/me
```

That means the manual token must already be a valid Instagram professional-account token for the target account.

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `Invalid redirect_uri` | Callback in Meta does not exactly match AutoMonk callback | Set it to `https://YOUR_PUBLIC_APP_URL/auth/instagram/callback` with exact scheme, host, path, and slash behavior |
| `This app is not currently accessible` | App is still in Development or user is not an allowed tester | Add tester access or move the app to Live after completing required fields |
| `Missing code or state` | Expired or malformed OAuth link | Start the flow again from AutoMonk |
| `Connection failed` after callback | Wrong `IG_APP_ID` / `IG_APP_SECRET`, expired code, or incorrect app setup | Recheck env vars and Meta Instagram Login setup |
| No account resolved | The Instagram account is not a professional account | Switch the account to Business or Creator |

---

## Quick Checklist

1. Set `APP_URL` to a public HTTPS URL.
2. Set `IG_APP_ID` and `IG_APP_SECRET` in `.env`.
3. In Meta, configure redirect URI as `https://YOUR_PUBLIC_APP_URL/auth/instagram/callback`.
4. Enable `instagram_business_basic` and `instagram_business_content_publish`.
5. Restart the app.
6. Run the Instagram connect flow from AutoMonk.
