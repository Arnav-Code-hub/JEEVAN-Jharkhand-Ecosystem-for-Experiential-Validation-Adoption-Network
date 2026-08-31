'use client';

import React from 'react';
import { Megaphone, GraduationCap, Scale, Briefcase } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 pb-12">
      <section className="text-center max-w-3xl mx-auto mt-8 sm:mt-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-jeevan-primary mb-6 tracking-tight">
          Welcome to JEEVAN Portal
        </h1>
        <p className="text-lg sm:text-xl text-jeevan-muted leading-relaxed">
          Jharkhand Ecosystem for Experiential Validation Adoption Network. Connects citizen grievances with academic research models and CSR funding for rapid, long-term implementation.
        </p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Citizen Portal */}
        <div className="bg-white rounded-xl border border-jeevan-border shadow-sm hover:shadow-md transition-all p-6 flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Megaphone className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-jeevan-text mb-3">Citizen Desk</h2>
          <p className="text-sm text-jeevan-muted flex-grow mb-6">
            Report local public concerns (water, road safety, electricity) with geotagging and track status from initial G1 review up to final validation.
          </p>
          <a href="/citizen/dashboard" className="w-full py-2.5 px-4 bg-jeevan-primary text-white font-medium rounded-lg hover:bg-jeevan-primary-hover transition-colors shadow-sm">
            Go to Citizen Desk
          </a>
        </div>

        {/* HEI Portal */}
        <div className="bg-white rounded-xl border border-jeevan-border shadow-sm hover:shadow-md transition-all p-6 flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-jeevan-text mb-3">HEI Academic Hub</h2>
          <p className="text-sm text-jeevan-muted flex-grow mb-6">
            Higher Educational Institutions workspace. Review verified state complaints, adopt them as final-year projects, and design solutions mapped to curriculum credits.
          </p>
          <a href="/student/dashboard" className="w-full py-2.5 px-4 bg-jeevan-primary text-white font-medium rounded-lg hover:bg-jeevan-primary-hover transition-colors shadow-sm">
            Open Academic Workspace
          </a>
        </div>

        {/* Government Portal */}
        <div className="bg-white rounded-xl border border-jeevan-border shadow-sm hover:shadow-md transition-all p-6 flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Scale className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-jeevan-text mb-3">Govt Validation</h2>
          <p className="text-sm text-jeevan-muted flex-grow mb-6">
            Administrative verification panel. Fast-track emergency bypass, filter spam using AI triage scores, and manage project approvals across municipal and state officers.
          </p>
          <a href="/admin/dashboard" className="w-full py-2.5 px-4 bg-jeevan-primary text-white font-medium rounded-lg hover:bg-jeevan-primary-hover transition-colors shadow-sm">
            Open Review Panel
          </a>
        </div>

        {/* Industry Portal */}
        <div className="bg-white rounded-xl border border-jeevan-border shadow-sm hover:shadow-md transition-all p-6 flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Briefcase className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-jeevan-text mb-3">CSR & Industry</h2>
          <p className="text-sm text-jeevan-muted flex-grow mb-6">
            Commercialization and funding Desk. Review validated academic solutions, allocate micro-CSR funds using Smart Escrow smart contracts, and track deployment.
          </p>
          <a href="/industry/dashboard" className="w-full py-2.5 px-4 bg-jeevan-primary text-white font-medium rounded-lg hover:bg-jeevan-primary-hover transition-colors shadow-sm">
            View Escrow Funding
          </a>
        </div>
      </div>

      <section className="border-t border-jeevan-border pt-12 mt-4 text-center">
        <h2 className="text-2xl font-bold text-jeevan-text mb-8">Active Progress Indicators</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white border border-jeevan-border rounded-xl p-6 shadow-sm">
            <div className="text-3xl sm:text-4xl font-black text-jeevan-secondary mb-2">1,248</div>
            <div className="text-sm font-medium text-jeevan-muted uppercase tracking-wide">Issues Reported</div>
          </div>
          <div className="bg-white border border-jeevan-border rounded-xl p-6 shadow-sm">
            <div className="text-3xl sm:text-4xl font-black text-jeevan-secondary mb-2">86%</div>
            <div className="text-sm font-medium text-jeevan-muted uppercase tracking-wide">Spam Triage Accuracy</div>
          </div>
          <div className="bg-white border border-jeevan-border rounded-xl p-6 shadow-sm">
            <div className="text-3xl sm:text-4xl font-black text-jeevan-secondary mb-2">342</div>
            <div className="text-sm font-medium text-jeevan-muted uppercase tracking-wide">HEI Projects Adopted</div>
          </div>
          <div className="bg-white border border-jeevan-border rounded-xl p-6 shadow-sm">
            <div className="text-3xl sm:text-4xl font-black text-jeevan-secondary mb-2">₹2.4 Cr</div>
            <div className="text-sm font-medium text-jeevan-muted uppercase tracking-wide">CSR Funds Escrowed</div>
          </div>
        </div>
      </section>
    </div>
  );
}