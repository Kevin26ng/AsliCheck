import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Navbar() {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const navLinks = [
    { name: 'Feed', path: '/' },
    { name: 'Analyzer', path: '/analyzer' },
    { name: 'Assistant', path: '/assistant' },
    { name: 'About', path: '/about' },
  ];

  return (
    <nav className="fixed top-0 z-50 w-full h-14 bg-black/80 backdrop-blur-md border-b border-[#2f3336] px-6 flex justify-between items-center">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-xl font-bold text-[#e7e9ea] tracking-tight">
          AsliCheck
        </Link>
        <div className="hidden md:flex gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm transition-all duration-200",
                location.pathname === link.path
                  ? "text-[#e7e9ea] font-bold bg-[#16181c]"
                  : "text-[#71767b] font-medium hover:text-[#e7e9ea] hover:bg-[#16181c]"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden lg:block">
          <input
            type="text"
            placeholder="Search..."
            className="bg-[#16181c] border border-[#2f3336] rounded-full py-1.5 pl-4 pr-4 w-56 text-xs text-[#e7e9ea] placeholder:text-[#71767b] focus:ring-1 focus:ring-[#e7e9ea]/20 focus:border-[#e7e9ea]/30 outline-none"
          />
        </div>
        <div className="w-8 h-8 rounded-full bg-[#16181c] border border-[#2f3336] flex items-center justify-center text-[#71767b] text-xs font-bold">
          U
        </div>
      </div>
    </nav>
  );
}
