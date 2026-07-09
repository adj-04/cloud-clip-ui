'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const [roomName, setRoomName] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim()) {
      router.push(`/clip/${encodeURIComponent(roomName.trim())}`);
    }
  };

  const handleRandomRoom = () => {
    const randomName = `room-${Math.random().toString(36).substring(2, 8)}`;
    router.push(`/clip/${randomName}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              ☁️ Cloud Clipboard
            </h1>
            <p className="text-gray-600">
              Share text and files across devices
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-2">
                Enter Room Name
              </label>
              <input
                type="text"
                id="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="my-shared-clipboard"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Enter Room
            </button>
          </form>

          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <button
              onClick={handleRandomRoom}
              className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition-colors"
            >
              Create Random Room
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>💡 Share the room name with others to collaborate</p>
            <p className="mt-1">🔒 No authentication required</p>
          </div>
        </div>
      </div>
    </div>
  );
}
