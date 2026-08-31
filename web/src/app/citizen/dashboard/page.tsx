'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LocationPicker from '../components/LocationPicker';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useToast } from '../../../components/ToastProvider';
import { Wifi, WifiOff, RefreshCw, LogOut, MapPin, AlertCircle, Bot, CheckCircle } from 'lucide-react';

interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  channel: string;
  citizenName: string;
  citizenPhone?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  district?: string;
  block?: string;
  isEmergency: boolean;
  urgencyScore?: number;
  aiSummary?: string;
  createdAt: string;
  isOfflinePending?: boolean;
}

export default function CitizenDashboard() {
  const router = useRouter();
  const { token, phone, isAuthenticated, logout } = useAuth();
  const { success, error, info } = useToast();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [citizenName, setCitizenName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('roads');
  const [isEmergency, setIsEmergency] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Location State
  const [location, setLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
    address: string;
    district: string;
    block: string;
  }>({
    latitude: null,
    longitude: null,
    address: '',
    district: '',
    block: '',
  });

  const [offlineSimulated, setOfflineSimulated] = useState<boolean>(false);

  const handleSyncSuccess = (syncedCount: number) => {
    success(`Successfully synchronized ${syncedCount} pending reports online!`);
    fetchIssues();
  };

  const { isOnline, pendingQueueLength, syncing, queueReport, triggerSync } = useOfflineSync(
    token,
    handleSyncSuccess
  );

  const effectiveOnline = isOnline && !offlineSimulated;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/citizen/login');
    }
  }, [isAuthenticated, router]);

  const fetchIssues = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:3000/citizen/issues', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIssues(res.data);
    } catch (err) {
      info('API unavailable or unauthorized, loading fallback mock data');
      setIssues([
        {
          id: '1',
          title: 'Damaged water supply line in Hatia',
          description: 'The main distribution pipe is cracked causing massive water loss and muddy roads.',
          category: 'water',
          status: 'submitted',
          channel: 'web',
          citizenName: 'Amit Mahato',
          citizenPhone: phone || '+919999999999',
          latitude: 23.2984,
          longitude: 85.2974,
          address: 'Main Chowk near Hatia Railway Station',
          district: 'Ranchi',
          block: 'Hatia',
          isEmergency: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Dangerous electrical wire hanging near school',
          description: 'A live high tension wire has snapped and is hanging at touching distance near Pragati High School.',
          category: 'electricity',
          status: 'verified',
          channel: 'mobile',
          citizenName: 'Sumati Kumari',
          citizenPhone: phone || '+918888888888',
          latitude: 23.3644,
          longitude: 85.3218,
          address: 'Pragati High School gate, Kanke Road',
          district: 'Ranchi',
          block: 'Kanke',
          isEmergency: true,
          urgencyScore: 0.95,
          aiSummary: 'Critical hazard: Live electrical line near school. Requires immediate department dispatch.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchIssues();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !citizenName) {
      error('Please fill out all required fields.');
      return;
    }

    if (!location.latitude || !location.longitude || !location.district || !location.block || !location.address) {
      error('Geotagging is mandatory. Please provide a valid location.');
      return;
    }

    setSubmitting(true);
    const payload = {
      title,
      description,
      category,
      citizenName,
      citizenPhone: phone || undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      district: location.district,
      block: location.block,
      isEmergency,
      channel: 'web',
    };

    if (!effectiveOnline) {
      const record = queueReport(payload);
      if (record) {
        const mockOfflineIssue: Issue = {
          ...record,
          status: 'submitted',
          isOfflinePending: true,
        };
        setIssues([mockOfflineIssue, ...issues]);
        info('You are offline. Report has been saved locally and will auto-sync.');
      }
      setSubmitting(false);
      setTitle('');
      setDescription('');
      setIsEmergency(false);
      return;
    }

    try {
      const res = await axios.post('http://localhost:3000/citizen/issues', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIssues([res.data, ...issues]);
      setTitle('');
      setDescription('');
      setIsEmergency(false);
      success('Issue reported successfully and routed to review G1 Gate!');
    } catch (err: any) {
      const record = queueReport(payload);
      if (record) {
        const mockOfflineIssue: Issue = {
          ...record,
          status: 'submitted',
          isOfflinePending: true,
        };
        setIssues([mockOfflineIssue, ...issues]);
        info('Network anomaly detected. Report stored in offline sync queue.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-jeevan-primary mr-3"></div>
        <p className="text-gray-600 font-medium">Redirecting to authentication portal...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Top Banner with Connectivity & Authentication Status */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8 shadow-sm gap-4">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Network:</span>
            {effectiveOnline ? (
              <span className="flex items-center text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md"><Wifi className="w-4 h-4 mr-1"/> Online</span>
            ) : (
              <span className="flex items-center text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md"><WifiOff className="w-4 h-4 mr-1"/> Offline</span>
            )}
            <button
              onClick={() => setOfflineSimulated(!offlineSimulated)}
              className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white hover:bg-gray-100 transition-colors shadow-sm ml-2"
            >
              {offlineSimulated ? 'Exit Sim' : 'Simulate Offline'}
            </button>
          </div>

          {pendingQueueLength > 0 && (
            <div className="flex items-center gap-2 text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-md">
              📂 {pendingQueueLength} pending report(s)
              {effectiveOnline && (
                <button 
                  onClick={triggerSync} 
                  disabled={syncing} 
                  className="ml-2 flex items-center bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing' : 'Sync Now'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Citizen: <strong className="text-gray-900">{phone}</strong></span>
          <button 
            onClick={logout} 
            className="flex items-center bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4 mr-1" /> Sign Out
          </button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-jeevan-primary mb-6">Citizen Reporting Desk</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Report Form */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-fit">
          <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-jeevan-primary inline-block">File a New G1 Report</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Your Name *</label>
              <input
                type="text"
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-jeevan-primary/50 focus:border-jeevan-primary outline-none"
                placeholder="Enter your full name"
                required
              />
            </div>

            <LocationPicker onChange={(loc) => setLocation(loc)} required={true} />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Issue Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-jeevan-primary/50 focus:border-jeevan-primary outline-none"
                placeholder="Short summary of the issue (e.g. Blocked drain)"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-jeevan-primary/50 focus:border-jeevan-primary outline-none resize-y min-h-[100px]"
                placeholder="Describe the issue in detail, key milestones, severity..."
                rows={4}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-jeevan-primary/50 focus:border-jeevan-primary outline-none"
              >
                <option value="roads">Road Infrastructure</option>
                <option value="water">Water supply & Sewerage</option>
                <option value="electricity">Electrical & Power</option>
                <option value="sanitation">Public Health & Sanitation</option>
                <option value="education">School & Education Infrastructure</option>
                <option value="healthcare">Health Centers</option>
                <option value="agriculture">Irrigation & Agriculture Support</option>
                <option value="other">Other Issues</option>
              </select>
            </div>

            <div className="flex items-start gap-2 mt-2 bg-red-50 p-3 rounded-lg border border-red-100">
              <input
                type="checkbox"
                id="emergency"
                checked={isEmergency}
                onChange={(e) => setIsEmergency(e.target.checked)}
                className="mt-1 w-4 h-4 text-red-600 border-red-300 rounded focus:ring-red-500"
              />
              <label htmlFor="emergency" className="text-sm font-bold text-red-700 cursor-pointer">
                🚨 Mark as High-Danger / Emergency (Direct bypass to critical response team)
              </label>
            </div>

            <button 
              type="submit" 
              disabled={submitting} 
              className="mt-4 w-full bg-jeevan-primary hover:bg-jeevan-primary-hover text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:opacity-70 flex justify-center items-center"
            >
              {submitting ? (
                <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
              ) : 'Submit Report'}
            </button>
          </form>
        </div>

        {/* Issue Status Feed */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-800 mb-2 pb-2 border-b-2 border-jeevan-secondary inline-block w-fit">Your Submitted Track Record</h2>
          
          {loading ? (
             <div className="flex justify-center items-center p-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-jeevan-primary mr-3"></div>
               <p className="text-gray-600">Loading reports...</p>
             </div>
          ) : issues.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center flex flex-col items-center">
              <CheckCircle className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-500 font-medium">No reports filed yet. Use the form to your left to raise your first issue.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {issues.map((issue) => (
                <div key={issue.id} className={`bg-white rounded-xl p-5 shadow-sm transition-all ${issue.isOfflinePending ? 'border-2 border-dashed border-orange-300 bg-orange-50/30' : 'border border-gray-200 hover:shadow-md'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-900 leading-tight pr-4">{issue.title}</h3>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {issue.isEmergency && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">EMERGENCY</span>}
                      {issue.isOfflinePending ? (
                        <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">OFFLINE QUEUED</span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider text-white ${
                          issue.status === 'verified' ? 'bg-green-500' :
                          issue.status === 'submitted' ? 'bg-blue-500' :
                          issue.status === 'rejected' ? 'bg-gray-500' : 'bg-gray-500'
                        }`}>
                          {issue.status}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">{issue.description}</p>

                  {issue.address && (
                    <div className="flex items-start gap-2 bg-blue-50 text-blue-800 p-3 rounded-lg text-xs font-medium mb-4">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="block mb-0.5">Landmark: {issue.address} ({issue.block}, {issue.district})</span>
                        <span className="opacity-80">Coordinates: {issue.latitude?.toFixed(4)}, {issue.longitude?.toFixed(4)}</span>
                      </div>
                    </div>
                  )}

                  {issue.aiSummary && (
                    <div className="bg-gray-50 border-l-4 border-gray-400 p-3 rounded-r-lg mb-4 text-xs text-gray-700">
                      <div className="font-bold flex items-center gap-1.5 mb-1 text-gray-900"><Bot className="w-4 h-4"/> AI Analysis</div>
                      <p className="mb-1">{issue.aiSummary}</p>
                      {issue.urgencyScore !== undefined && (
                        <div className="font-semibold text-gray-800">Urgency Confidence: {(issue.urgencyScore * 100).toFixed(0)}%</div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-100">
                    <span className="font-medium bg-gray-100 px-2 py-1 rounded uppercase">{issue.category}</span>
                    <span className="hidden sm:inline">Filed by: {issue.citizenName}</span>
                    <span className="font-medium">{new Date(issue.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
