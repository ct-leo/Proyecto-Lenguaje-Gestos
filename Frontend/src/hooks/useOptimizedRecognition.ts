import { useCallback, useMemo, useRef } from 'react';
import type { Landmark } from '../lib/api';

interface UseOptimizedRecognitionOptions {
  debounceMs?: number;
  maxProcessingRate?: number;
  enableSmoothing?: boolean;
  confidenceThreshold?: number;
}

interface RecognitionResult {
  letter: string | null;
  confidence: number;
  isStable: boolean;
  processingTime: number;
}

export const useOptimizedRecognition = (
  recognitionFn: (landmarks: Landmark[]) => { letter: string | null; confidence: number },
  options: UseOptimizedRecognitionOptions = {}
) => {
  const {
    debounceMs = 100,
    maxProcessingRate = 10, // max 10 FPS
    enableSmoothing = true,
    confidenceThreshold = 0.5
  } = options;

  const lastProcessTime = useRef(0);
  const debounceTimer = useRef<number>();
  // const resultHistory = useRef<RecognitionResult[]>([]); // Para uso futuro
  const smoothingWindow = useRef<{ letter: string; confidence: number; timestamp: number }[]>([]);

  // Debounced recognition function
  const debouncedRecognition = useCallback((
    landmarks: Landmark[],
    callback: (result: RecognitionResult) => void
  ) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = window.setTimeout(() => {
      const now = Date.now();
      
      // Rate limiting
      if (now - lastProcessTime.current < 1000 / maxProcessingRate) {
        return;
      }

      const startTime = performance.now();
      
      try {
        const result = recognitionFn(landmarks);
        const processingTime = performance.now() - startTime;

        if (enableSmoothing) {
          // Add to smoothing window
          smoothingWindow.current.push({
            letter: result.letter || '',
            confidence: result.confidence || 0,
            timestamp: now
          });

          // Keep only recent results within smoothing window (500ms)
          smoothingWindow.current = smoothingWindow.current.filter(
            item => now - item.timestamp <= 500
          );

          // Calculate smoothed result
          const smoothedResult = calculateSmoothedResult(smoothingWindow.current);
          
          const finalResult: RecognitionResult = {
            letter: smoothedResult.letter,
            confidence: smoothedResult.confidence,
            isStable: smoothedResult.stability > 0.7,
            processingTime
          };

          callback(finalResult);
        } else {
          const finalResult: RecognitionResult = {
            letter: result.letter,
            confidence: result.confidence,
            isStable: result.confidence > confidenceThreshold,
            processingTime
          };

          callback(finalResult);
        }

        lastProcessTime.current = now;
      } catch (error) {
        console.error('Recognition error:', error);
        callback({
          letter: null,
          confidence: 0,
          isStable: false,
          processingTime: performance.now() - startTime
        });
      }
    }, debounceMs);
  }, [recognitionFn, debounceMs, maxProcessingRate, enableSmoothing, confidenceThreshold]);

  // Memoized feature extraction (if needed)
  const memoizedFeatureExtraction = useMemo(() => {
    const cache = new Map<string, number[]>();
    const maxCacheSize = 100;

    return (landmarks: Landmark[]): number[] => {
      // Create a simple hash of landmarks for caching
      const hash = landmarks.map(l => `${l.x?.toFixed(3) || 0},${l.y?.toFixed(3) || 0},${l.z?.toFixed(3) || 0}`).join('|');
      
      if (cache.has(hash)) {
        return cache.get(hash)!;
      }

      // Extract features (this would be your actual feature extraction logic)
      const features = extractFeatures(landmarks);
      
      // Manage cache size
      if (cache.size >= maxCacheSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      cache.set(hash, features);
      return features;
    };
  }, []);

  // Performance monitoring
  const performanceStats = useRef({
    totalProcessingTime: 0,
    processedFrames: 0,
    averageProcessingTime: 0,
    maxProcessingTime: 0
  });

  const updatePerformanceStats = useCallback((processingTime: number) => {
    const stats = performanceStats.current;
    stats.totalProcessingTime += processingTime;
    stats.processedFrames += 1;
    stats.averageProcessingTime = stats.totalProcessingTime / stats.processedFrames;
    stats.maxProcessingTime = Math.max(stats.maxProcessingTime, processingTime);
  }, []);

  const getPerformanceStats = useCallback(() => ({
    ...performanceStats.current
  }), []);

  const resetPerformanceStats = useCallback(() => {
    performanceStats.current = {
      totalProcessingTime: 0,
      processedFrames: 0,
      averageProcessingTime: 0,
      maxProcessingTime: 0
    };
  }, []);

  return {
    debouncedRecognition,
    memoizedFeatureExtraction,
    getPerformanceStats,
    resetPerformanceStats,
    updatePerformanceStats
  };
};

// Helper function to calculate smoothed result
function calculateSmoothedResult(window: { letter: string; confidence: number; timestamp: number }[]) {
  if (window.length === 0) {
    return { letter: null, confidence: 0, stability: 0 };
  }

  // Count occurrences of each letter
  const letterCounts = new Map<string, { count: number; totalConfidence: number }>();
  
  window.forEach(({ letter, confidence }) => {
    if (letter) {
      const current = letterCounts.get(letter) || { count: 0, totalConfidence: 0 };
      letterCounts.set(letter, {
        count: current.count + 1,
        totalConfidence: current.totalConfidence + confidence
      });
    }
  });

  if (letterCounts.size === 0) {
    return { letter: null, confidence: 0, stability: 0 };
  }

  // Find the most frequent letter
  let bestLetter = '';
  let bestScore = 0;
  let bestConfidence = 0;

  letterCounts.forEach(({ count, totalConfidence }, letter) => {
    const avgConfidence = totalConfidence / count;
    const score = count * avgConfidence; // Frequency * confidence
    
    if (score > bestScore) {
      bestScore = score;
      bestLetter = letter;
      bestConfidence = avgConfidence;
    }
  });

  // Calculate stability (how consistent the results are)
  const stability = (letterCounts.get(bestLetter)?.count || 0) / window.length;

  return {
    letter: bestLetter || null,
    confidence: bestConfidence,
    stability
  };
}

// Placeholder feature extraction function
function extractFeatures(landmarks: Landmark[]): number[] {
  // This would contain your actual feature extraction logic
  // For now, just return a simple array based on landmarks
  return landmarks.flatMap(l => [l.x, l.y, l.z]);
}

export default useOptimizedRecognition;
