const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  console.warn('NEXT_PUBLIC_API_URL is not set');
}

export interface ClipData {
  roomName: string;
  text: string;
  expiryTimestamp: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

/**
 * Fetch clip data for a given room
 */
export async function getClip(roomName: string): Promise<ClipData | null> {
  try {
    const response = await fetch(`${API_URL}/clip/${encodeURIComponent(roomName)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return null; // Room doesn't exist yet
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch clip: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching clip:', error);
    throw error;
  }
}

/**
 * Save or update text for a given room
 */
export async function saveClip(roomName: string, text: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/clip/${encodeURIComponent(roomName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save clip: ${response.statusText}`);
    }

    await response.json();
  } catch (error) {
    console.error('Error saving clip:', error);
    throw error;
  }
}

/**
 * Get presigned URL for file upload
 */
export async function getUploadUrl(
  roomName: string,
  fileName: string,
  fileType: string
): Promise<UploadUrlResponse> {
  try {
    const response = await fetch(`${API_URL}/clip/${encodeURIComponent(roomName)}/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName, fileType }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload URL: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting upload URL:', error);
    throw error;
  }
}

/**
 * Upload file directly to S3 using presigned URL
 */
export async function uploadFileToS3(uploadUrl: string, file: File): Promise<void> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
}