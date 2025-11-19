import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Eye, 
  Clock, 
  TrendingUp, 
  Activity,
  Monitor,
  Smartphone,
  Globe,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { PageLoading } from '@/components/LoadingSpinner';
import { NoDataEmptyState } from '@/components/EmptyState';
import ErrorBoundary from '@/components/ErrorBoundary';
import Alert from '@/components/Alert';

const dateRangeOptions = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom Range' }
];

export default function AnalyticsDashboard() {
  const { 
    analyticsData, 
    isLoading, 
    error, 
    loadAnalytics 
  } = useAnalyticsStore();

  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange, customStart, customEnd]);

  const loadAnalyticsData = () => {
    let range = undefined;
    
    if (dateRange === 'custom' && customStart && customEnd) {
      range = { start: customStart, end: customEnd };
    } else if (dateRange !== 'custom') {
      const days = parseInt(dateRange);
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      range = { start, end };
    }

    loadAnalytics(range);
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ 
          dateRange,
          customStart: dateRange === 'custom' ? customStart : undefined,
          customEnd: dateRange === 'custom' ? customEnd : undefined
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (isLoading && !analyticsData) {
    return <PageLoading text="Loading analytics dashboard..." />;
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BarChart3 size={32} className="text-blue-600" />
              Analytics Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive insights into user behavior and platform performance
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => loadAnalyticsData()}
              className="btn-outline flex items-center gap-2"
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={exportData}
              className="btn-primary flex items-center gap-2"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {error && (
          <Alert type="error" onDismiss={() => {}}>
            {error}
          </Alert>
        )}

        {/* Date Range Selector */}
        <div className="card">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Date Range:</span>
            </div>
            
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {dateRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>
        </div>

        {!analyticsData ? (
          <NoDataEmptyState
            title="No Analytics Data"
            description="Analytics data will appear here once users start interacting with the platform."
          />
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card">
                <div className="flex items-center gap-3">
                  <Users size={24} className="text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(analyticsData.totalUsers)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-sm text-green-600">
                  {analyticsData.activeUsers} active users
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-3">
                  <Activity size={24} className="text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(analyticsData.totalSessions)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-sm text-blue-600">
                  {formatDuration(analyticsData.avgSessionDuration)} avg duration
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-3">
                  <Eye size={24} className="text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Page Views</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(analyticsData.pageViews)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-sm text-orange-600">
                  {analyticsData.userEngagement.pagesPerSession.toFixed(1)} per session
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-3">
                  <Globe size={24} className="text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Realtime Users</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsData.realtimeUsers}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Live
                </div>
              </div>
            </div>

            {/* User Engagement */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Engagement</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Bounce Rate</span>
                    <span className="font-semibold text-gray-900">
                      {(analyticsData.userEngagement.bounceRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg. Time on Site</span>
                    <span className="font-semibold text-gray-900">
                      {formatDuration(analyticsData.userEngagement.avgTimeOnSite)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Pages per Session</span>
                    <span className="font-semibold text-gray-900">
                      {analyticsData.userEngagement.pagesPerSession.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Registration Rate</span>
                    <span className="font-semibold text-green-600">
                      {(analyticsData.conversionMetrics.registrationRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subscription Rate</span>
                    <span className="font-semibold text-blue-600">
                      {(analyticsData.conversionMetrics.subscriptionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Lesson Completion</span>
                    <span className="font-semibold text-purple-600">
                      {(analyticsData.conversionMetrics.lessonCompletionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Pages */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Page
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyticsData.topPages.map((page, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {page.page}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatNumber(page.views)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-primary-600 h-2 rounded-full" 
                                style={{ width: `${page.percentage}%` }}
                              ></div>
                            </div>
                            <span>{page.percentage.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock size={20} className="text-blue-600" />
                    <span className="text-sm text-gray-600">Avg Load Time</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {(analyticsData.performanceMetrics.avgLoadTime / 1000).toFixed(2)}s
                  </span>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp size={20} className="text-green-600" />
                    <span className="text-sm text-gray-600">Error Rate</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {(analyticsData.performanceMetrics.errorRate * 100).toFixed(2)}%
                  </span>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Activity size={20} className="text-purple-600" />
                    <span className="text-sm text-gray-600">API Response</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {analyticsData.performanceMetrics.apiResponseTime}ms
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}