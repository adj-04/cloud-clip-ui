# Cloud Clipboard UI

A modern, anonymous clipboard application with AWS backend integration for text and file sharing across devices.

## 🚀 Features

- **Text & File Sharing**: Share text notes and upload files to S3
- **Room-based Access**: Each room has a unique URL for collaboration
- **AWS Backend**: Integrated with API Gateway, Lambda, DynamoDB, and S3
- **Auto-Expiry**: Clips automatically expire after 7 days (configurable)
- **Direct S3 Upload**: Files upload directly to S3 using presigned URLs
- **Responsive Design**: Mobile-first with modern UI
- **Real-time Feedback**: Loading states, success toasts, and error handling

## 🏗️ Architecture

### Frontend (Next.js + TypeScript)
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks

### Backend (AWS)
- **API Gateway**: REST API endpoints
- **Lambda Functions**: Serverless compute
- **DynamoDB**: NoSQL database for text storage with TTL
- **S3**: Object storage for file uploads
- **EventBridge**: Scheduled cleanup of expired clips

## 📁 Project Structure

```
cloud-clip-ui/
├── app/
│   ├── page.tsx                    # Landing page with room input
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   └── clip/
│       └── [roomName]/
│           └── page.tsx            # Room page with text editor & file upload
├── src/
│   └── utils/
│       └── api.ts                  # API utility functions
├── components/
├── .env.local                      # Environment variables (not committed)
├── .env.example                    # Environment variables template
├── next.config.ts                  # Next.js configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies
```

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- AWS account with deployed backend (API Gateway URL)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cloud-clip-ui
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your AWS API Gateway URL:
   ```env
   NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.your-region.amazonaws.com/v1
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 API Integration

### Endpoints

The frontend integrates with the following AWS backend endpoints:

#### 1. **GET /clip/{roomName}**
Fetch existing clip data for a room.

**Response:**
```json
{
  "roomName": "test-room",
  "text": "Existing note...",
  "expiryTimestamp": 1731517761
}
```

#### 2. **POST /clip/{roomName}**
Save or update text for a room.

**Request:**
```json
{
  "text": "User typed content..."
}
```

**Response:**
```json
{
  "message": "Clip updated successfully"
}
```

#### 3. **POST /clip/{roomName}/upload-url**
Get presigned S3 URL for file upload.

**Request:**
```json
{
  "fileName": "document.pdf",
  "fileType": "application/pdf"
}
```

**Response:**
```json
{
  "uploadUrl": "https://cloudclip-bucket.s3.amazonaws.com/...",
  "key": "roomName/123_document.pdf"
}
```

#### 4. **PUT {uploadUrl}**
Upload file directly to S3 (no AWS credentials needed).

**Headers:**
- `Content-Type`: file MIME type

**Body:** Raw file binary

## 🚢 Deployment

### Deploy to AWS Amplify

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "AWS backend integration"
   git push origin main
   ```

2. **Configure Amplify**
   - Connect your GitHub repository to AWS Amplify
   - Add environment variable in Amplify Console:
     ```
     NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.your-region.amazonaws.com/v1
     ```

3. **Auto-deploy**
   - Amplify will automatically build and deploy on every push to main

### Deploy to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Add environment variable**
   ```bash
   vercel env add NEXT_PUBLIC_API_URL production
   ```

## 🧪 Testing

### Local Testing

1. Ensure backend is deployed and API URL is configured
2. Run development server: `pnpm dev`
3. Test the following:
   - [ ] Landing page loads and allows room creation
   - [ ] Navigate to `/clip/test-room`
   - [ ] Text can be saved and retrieved
   - [ ] Files can be uploaded (check S3 bucket)
   - [ ] Loading states appear during operations
   - [ ] Success/error messages display correctly
   - [ ] Handle 404 for non-existent rooms gracefully

### Production Testing

1. Deploy to staging environment
2. Verify CORS is configured correctly in API Gateway
3. Test with different file types and sizes
4. Check S3 bucket for uploaded files
5. Verify DynamoDB for text storage and TTL

## 🔐 Security Notes

- **No Authentication**: Public clipboard (by design)
- **CORS**: Backend should allow origins from your domain
- **Presigned URLs**: S3 uploads use time-limited presigned URLs
- **TTL**: Clips auto-expire after 7 days
- **Rate Limiting**: Consider adding rate limiting to prevent abuse

## 📝 Usage

### Creating a Room

1. Visit the home page
2. Enter a custom room name OR click "Create Random Room"
3. Share the room URL with others

### Using a Room

1. **Text Notes**:
   - Type or paste content in the text area
   - Click "Save" to persist to DynamoDB
   - Text is automatically loaded on page refresh

2. **File Upload**:
   - Click "Choose File" and select a file
   - Upload starts automatically
   - File is stored in S3 under the room namespace

## 🛠️ Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### API Functions

All API interactions are centralized in `src/utils/api.ts`:

- `getClip(roomName)` - Fetch clip data
- `saveClip(roomName, text)` - Save text
- `getUploadUrl(roomName, fileName, fileType)` - Get presigned URL
- `uploadFileToS3(uploadUrl, file)` - Upload file to S3

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[Add your license here]

## 🆘 Troubleshooting

### API URL not found
- Ensure `.env.local` exists and contains `NEXT_PUBLIC_API_URL`
- Restart the dev server after changing environment variables

### CORS errors
- Check API Gateway CORS configuration
- Ensure your domain is whitelisted in backend

### File upload fails
- Verify S3 bucket permissions
- Check presigned URL expiration time
- Ensure file size is within limits

### Build fails on Amplify
- Verify environment variables are set in Amplify Console
- Check build logs for specific errors
- Ensure Node.js version matches (18+)

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review AWS CloudWatch logs for backend errors
</content>
