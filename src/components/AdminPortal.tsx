import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  adminLogin,
  adminGetStats,
  adminLogout,
  getStoredAdminToken,
  AnalyticsStats,
} from '../utils/analytics.ts';
import {
  Users,
  Eye,
  Play,
  Award,
  Download,
  Share2,
  RefreshCw,
  LogOut,
  ArrowLeft,
  Smartphone,
  Monitor,
  Tablet,
  Lock,
  User,
  AlertCircle,
  Clock,
  Activity,
  Flame,
} from 'lucide-react';

interface AdminPortalProps {
  onBackToGame: () => void;
}

type TimeRange = '1h' | '6h' | '12h' | '24h' | 'all';

export function AdminPortal({ onBackToGame }: AdminPortalProps) {
  const [token, setToken] = useState<string | null>(() => getStoredAdminToken());
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [selectedRange, setSelectedRange] = useState<TimeRange>('24h');
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh interval ref
  const autoRefreshTimerRef = useRef<number | null>(null);

  // Fetch stats handler
  const loadStats = useCallback(
    async (range: TimeRange, authToken?: string) => {
      const activeToken = authToken || token;
      if (!activeToken) return;

      setIsLoadingStats(true);
      setStatsError(null);
      try {
        const data = await adminGetStats(range, activeToken);
        setStats(data);
        setLastUpdated(new Date());
      } catch (err: any) {
        setStatsError(err.message || 'ডাটা লোড করতে সমস্যা হয়েছে।');
        if (err.message && err.message.includes('লগইন')) {
          setToken(null);
        }
      } finally {
        setIsLoadingStats(false);
      }
    },
    [token]
  );

  // Initial load when token changes or range changes
  useEffect(() => {
    if (token) {
      loadStats(selectedRange, token);
    }
  }, [token, selectedRange, loadStats]);

  // Setup auto-refresh every 10 seconds for real-time live visitors monitoring
  useEffect(() => {
    if (!token || !autoRefresh) {
      if (autoRefreshTimerRef.current) {
        window.clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
      return;
    }

    autoRefreshTimerRef.current = window.setInterval(() => {
      loadStats(selectedRange, token);
    }, 10000);

    return () => {
      if (autoRefreshTimerRef.current) {
        window.clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [token, autoRefresh, selectedRange, loadStats]);

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await adminLogin(usernameInput.trim(), passwordInput);
      if (res.success && res.token) {
        setToken(res.token);
        setUsernameInput('');
        setPasswordInput('');
      } else {
        setLoginError(res.error || 'ভুল ইউজারনেম বা পাসওয়ার্ড।');
      }
    } catch (err: any) {
      setLoginError(err.message || 'সার্ভারে সংযোগ ব্যর্থ হয়েছে।');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await adminLogout();
    setToken(null);
    setStats(null);
  };

  // Format relative timestamp
  const formatTimeAgo = (unixSeconds: number) => {
    const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
    if (diff < 15) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(unixSeconds * 1000).toLocaleDateString();
  };

  // -------------------------------------------------------------------------
  // 1. RENDER LOGIN SCREEN (If not authenticated)
  // -------------------------------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-screen bg-[#F4EFE6] text-[#2C1810] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E3D4C1] p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#8B4513]/10 text-[#8B4513] mb-3 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#381B0E]">
              Chakosh Admin Portal
            </h1>
            <p className="text-xs sm:text-sm text-[#7C5A43] mt-1">
              চা-খোর কুইজ লাইভ ট্র্যাকিং ও এনালিটিক্স ড্যাশবোর্ড
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7C5A43] mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A8907E]">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5C2AF] bg-[#FAF7F2] text-[#2C1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7C5A43] mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A8907E]">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5C2AF] bg-[#FAF7F2] text-[#2C1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#8B4513] hover:from-[#B45309] hover:to-[#78350F] active:scale-[0.98] text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>লগইন হচ্ছে...</span>
                </>
              ) : (
                <span>লগইন করুন</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#EAE0D2] flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToGame}
              className="text-xs font-semibold text-[#8B4513] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>গেম-এ ফিরে যান</span>
            </button>

            <span className="text-[11px] text-[#A8907E]">Chakosh Analytics v1.0</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. RENDER ADMIN DASHBOARD (Authenticated)
  // -------------------------------------------------------------------------
  const ranges: { key: TimeRange; label: string }[] = [
    { key: '1h', label: '1 Hour' },
    { key: '6h', label: '6 Hours' },
    { key: '12h', label: '12 Hours' },
    { key: '24h', label: '24 Hours' },
    { key: 'all', label: 'Lifetime' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#2C1810] pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E3D4C1] px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToGame}
              className="p-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#EDE3D5] text-[#5C2C16] transition-colors cursor-pointer"
              title="গেমে ফিরে যান"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-[#381B0E] tracking-tight">
                  Chakosh Analytics
                </h1>
                {/* Realtime Live Visitors Pulse Badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-300 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span>{stats ? stats.liveVisitors : '...'} LIVE</span>
                </div>
              </div>
              <p className="text-[11px] text-[#8C6D58]">
                লাইভ ট্র্যাকিং ও বিস্তারিত পারফর্মেন্স এনালিটিক্স
              </p>
            </div>
          </div>

          {/* Controls: Auto-refresh, manual refresh, logout */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-stone-100 border-stone-300 text-stone-600'
              }`}
              title="প্রতি ১০ সেকেন্ডে স্বয়ংক্রিয় রিফ্রেশ"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{autoRefresh ? 'Auto 10s' : 'Auto Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => loadStats(selectedRange)}
              disabled={isLoadingStats}
              className="px-3 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#EFE5D8] border border-[#D5C2AF] text-[#381B0E] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
        {/* Time Range Filter Bar */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E3D4C1] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Clock className="w-4 h-4 text-[#8B4513] shrink-0 mr-1" />
            <span className="text-xs font-bold text-[#7C5A43] mr-1 hidden sm:inline">Time Range:</span>
            {ranges.map((r) => {
              const active = selectedRange === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setSelectedRange(r.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[#8B4513] text-white shadow-sm'
                      : 'bg-[#FAF7F2] hover:bg-[#EFE5D8] text-[#5C2C16] border border-[#E7D6C3]'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-[#8C6D58] flex items-center gap-1.5">
            {lastUpdated && (
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
            )}
            {isLoadingStats && (
              <span className="text-amber-700 font-medium">· লোড হচ্ছে...</span>
            )}
          </div>
        </div>

        {statsError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{statsError}</span>
          </div>
        )}

        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Live Active Visitors */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3D4C1] shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C5A43]">
                Live Visitors
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#1E293B]">
              {stats ? stats.liveVisitors.toLocaleString() : '...'}
            </div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active in last 2 mins</span>
            </p>
          </div>

          {/* 2. Total Visitors & Page Views */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3D4C1] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C5A43]">
                Visitors
              </span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#1E293B]">
              {stats ? stats.uniqueVisitors.toLocaleString() : '...'}
            </div>
            <p className="text-[11px] text-[#7C5A43] mt-1 flex items-center gap-1">
              <Eye className="w-3 h-3 text-[#7C5A43]" />
              <span>{stats ? stats.totalVisits.toLocaleString() : 0} total page views</span>
            </p>
          </div>

          {/* 3. Quiz Plays Started */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3D4C1] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C5A43]">
                Plays Started
              </span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#1E293B]">
              {stats ? stats.plays.toLocaleString() : '...'}
            </div>
            <p className="text-[11px] text-amber-700 font-semibold mt-1">
              {stats ? `${stats.conversionRates.playRate}% play rate` : '...'}
            </p>
          </div>

          {/* 4. Quiz Completions */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3D4C1] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C5A43]">
                Completions
              </span>
              <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#1E293B]">
              {stats ? stats.completions.toLocaleString() : '...'}
            </div>
            <p className="text-[11px] text-purple-700 font-semibold mt-1">
              {stats ? `${stats.conversionRates.completionRate}% completion rate` : '...'}
            </p>
          </div>

          {/* 5. Photocard Downloads */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3D4C1] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C5A43]">
                Downloads
              </span>
              <span className="p-2 rounded-xl bg-orange-50 text-orange-600">
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#1E293B]">
              {stats ? stats.downloads.toLocaleString() : '...'}
            </div>
            <p className="text-[11px] text-orange-700 font-semibold mt-1">
              {stats ? `${stats.conversionRates.downloadRate}% download rate` : '...'}
            </p>
          </div>

          {/* 6. Facebook Share Clicks */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3D4C1] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C5A43]">
                Facebook Shares
              </span>
              <span className="p-2 rounded-xl bg-blue-50 text-[#1877F2]">
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#1E293B]">
              {stats ? stats.sharesFacebook.toLocaleString() : '...'}
            </div>
            <p className="text-[11px] text-blue-700 font-semibold mt-1">
              Facebook profile / share clicks
            </p>
          </div>

          {/* 7. Messenger Share Clicks */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3D4C1] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C5A43]">
                Messenger Shares
              </span>
              <span className="p-2 rounded-xl bg-sky-50 text-[#0084FF]">
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#1E293B]">
              {stats ? stats.sharesMessenger.toLocaleString() : '...'}
            </div>
            <p className="text-[11px] text-sky-700 font-semibold mt-1">
              Messenger direct share clicks
            </p>
          </div>

          {/* 8. Total Viral Shares */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3D4C1] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7C5A43]">
                Total Shares
              </span>
              <span className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#1E293B]">
              {stats ? stats.totalShares.toLocaleString() : '...'}
            </div>
            <p className="text-[11px] text-teal-700 font-semibold mt-1">
              {stats ? `${stats.conversionRates.shareRate}% share rate` : '...'}
            </p>
          </div>
        </div>

        {/* Funnel & Device Breakdown Dual Column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversion Funnel */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E3D4C1] shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#7C5A43] mb-4">
              Conversion Funnel ({ranges.find((r) => r.key === selectedRange)?.label})
            </h2>

            {stats && (
              <div className="space-y-3">
                {/* 1. Unique Visitors */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#381B0E] mb-1">
                    <span>1. Unique Visitors</span>
                    <span>{stats.uniqueVisitors.toLocaleString()} (100%)</span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>

                {/* 2. Started Quiz */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#381B0E] mb-1">
                    <span>2. Started Quiz</span>
                    <span>
                      {stats.plays.toLocaleString()} ({stats.conversionRates.playRate}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, stats.conversionRates.playRate)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* 3. Completed Quiz */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#381B0E] mb-1">
                    <span>3. Completed Quiz</span>
                    <span>
                      {stats.completions.toLocaleString()} (
                      {stats.uniqueVisitors > 0
                        ? Math.round((stats.completions / stats.uniqueVisitors) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          stats.uniqueVisitors > 0
                            ? Math.min(100, Math.round((stats.completions / stats.uniqueVisitors) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* 4. Downloaded Card */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#381B0E] mb-1">
                    <span>4. Photocard Downloaded</span>
                    <span>
                      {stats.downloads.toLocaleString()} (
                      {stats.uniqueVisitors > 0
                        ? Math.round((stats.downloads / stats.uniqueVisitors) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          stats.uniqueVisitors > 0
                            ? Math.min(100, Math.round((stats.downloads / stats.uniqueVisitors) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* 5. Shared on Social */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#381B0E] mb-1">
                    <span>5. Viral Shares (FB + Messenger)</span>
                    <span>
                      {stats.totalShares.toLocaleString()} (
                      {stats.uniqueVisitors > 0
                        ? Math.round((stats.totalShares / stats.uniqueVisitors) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          stats.uniqueVisitors > 0
                            ? Math.min(100, Math.round((stats.totalShares / stats.uniqueVisitors) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Device Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-[#E3D4C1] shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#7C5A43] mb-4">
                Device Breakdown
              </h2>

              {stats && (
                <div className="space-y-4">
                  {(() => {
                    const totalDev =
                      (stats.deviceBreakdown.mobile || 0) +
                      (stats.deviceBreakdown.desktop || 0) +
                      (stats.deviceBreakdown.tablet || 0);
                    const mobPct = totalDev > 0 ? Math.round((stats.deviceBreakdown.mobile / totalDev) * 100) : 0;
                    const deskPct = totalDev > 0 ? Math.round((stats.deviceBreakdown.desktop / totalDev) * 100) : 0;
                    const tabPct = totalDev > 0 ? Math.round((stats.deviceBreakdown.tablet / totalDev) * 100) : 0;

                    return (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE0D2]">
                          <div className="flex items-center gap-2.5">
                            <Smartphone className="w-5 h-5 text-emerald-600" />
                            <div>
                              <p className="text-xs font-bold text-[#381B0E]">Mobile</p>
                              <p className="text-[11px] text-[#7C5A43]">
                                {stats.deviceBreakdown.mobile.toLocaleString()} events
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-black text-emerald-700">{mobPct}%</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE0D2]">
                          <div className="flex items-center gap-2.5">
                            <Monitor className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="text-xs font-bold text-[#381B0E]">Desktop / Laptop</p>
                              <p className="text-[11px] text-[#7C5A43]">
                                {stats.deviceBreakdown.desktop.toLocaleString()} events
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-black text-blue-700">{deskPct}%</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE0D2]">
                          <div className="flex items-center gap-2.5">
                            <Tablet className="w-5 h-5 text-amber-600" />
                            <div>
                              <p className="text-xs font-bold text-[#381B0E]">Tablet / iPad</p>
                              <p className="text-[11px] text-[#7C5A43]">
                                {stats.deviceBreakdown.tablet.toLocaleString()} events
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-black text-amber-700">{tabPct}%</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#A8907E] mt-4 pt-3 border-t border-[#EAE0D2] text-center">
              সব ডিভাইস স্বয়ংক্রিয়ভাবে শনাক্ত ও ট্র্যাক হচ্ছে
            </p>
          </div>
        </div>

        {/* Live Realtime Activity Stream Table */}
        <div className="bg-white rounded-2xl p-5 border border-[#E3D4C1] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#7C5A43] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#8B4513]" />
              <span>Recent Activity Stream (Last 20 Events)</span>
            </h2>
            <span className="text-[11px] text-[#A8907E]">Real-time audit log</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAE0D2] text-[11px] font-bold uppercase tracking-wider text-[#7C5A43]">
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Device</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E6D8] text-xs">
                {stats && stats.recentEvents.length > 0 ? (
                  stats.recentEvents.map((evt, idx) => {
                    let badgeClass = 'bg-stone-100 text-stone-700';
                    let label = evt.event_type;

                    if (evt.event_type === 'visit') {
                      badgeClass = 'bg-blue-50 text-blue-700 border border-blue-200';
                      label = 'Page Visit';
                    } else if (evt.event_type === 'play') {
                      badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
                      label = 'Started Quiz';
                    } else if (evt.event_type === 'complete') {
                      badgeClass = 'bg-purple-50 text-purple-700 border border-purple-200';
                      label = 'Completed Quiz';
                    } else if (evt.event_type === 'download') {
                      badgeClass = 'bg-orange-50 text-orange-700 border border-orange-200';
                      label = 'Downloaded Card';
                    } else if (evt.event_type === 'share_facebook') {
                      badgeClass = 'bg-sky-50 text-[#1877F2] border border-sky-200';
                      label = 'FB Share Click';
                    } else if (evt.event_type === 'share_messenger') {
                      badgeClass = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                      label = 'Messenger Share Click';
                    }

                    let metadataDetails = '—';
                    if (evt.metadata) {
                      try {
                        const parsed = JSON.parse(evt.metadata);
                        if (parsed.title) {
                          metadataDetails = `${parsed.title} (স্কোর: ${parsed.score})`;
                        } else {
                          metadataDetails = JSON.stringify(parsed);
                        }
                      } catch {
                        metadataDetails = evt.metadata;
                      }
                    }

                    return (
                      <tr key={idx} className="hover:bg-[#FAF7F2] transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${badgeClass}`}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-[#5C2C16] capitalize">
                          {evt.device_type}
                        </td>
                        <td className="py-2.5 px-3 text-[#381B0E] max-w-xs truncate">
                          {metadataDetails}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-right font-medium text-[#7C5A43]">
                          {formatTimeAgo(evt.created_at)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#A8907E]">
                      এখনো কোনো ইভেন্ট রেকর্ড হয়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
