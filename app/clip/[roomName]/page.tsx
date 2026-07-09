'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { getClip, saveClip, getUploadUrl, uploadFileToS3 } from '@/utils/api';

export default function ClipPage() {
  const params = useParams();
  const roomName = params?.roomName as string;

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load clip data on mount
  useEffect(() => {
    async function loadClip() {
      if (!roomName) return;

      try {
        setLoading(true);
        const data = await getClip(roomName);
        if (data) {
          setText(data.text || '');
        }
      } catch (error) {
        console.error('Failed to load clip:', error);
        showMessage('Failed to load clip', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadClip();
  }, [roomName]);

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSave = async () => {
    if (!roomName) return;

    try {
      setSaving(true);
      await saveClip(roomName, text);
      showMessage('Saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save:', error);
      showMessage('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      handleFileUpload(selectedFile);
    }
  };

  const handleFileUpload = async (fileToUpload: File) => {
    if (!roomName) return;

    try {
      setUploading(true);
      
      // Get presigned URL
      const { uploadUrl } = await getUploadUrl(
        roomName,
        fileToUpload.name,
        fileToUpload.type
      );

      // Upload file to S3
      await uploadFileToS3(uploadUrl, fileToUpload);
      
      showMessage('File uploaded successfully!', 'success');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      showMessage('Failed to upload file', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clipboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Cloud Clipboard
          </h1>
          <p className="text-gray-600">
            Room: <span className="font-mono font-semibold text-blue-600">{roomName}</span>
          </p>
        </div>

        {/* Message Toast */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.includes('Failed') 
              ? 'bg-red-100 text-red-700 border border-red-300' 
              : 'bg-green-100 text-green-700 border border-green-300'
          }`}>
            {message}
          </div>
        )}

        {/* Text Editor */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Text Content
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your content here..."
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
            disabled={saving}
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            File Upload
          </label>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {uploading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm">Uploading...</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Files are uploaded directly to S3 and associated with this room.
          </p>
        </div>
      </div>
    </div>
  );
}