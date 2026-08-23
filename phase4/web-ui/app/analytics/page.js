'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default function UnifiedIntelligencePage() {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchIntelligence = async () => {
    setLoading(true)
    try {
      // Primary: Use Raw GitHub URL (High-bandwidth, No Rate Limit)
      const RAW_URL = "https://raw.githubusercontent.com/danwantari/voxfin-intelligence/main/data/latest_pulse.json";
      let json;
      try {
        const res = await fetch(RAW_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`GitHub source returned ${res.status}`);
        json = await res.json();
      } catch (primaryErr) {
        // GitHub source not reachable yet (e.g. repo not pushed) — use the local data file
        console.warn("GitHub source unavailable, using local data/latest_pulse.json", primaryErr)
        const localRes = await fetch('/api/local-pulse', { cache: 'no-store' });
        if (!localRes.ok) throw new Error('No local pulse data available');
        json = await localRes.json();
      }

      // 1. Transform & Filter Data Locally for full reactivity
      const reviews = json.reviews || [];
      const parseDate = (d) => {
        if (!d) return new Date(0);
        try {
          const cleanDate = (typeof d === 'string' && d.includes('T')) ? d.split('.')[0] + 'Z' : d;
          const dd = new Date(cleanDate);
          if (!isNaN(dd.getTime())) return dd;
          
          if (typeof d === 'string' && d.includes('/')) {
             const parts = d.split('/');
             if (parts.length === 3) {
                const d2 = new Date(parts[2], parts[0] - 1, parts[1]);
                if (!isNaN(d2.getTime())) return d2;
             }
          }
          return new Date(0);
        } catch(e) {
          return new Date(0);
        }
      };

      const days = parseInt(timeRange) || 30;
      
      // Relative Time Anchor: Base 'today' on the newest review in the dataset
      let maxTime = 0;
      reviews.forEach(r => {
         const t = parseDate(r.review_date).getTime();
         if (t > maxTime) maxTime = t;
      });
      const anchorDate = maxTime > 0 ? new Date(maxTime) : new Date();
      
      const cutoffDate = new Date(anchorDate);
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const timeFiltered = reviews.filter(r => {
        if (!r.review_date) return true; // Keep reviews missing dates
        return parseDate(r.review_date) >= cutoffDate;
      });
      
      const total = timeFiltered.length || 1;
      const avgRating = (timeFiltered.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1);
      
      const getEffectiveSentiment = (r) => {
        const rating = parseInt(r.rating) || 3;
        const rawSent = String(r.sentiment || "").toLowerCase();
        if (rawSent.includes("pos") || rating >= 4) return 'positive';
        if (rawSent.includes("neg") || rating <= 2) return 'negative';
        return 'neutral';
      };

      const posCount = timeFiltered.filter(r => getEffectiveSentiment(r) === 'positive').length;
      const negCount = timeFiltered.filter(r => getEffectiveSentiment(r) === 'negative').length;
      const neuCount = timeFiltered.filter(r => getEffectiveSentiment(r) === 'neutral').length;

      const classifyLocally = (text, rating) => {
        const t = (text || "").toLowerCase();
        if (t.match(/crash|close|stuck|freeze|not opening|broken|bug/)) return 'App Crash';
        if (t.match(/slow|lag|loading|speed|fast|hang|performance/)) return 'Performance';
        if (t.match(/support|customer care|help|respond|chat|ticket|service/)) return 'Customer Support';
        if (t.match(/fee|charge|cost|brokerage|money|deduct|hidden/)) return 'Charges & Fees';
        if (t.match(/login|account|kyc|otp|access|delete|verify|security/)) return 'Account & KYC';
        if (t.match(/ui|ux|design|interface|look|confusing|hard/)) return 'Ease of Use';
        if (t.match(/add|wish|want|please|missing|feature/)) return 'Feature Request';
        return parseInt(rating) >= 4 ? 'General Praise' : 'General Feedback';
      };

      // Group by Category for Functional Categories
      const catMap = {};
      timeFiltered.forEach(r => {
        const cat = r.category && r.category !== 'null' && r.category !== 'undefined' ? r.category : classifyLocally(r.review_text, r.rating);
        if (!catMap[cat]) catMap[cat] = { count: 0, rating: 0, pos: 0, neg: 0 };
        catMap[cat].count++;
        catMap[cat].rating += r.rating;
        const s = getEffectiveSentiment(r);
        if (s === 'positive') catMap[cat].pos++;
        if (s === 'negative') catMap[cat].neg++;
      });

      const transformedData = {
        summary: {
          total_reviews: timeFiltered.length,
          avg_rating: avgRating,
          sentiment: {
            pos_p: Math.round((posCount / total) * 100),
            neg_p: Math.round((negCount / total) * 100)
          }
        },
        nps: {
          promoters: posCount,
          detractors: negCount
        },
        categories: Object.keys(catMap).map(name => {
          const c = catMap[name];
          const pos_p = Math.round((c.pos / c.count) * 100);
          const neg_p = Math.round((c.neg / c.count) * 100);
          
          const isBug = ['App Crash', 'Performance', 'Account & KYC', 'Charges & Fees'].includes(name);
          const isFR = name === 'Feature Request';
          
          let health = 'Monitor';
          if (isBug) {
             health = neg_p > 50 ? 'Critical' : neg_p > 30 ? 'Warning' : 'Stable';
          } else if (isFR) {
             health = 'Opportunity';
          } else {
             health = pos_p > 60 ? 'Good' : 'Needs Attention';
          }

          let displayStat = { label: 'Positive', value: `${pos_p}%`, color: 'text-emerald-600' };
          if (isBug) {
             displayStat = { label: 'Negative', value: `${neg_p}%`, color: 'text-rose-600' };
          } else if (isFR) {
             displayStat = { label: 'Volume', value: `${Math.round((c.count / total) * 100)}%`, color: 'text-blue-600' };
          }

          return {
            name,
            count: c.count,
            avg_rating: (c.rating / c.count).toFixed(1),
            pos_p,
            neg_p,
            health,
            displayStat
          };
        }).sort((a,b) => b.count - a.count)
      };
      
      setData({ ...transformedData, generated_at: json.generated_at })
    } catch (err) {
      console.error("Live Bridge failed, using local fallback", err)
      // Fallback for local development
      try {
        const res = await fetch(`http://localhost:8001/api/analytics?time_range=${timeRange}`)
        const json = await res.json()
        // Only trust the fallback if it actually looks like our own analytics payload —
        // localhost:8001 can be occupied by an unrelated local service.
        if (json && json.summary) setData(json)
      } catch (e) {}
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIntelligence()
  }, [timeRange])

  const navigateToReviews = (category) => {
    router.push(`/reviews?category=${encodeURIComponent(category)}&time_range=${timeRange}#review-feed`)
  }

  if (loading && !data) return <div className="p-20 text-center animate-pulse text-slate-400 font-medium text-sm">Loading Intelligence Hub...</div>

  if (!loading && !data) return (
    <div className="max-w-2xl mx-auto py-24 text-center space-y-3">
      <p className="text-slate-900 font-bold">No pulse data available yet</p>
      <p className="text-slate-400 text-sm">
        Trigger a run from the Streamlit controller (localhost:8501), or push this repo to GitHub so
        <code className="mx-1 px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">data/latest_pulse.json</code>
        is reachable at raw.githubusercontent.com.
      </p>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 px-6">
      {/* 1. Header & Global Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Category Intelligence</h1>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rolling Signal Analysis:</span>
              <span className="text-[10px] font-bold text-[#0066CC] uppercase tracking-widest">
                {(() => {
                  const now = new Date()
                  const days = parseInt(timeRange) || 30
                  const start = new Date()
                  start.setDate(now.getDate() - days)
                  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                })()}
              </span>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">📡 Pulse Generated: {data?.generated_at ? new Date(data.generated_at).toLocaleString() : 'Live Snapshot'}</span>
               <a href="https://share.streamlit.io/" target="_blank" className="text-[9px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest border-l border-slate-200 pl-2 underline decoration-slate-200 underline-offset-2">Refresh Data in Controller ↗</a>
            </div>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {['7d', '14d', '30d', '90d', '180d', '240d', '360d'].map(t => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${timeRange === t ? 'bg-white text-[#0066CC] shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  Last {t.toUpperCase()}
                </button>
              ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intelligence Active: Analyzing {data?.summary?.total_reviews} signals for this period</span>
      </div>

      {/* 2. CORE KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard 
          label="Total Signals" 
          value={data?.summary?.total_reviews.toLocaleString()} 
          onClick={() => router.push(`/reviews?time_range=${timeRange}#review-feed`)}
        />
        <KPICard 
          label="Avg Rating" 
          value={`${data?.summary?.avg_rating} ⭐`} 
          sub="out of 5.0" 
          onClick={() => router.push(`/reviews?time_range=${timeRange}#review-feed`)}
        />
        <KPICard 
          label="Positive" 
          value={`${data?.summary?.sentiment?.pos_p}%`} 
          color="text-emerald-600" 
          onClick={() => router.push(`/reviews?time_range=${timeRange}&sentiment=Positive#review-feed`)}
        />
        <KPICard 
          label="Negative" 
          value={`${data?.summary?.sentiment?.neg_p}%`} 
          color="text-rose-600" 
          onClick={() => router.push(`/reviews?time_range=${timeRange}&sentiment=Negative#review-feed`)}
        />
        <KPICard 
          label="Promoters" 
          value={data?.nps?.promoters} 
          sub="NPS" 
          onClick={() => router.push(`/reviews?time_range=${timeRange}&sentiment=Positive#review-feed`)}
        />
        <KPICard 
          label="Detractors" 
          value={data?.nps?.detractors} 
          color="text-rose-500" 
          onClick={() => router.push(`/reviews?time_range=${timeRange}&sentiment=Negative#review-feed`)}
        />
      </div>

      {/* 3. INTELLIGENCE GRID (CATEGORY DEEP-DIVES) */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
           <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Functional Categories</h2>
           <p className="text-[10px] text-slate-400 italic">Select category to view raw evidence</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.categories && data.categories.map((cat, i) => (
            <div 
              key={i} 
              onClick={() => navigateToReviews(cat.name)}
              className="bg-white border border-slate-200 p-6 rounded-xl hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#0066CC] transition-colors">{cat.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{cat.count} Signals</p>
                </div>
                <span className={`text-[9px] font-bold px-2.5 py-1 rounded-md uppercase tracking-tight ${
                  cat.health === 'Good' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                  cat.health === 'Critical' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 
                  cat.health === 'Opportunity' ? 'bg-blue-50 text-[#0066CC] border border-blue-100' : 
                  'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                  {cat.health}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                   <p className="text-lg font-bold text-slate-900">{cat.avg_rating} ⭐</p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase">Avg Rating</p>
                </div>
                <div className="text-right">
                   <p className={`text-lg font-bold ${cat.displayStat?.color || 'text-emerald-600'}`}>{cat.displayStat?.value || `${cat.pos_p}%`}</p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase">{cat.displayStat?.label || 'Positive'}</p>
                </div>
              </div>

              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-200 group-hover:bg-[#0066CC] transition-all duration-500" 
                  style={{ width: `${(cat.count / data.summary.total_reviews) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, sub, color = "text-slate-900", onClick }) {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1 cursor-pointer hover:border-slate-300 hover:bg-slate-50/50 transition-all group"
    >
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className={`text-xl font-bold tracking-tight ${color}`}>{value}</p>
        {sub && <span className="text-[10px] font-medium text-slate-400">{sub}</span>}
      </div>
    </div>
  )
}
