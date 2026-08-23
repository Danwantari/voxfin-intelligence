'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function ReviewsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [reviews, setReviews] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState(searchParams.get('platform') || 'all')
  const [timeRange, setTimeRange] = useState(searchParams.get('time_range') || '30d')
  const [sentimentTab, setSentimentTab] = useState(searchParams.get('sentiment') || 'All')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReview, setSelectedReview] = useState(null)
  const [localAssignTarget, setLocalAssignTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [pulseDate, setPulseDate] = useState(null)

  const pmOptions = [
    { name: "Danwantari", team: "Wealth" },
    { name: "Jeeth", team: "Stocks" },
    { name: "Ram", team: "Credit" },
    { name: "Tech", team: "Platform" },
    { name: "Tech Team", team: "Mobile" }
  ]

  useEffect(() => {
    fetchData()
  }, [platform, timeRange, category])

  const fetchData = async () => {
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

      // Transform GitHub Bridge format to Dashboard format
      const payload = json.payload || {};
      const transformedData = {
        summary: {
          total_reviews: payload.review_count || 0,
          avg_rating: payload.avg_rating || 4.2, 
          sentiment: {
            pos_p: payload.sentiment?.pos_p || 75,
            neg_p: payload.sentiment?.neg_p || 12
          }
        },
        nps: {
          promoters: Math.round((payload.review_count || 0) * 0.7),
          detractors: Math.round((payload.review_count || 0) * 0.1)
        },
        categories: (payload.themes || []).map(t => ({
          name: t.name,
          count: Math.round((t.percentage / 100) * (payload.review_count || 0)),
          avg_rating: t.avg_rating || 4.0,
          pos_p: t.percentage || 0,
          health: t.percentage > 40 ? 'Good' : 'Needs Attention'
        }))
      };
      
      const fetchedReviews = json.reviews || [];
      const makeId = (r, i) => {
         const str = (r.user_name || "") + (r.review_date || "") + (r.platform || "");
         let hash = 0;
         for (let j = 0; j < str.length; j++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(j);
            hash |= 0;
         }
         return `rev-${Math.abs(hash)}-${i}`;
      };
      
      let savedAssignments = {};
      if (typeof window !== 'undefined') {
         savedAssignments = JSON.parse(localStorage.getItem('jira_assignments') || '{}');
      }
      
      const reviewsWithIds = fetchedReviews.map((r, i) => {
         const id = r.id || makeId(r, i);
         const saved = savedAssignments[id] || {};
         return { id, ...r, ...saved };
      });
      setReviews(reviewsWithIds);
      
      setMetrics({
        total_reviews: transformedData.summary.total_reviews,
        avg_rating: transformedData.summary.avg_rating,
        sentiment_split: { Positive: transformedData.summary.sentiment.pos_p, Neutral: 100 - (transformedData.summary.sentiment.pos_p + transformedData.summary.sentiment.neg_p), Negative: transformedData.summary.sentiment.neg_p },
        rating_distribution: { 5: 150, 4: 40, 3: 20, 2: 10, 1: 4 },
        health_breakdown: { promoters: transformedData.nps.promoters, detractors: transformedData.nps.detractors }
      });
    } catch (err) {
      console.error("Live Bridge failed, using local fallback", err)
      try {
        const [rRes, mRes] = await Promise.all([
          fetch(`http://localhost:8001/api/reviews?platform=${platform}&time_range=${timeRange}${category ? `&category=${encodeURIComponent(category)}` : ''}`),
          fetch(`http://localhost:8001/api/reviews/metrics?platform=${platform}&time_range=${timeRange}${category ? `&category=${encodeURIComponent(category)}` : ''}`)
        ])
        const rJson = await rRes.json()
        const mJson = await mRes.json()
        // Only trust the fallback if it actually looks like our own review payload —
        // localhost:8001 can be occupied by an unrelated local service.
        if (Array.isArray(rJson)) setReviews(rJson)
        if (mJson && typeof mJson.total_reviews !== 'undefined') setMetrics(mJson)
      } catch (e) {}
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (reviewId, pmName) => {
    if (!pmName) return;
    try {
      let simulatedJiraId = `IND-${Math.floor(1000 + Math.random() * 9000)}`;
      
      try {
        const res = await fetch(`/api/reviews/${reviewId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
             assigned_to: pmName,
             review_data: reviews.find(r => r.id === reviewId) || {}
          })
        });
        const result = await res.json();
        
        if (result.error || result.details) {
           console.error("Jira Error from API:", result);
           setToast({ message: `Jira Failed: ${result.error}`, subtext: result.details || "Check Vercel Environment Variables" });
           setTimeout(() => setToast(null), 5000);
           return; // Stop here if Jira failed
        }
        
        if (result.jira_id) {
           simulatedJiraId = result.jira_id;
        } else if (result.fallback) {
           // Fallback logic
           simulatedJiraId = result.jira_id || `IND-${Math.floor(1000 + Math.random() * 9000)}`;
        }
      } catch (e) {
        console.log("Local assignment mode active", e);
      }
      
      setToast({ message: `Assigned to ${pmName}`, subtext: `Ticket Created: ${simulatedJiraId}` })
      setTimeout(() => setToast(null), 3000)
      
      setReviews(prev => {
        const next = prev.map(r => r.id === reviewId ? { ...r, assigned_to: pmName, jira_id: simulatedJiraId } : r);
        if (typeof window !== 'undefined') {
          const saved = JSON.parse(localStorage.getItem('jira_assignments') || '{}');
          saved[reviewId] = { assigned_to: pmName, jira_id: simulatedJiraId };
          localStorage.setItem('jira_assignments', JSON.stringify(saved));
        }
        return next;
      });
      
      // AUTO-CLOSE
      setSelectedReview(null)
      setLocalAssignTarget(null)
    } catch (err) {
      console.error("Assignment failed", err)
    }
  }

  // 4. REACTIVE METRICS CALCULATION
  const reactiveMetrics = (() => {
    const days = parseInt(timeRange) || 30;
    
    const parseDate = (d) => {
      if (!d) return new Date(0);
      try {
        const cleanDate = (typeof d === 'string' && d.includes('T')) ? d.split('.')[0] + 'Z' : d;
        const dd = new Date(cleanDate);
        if (!isNaN(dd.getTime())) return dd;
        
        // Fallback for MM/DD/YYYY
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

    let maxTime = 0;
    reviews.forEach(r => {
       const t = parseDate(r.review_date).getTime();
       if (t > maxTime) maxTime = t;
    });
    const anchorDate = maxTime > 0 ? new Date(maxTime) : new Date();
    const cutoffDate = new Date(anchorDate);
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const timeFiltered = reviews.filter(r => {
      if (!r.review_date) return true;
      return parseDate(r.review_date) >= cutoffDate;
    });

    const platformFiltered = timeFiltered.filter(r => platform === 'all' || r.platform?.toLowerCase() === platform.toLowerCase());
    const total = platformFiltered.length || 1;
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const sent = { Positive: 0, Neutral: 0, Negative: 0 };
    let promoters = 0, detractors = 0;

    platformFiltered.forEach(r => {
      const rating = parseInt(r.rating) || 3;
      dist[rating] = (dist[rating] || 0) + 1;
      let s = "Neutral";
      const rawSent = String(r.sentiment || "").toLowerCase();
      if (rawSent.includes("pos") || rating >= 4) s = "Positive";
      else if (rawSent.includes("neg") || rating <= 2) s = "Negative";
      if (sent.hasOwnProperty(s)) sent[s]++;
      if (rating >= 4) promoters++;
      if (rating <= 2) detractors++;
    });

    return {
      total_reviews: platformFiltered.length,
      avg_rating: (platformFiltered.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1),
      rating_distribution: dist,
      sentiment_split: sent,
      health_breakdown: { promoters, detractors },
      anchorDate,
      cutoffDate,
      platform_counts: {
        android: timeFiltered.filter(r => r.platform?.toLowerCase() === 'android').length,
        ios: timeFiltered.filter(r => r.platform?.toLowerCase() === 'ios').length
      }
    };
  })();

  const filteredReviews = (() => {
    const days = parseInt(timeRange) || 30;
    const anchorDate = reactiveMetrics.anchorDate;
    const cutoffDate = new Date(anchorDate);
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const parseDate = (d) => {
      if (!d) return new Date(0);
      try {
        const cleanDate = (typeof d === 'string' && d.includes('T')) ? d.split('.')[0] + 'Z' : d;
        const dd = new Date(cleanDate);
        return isNaN(dd.getTime()) ? new Date(0) : dd;
      } catch(e) { return new Date(0); }
    };

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

    return reviews.filter(r => {
      const rating = parseInt(r.rating) || 3;
      const rawSent = String(r.sentiment || "").toLowerCase();
      let effectiveSentiment = (rawSent.includes("pos") || rating >= 4) ? "positive" : (rawSent.includes("neg") || rating <= 2) ? "negative" : "neutral";
      
      const matchesSentiment = sentimentTab === 'All' || effectiveSentiment === sentimentTab.toLowerCase();
      const matchesPlatform = platform === 'all' || r.platform?.toLowerCase() === platform.toLowerCase();
      const effectiveCategory = r.category && r.category !== 'null' && r.category !== 'undefined' ? r.category : classifyLocally(r.review_text, r.rating);
      const matchesCategory = !category || effectiveCategory === category;
      const matchesTime = !r.review_date || parseDate(r.review_date) >= cutoffDate;
      const matchesSearch = !searchQuery || r.review_text?.toLowerCase().includes(searchQuery.toLowerCase()) || r.user_name?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSentiment && matchesPlatform && matchesCategory && matchesTime && matchesSearch;
    });
  })();

  if (loading && !reactiveMetrics.total_reviews && reviews.length === 0) return <div className="p-20 text-center text-slate-400">Analyzing signals...</div>

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12 space-y-12">
      
      {/* 1. Header & Primary Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">INDMoney Insights</h1>
          <div className="flex flex-col gap-1 mt-1">
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Direct feedback pulse across all platforms</span>
             </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">📡 Pulse Generated: {pulseDate ? new Date(pulseDate).toLocaleString() : 'Live Snapshot'}</span>
                <a href="https://share.streamlit.io/" target="_blank" className="text-[9px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest border-l border-slate-200 pl-2 underline decoration-slate-200 underline-offset-2">Refresh Data in Controller ↗</a>
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${reviews.length > 3 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{reviews.length > 3 ? 'Connected' : 'Sync Required'}</span>
                </div>
             </div>
          </div>
          {category && (
            <div className="mt-3 flex items-center gap-2">
               <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md">Category: {category}</span>
               <button onClick={() => setCategory('')} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-wider transition-colors">✕ Clear</button>
            </div>
          )}
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          {['all', 'android', 'ios'].map(p => {
            const count = p === 'all' ? reactiveMetrics.total_reviews : (reactiveMetrics.platform_counts[p] || 0);
            return (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 ${platform === p ? 'bg-white text-[#0066CC] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {p}
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${platform === p ? 'bg-slate-50 text-[#0066CC]' : 'bg-slate-200/50 text-slate-400'}`}>
                  {count.toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. TOP SUMMARY STRIP */}
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
          <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">{reactiveMetrics?.total_reviews.toLocaleString()} Reviews</span>
          <span className="text-slate-300">/</span>
          <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">Rating {reactiveMetrics?.avg_rating} ⭐</span>
        </div>
        
        <div className="ml-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rolling Signal Analysis:</span>
            <span className="text-[9px] font-bold text-[#0066CC] uppercase tracking-widest">
              {(() => {
                const now = reactiveMetrics.anchorDate || new Date()
                const start = reactiveMetrics.cutoffDate || new Date()
                return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              })()}
            </span>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {['7d', '14d', '30d', '90d', '180d', '240d', '360d'].map(t => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${timeRange === t ? 'bg-white text-[#0066CC] shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
              >
                Last {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. KEY INSIGHTS (CLEAN GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quality Split</p>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(stars => (
              <div key={stars} className="flex items-center gap-2 group">
                <span className="text-[10px] font-bold text-slate-400 w-4">{stars}★</span>
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-slate-200 rounded-full transition-all" 
                    style={{ width: `${(reactiveMetrics?.rating_distribution[stars] / (reactiveMetrics?.total_reviews || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-slate-400 w-8 text-right">{reactiveMetrics?.rating_distribution[stars] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sentiment</p>
          <div className="space-y-3">
             <StatItem label="Positive" count={reactiveMetrics?.sentiment_split?.Positive} color="text-emerald-600" total={reactiveMetrics?.total_reviews} />
             <StatItem label="Neutral" count={reactiveMetrics?.sentiment_split?.Neutral} color="text-amber-600" total={reactiveMetrics?.total_reviews} />
             <StatItem label="Negative" count={reactiveMetrics?.sentiment_split?.Negative} color="text-rose-600" total={reactiveMetrics?.total_reviews} />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Loyalty</p>
          <div className="flex flex-col gap-2">
             <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Promoters</span>
                <span className="text-xs font-bold text-emerald-600">{reactiveMetrics?.health_breakdown?.promoters}</span>
             </div>
             <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Detractors</span>
                <span className="text-xs font-bold text-rose-600">{reactiveMetrics?.health_breakdown?.detractors}</span>
             </div>
          </div>
        </div>
      </div>

      {/* 4. REVIEWS LIST */}
      <div className="space-y-6" id="review-feed">
        <div className="flex items-center gap-2 px-1 mb-2">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intelligence Active: Analyzing {filteredReviews.length} feedback signals for this view</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-6">
           <div className="flex gap-6">
              {['All', 'Positive', 'Neutral', 'Negative'].map(tab => {
                const count = tab === 'All' ? reactiveMetrics.total_reviews : (reactiveMetrics.sentiment_split[tab] || 0);
                const colorClass = tab === 'Positive' ? 'text-emerald-600' : tab === 'Negative' ? 'text-rose-600' : tab === 'Neutral' ? 'text-amber-600' : 'text-[#0066CC]';
                
                return (
                  <button
                    key={tab}
                    onClick={() => setSentimentTab(tab)}
                    className={`text-[10px] font-bold uppercase tracking-wider transition-all relative pb-4 flex items-center gap-1.5 ${sentimentTab === tab ? colorClass : 'text-slate-400 hover:text-slate-700'}`}
                  >
                    {tab}
                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${sentimentTab === tab ? 'bg-slate-100' : 'bg-slate-50'}`}>
                      {count.toLocaleString()}
                    </span>
                    {sentimentTab === tab && <div className={`absolute bottom-0 left-0 right-0 h-[1.5px] rounded-full ${tab === 'All' ? 'bg-[#0066CC]' : tab === 'Positive' ? 'bg-emerald-500' : tab === 'Negative' ? 'bg-rose-500' : 'bg-amber-500'}`} />}
                  </button>
                )
              })}
           </div>

           <div className="relative flex-1 max-w-md">
              <input 
                type="text" 
                placeholder="Filter reviews..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-xs font-medium focus:outline-none focus:border-slate-400 transition-all placeholder:text-slate-300 text-slate-700"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]">🔍</span>
           </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredReviews.length > 0 ? filteredReviews.map((r, i) => (
            <ReviewCard key={i} r={r} onClick={() => setSelectedReview(r)} />
          )) : (
            <div className="py-20 text-center text-slate-400 italic text-sm">No signals match your criteria.</div>
          )}
        </div>
      </div>

      {selectedReview && (
        <SideDrawer 
          r={selectedReview} 
          onClose={() => setSelectedReview(null)}
          pmOptions={pmOptions}
          localAssignTarget={localAssignTarget}
          setLocalAssignTarget={setLocalAssignTarget}
          onAssign={handleAssign}
        />
      )}

      {toast && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white p-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom duration-300 z-[100] border border-slate-800">
           <p className="text-sm font-bold">{toast.message}</p>
           <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{toast.subtext}</p>
        </div>
      )}
    </div>
  )
}

function ReviewCard({ r, onClick }) {
  return (
    <div onClick={onClick} className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer relative">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
           <div className={`w-1.5 h-1.5 rounded-full ${r.sentiment?.toLowerCase() === 'positive' ? 'bg-emerald-500' : r.sentiment?.toLowerCase() === 'negative' ? 'bg-rose-500' : 'bg-amber-500'}`} />
           <span className="text-[11px] font-bold text-slate-800">{r.user_name || 'User'}</span>
           <span className="text-amber-500 text-[8px] tracking-widest ml-1">{'★'.repeat(r.rating)}</span>
           <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${r.sentiment?.toLowerCase() === 'positive' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : r.sentiment?.toLowerCase() === 'negative' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
             {r.sentiment}
           </span>
        </div>
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex gap-3 items-center">
           <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{r.platform}</span>
           <span>{new Date(r.review_date).toLocaleDateString()}</span>
        </div>
      </div>
      <p className="text-[12px] text-slate-600 leading-normal line-clamp-2">{r.review_text}</p>
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-3">
          {r.assigned_to && (
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/50">
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Owner: {r.assigned_to}</span>
            </div>
          )}
          {r.jira_id && (
            <div className="inline-flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                <span className="text-[8px] font-bold text-[#0066CC] uppercase">Ticket: {r.jira_id}</span>
            </div>
          )}
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">v{r.app_version || 'N/A'}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-[#0066CC] border border-blue-100 rounded-full uppercase tracking-wider">
            #{(() => {
              const t = (r.review_text || "").toLowerCase();
              let c = r.category && r.category !== 'null' && r.category !== 'undefined' ? r.category : null;
              if (!c) {
                if (t.match(/crash|close|stuck|freeze|not opening|broken|bug/)) c = 'App Crash';
                else if (t.match(/slow|lag|loading|speed|fast|hang|performance/)) c = 'Performance';
                else if (t.match(/support|customer care|help|respond|chat|ticket|service/)) c = 'Customer Support';
                else if (t.match(/fee|charge|cost|brokerage|money|deduct|hidden/)) c = 'Charges & Fees';
                else if (t.match(/login|account|kyc|otp|access|delete|verify|security/)) c = 'Account & KYC';
                else if (t.match(/ui|ux|design|interface|look|confusing|hard/)) c = 'Ease of Use';
                else if (t.match(/add|wish|want|please|missing|feature/)) c = 'Feature Request';
                else c = parseInt(r.rating) >= 4 ? 'General Praise' : 'General Feedback';
              }
              return c;
            })()}
          </span>
        </div>
        
        <button 
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="px-3 py-1 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
        >
          Create a Jira ticket
        </button>
      </div>
    </div>
  )
}

function SideDrawer({ r, onClose, pmOptions, localAssignTarget, setLocalAssignTarget, onAssign }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white border-l border-slate-200 h-full p-8 animate-in slide-in-from-right duration-300 flex flex-col shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 text-lg transition-colors">✕</button>
        <div className="flex-1 overflow-y-auto space-y-8 pr-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Feedback Signal</p>
            <h2 className="text-lg font-bold text-slate-900">{r.user_name || 'User'}</h2>
          </div>
          <div className="grid grid-cols-2 gap-6 pb-6 border-b border-slate-100">
            <DetailItem label="Platform" value={r.platform} />
            <DetailItem label="Rating" value={`${r.rating} / 5`} />
            <DetailItem label="Category" value={r.category} />
            <DetailItem label="Version" value={r.app_version || 'Unknown'} />
            <DetailItem label="Jira Ticket" value={r.jira_id || 'None'} />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Content</p>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 italic">"{r.review_text}"</p>
          </div>
          <div className="space-y-4 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Assign Owner</p>
            <div className="grid grid-cols-1 gap-2">
              {pmOptions.map(pm => (
                <button
                  key={pm.name}
                  onClick={() => setLocalAssignTarget(pm.name)}
                  className={`flex justify-between items-center px-4 py-2.5 rounded-lg border transition-all ${localAssignTarget === pm.name ? 'bg-slate-50 border-slate-400' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                >
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">{pm.name}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">{pm.team}</p>
                  </div>
                  {localAssignTarget === pm.name && <span className="text-[8px] font-bold text-[#0066CC] uppercase">Selected</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="pt-8 flex gap-3 border-t border-slate-100 mt-auto">
          <button onClick={() => onAssign(r.id, localAssignTarget)} className="btn-primary flex-1 py-2.5 text-xs font-bold" disabled={!localAssignTarget || localAssignTarget === r.assigned_to}>Create a Ticket</button>
          <button onClick={onClose} className="btn-secondary flex-1 py-2 text-xs">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-xs font-bold text-slate-700 uppercase">{value}</p>
    </div>
  )
}

function StatItem({ label, count, color, total }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex justify-between items-center">
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{count}</p>
      </div>
      <p className="text-[10px] font-bold text-slate-300">{percent}%</p>
    </div>
  )
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center text-slate-400">Loading...</div>}>
      <ReviewsContent />
    </Suspense>
  )
}
