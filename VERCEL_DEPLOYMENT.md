# Vercel Deployment Guide for ararat-user

## Current Setup

The `ararat-user` project is a **static HTML/CSS/JS website**. The CSS files are already compiled from SCSS, so no build process is required.

## Build Command for Vercel

Since this is a static site with pre-compiled assets, you have two options:

### Option 1: No Build Command (Recommended)
**Build Command**: (leave empty)

This is the simplest approach since all files are already ready to deploy.

### Option 2: Echo Command (if Vercel requires a build command)
**Build Command**: `echo "No build required - static site"`

### Option 3: If You Want to Recompile SCSS (Optional)

If you want to set up a build process to recompile SCSS files, you would need:

1. **Create `package.json`**:
```json
{
  "name": "ararat-user",
  "version": "1.0.0",
  "scripts": {
    "build": "echo 'No build required'"
  }
}
```

2. **Build Command**: `npm run build` or leave empty

## Vercel Configuration

The project already has a `vercel.json` configured for static site deployment:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "**/*.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*\\.(css|js|jpg|jpeg|png|gif|svg|woff|woff2|ttf|eot|ico|mp4|pdf))",
      "headers": {
        "cache-control": "public, max-age=31536000, immutable"
      }
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "trailingSlash": false
}
```

## Recommended Settings in Vercel Dashboard

1. **Framework Preset**: Other
2. **Root Directory**: `ararat-user` (if deploying from monorepo) or leave empty (if deploying the folder directly)
3. **Build Command**: (leave empty) or `echo "No build required"`
4. **Output Directory**: (leave empty - Vercel will serve from root)
5. **Install Command**: (leave empty - no dependencies to install)

## Deployment Steps

1. Go to Vercel Dashboard
2. Click "New Project"
3. Import your repository
4. Configure:
   - **Root Directory**: `ararat-user` (if in monorepo)
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)
5. Click "Deploy"

## Notes

- All CSS files are already compiled, so no SCSS compilation is needed
- All JavaScript files are already minified/ready
- The site will be served as static files
- No Node.js dependencies are required

