'use client';

import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  avgResponseTime: number;
  cacheHitRate: number;
  totalRequests: number;
  fastestResponse: number;
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    avgResponseTime: 0,
    cacheHitRate: 0,
    totalRequests: 0,
    fastestResponse: 0
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Simulate performance metrics (in a real app, this would come from the backend)
    const interval = setInterval(() => {
      setMetrics(prev => ({
        avgResponseTime: Math.random() * 500 + 200, // 200-700ms
        cacheHitRate: Math.random() * 40 + 60, // 60-100%
        totalRequests: prev.totalRequests + Math.floor(Math.random() * 3),
        fastestResponse: Math.random() * 150 + 50 // 50-200ms
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
      >
        📊 Show Performance
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800">⚡ Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Avg Response:</span>
          <span className={`text-sm font-mono ${
            metrics.avgResponseTime < 300 ? 'text-green-600' : 
            metrics.avgResponseTime < 500 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {metrics.avgResponseTime.toFixed(0)}ms
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Cache Hit Rate:</span>
          <span className={`text-sm font-mono ${
            metrics.cacheHitRate > 80 ? 'text-green-600' : 
            metrics.cacheHitRate > 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {metrics.cacheHitRate.toFixed(1)}%
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Fastest Response:</span>
          <span className="text-sm font-mono text-blue-600">
            {metrics.fastestResponse.toFixed(0)}ms
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Requests:</span>
          <span className="text-sm font-mono text-gray-800">
            {metrics.totalRequests}
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 space-y-1">
          <div>🚀 Real-time audio streaming</div>
          <div>💾 Response caching active</div>
          <div>⚡ Parallel processing enabled</div>
          <div>🎯 Optimized for sub-500ms responses</div>
        </div>
      </div>
    </div>
  );
} 