# 🚀 Quick Start Guide

## Get Running in 5 Minutes

### 1️⃣ Install Dependencies
```bash
pnpm install
```

### 2️⃣ Configure Environment
Create `.env.local` and add your AWS API Gateway URL:
```env
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.your-region.amazonaws.com/v1
```

### 3️⃣ Start Development Server
```bash
pnpm dev
```

### 4️⃣ Open Browser
Navigate to [http://localhost:3000](http://localhost:3000)

---

## How It Works

### User Flow
1. **Home Page** → Enter room name or create random room
2. **Room Page** → Edit text, save, and upload files
3. **Share** → Share the room URL with others

### Technical Flow
```
Frontend (Next.js)
    ↓
API Gateway (AWS)
    ↓
Lambda Functions
    ↓
DynamoDB (text) + S3 (files)
```

---

## Testing Without Backend

If you don't have the AWS backend deployed yet:

1. The app will show warnings about missing API URL
2. You can still navigate the UI
3. Save/upload actions will fail gracefully with error messages

**Mock the API for testing:**
Update `src/utils/api.ts` to return mock data:
```typescript
export async function getClip(roomName: string): Promise<ClipData | null> {
  // Return mock data for testing
  return {
    roomName,
    text: 'Mock data - backend not connected',
    expiryTimestamp: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
}
```

---

## Next Steps

- [ ] Deploy AWS backend (Lambda, DynamoDB, S3)
- [ ] Get API Gateway URL
- [ ] Update `.env.local`
- [ ] Test locally
- [ ] Deploy to Amplify/Vercel
- [ ] Configure production environment variables

---

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run linter |

---

## Need Help?

- Check the main [README.md](./README.md) for detailed docs
- Review [API specification](./specs/cloudclip-specification.md)
- Open an issue on GitHub
