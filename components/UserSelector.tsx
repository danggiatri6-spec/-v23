
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';

interface UserSelectorProps {
  profiles: UserProfile[];
  currentProfile: UserProfile;
  onSelect: (p: UserProfile) => void;
  onDelete: (id: string) => void;
}

const UserSelector: React.FC<UserSelectorProps> = ({ profiles, currentProfile, onSelect, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1 pr-3 rounded-full hover:bg-slate-100 transition-colors"
      >
        <div className={`w-8 h-8 ${currentProfile.avatarColor} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
          {currentProfile.name.charAt(0)}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold text-slate-800 leading-none">{currentProfile.name}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">切换账户 <i className="fa-solid fa-chevron-down ml-1"></i></p>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">可用账户列表</h4>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center justify-between group px-4 py-3 hover:bg-indigo-50/50 transition-colors cursor-pointer" onClick={() => { onSelect(p); setIsOpen(false); }}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${p.avatarColor} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                    {p.name.charAt(0)}
                  </div>
                  <span className={`text-sm ${p.id === currentProfile.id ? 'font-bold text-indigo-600' : 'text-slate-700'}`}>
                    {p.name}
                  </span>
                </div>
                {p.id !== 'default' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                    className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                  >
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                )}
                {p.id === currentProfile.id && (
                  <i className="fa-solid fa-circle-check text-indigo-500 text-xs"></i>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold italic">WealthTrack Pro v24.1</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSelector;
