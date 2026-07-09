"use client"

import { useState, useEffect, useRef } from "react"

/**
 * CloudClip UI Component
 *
 * A minimal, modern anonymous clipboard UI with room-based sharing.
 *
 * Backend Integration Notes:
 * - Replace placeholder API functions with real endpoints
 * - Use DynamoDB for text storage with 7-day TTL
 * - Use S3 with 5-day lifecycle for file storage
 * - Replace polling with WebSocket/AppSync for real-time updates
 * - Implement pre-signed URLs for file uploads
 *
 * Expected API Endpoints:
 * - GET /api/rooms/:room - fetch room data
 * - POST /api/rooms/:room/text - post text content
 * - POST /api/rooms/:room/files - upload file
 * - DELETE /api/rooms/:room/:id - delete after view
 */

// Design Tokens
const tokens = {
  light: {
    background: "#FFFFFF",
    pageBg: "#F8FAFC",
    cardBg: "#FFFFFF",
    textPrimary: "#0F172A",
    textMuted: "#64748B",
    accent: "#0EA5E9",
    accentDark: "#0369A1",
    shadow: "0 6px 20px rgba(2,6,23,0.08)",
  },
  dark: {
    background: "#071326",
    pageBg: "#0B1220",
    cardBg: "#0F1724",
    textPrimary: "#E6EEF6",
    textMuted: "#93A6B8",
    accent: "#06B6D4",
    accentDark: "#0891B2",
    shadow: "0 0 20px rgba(6,182,212,0.1)",
  },
}

// Placeholder API Functions - Replace with real implementations
async function generateRoom() {
  // Generate format: 5 lowercase letters + 2 digits + 1 symbol
  const letters = "abcdefghijklmnopqrstuvwxyz"
  const digits = "0123456789"
  const symbols = "@#$%&-"

  let room = ""
  for (let i = 0; i < 5; i++) {
    room += letters[Math.floor(Math.random() * letters.length)]
  }
  for (let i = 0; i < 2; i++) {
    room += digits[Math.floor(Math.random() * digits.length)]
  }
  room += symbols[Math.floor(Math.random() * symbols.length)]

  return room
}

async function fetchRoomData(room) {
  // TODO: Replace with real API call
  // return fetch(`/api/rooms/${room}`).then(r => r.json());
  return null
}

async function postText(room, payload) {
  // TODO: Replace with real API call
  // return fetch(`/api/rooms/${room}/text`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(payload)
  // });
  return { success: true }
}

async function uploadFile(room, file, onProgress) {
  // TODO: Replace with pre-signed URL upload
  // Simulate progress for demo
  return new Promise((resolve) => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      onProgress?.(progress)
      if (progress >= 100) {
        clearInterval(interval)
        resolve({
          success: true,
          filename: file.name,
          size: file.size,
          id: Math.random().toString(36).substr(2, 9),
        })
      }
    }, 100)
  })
}

// Copy to clipboard helper
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea")
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    const success = document.execCommand("copy")
    document.body.removeChild(textArea)
    return success
  }
}

