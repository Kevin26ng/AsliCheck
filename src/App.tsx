import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import FeedView from './views/FeedView';
import AnalyzerView from './views/AnalyzerView';
import AssistantView from './views/AssistantView';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black text-[#e7e9ea]">
        <Navbar />
        
        <div className="flex pt-14 max-w-[1400px] mx-auto px-4 gap-0">
          <Sidebar />
          
          <main className="flex-1 min-w-0 py-4">
            <Routes>
              <Route path="/" element={<FeedView />} />
              <Route path="/analyzer" element={<AnalyzerView />} />
              <Route path="/assistant" element={<AssistantView />} />
              <Route path="/about" element={<div className="p-4 text-center text-xl text-[#e7e9ea]">About AsliCheck</div>} />
            </Routes>
          </main>
          
          <RightSidebar />
        </div>
      </div>
    </Router>
  );
}
