import { useEffect, useRef, useState } from 'react'

function App() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  // States for flow
  const [aadhaar, setAadhaar] = useState('')
  const [voterName, setVoterName] = useState('')
  const [otp, setOtp] = useState('')
  const [otpHint, setOtpHint] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [faceVerified, setFaceVerified] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)

  const [candidates, setCandidates] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [results, setResults] = useState([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Camera refs
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [cameraOn, setCameraOn] = useState(false)

  const resetAlerts = () => {
    setError('')
    setSuccess('')
  }

  const fetchStatus = async (id) => {
    try {
      const res = await fetch(`${backendUrl}/status/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setVoterName(data.name || '')
      setHasVoted(!!data.has_voted)
      setOtpVerified(!!data.otp_verified)
      setFaceVerified(!!data.face_verified)
    } catch {}
  }

  const sendOtp = async () => {
    resetAlerts()
    if (!aadhaar || aadhaar.length < 8) {
      setError('Enter a valid Aadhaar number')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${backendUrl}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to send OTP')
      setOtpHint(`Demo OTP: ${data.otp_demo} (expires in 5 min)`) // demo only
      setVoterName(data.voter_name || '')
      setSuccess('OTP sent successfully (demo)')
      await fetchStatus(aadhaar)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    resetAlerts()
    if (!otp || otp.length < 4) {
      setError('Enter the OTP')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${backendUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar, otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid OTP')
      setOtpVerified(true)
      setSuccess('OTP verified')
      await fetchStatus(aadhaar)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const startCamera = async () => {
    resetAlerts()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraOn(true)
      }
    } catch (e) {
      setError('Camera access denied. Please allow camera permissions.')
    }
  }

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
    }
    setCameraOn(false)
  }

  const captureAndVerifyFace = async () => {
    resetAlerts()
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      const w = video.videoWidth
      const h = video.videoHeight
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/png')

      setLoading(true)
      const res = await fetch(`${backendUrl}/auth/verify-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar, image_base64: dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Face verification failed')
      setFaceVerified(true)
      setSuccess(data.enrolled ? 'Face enrolled and verified' : 'Face verified')
      await fetchStatus(aadhaar)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCandidates = async () => {
    try {
      const res = await fetch(`${backendUrl}/candidates`)
      const data = await res.json()
      setCandidates(data.candidates || [])
      if ((data.candidates || []).length) setSelectedCandidate(data.candidates[0].id)
    } catch {}
  }

  const castVote = async () => {
    resetAlerts()
    if (!selectedCandidate) {
      setError('Select a candidate')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${backendUrl}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar, candidate_id: selectedCandidate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to cast vote')
      setSuccess('Your vote has been recorded')
      setHasVoted(true)
      await fetchResults()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchResults = async () => {
    try {
      const res = await fetch(`${backendUrl}/results`)
      const data = await res.json()
      setResults(data.results || [])
    } catch {}
  }

  useEffect(() => {
    loadCandidates()
    if (aadhaar.length >= 8) fetchStatus(aadhaar)
    fetchResults()
    // cleanup camera on unmount
    return () => stopCamera()
  }, [])

  const Step = ({ title, children, done }) => (
    <div className={`rounded-xl p-5 border ${done ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'} shadow-sm` }>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${done ? 'bg-green-500' : 'bg-gray-300'}`}></div>
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Voting System Simulation</h1>
          <p className="text-gray-600 mt-1">Secure flow: Aadhaar → OTP → Face verification → Cast Vote</p>
        </header>

        {/* Alerts */}
        {(error || success || otpHint) && (
          <div className="space-y-2 mb-6">
            {error && <div className="p-3 rounded-md bg-red-50 text-red-700 border border-red-200">{error}</div>}
            {success && <div className="p-3 rounded-md bg-green-50 text-green-700 border border-green-200">{success}</div>}
            {otpHint && <div className="p-3 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200">{otpHint}</div>}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Identification */}
          <Step title="1) Enter Aadhaar" done={aadhaar.length >= 8}>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value)}
                placeholder="Enter Aadhaar number"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={sendOtp} disabled={loading}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">Send OTP</button>
            </div>
            {voterName && <p className="text-sm text-gray-600 mt-2">Voter: {voterName}</p>}
          </Step>

          {/* OTP */}
          <Step title="2) Verify OTP" done={otpVerified}>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={verifyOtp} disabled={loading}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">Verify</button>
            </div>
          </Step>

          {/* Face */}
          <Step title="3) Face verification" done={faceVerified}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {!cameraOn ? (
                  <button onClick={startCamera} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Start Camera</button>
                ) : (
                  <button onClick={stopCamera} className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700">Stop Camera</button>
                )}
                <button onClick={captureAndVerifyFace} disabled={!cameraOn || loading || !aadhaar}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">Capture & Verify</button>
              </div>
              <div className="flex gap-4 items-start">
                <video ref={videoRef} className="w-56 h-40 bg-black rounded-lg object-cover" playsInline />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <p className="text-xs text-gray-500">Note: In this simulation, we store a secure hash of your capture on first verification and match it on subsequent attempts.</p>
            </div>
          </Step>

          {/* Vote */}
          <Step title="4) Cast your vote" done={hasVoted}>
            <div className="space-y-3">
              <select
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.party ? ` — ${c.party}` : ''}</option>
                ))}
              </select>
              <button
                onClick={castVote}
                disabled={!otpVerified || !faceVerified || hasVoted || loading}
                className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50"
              >
                Submit Vote
              </button>
              {!otpVerified && <p className="text-sm text-gray-500">Complete OTP verification to enable voting.</p>}
              {!faceVerified && <p className="text-sm text-gray-500">Complete face verification to enable voting.</p>}
              {hasVoted && <p className="text-sm text-green-700">You have already voted. Thank you!</p>}
            </div>
          </Step>
        </div>

        {/* Live Results */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Live Results</h3>
            <button onClick={fetchResults} className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200">Refresh</button>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {results.map((r) => (
              <div key={r.candidate_id} className="border rounded-lg p-4 bg-gray-50">
                <div className="font-medium text-gray-900">{r.name}</div>
                <div className="text-gray-600 text-sm">{r.party || 'Independent'}</div>
                <div className="mt-2 text-2xl font-bold text-indigo-700">{r.votes}</div>
              </div>
            ))}
            {!results.length && <p className="text-gray-500">No votes yet.</p>}
          </div>
        </section>

        <footer className="text-xs text-gray-500 mt-8">
          For demonstration purposes only. Aadhaar/OTP and face recognition are simulated in this environment.
        </footer>
      </div>
    </div>
  )
}

export default App
