'use client'
import { useState, useEffect } from 'react'

export default function IdeationPage() {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/ideas`)
      .then(res => res.json())
      .then(data => {
        setIdeas(Array.isArray(data) ? data : (data.ideas || []))
      })
      .catch(err => {
        console.error("Ideation backend unavailable:", err)
        setIdeas([])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/generate-ideas`, { method: 'POST' })
      const data = await res.json()
      const newIdeas = Array.isArray(data.ideas) ? data.ideas : []
      setIdeas([...newIdeas, ...ideas])
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Scanning for product opportunities...</div>

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2">Ideation</h1>
          <p className="text-zinc-500">AI-driven product suggestions synthesized from negative user feedback.</p>
        </div>
        <button 
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary"
        >
          {generating ? 'Synthesizing...' : '✨ Generate AI Ideas'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ideas.map((idea, i) => (
          <div key={i} className="card-premium p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${idea.type === 'bug' ? 'bg-red-500/10 text-red-500' : 'bg-[#0066CC]/10 text-[#0066CC]'}`}>
                  {idea.type}
                </span>
                <span className="text-[10px] text-zinc-500">{new Date(idea.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="font-bold text-lg mb-2 leading-tight">{idea.title}</h3>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{idea.description}</p>
            </div>
            <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
              <div className="flex -space-x-2">
                {[1,2,3].map(j => (
                  <div key={j} className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-800" />
                ))}
              </div>
              <button className="text-[10px] font-bold text-[#0066CC] hover:underline uppercase tracking-widest">
                Create Jira Ticket
              </button>
            </div>
          </div>
        ))}
      </div>

      {ideas.length === 0 && !generating && (
        <div className="py-20 text-center card-premium border-dashed">
          <p className="text-zinc-500 mb-4">No ideas generated yet.</p>
          <button onClick={handleGenerate} className="btn-secondary">Start Analysis</button>
        </div>
      )}
    </div>
  )
}
