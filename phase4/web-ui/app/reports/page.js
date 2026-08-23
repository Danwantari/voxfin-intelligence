'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ReportsAndAutomation() {
  const router = useRouter()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedMonths, setSelectedMonths] = useState(10)
  const [maxReviews, setMaxReviews] = useState(1000)
  const [isPolling, setIsPolling] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const [runId, setRunId] = useState(null)
  const [runStatus, setRunStatus] = useState('queued')
  const [initialLatestId, setInitialLatestId] = useState(null)

  useEffect(() => {
    fetchArchive()
    // Capture the current latest ID so we know when a NEW one arrives
    const captureInitialId = async () => {
      const res = await fetch('/api/latest-report')
      const data = await res.json()
      if (data.id) setInitialLatestId(data.id)
    }
    captureInitialId()
  }, [])

  useEffect(() => {
    let interval;
    if (isPolling) {
      interval = setInterval(() => {
        setPollCount(prev => prev + 1)
        if (runId) {
          checkActionStatus()
        } else {
          checkLatestReport()
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [isPolling, runId])

  const fetchArchive = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/fetch-archive')
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setReports(data)
      } else {
        // GitHub source not reachable yet (e.g. repo not pushed) — use the local archive file
        const localRes = await fetch('/api/local-archive')
        const localData = await localRes.json()
        if (Array.isArray(localData)) setReports(localData)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const checkActionStatus = async () => {
    try {
      const res = await fetch(`/api/check-run?run_id=${runId}`)
      const data = await res.json()
      setRunStatus(data.status)
      if (data.status === 'completed') {
        // ACTION COMPLETED -> Wait 2 seconds for GitHub Sync and then hard redirect
        setTimeout(checkLatestReport, 2000)
      }
    } catch (e) { checkLatestReport() }
  }

  const checkLatestReport = async () => {
    try {
      const res = await fetch('/api/latest-report')
      const data = await res.json()
      if (data.id && data.id !== initialLatestId) {
        // NEW REPORT FOUND -> GO!
        window.location.href = `/report/${data.id}?months=${selectedMonths}`
      }
    } catch (e) {}
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const days = selectedMonths * 30
      // [PROD FIX] Using Fast Path Edge Synthesis (5-10s target)
      const res = await fetch(`/api/fast-synthesis?days=${days}&max_reviews=${maxReviews}`, { method: 'POST' })
      const data = await res.json()
      
      if (data.summary) {
        // 1. Save as transient for instant view
        localStorage.setItem('transient_report', JSON.stringify(data))
        
        // 2. Add to local archive list for the dashboard
        const localData = localStorage.getItem('local_archive')
        const localReports = localData ? JSON.parse(localData) : []
        const newReport = {
            ...data,
            id: `local-${Date.now()}`,
            created_at: new Date().toISOString(),
            is_local: true
        }
        localStorage.setItem('local_archive', JSON.stringify([newReport, ...localReports]))

        window.location.href = `/report/latest?transient=true`
        return;
      } else {
        // [MODIFIED] No silent fallback. If fast path fails, we need to know WHY.
        console.error("Fast Synthesis Failed:", data.error || "Unknown error")
        alert(`Synthesis failed: ${data.message || 'Please check your ANTHROPIC_API_KEY on Vercel.'}`)
        setGenerating(false)
      }
    } catch (err) { 
      console.error(err)
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">


      <main className="max-w-7xl mx-auto px-8 py-16">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-20 mb-24">
          <div className="max-w-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-[10px] font-bold text-[#0066CC] uppercase tracking-widest">INDPLUS INTELLIGENCE</span>
              <span className="text-gray-300 text-xs">|</span>
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">MODEL CONTEXT PROTOCOL</span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">Strategic Intelligence Console</h1>
            <p className="text-lg text-slate-500 leading-relaxed max-w-xl">
              Select your strategic window from 1 to 12 months. The AI will synthesize thousands of signals into a one-page executive note, automatically syncing to Google Workspace and drafting leadership reports.
            </p>
          </div>

          <div className="w-full lg:w-96 bg-white space-y-10 pt-4">
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="flex flex-col text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span className="mb-1">TIME WINDOW</span>
                  <span className="text-[#0066CC]">LAST {selectedMonths} MONTHS ANALYSIS</span>
                </div>
                <div className="text-3xl font-bold text-[#0066CC]">{selectedMonths} Months</div>
              </div>
              <input 
                type="range" min="1" max="12" value={selectedMonths}
                onChange={(e) => setSelectedMonths(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#0066CC]"
              />
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="flex flex-col text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span className="mb-1">REVIEW VOLUME</span>
                  <span className="text-[#0066CC]">ANALYZE UP TO {maxReviews} REVIEWS</span>
                </div>
                <div className="text-3xl font-bold text-[#0066CC]">{maxReviews}</div>
              </div>
              <input 
                type="range" min="100" max="5000" step="100" value={maxReviews}
                onChange={(e) => setMaxReviews(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#0066CC]"
              />
            </div>
            <button 
              onClick={handleGenerate}
              disabled={generating || isPolling}
              className={`w-full py-5 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all ${
                generating || isPolling ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#0066CC] hover:bg-[#0052A3] text-white shadow-xl shadow-blue-200'
              }`}
            >
              <span>{generating || isPolling ? 'Processing...' : '✨ Generate INDPlus Note'}</span>
            </button>
          </div>
        </div>

        {isPolling && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
            <div className="max-w-md w-full text-center">
              <div className="mb-10 inline-block relative animate-bounce">
                <div className="w-24 h-24 border-4 border-gray-50 border-t-[#0066CC] rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[#0066CC] font-bold text-xl">MCP</span>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Synthesizing Strategic Pulse</h2>
              <div className="space-y-5 text-left max-w-xs mx-auto mt-12">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-widest text-slate-800">Cloud Environment</span>
                  <span className="text-[10px] font-black text-[#0066CC] uppercase">{runStatus === 'queued' ? 'QUEUING' : 'READY'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-widest text-slate-800">AI Synthesis</span>
                  <span className="text-[10px] font-black text-[#0066CC] uppercase">{runStatus === 'in_progress' ? 'PROCESSING' : (runStatus === 'completed' ? 'DONE' : 'PENDING')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-widest text-slate-800">Finalizing Report</span>
                  <span className="text-[10px] font-black text-[#0066CC] uppercase">{runStatus === 'completed' ? 'REDIRECTING...' : 'PENDING'}</span>
                </div>
              </div>
              <div className="mt-16 text-gray-300 text-[10px] font-bold uppercase tracking-widest">
                ELAPSED TIME: {pollCount * 3} SECONDS
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">INDPlus Archive</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">HISTORICAL DECISIONS & SIGNAL RECORDS</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
            <div className="grid grid-cols-4 px-10 py-5 bg-gray-50/50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>GENERATION DATE</span>
              <span>SIGNALS</span>
              <span>STRATEGIC THEMES</span>
              <span className="text-right">ACTIONS</span>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="py-40 flex items-center justify-center"><div className="w-10 h-10 border-2 border-t-[#0066CC] rounded-full animate-spin"></div></div>
              ) : reports.map((report) => (
                <div key={report.id} className="grid grid-cols-4 px-10 py-8 items-center hover:bg-gray-50/30">
                  <div className="flex flex-col">
                    <div className="text-sm font-bold text-slate-900 uppercase">
                      {new Date(report.created_at).toLocaleDateString()} 
                      <span className="text-gray-400 font-normal ml-2">
                        {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {report.is_local && (
                      <span className="text-[9px] font-black text-white bg-[#0066CC] px-1.5 py-0.5 rounded w-fit mt-1">JUST NOW</span>
                    )}
                  </div>
                  <div><span className="bg-[#F4F9FF] text-[#0066CC] text-[11px] font-black px-3 py-1.5 rounded-lg">{report.review_count} SIGNALS</span></div>
                  <div className="flex gap-2">
                    {(typeof report.themes === 'string' ? JSON.parse(report.themes) : report.themes).slice(0, 2).map((t, i) => (
                      <span key={i} className="text-[10px] font-bold text-slate-500 uppercase px-2 py-1 bg-gray-100 rounded">{typeof t === 'string' ? t : t.name}</span>
                    ))}
                  </div>
                  <div className="text-right">
                    <Link 
                      href={report.is_local ? `/report/${report.id}?transient=true&local=true` : `/report/${report.id}`} 
                      className="text-[10px] font-black text-[#0066CC] uppercase tracking-widest hover:underline"
                    >
                      VIEW INSIGHTS →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
