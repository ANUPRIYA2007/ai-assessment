'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/authStore';
import UserProfile from '@/components/UserProfile';
import { examsAPI } from '@/lib/api';

interface TestCase {
  id: number;
  input: string;
  output: string;
  isHidden: boolean;
}

export default function CreateCodingTest() {
  const { user, loadFromStorage } = useAuthStore();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    problemStatement: '',
    inputDescription: '',
    outputDescription: '',
    constraints: '',
    timeLimit: 5,
    memoryLimit: 256,
    startTime: '',
    endTime: '',
    scoringType: 'points' as 'points' | 'percentage',
    maxScore: 100,
    language: 'python',
    assigned_class: '',
    assigned_year: '',
    assigned_section: '',
    testCases: [
      {
        id: 1,
        input: '',
        output: '',
        isHidden: false,
      }
    ] as TestCase[]
  });

  const [submitting, setSubmitting] = useState(false);

  const [currentTestCaseIndex, setCurrentTestCaseIndex] = useState(0);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (user && user.role !== 'teacher') {
      router.push(`/${user.role}/dashboard`);
    }
  }, [user, router]);

  // GSAP animation on mount
  useEffect(() => {
    if (containerRef.current) {
      gsap.set(containerRef.current, { opacity: 0, y: 20 });
      gsap.to(containerRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
      });
    }
  }, []);

  const currentTestCase = formData.testCases[currentTestCaseIndex];

  const handleBasicFieldChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTestCaseChange = (field: string, value: any) => {
    const updatedTestCases = [...formData.testCases];
    updatedTestCases[currentTestCaseIndex] = {
      ...updatedTestCases[currentTestCaseIndex],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      testCases: updatedTestCases
    }));
  };

  const addTestCase = () => {
    const newTestCase: TestCase = {
      id: formData.testCases.length + 1,
      input: '',
      output: '',
      isHidden: false,
    };
    setFormData(prev => ({
      ...prev,
      testCases: [...prev.testCases, newTestCase]
    }));
    setCurrentTestCaseIndex(formData.testCases.length);
  };

  const deleteTestCase = (index: number) => {
    if (formData.testCases.length > 1) {
      setFormData(prev => ({
        ...prev,
        testCases: prev.testCases.filter((_, i) => i !== index)
      }));
      if (currentTestCaseIndex >= formData.testCases.length - 1) {
        setCurrentTestCaseIndex(Math.max(0, currentTestCaseIndex - 1));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.problemStatement || !formData.startTime || !formData.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.testCases.some(tc => !tc.input || !tc.output)) {
      alert('Please fill in all test cases');
      return;
    }

    setSubmitting(true);
    try {
      // Build questions array from test cases (stored as questions in backend)
      const questions = formData.testCases.map((tc, i) => ({
        text: `Test Case ${i + 1}`,
        question_type: 'coding',
        options: [],
        correct_answer: tc.output,
        points: Math.round(formData.maxScore / formData.testCases.length),
        metadata: { input: tc.input, expected_output: tc.output, is_hidden: tc.isHidden },
      }));

      const payload = {
        title: formData.title,
        description: formData.description || formData.problemStatement,
        type: 'coding',
        status: 'active',
        language: formData.language,
        start_time: new Date(formData.startTime).toISOString(),
        end_time: new Date(formData.endTime).toISOString(),
        duration_minutes: Math.round((new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime()) / 60000),
        passing_score: formData.maxScore,
        assigned_class: formData.assigned_class || null,
        assigned_year: formData.assigned_year || null,
        assigned_section: formData.assigned_section || null,
        metadata: {
          problem_statement: formData.problemStatement,
          input_format: formData.inputDescription,
          output_format: formData.outputDescription,
          constraints: formData.constraints,
          time_limit: formData.timeLimit,
          memory_limit: formData.memoryLimit,
        },
        questions,
      };

      await examsAPI.create(payload);
      router.push('/teacher/dashboard');
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail || 'Failed to create coding test. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || user.role !== 'teacher') {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 px-4 py-8 overflow-x-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-indigo-600 rounded-full filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-purple-600 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* Top Navigation */}
      <div className="relative z-10 max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Create Coding Test
            </h1>
            <p className="text-purple-300/60 mt-2">Design and configure your coding challenge</p>
          </div>
          <div className="w-64">
            <UserProfile compact={false} />
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div 
        ref={containerRef}
        className="relative z-10 max-w-7xl mx-auto"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-6">
          
          {/* Left Panel - Problem Details */}
          <div className="col-span-12 lg:col-span-6 space-y-6">
            
            {/* Basic Information */}
            <div className="bg-white/5 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-8 hover:border-purple-400/40 transition-all duration-300">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Problem Details
              </h2>

              <div className="space-y-5">
                {/* Title */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Problem Title *</label>
                  <input
                    type="text"
                    placeholder="e.g., Reverse a String"
                    value={formData.title}
                    onChange={(e) => handleBasicFieldChange('title', e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Short Description</label>
                  <input
                    type="text"
                    placeholder="Brief description of the problem..."
                    value={formData.description}
                    onChange={(e) => handleBasicFieldChange('description', e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                {/* Problem Statement */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Problem Statement *</label>
                  <textarea
                    placeholder="Describe the problem in detail..."
                    value={formData.problemStatement}
                    onChange={(e) => handleBasicFieldChange('problemStatement', e.target.value)}
                    rows={5}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Input/Output Specifications */}
            <div className="bg-white/5 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-8 hover:border-purple-400/40 transition-all duration-300">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Input/Output Specifications
              </h2>

              <div className="space-y-5">
                {/* Input Description */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Input Format</label>
                  <textarea
                    placeholder="Describe the input format (e.g., First line: number of test cases...)"
                    value={formData.inputDescription}
                    onChange={(e) => handleBasicFieldChange('inputDescription', e.target.value)}
                    rows={3}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>

                {/* Output Description */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Output Format</label>
                  <textarea
                    placeholder="Describe the expected output format..."
                    value={formData.outputDescription}
                    onChange={(e) => handleBasicFieldChange('outputDescription', e.target.value)}
                    rows={3}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>

                {/* Constraints */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Constraints</label>
                  <textarea
                    placeholder="e.g., 1 ≤ n ≤ 10^6, -10^9 ≤ arr[i] ≤ 10^9"
                    value={formData.constraints}
                    onChange={(e) => handleBasicFieldChange('constraints', e.target.value)}
                    rows={3}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Execution Limits */}
            <div className="bg-white/5 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-8 hover:border-purple-400/40 transition-all duration-300">
              <h2 className="text-2xl font-bold text-white mb-6">Execution Limits</h2>

              <div className="space-y-5">
                {/* Time Limit */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Time Limit (seconds) *</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.timeLimit}
                    onChange={(e) => handleBasicFieldChange('timeLimit', parseInt(e.target.value))}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>

                {/* Memory Limit */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Memory Limit (MB) *</label>
                  <input
                    type="number"
                    min="64"
                    max="1024"
                    value={formData.memoryLimit}
                    onChange={(e) => handleBasicFieldChange('memoryLimit', parseInt(e.target.value))}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Schedule & Test Cases */}
          <div className="col-span-12 lg:col-span-6 space-y-6">
            
            {/* Schedule */}
            <div className="bg-white/5 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-8 hover:border-purple-400/40 transition-all duration-300">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Test Schedule
              </h2>

              <div className="space-y-5">
                {/* Start Time */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => handleBasicFieldChange('startTime', e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>

                {/* End Time */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">End Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => handleBasicFieldChange('endTime', e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>

                {/* Scoring Type */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Scoring Type</label>
                  <select
                    value={formData.scoringType}
                    onChange={(e) => handleBasicFieldChange('scoringType', e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    <option value="points">Points</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>

                {/* Max Score */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Maximum Score</label>
                  <input
                    type="number"
                    value={formData.maxScore}
                    onChange={(e) => handleBasicFieldChange('maxScore', parseInt(e.target.value))}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Language & Class Assignment */}
            <div className="bg-white/5 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-8 hover:border-purple-400/40 transition-all duration-300">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Language &amp; Class Assignment
              </h2>
              <div className="space-y-5">
                {/* Language */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Programming Language *</label>
                  <select
                    value={formData.language}
                    onChange={(e) => handleBasicFieldChange('language', e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                    <option value="javascript">JavaScript</option>
                  </select>
                </div>
                {/* Class */}
                <div className="space-y-2">
                  <label className="block text-purple-200 text-sm font-semibold">Class Name</label>
                  <input
                    type="text"
                    placeholder="e.g., 10th Grade"
                    value={formData.assigned_class}
                    onChange={(e) => handleBasicFieldChange('assigned_class', e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-purple-200 text-sm font-semibold">Year</label>
                    <input type="text" placeholder="e.g., 2024" value={formData.assigned_year} onChange={(e) => handleBasicFieldChange('assigned_year', e.target.value)}
                      className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-purple-200 text-sm font-semibold">Section</label>
                    <input type="text" placeholder="e.g., A" value={formData.assigned_section} onChange={(e) => handleBasicFieldChange('assigned_section', e.target.value)}
                      className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                  </div>
                </div>
                <p className="text-xs text-purple-300/40">Students matching the class/year/section will be auto-assigned.</p>
              </div>
            </div>

            {/* Test Cases */}
            <div className="bg-white/5 backdrop-blur-xl border border-purple-400/20 rounded-2xl p-8 hover:border-purple-400/40 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Test Cases</h2>
                <button
                  type="button"
                  onClick={addTestCase}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-indigo-600/50 transition-all transform hover:scale-105"
                >
                  + Add Test Case
                </button>
              </div>

              {/* Test Case Tabs */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pb-2">
                  {formData.testCases.map((tc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentTestCaseIndex(idx)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all transform hover:scale-105 flex items-center gap-2 ${
                        currentTestCaseIndex === idx
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                          : 'bg-white/10 text-purple-200 border border-purple-400/20 hover:border-purple-400/40'
                      }`}
                    >
                      TC{idx + 1}
                      {tc.isHidden && <span className="text-xs">(Hidden)</span>}
                      {formData.testCases.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTestCase(idx);
                          }}
                          className="ml-1 p-1 hover:bg-red-500/20 rounded"
                        >
                          ×
                        </button>
                      )}
                    </button>
                  ))}
                </div>

                {/* Test Case Editor */}
                <div className="space-y-4 mt-6 pt-6 border-t border-purple-400/20">
                  
                  {/* Input */}
                  <div className="space-y-2">
                    <label className="block text-purple-200 text-sm font-semibold">Input *</label>
                    <textarea
                      placeholder="Enter sample input..."
                      value={currentTestCase.input}
                      onChange={(e) => handleTestCaseChange('input', e.target.value)}
                      rows={3}
                      className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none font-mono text-sm"
                      required
                    />
                  </div>

                  {/* Output */}
                  <div className="space-y-2">
                    <label className="block text-purple-200 text-sm font-semibold">Expected Output *</label>
                    <textarea
                      placeholder="Enter expected output..."
                      value={currentTestCase.output}
                      onChange={(e) => handleTestCaseChange('output', e.target.value)}
                      rows={3}
                      className="w-full px-5 py-3.5 bg-white/5 border border-purple-400/30 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none font-mono text-sm"
                      required
                    />
                  </div>

                  {/* Hidden Test Case Toggle */}
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-purple-400/20">
                    <input
                      type="checkbox"
                      id="isHidden"
                      checked={currentTestCase.isHidden}
                      onChange={(e) => handleTestCaseChange('isHidden', e.target.checked)}
                      className="w-5 h-5 rounded cursor-pointer"
                    />
                    <label htmlFor="isHidden" className="text-purple-200 font-semibold cursor-pointer flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" fillRule="evenodd" />
                      </svg>
                      Hidden Test Case
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="col-span-12 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-8 py-3.5 rounded-xl bg-white/10 border border-purple-400/30 text-white font-bold hover:bg-white/20 hover:border-purple-400/50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-indigo-600/50 transition-all transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {submitting ? 'Creating…' : 'Create Coding Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