// Custom hooks
const useTheme = () => {
  const [theme, setTheme] = useState("light")

  useEffect(() => {
    const stored = localStorage.getItem("cloudclip-theme")
    if (stored) {
      setTheme(stored)
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark")
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("cloudclip-theme", newTheme)
  }

  return { theme, toggleTheme }
}

// Toast component
const Toast = ({ message, type = "success", onClose }) => (
  <div
    className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
      type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
    }`}
    role="status"
    aria-live="polite"
  >
    <div className="flex items-center justify-between">
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-white hover:text-gray-200" aria-label="Close">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  </div>
)

export default function CloudClipUI({
  roomName: initialRoomName = null,
  initialData = null,
  onRoomGenerated = () => {},
}) {
  const { theme, toggleTheme } = useTheme()
  const [roomName, setRoomName] = useState(initialRoomName)
  const [mode, setMode] = useState("text")
  const [textContent, setTextContent] = useState(initialData?.type === "text" ? initialData.value : "")
  const [files, setFiles] = useState(initialData?.type === "file" ? [initialData] : [])
  const [oneTimeView, setOneTimeView] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toast, setToast] = useState(null)
  const [roomData, setRoomData] = useState(null)
  const [isEditing, setIsEditing] = useState(!initialData)
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  // Generate room if not provided
  useEffect(() => {
    if (!roomName) {
      generateRoom().then((newRoom) => {
        setRoomName(newRoom)
        onRoomGenerated(newRoom)
        // Update URL without page reload
        window.history.pushState({}, "", `/${newRoom}`)
      })
    }
  }, [roomName, onRoomGenerated])

  // Polling for room updates (replace with WebSocket in production)
  const pollRoomData = async () => {
    if (roomName) {
      try {
        const data = await fetchRoomData(roomName)
        setRoomData(data)
      } catch (error) {
        console.error("Failed to fetch room data:", error)
      }
    }
  }

  useEffect(() => {
    const interval = setInterval(pollRoomData, 5000)
    return () => clearInterval(interval)
  }, [roomName])

  const showToast = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleCopyLink = async () => {
    const url = `https://cloudclip.com/${roomName}`
    const success = await copyToClipboard(url)
    if (success) {
      showToast("Room link copied to clipboard!")
    } else {
      showToast("Failed to copy link", "error")
    }
  }

  const handleSubmit = async () => {
    if (!roomName) return

    setIsLoading(true)

    try {
      if (mode === "text" && textContent.trim()) {
        await postText(roomName, {
          text: textContent,
          oneTime: oneTimeView,
        })
        showToast(`Posted to ${roomName} — URL copied to clipboard`)
        await copyToClipboard(`https://cloudclip.com/${roomName}`)
        setIsEditing(false)
      } else if (mode === "file" && files.length > 0) {
        // Handle file upload
        showToast("File uploaded successfully!")
        setIsEditing(false)
      }
    } catch (error) {
      showToast("Network error — try again", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (selectedFiles) => {
    const fileList = Array.from(selectedFiles)

    // Check file size limit (10MB)
    const oversizedFiles = fileList.filter((file) => file.size > 10 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      showToast("Upload failed — file too large (max 10 MB)", "error")
      return
    }

    // Upload files
    fileList.forEach(async (file) => {
      try {
        const result = await uploadFile(roomName, file, setUploadProgress)
        setFiles((prev) => [...prev, { ...result, filename: file.name, size: file.size }])
      } catch (error) {
        showToast("Upload failed — try again", "error")
      }
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        handleSubmit()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const currentTokens = tokens[theme]

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${theme === "dark" ? "bg-slate-900" : "bg-slate-50"}`}
      style={{ backgroundColor: currentTokens.pageBg }}
    >
      {/* Navbar */}
      <nav
        className={`h-16 border-b transition-colors duration-200 ${
          theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <h1
            className={`text-lg font-semibold transition-colors duration-200 ${
              theme === "dark" ? "text-slate-100" : "text-slate-900"
            }`}
          >
            CloudClip
          </h1>

          <div className="flex items-center gap-3">
            {roomName && (
              <button
                onClick={handleCopyLink}
                className={`p-2 rounded-lg transition-all duration-140 hover:-translate-y-0.5 ${
                  theme === "dark"
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
                aria-label="Copy room link"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all duration-140 hover:-translate-y-0.5 ${
                theme === "dark"
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              aria-pressed={theme === "dark"}
              aria-label="Toggle light / dark"
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414 0zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div
          className={`rounded-xl p-6 transition-all duration-200 ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}
          style={{
            backgroundColor: currentTokens.cardBg,
            boxShadow: currentTokens.shadow,
          }}
        >
          {/* Room Bar */}
          {roomName && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-mono px-2 py-1 rounded ${
                    theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {roomName}
                </span>
                <button
                  onClick={handleCopyLink}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    theme === "dark"
                      ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="mb-6">
            <div
              className={`inline-flex rounded-full p-1 ${theme === "dark" ? "bg-slate-700" : "bg-slate-100"}`}
              role="tablist"
            >
              <button
                onClick={() => setMode("text")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-180 ${
                  mode === "text"
                    ? `text-white shadow-sm`
                    : theme === "dark"
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                }`}
                style={mode === "text" ? { backgroundColor: currentTokens.accent } : {}}
                role="tab"
                aria-selected={mode === "text"}
              >
                Text
              </button>
              <button
                onClick={() => setMode("file")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-180 ${
                  mode === "file"
                    ? `text-white shadow-sm`
                    : theme === "dark"
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                }`}
                style={mode === "file" ? { backgroundColor: currentTokens.accent } : {}}
                role="tab"
                aria-selected={mode === "file"}
              >
                File
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="mb-6">
            {mode === "text" ? (
              <div>
                {isEditing ? (
                  <div>
                    <textarea
                      ref={textareaRef}
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Paste or type text here..."
                      className={`w-full min-h-[140px] p-4 rounded-lg border resize-y transition-colors ${
                        theme === "dark"
                          ? "bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-cyan-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-500 focus:border-sky-400"
                      } focus:outline-none focus:ring-2 focus:ring-opacity-50`}
                      style={{ focusRingColor: currentTokens.accent + "50" }}
                    />
                    <div
                      className={`text-xs mt-2 text-right ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {textContent.length} / 10000
                    </div>
                  </div>
                ) : (
                  <div
                    className={`p-4 rounded-lg border ${
                      theme === "dark" ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        Text content
                      </span>
                      <button
                        onClick={() => setIsEditing(true)}
                        className={`text-sm px-2 py-1 rounded transition-colors ${
                          theme === "dark"
                            ? "text-slate-400 hover:text-slate-200 hover:bg-slate-600"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        Edit
                      </button>
                    </div>
                    <div className={`whitespace-pre-wrap ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                      {textContent || "No content"}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {files.length === 0 ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-120 ${
                      dragOver
                        ? theme === "dark"
                          ? "border-cyan-400 bg-cyan-400/10"
                          : "border-sky-400 bg-sky-50"
                        : theme === "dark"
                          ? "border-slate-600 hover:border-slate-500 hover:bg-slate-700/50"
                          : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <svg
                      className={`w-12 h-12 mx-auto mb-4 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className={`text-base mb-2 ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}>
                      Drop your file here or click to upload
                    </p>
                    <p className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>(max 10 MB)</p>
                    <p className={`text-xs mt-2 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                      All file types allowed
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          theme === "dark" ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className={`w-8 h-8 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <div>
                            <p className={`font-medium ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                              {file.filename}
                            </p>
                            <p className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                              {(file.size / 1024 / 1024).toFixed(2)} MB • expires in 4 days
                            </p>
                          </div>
                        </div>
                        <button
                          className={`px-3 py-1 text-sm rounded transition-colors ${
                            theme === "dark"
                              ? "text-slate-400 hover:text-slate-200 hover:bg-slate-600"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Options Row */}
          <div className="mb-6 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={oneTimeView}
                onChange={(e) => setOneTimeView(e.target.checked)}
                className={`rounded border-2 ${theme === "dark" ? "border-slate-600" : "border-slate-300"}`}
                style={{ accentColor: currentTokens.accent }}
              />
              <span className={`text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                Enable one-time view (auto-delete after first access)
              </span>
            </label>

            <div className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              Text TTL: 7 days · File TTL: 5 days
            </div>
          </div>

          {/* Action Row */}
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={isLoading || (!textContent.trim() && files.length === 0)}
              className={`px-8 py-3 rounded-lg font-medium text-white transition-all duration-140 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                theme === "dark"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-lg hover:shadow-cyan-500/25"
                  : "bg-gradient-to-r from-sky-400 to-cyan-400 hover:shadow-lg hover:shadow-sky-500/25"
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Posting...
                </div>
              ) : (
                "Send / Post"
              )}
            </button>
          </div>

          {/* Footer */}
          <div className={`mt-6 text-center text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
            Room is public and editable by default. Lock the room to prevent edits.
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
