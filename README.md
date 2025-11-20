# Ararat Design - Frontend Deployment

This folder contains all files needed to deploy the main website to **araratdesign.org** on Vercel.

## Structure

- `*.html` - All frontend HTML pages
- `images/` - Frontend-specific images
- `assets/` - Shared assets (CSS, JS, fonts, etc.)
- `vercel.json` - Vercel configuration

## Deployment

See the main [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for detailed instructions.

### Quick Deploy

1. Deploy via Vercel Dashboard or CLI
2. Set custom domain: `araratdesign.org`
3. Configure DNS as per Vercel's instructions

## Important Notes

- Asset paths have been updated for deployment (changed from `../assets/` to `./assets/`)
- All original files in `front-end/` and `assets/` remain untouched
- This is a static site - no build process required
