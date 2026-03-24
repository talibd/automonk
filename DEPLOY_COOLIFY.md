# Coolify Deployment

Use `docker-compose.coolify.yml` as the deployment file in Coolify.

## Steps

1. Push this repository to GitHub or GitLab.
2. In Coolify, create a new `Application`.
3. Choose `Docker Compose`.
4. Connect the repository.
5. Set the compose file to `docker-compose.coolify.yml`.
6. Add a domain to the `app` service.
7. Set the public port for `app` to `3000`.
8. Add all required environment variables from `coolify.env.example`.
9. Deploy.

## Notes

- The `app` image now builds the dashboard during deployment, so `dashboard/dist` does not need to be committed.
- `worker`, `bot`, `postgres`, `redis`, and `minio` stay internal to the stack.
- Set `APP_URL` to your real Coolify domain, for example `https://automonk.example.com`.
- Update OAuth callback URLs after deploy:
  - `https://your-domain.com/auth/instagram/callback`
- Rotate any secrets that were previously stored in local `.env` files.
