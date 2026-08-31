'use client';

import React, { useState } from 'react';
import { useToast } from '../../../components/ToastProvider';
import { GraduationCap, Briefcase, ChevronRight, UserPlus, FileSearch, Library } from 'lucide-react';

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

interface AdoptedProject extends VerifiedIssue {
  adoptionId: string;
  heiName: string;
  assignedStudents: string[];
  nepCredits: number;
  kanbanStatus: 'backlog' | 'in_progress' | 'review' | 'completed';
}

export default function StudentDashboard() {
  const { success, error, info } = useToast();
  const [university, setUniversity] = useState('Birla Institute of Technology (BIT) Mesra');
  
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
    }
  ]);

  const [adoptedProjects, setAdoptedProjects] = useState<AdoptedProject[]>([
    {
      id: '2',
      title: 'Dangerous electrical wire hanging near school',
      description: 'A live high tension wire has snapped and is hanging at touching distance near Pragati High School.',
      category: 'electricity',
      citizenName: 'Sumati Kumari',
      urgencyScore: 0.95,
      aiSummary: 'Critical hazard: Live electrical line near school. Requires immediate department dispatch.',
      createdAt: new Date().toISOString(),
      adoptionId: 'adoption-001',
      heiName: 'BIT Mesra',
      assignedStudents: ['Rohan Gupta', 'Swati Kumari'],
      nepCredits: 4,
      kanbanStatus: 'in_progress'
    }
  ]);

  const handleAdopt = (issue: VerifiedIssue) => {
    const doubleAdopted = adoptedProjects.some(proj => proj.id === issue.id);
    if (doubleAdopted) {
      error('This concern has already been adopted by your HEI.');
      return;
    }

    const newAdoption: AdoptedProject = {
      ...issue,
      adoptionId: `adoption-${Math.floor(Math.random() * 1000)}`,
      heiName: university,
      assignedStudents: ['Nitin Kumar'],
      nepCredits: 6,
      kanbanStatus: 'backlog',
    };

    setAdoptedProjects([...adoptedProjects, newAdoption]);
    setVerifiedIssues(verifiedIssues.filter(item => item.id !== issue.id));
    success(`Successfully adopted: "${issue.title}". Mapped under NEP credit frameworks.`);
  };

  const handleKanbanMove = (adoptionId: string, nextStatus: AdoptedProject['kanbanStatus']) => {
    setAdoptedProjects(adoptedProjects.map(proj => {
      if (proj.adoptionId === adoptionId) {
        return { ...proj, kanbanStatus: nextStatus };
      }
      return proj;
    }));
    info(`Project moved to ${nextStatus.replace('_', ' ').toUpperCase()}`);
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-jeevan-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-jeevan-primary mb-1">HEI Project Workspace</h1>
          <p className="text-sm text-jeevan-muted">Adopt verified state issues into academic research & NEP-credit projects</p>
        </div>
        <div className="bg-white border border-jeevan-border px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-jeevan-primary" />
          <span className="text-gray-500">Institution: </span>
          <strong className="text-jeevan-text">{university}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Adoptable Issues Feed */}
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-jeevan-primary inline-flex items-center gap-2 w-fit">
            <FileSearch className="w-5 h-5 text-jeevan-primary" /> 
            Verified Citizen Concerns
          </h2>
          {verifiedIssues.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
              <Library className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              <p>No new verified concerns available for adoption. Check back later.</p>
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

                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <button 
                      onClick={() => handleAdopt(issue)} 
                      className="bg-jeevan-primary hover:bg-jeevan-primary-hover text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <UserPlus className="w-4 h-4" /> Deploy HEI Team & Adopt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Adopted Projects & Kanban Area */}
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b-2 border-jeevan-secondary inline-flex items-center gap-2 w-fit">
            <Briefcase className="w-5 h-5 text-jeevan-secondary" />
            Active HEI Project Roadmap
          </h2>
          {adoptedProjects.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
              <p>No issues adopted yet. Select from the open concerns left to load.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {adoptedProjects.map(proj => (
                <div key={proj.adoptionId} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-mono text-gray-400">REF: {proj.adoptionId}</span>
                    <span className="bg-jeevan-secondary text-white text-xs font-bold px-2 py-1 rounded shadow-sm">
                      {proj.nepCredits} NEP Credits
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{proj.title}</h3>
                  <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-md border border-gray-100">
                    <strong className="text-gray-800">Assigned:</strong> {proj.assignedStudents.join(', ')}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-sm border-t border-gray-100 pt-4">
                    <span className="font-semibold text-gray-600">Workflow Stage</span>
                    <select
                      value={proj.kanbanStatus}
                      onChange={(e) => handleKanbanMove(proj.adoptionId, e.target.value as AdoptedProject['kanbanStatus'])}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-jeevan-secondary/50 font-medium"
                    >
                      <option value="backlog">📌 Backlog / Conceptual</option>
                      <option value="in_progress">⚙️ In Progress (Lab/Field Test)</option>
                      <option value="review">🔍 Under G2 Validation Review</option>
                      <option value="completed">✅ Completed / Deployment Ready</option>
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
