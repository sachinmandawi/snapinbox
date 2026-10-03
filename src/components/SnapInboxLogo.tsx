import React from 'react';

interface SnapInboxLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const SnapInboxLogo: React.FC<SnapInboxLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9 sm:w-10 sm:h-10',
    lg: 'w-12 h-12',
  }[size];

  const textStyles = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 group ${className}`}>
      {/* Brand Icon from user mail.png */}
      <div className={`relative ${iconDimensions} shrink-0 group-hover:scale-105 transition-transform duration-200 drop-shadow-[0_4px_12px_rgba(59,130,246,0.35)]`}>
        <img
          src="/logo.png"
          alt="SnapInbox Logo"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Brand Typography */}
      {showText && (
        <span className={`font-extrabold tracking-tight text-white select-none ${textStyles}`}>
          Snap
          <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Inbox
          </span>
        </span>
      )}
    </div>
  );
};
