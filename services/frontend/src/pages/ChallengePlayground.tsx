import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Play, 
  Send, 
  ChevronLeft, 
  Check, 
  X,
  AlertCircle,
  Code,
  FileCode
} from 'lucide-react';
import type { Challenge, ChallengeTestResult } from '@/types/curriculum';
import curriculumService from '@/services/curriculum';
import { showSuccess, showError, showXPGain } from '@/utils/toast';
import { useCurriculumStore } from '@/stores/curriculumStore';

export default function ChallengePlayground() {
  const { id } = useParams<{ id: string }>();
  const { refreshProgress } = useCurriculumStore();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [testResults, setTestResults] = useState<ChallengeTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      return;
    }
    const fetchChallenge = async () => {
      setLoading(true);
      try {
        const challengeData = await curriculumService.getChallenge(id);
        setChallenge(challengeData);
        setCode(challengeData.starter_code || '// Write your code here\n');
      } catch (error) {
        console.error('Failed to load challenge:', error);
        showError('Failed to load challenge');
      } finally {
        setLoading(false);
      }
    };

    void fetchChallenge();
  }, [id]);

  const handleRunTests = async () => {
    setIsRunning(true);
    setOutput('');
    setTestResults([]);

    try {
      // Simulate test execution (actual execution would be via sandbox API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock test results
      const mockResults = challenge?.test_cases?.map((tc, idx) => ({
        test: `Test ${idx + 1}`,
        passed: Math.random() > 0.3,
        expected: tc.expected,
        actual: 'Result output',
      })) || [];

      setTestResults(mockResults);
      setOutput('Tests completed. Check results below.');
    } catch (error) {
      console.error('Failed to run tests:', error);
      showError('Failed to run tests');
      setOutput('Error running tests');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!challenge) return;

    setIsSubmitting(true);
    try {
      const result = await curriculumService.submitChallenge(challenge.id, code);
      
      await refreshProgress();
      
      showSuccess('Challenge submitted successfully!');
      if (result.xp_awarded) {
        showXPGain(result.xp_awarded);
      }
    } catch (error) {
      console.error('Failed to submit challenge:', error);
      const fallbackMessage = 'Failed to submit challenge';
      if (error && typeof error === 'object' && 'response' in error) {
        const maybeResponse = (error as { response?: { data?: { message?: string } } }).response;
        showError(maybeResponse?.data?.message || fallbackMessage);
      } else {
        showError(fallbackMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Challenge Not Found</h2>
          <p className="text-gray-600 mb-4">The challenge you're looking for doesn't exist.</p>
          <Link to="/levels" className="btn-primary">
            Back to Levels
          </Link>
        </div>
      </div>
    );
  }

  const passedTests = testResults.filter(r => r.passed).length;
  const totalTests = testResults.length;

  const formatResultValue = (value: unknown): string => {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (serializationError) {
      console.warn('Failed to stringify result value:', serializationError);
      return String(value);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/levels" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft size={20} />
          <span>Back to Levels</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className={`badge ${
            challenge.difficulty === 'easy' ? 'badge-success' :
            challenge.difficulty === 'medium' ? 'badge-secondary' :
            challenge.difficulty === 'hard' ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            {challenge.difficulty.toUpperCase()}
          </span>
          <span className="badge-primary">{challenge.xp_reward} XP</span>
        </div>
      </div>

      {/* Main Layout: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-12rem)]">
        {/* Instructions Panel */}
        <div className="lg:col-span-4 overflow-y-auto">
          <div className="card h-full">
            <div className="flex items-center gap-2 mb-4">
              <FileCode size={24} className="text-primary-800" />
              <h1 className="text-2xl font-bold text-gray-900">{challenge.title}</h1>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700 text-sm">{challenge.description}</p>
              </div>

              {challenge.test_cases && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Test Cases</h3>
                  <div className="space-y-2">
                    {challenge.test_cases.slice(0, 3).map((testCase, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded text-sm font-mono">
                        <div className="text-gray-600">Input: {JSON.stringify(testCase.input)}</div>
                        <div className="text-gray-900">Output: {JSON.stringify(testCase.expected)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {challenge.time_limit_minutes && (
                <div className="p-3 bg-accent-50 border border-accent-200 rounded">
                  <div className="text-sm">
                    <span className="font-semibold text-accent-800">Time Limit:</span>{' '}
                    <span className="text-gray-700">{challenge.time_limit_minutes} minutes</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code Editor */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="card flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Code size={20} className="text-primary-800" />
                <h2 className="text-lg font-bold text-gray-900">Code Editor</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunTests}
                  disabled={isRunning}
                  className="btn-outline flex items-center gap-2 text-sm py-2"
                >
                  <Play size={16} />
                  {isRunning ? 'Running...' : 'Run Tests'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || isRunning}
                  className="btn-primary flex items-center gap-2 text-sm py-2"
                >
                  <Send size={16} />
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>

            <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                value={code}
                onChange={(value) => setCode(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3 overflow-y-auto">
          <div className="card h-full">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Test Results</h2>

            {testResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-sm">Run tests to see results</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm font-semibold text-gray-900 mb-1">
                    {passedTests} / {totalTests} Tests Passed
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        passedTests === totalTests ? 'bg-green-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${(passedTests / totalTests) * 100}%` }}
                    />
                  </div>
                </div>

                {testResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border-2 ${
                      result.passed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {result.passed ? (
                        <Check size={20} className="text-green-600" />
                      ) : (
                        <X size={20} className="text-red-600" />
                      )}
                      <span className="font-semibold text-gray-900">{result.test}</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      <div>Expected: {formatResultValue(result.expected)}</div>
                      <div>Actual: {formatResultValue(result.actual)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {output && (
              <div className="mt-4 p-3 bg-gray-900 text-gray-100 rounded text-sm font-mono">
                {output}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Note about sandbox */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <strong>Note:</strong> This is a demo implementation. In production, code execution would run in a secure sandbox environment with actual test validation.
          </div>
        </div>
      </div>
    </div>
  );
}
