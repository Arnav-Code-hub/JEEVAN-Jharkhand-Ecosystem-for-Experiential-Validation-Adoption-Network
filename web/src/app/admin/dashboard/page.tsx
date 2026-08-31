'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../../components/ToastProvider';
import { ShieldCheck, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';

interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  channel: string;
  citizenName: string;
  citizenPhone?: string;
  isEmergency: boolean;
  urgencyScore?: number;
  aiSummary?: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { success, error, info } = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'actioned'>('pending');

  // Review form states
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [officerName, setOfficerName] = useState('Govt Reviewer G1');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:3000/citizen/issues/review-queue');
      setIssues(res.data);
    } catch (err) {
      info('API connection failed. Loading local mock queue for demonstration.');
      setIssues([
        {
          id: '2',
          title: 'Dangerous electrical wire hanging near school',
          description: 'A live high tension wire has snapped and is hanging at touching distance near Pragati High School.',
          category: 'electricity',
          status: 'submitted',
          channel: 'mobile',
          citizenName: 'Sumati Kumari',
          isEmergency: true,
          urgencyScore: 0.95,
          aiSummary: 'Critical hazard: Live electrical line near school. Requires immediate department dispatch.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3',
          title: 'Potholes on Ratu Road Main Crossing',
          description: 'Deep potholes have formed. Two motorcyclists fell down yesterday night during rain.',
          category: 'roads',
          status: 'submitted',
          channel: 'voice',
          citizenName: 'Binay Kumar',
          isEmergency: false,
          urgencyScore: 0.62,
          aiSummary: 'Infrastructure degradation: Road repair needed at busy crossing. Moderate hazard due to traffic density.',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleReview = async (id: string, status: 'verified' | 'rejected') => {
    if (status === 'rejected' && !rejectionReason) {
      error('Please specify a rejection reason.');
      return;
    }

    setSubmitting(true);
    const dto = {
      status,
      reviewedBy: officerName,
      rejectionReason: status === 'rejected' ? rejectionReason : undefined
    };

    try {
      await axios.post(`http://localhost:3000/citizen/issues/${id}/review`, dto);
      setIssues(issues.filter(item => item.id !== id));
      setSelectedIssue(null);
      setRejectionReason('');
      success(`Issue is verified and promoted to ${status.toUpperCase()} stage.`);
    } catch (err) {
      error('Review submission online failed. Mock actioning state locally.');
      setIssues(issues.filter(item => item.id !== id));
      setSelectedIssue(null);
      setRejectionReason('');
      success(`[Local Setup Sync] Issue successfully moved to ${status.toUpperCase()} status.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-6 border-b border-jeevan-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-jeevan-primary mb-1">G1 Validation Review Board</h1>
          <p className="text-sm text-jeevan-muted">State-level citizen issue triage & validation dashboard</p>
        </div>
        <div className="bg-white border border-jeevan-border px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-jeevan-primary" />
          <span>Officer Profile: </span>
          <strong className="text-jeevan-text">{officerName}</strong>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          className={`px-4 py-2 border rounded-md font-semibold text-sm transition-colors ${activeTab === 'pending' ? 'bg-jeevan-primary border-jeevan-primary text-white shadow-sm' : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          onClick={() => setActiveTab('pending')}
        >
          Awaiting Action ({issues.length})
        </button>
        <button
          className={`px-4 py-2 border rounded-md font-semibold text-sm transition-colors ${activeTab === 'actioned' ? 'bg-jeevan-primary border-jeevan-primary text-white shadow-sm' : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          onClick={() => setActiveTab('actioned')}
        >
          History Logs
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Verification list */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-jeevan-muted">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-jeevan-primary"></div>
              <span className="ml-3">Loading queue...</span>
            </div>
          ) : issues.length === 0 ? (
            <div className="p-10 text-center bg-white border border-jeevan-border rounded-xl shadow-sm text-jeevan-muted">
              <p>🎉 All clear! No pending citizen complaints in the review queue.</p>
            </div>
          ) : (
            issues.map(issue => (
              <div
                key={issue.id}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition-all shadow-sm hover:shadow-md ${selectedIssue?.id === issue.id ? 'border-jeevan-primary ring-1 ring-jeevan-primary/20 bg-blue-50/30' : 'border-jeevan-border'} ${issue.isEmergency ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-500'}`}
                onClick={() => setSelectedIssue(issue)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-jeevan-muted uppercase tracking-wider">{issue.category}</span>
                  {issue.isEmergency && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">EMERGENCY</span>}
                </div>
                <h3 className="text-base font-semibold text-jeevan-text mb-1 leading-snug">{issue.title}</h3>
                <p className="text-sm text-jeevan-muted mb-3 line-clamp-2">
                  {issue.description}
                </p>
                <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                  <span className="bg-gray-100 px-2 py-1 rounded">Source: {issue.channel}</span>
                  <span className={`${issue.urgencyScore && issue.urgencyScore > 0.8 ? 'text-red-600' : 'text-green-600'}`}>
                    Triage: {issue.urgencyScore ? `${(issue.urgencyScore*100).toFixed(0)}% severity` : 'Pending'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Panel */}
        <div className="lg:col-span-7 flex flex-col">
          {selectedIssue ? (
            <div className="bg-white border border-jeevan-border rounded-xl p-6 shadow-md sticky top-24">
              <h2 className="text-2xl font-bold text-jeevan-text mb-4">{selectedIssue.title}</h2>
              
              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
                <div><span className="text-gray-500">Reporter:</span> <strong className="text-gray-900">{selectedIssue.citizenName}</strong></div>
                <div><span className="text-gray-500">Channel:</span> <strong className="text-gray-900 uppercase">{selectedIssue.channel}</strong></div>
                <div><span className="text-gray-500">Reported at:</span> <strong className="text-gray-900">{new Date(selectedIssue.createdAt).toLocaleString()}</strong></div>
                <div><span className="text-gray-500">Category:</span> <strong className="text-gray-900 uppercase">{selectedIssue.category}</strong></div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-900 mb-2 pb-1 border-b border-gray-100">Description</h4>
                <p className="text-sm leading-relaxed text-gray-700">{selectedIssue.description}</p>
              </div>

              {selectedIssue.aiSummary && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
                  <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                    🤖 AI NLP Extraction
                  </h4>
                  <p className="text-sm text-blue-800 mb-2"><strong>Auto-Summary:</strong> {selectedIssue.aiSummary}</p>
                  <p className="text-sm text-blue-800">
                    <strong>Urgency Assessment:</strong> {' '}
                    <span className={`font-bold ${selectedIssue.isEmergency ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedIssue.urgencyScore ? `${(selectedIssue.urgencyScore*100).toFixed(0)}% Urgency Confidence` : 'Routine'}
                    </span>
                  </p>
                </div>
              )}

              <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-orange-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  G1 Validation Action
                </h4>

                <div className="flex flex-col gap-1 mb-4">
                  <label className="text-xs font-semibold text-gray-700">If Rejecting, enter grounds / reason *</label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide detailed feedback for citizen rejection"
                    className="px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleReview(selectedIssue.id, 'verified')}
                    disabled={submitting}
                    className="flex-1 bg-jeevan-primary hover:bg-jeevan-primary-hover text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
                  >
                    <ShieldCheck className="w-4 h-4" /> Verify & Promote
                  </button>
                  <button
                    onClick={() => handleReview(selectedIssue.id, 'rejected')}
                    disabled={submitting}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
                  >
                    <XCircle className="w-4 h-4" /> Reject Complaint
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-jeevan-muted border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 h-64">
              <AlertTriangle className="w-8 h-8 text-gray-400 mb-3" />
              <p className="text-sm font-medium">Select an issue from the queue list to inspect and execute validation actions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
