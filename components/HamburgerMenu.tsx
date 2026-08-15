'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { navLinks as navigation } from './Navi';
import { X } from 'lucide-react';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HamburgerMenu({ isOpen, onClose }: HamburgerMenuProps) {
  const pathname = usePathname();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40" 
        onClick={onClose}
      />
      
      {/* Menu Panel */}
      <div className="fixed top-0 left-0 h-full w-64 bg-[#15274E] z-50 shadow-lg transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className='bg-[#27685b] flex items-center justify-between p-4 border-b border-[#060E1F] h-[60px]'>
          <div className="text-white font-bold text-xl">
            ISPM
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-300 p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-2 px-3 py-6">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex w-full items-center gap-3 px-3 py-3 text-sm rounded-md transition-colors text-white ${
                  pathname === item.href ? 'bg-[#2684FF] hover:bg-[#2684FF]/90' : 'hover:bg-white/10'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
