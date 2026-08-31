'use client';

import React, { useState } from 'react';
import { useToast } from '../../../components/ToastProvider';
import { Briefcase, Building, ChevronRight, HandCoins, Leaf } from 'lucide-react';

interface VerifiedIssue {
  id: string;
  title: string;
  description: string;
  category: string;
  citizenName: string;
  urgencyScore?: number;
  aiSummary?: string;
  createdAt: string;
}

interface CsrProject extends VerifiedIssue {
  projectId: string;
  csrBudget: number;
  timeline: string;
  status: 'proposed' | 'approved' | 'funded' | 'in_progress' | 'completed';
  companyName: string;
}

export default function IndustryDashboard() {
  const { success, error, info } = useToast();
  const [companyName, setCompanyName] = useState('Tata Steel');
  const [adoptingIssueId, setAdoptingIssueId] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [timelineInput, setTimelineInput] = useState('');

  const [verifiedIssues, setVerifiedIssues] = useState<VerifiedIssue[]>([
    {
      id: '101',
      title: 'Water treatment failure near Tundi block',
      description: 'The local high iron concentration filter has rusted and is defunct. Citizens have to travel 4km for clean drinking water.',
      category: 'water',
      citizenName: 'Ramesh Soren',
      urgencyScore: 0.88,
      aiSummary: 'Water quality hazard: High iron levels. Rural block filter maintenance required.',
      createdAt: new Date().toISOString(),
    },
    {
      id: '102',
      title: 'Lack of cold storage facilities for tomato growers in Ormanjhi',
      description: 'Tomato growers are forced to dump their produce on highways due to zero shelf-life facilities during bumper harvests.',
      category: 'agriculture',
      citizenName: 'Priya Devi',
      urgencyScore: 0.74,
      aiSummary: 'Agricultural distress: Market dump crisis. Localized micro-cold storage solution recommended.',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '103',
      title: 'Potholes on Ratu Road Main Crossing',
      description: 'Deep potholes have formed. Two motorcyclists fell down yesterday night during rain.',
      category: 'roads',
      citizenName: 'Binay Kumar',
      urgencyScore: 0.62,
      aiSummary: 'Infrastructure degradation: Road repair needed at busy crossing. Moderate hazard due to traffic density.',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    }
  ]);

  const [csrProjects, setCsrProjects] = useState<CsrProject[]>([
    {
      id: '201',
      title: 'Solar panel installation for Birsa Munda Park',
      description: 'Install solar panels to power lighting and water pumps in Birsa Munda Park, Ranchi.',
      category: 'electricity',
      citizenName: 'Anita Lakra',
      urgencyScore: 0.75,
      aiSummary: 'Renewable energy solution: Solar-powered park reduces grid dependency and promotes sustainability.',
      createdAt: new Date(Date.now() - 1209600000).toISOString(),
      projectId: 'csr-001',
      csrBudget: 500000,
      timeline: '3 months',
      status: 'funded',
      companyName: 'Tata Steel'
    }
  ]);

  const initiateAdoption = (issue: VerifiedIssue) => {
    const doubleAdopted = csrProjects.some(proj => proj.id === issue.id);
    if (doubleAdopted) {
      error('This issue has already been adopted for CSR funding.');
      return;
    }
    setAdoptingIssueId(issue.id);
    setBudgetInput('100000');
    setTimelineInput('2 months');
  };

  const confirmAdoption = (issue: VerifiedIssue) => {
    const newProject: CsrProject = {
      ...issue,
      projectId: `csr-${Math.floor(Math.random() * 1000)}`,
      csrBudget: parseFloat(budgetInput) || 0,
      timeline: timelineInput,
      status: 'proposed',
      companyName: companyName || 'CSR Partner',
    };

    setCsrProjects([...csrProjects, newProject]);
    setVerifiedIssues(verifiedIssues.filter(item => item.id !== issue.id));
    setAdoptingIssueId(null);
    success(`Successfully adopted for CSR funding: "${issue.title}".`);
  };

  const handleStatusChange = (projectId: string, nextStatus: CsrProject['status']) => {
    setCsrProjects(csrProjects.map(proj => {
      if (proj.projectId === projectId) {
        return { ...proj, status: nextStatus };
      }
      return proj;
    }));
    info(`Project status updated to ${nextStatus.replace('_', ' ').toUpperCase()}`);
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-jeevan-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-jeevan-primary mb-1">CSR Funding Portal</h1>
          <p className="text-sm text-jeevan-muted">Corporate Social Responsibility platform for industry partners</p>
        </div>
        <div className="bg-white border border-jeevan-border px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2">
          <Building className="w-4 h-4 text-jeevan-primary" />
          <span className="text-gray-500">Company: </span>
          <strong className="text-jeevan-text">{companyName}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Adoptable Issues Feed */}
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-jeevan-primary inline-flex items-center gap-2 w-fit">
            <Leaf className="w-5 h-5 text-jeevan-primary" /> 
            Verified Citizen Concerns
          </h2>
          {verifiedIssues.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
              <p>No new verified concerns available for CSR adoption. Check back later.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {verifiedIssues.map(issue => (
                <div key={issue.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">{issue.category}</span>
                    <span className="text-xs text-gray-400 font-medium">{new Date(issue.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{issue.title}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">{issue.description}</p>

                  {issue.aiSummary && (
                    <div className="bg-blue-50/50 border-l-4 border-blue-400 p-3 rounded-r-lg mb-4 text-xs">
                      <strong className="text-blue-800 flex items-center gap-1 mb-1">
                        <ChevronRight className="w-3 h-3" /> Recommended Solution Mappings
                      </strong>
                      <span className="text-blue-700/80">{issue.aiSummary}</span>
                    </div>
                  )}

                  {adoptingIssueId === issue.id ? (
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mt-4">
                      <h4 className="text-sm font-bold text-orange-900 mb-3">Funding Details</h4>
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-orange-800">CSR Budget (INR)</label>
                          <input 
                            type="number" 
                            value={budgetInput} 
                            onChange={(e) => setBudgetInput(e.target.value)} 
                            className="px-3 py-1.5 text-sm rounded border border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-orange-800">Estimated Timeline</label>
                          <input 
                            type="text" 
                            value={timelineInput} 
                            onChange={(e) => setTimelineInput(e.target.value)} 
                            className="px-3 py-1.5 text-sm rounded border border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                          />
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => confirmAdoption(issue)} className="flex-1 bg-jeevan-primary hover:bg-jeevan-primary-hover text-white text-sm font-semibold py-2 rounded-md transition-colors">
                            Confirm Funding
                          </button>
                          <button onClick={() => setAdoptingIssueId(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold py-2 rounded-md transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end pt-2 border-t border-gray-100 mt-2">
                      <button 
                        onClick={() => initiateAdoption(issue)} 
                        className="bg-jeevan-primary hover:bg-jeevan-primary-hover text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <HandCoins className="w-4 h-4" /> Adopt for CSR Funding
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CSR Projects & Status Area */}
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-jeevan-secondary inline-flex items-center gap-2 w-fit">
            <Briefcase className="w-5 h-5 text-jeevan-secondary" />
            CSR Project Portfolio
          </h2>
          {csrProjects.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
              <p>No CSR projects yet. Select from the open concerns left to load.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {csrProjects.map(proj => (
                <div key={proj.projectId} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-mono text-gray-400">REF: {proj.projectId}</span>
                    <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">
                      ₹{proj.csrBudget.toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{proj.title}</h3>
                  <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-md border border-gray-100">
                    <strong className="text-gray-800">Beneficiary:</strong> {proj.citizenName} <br/>
                    <strong className="text-gray-800">Timeline:</strong> {proj.timeline}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-sm border-t border-gray-100 pt-4">
                    <span className="font-semibold text-gray-600">Project Stage</span>
                    <select
                      value={proj.status}
                      onChange={(e) => handleStatusChange(proj.projectId, e.target.value as CsrProject['status'])}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-jeevan-secondary/50 font-medium"
                    >
                      <option value="proposed">📝 Proposed</option>
                      <option value="approved">👍 Approved</option>
                      <option value="funded">💰 Funded</option>
                      <option value="in_progress">⚙️ In Progress</option>
                      <option value="completed">✅ Completed</option>
                    </select>
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