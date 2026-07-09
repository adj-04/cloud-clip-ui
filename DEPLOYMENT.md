# 🚀 Deployment Guide

## AWS Amplify Deployment

### Prerequisites
- AWS Account
- GitHub repository connected to Amplify
- AWS backend deployed (API Gateway, Lambda, DynamoDB, S3)

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Add AWS backend integration"
git push origin main
```

### Step 2: Connect to AWS Amplify

1. **Go to AWS Amplify Console**
   - Navigate to: https://console.aws.amazon.com/amplify/

2. **Create New App**
   - Click "New app" → "Host web app"
   - Choose "GitHub" as the repository service
   - Authenticate with GitHub
   - Select your repository and branch (main)

3. **Configure Build Settings**
   
   Amplify should auto-detect Next.js. Verify the build settings:
   
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install -g pnpm
           - pnpm install
       build:
         commands:
           - pnpm build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
         - .next/cache/**/*
   ```

4. **Add Environment Variables**
   
   In Amplify Console → App Settings → Environment variables:
   
   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://your-api-id.execute-api.your-region.amazonaws.com/v1` |

5. **Deploy**
   - Click "Save and deploy"
   - Wait for build to complete (~3-5 minutes)
   - Access your app at: `https://main.xxxxx.amplifyapp.com`

### Step 3: Configure Custom Domain (Optional)

1. Go to "Domain management" in Amplify
2. Add your domain (e.g., `cloudclip.com`)
3. Follow DNS configuration steps
4. Wait for SSL certificate provisioning (~15 minutes)

---

## Vercel Deployment

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
cd cloud-clip-ui
vercel
```

Follow the prompts:
- Link to existing project or create new
- Set up project settings
- Deploy

### Step 3: Add Environment Variables
```bash
vercel env add NEXT_PUBLIC_API_URL
```

Paste your API Gateway URL when prompted.

Choose environment: `Production`

### Step 4: Redeploy with Environment Variables
```bash
vercel --prod
```

### Alternative: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure environment variables:
   - `NEXT_PUBLIC_API_URL` = your API Gateway URL
4. Click "Deploy"

---

## Netlify Deployment

### Step 1: Create netlify.toml
```toml
[build]
  command = "pnpm build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "18"
```

### Step 2: Deploy via Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

### Step 3: Add Environment Variables
In Netlify Dashboard:
1. Go to Site settings → Environment variables
2. Add `NEXT_PUBLIC_API_URL` with your API Gateway URL

---

## Docker Deployment

### Step 1: Create Dockerfile
```dockerfile
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### Step 2: Update next.config.ts
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};
```

### Step 3: Build and Run
```bash
# Build image
docker build -t cloud-clip-ui .

# Run container
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://your-api-url.com/v1 cloud-clip-ui
```

---

## Post-Deployment Checklist

- [ ] Verify environment variables are set correctly
- [ ] Test room creation and navigation
- [ ] Test text save functionality
- [ ] Test file upload functionality
- [ ] Check browser console for errors
- [ ] Verify API calls in Network tab
- [ ] Test on mobile devices
- [ ] Verify CORS configuration in API Gateway
- [ ] Check CloudWatch logs for backend errors
- [ ] Monitor S3 bucket for uploaded files
- [ ] Test with different file types and sizes

---

## Monitoring & Debugging

### Frontend Monitoring
- Use Vercel Analytics or AWS CloudWatch RUM
- Monitor Web Vitals (LCP, FID, CLS)
- Track error rates and user flows

### Backend Monitoring
- **CloudWatch Logs**: Lambda execution logs
- **API Gateway Metrics**: Request count, latency, errors
- **DynamoDB Metrics**: Read/write capacity, throttles
- **S3 Metrics**: Storage size, request metrics

### Common Issues

**1. CORS Errors**
- Check API Gateway CORS configuration
- Ensure your domain is whitelisted
- Verify preflight OPTIONS requests

**2. 404 Errors on API**
- Verify API Gateway URL is correct
- Check Lambda function integration
- Ensure API is deployed to correct stage

**3. File Upload Fails**
- Check S3 bucket permissions
- Verify presigned URL generation
- Ensure file size is within limits
- Check bucket CORS configuration

**4. Build Fails**
- Verify Node.js version (18+)
- Check environment variables
- Review build logs for specific errors
- Ensure all dependencies are installed

---

## Scaling Considerations

### Frontend
- Enable CDN caching (Amplify/Vercel have built-in CDN)
- Implement image optimization
- Use React.memo for expensive components
- Add service worker for offline support

### Backend
- Configure DynamoDB auto-scaling
- Implement Lambda reserved concurrency
- Add API Gateway caching
- Set up S3 Transfer Acceleration for large files

### Cost Optimization
- Set up DynamoDB TTL for automatic cleanup
- Configure S3 lifecycle policies
- Use Lambda provisioned concurrency for consistent performance
- Enable API Gateway request throttling

---

## Rollback Procedure

### Amplify
1. Go to Amplify Console
2. Select your app
3. Choose "Deployments"
4. Find previous successful deployment
5. Click "Redeploy this version"

### Vercel
```bash
vercel rollback
```
Or use Vercel Dashboard → Deployments → Previous deployment → Promote to Production

---

## Environment-Specific Configurations

### Development
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/dev
```

### Staging
```env
NEXT_PUBLIC_API_URL=https://staging-api.your-domain.com/v1
```

### Production
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com/v1
```

---

## Support & Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [AWS Amplify Docs](https://docs.amplify.aws/)
- [Vercel Docs](https://vercel.com/docs)
- Project GitHub Issues
