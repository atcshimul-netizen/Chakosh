import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getPublicAssetUrl } from '../utils/assets.ts';

interface HeaderProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onResetToHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  soundEnabled,
  onToggleSound,
  onResetToHome,
}) => {
  const logoSrc = getPublicAssetUrl('assets/aistudio/CHAKOSH_LOGO_LQ_56c97d99.png');

  return (
    <header className="sticky top-0 z-30 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E8DFC8]/80 transition-colors">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand Zone: Uploaded Logo */}
        <button
          onClick={onResetToHome}
          className="flex items-center group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B4513] rounded-lg p-1 -ml-1 transition-transform active:scale-95"
          title="হোম পেজে যান"
        >
          <img
            src={logoSrc}
            alt="চা-খোর কল্যাণ সমিতি"
            className="h-9 sm:h-10 w-auto object-contain drop-shadow-2xs"
            referrerPolicy="no-referrer"
          />
        </button>

        {/* Right Action: Sound Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onToggleSound();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#5C2C16] bg-[#F0E6D8] hover:bg-[#E6D7C3] active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B4513]"
            title={soundEnabled ? 'শব্দ বন্ধ করুন' : 'শব্দ চালু করুন'}
            aria-label={soundEnabled ? 'শব্দ বন্ধ করুন' : 'শব্দ চালু করুন'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#8B4513]" />
                <span className="hidden xs:inline">শব্দ অন</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#8C6D58]" />
                <span className="hidden xs:inline text-[#8C6D58]">শব্দ অফ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
