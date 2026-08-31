// C:\Users\ARNAV_TFS\OneDrive\Documents\SIH\NEW\web\src\app\layout.tsx
import React from 'react';
import './globals.css';
import { AuthProvider } from './citizen/contexts/AuthContext';
import { ToastProvider } from '../components/ToastProvider';

export const metadata = {
  title: 'JEEVAN - Jharkhand Ecosystem for Experiential Validation Adoption Network',
  description: 'AI-infused state-level issue tracking, HEI routing, and crowd-funding portal for Jharkhand',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-jeevan-background text-jeevan-text">
        <ToastProvider>
          <AuthProvider>
            <header className="bg-jeevan-primary text-white border-b-4 border-jeevan-secondary sticky top-0 z-40 shadow-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-xl font-bold tracking-wide">🌳 JEEVAN</span>
                  <span className="text-xs text-green-100 opacity-90">Jharkhand State Citizen & Innovation Link</span>
                </div>
                <nav className="flex flex-wrap gap-4 sm:gap-6 text-sm font-semibold">
                  <a href="/" className="hover:text-jeevan-secondary transition-colors">Home</a>
                  <a href="/citizen/dashboard" className="hover:text-jeevan-secondary transition-colors">Citizen Desk</a>
                  <a href="/student/dashboard" className="hover:text-jeevan-secondary transition-colors">HEI Workdesk</a>
                  <a href="/admin/dashboard" className="hover:text-jeevan-secondary transition-colors">G1-G4 Review</a>
                  <a href="/industry/dashboard" className="hover:text-jeevan-secondary transition-colors">CSR Funding</a>
                </nav>
              </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>

            <footer className="bg-slate-800 text-slate-300 py-6 text-center text-sm border-t border-slate-700 mt-auto">
              <p>© 2026 Government of Jharkhand. Designed for Smart India Hackathon.</p>
            </footer>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
