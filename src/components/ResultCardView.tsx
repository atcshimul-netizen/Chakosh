import React from 'react';
import { Personality } from '../types.ts';
import { toBengaliDigits } from '../data/quizData.ts';
import { Trophy } from 'lucide-react';
import teaCupImg from '../assets/images/tea_cup_badge_1792709017902.jpg';
import { getPublicAssetUrl } from '../utils/assets.ts';

export interface ResultCardViewProps {
  score: number;
  personality: Personality;
  isExportMode?: boolean;
  playerName?: string;
  profileImageUrl?: string | null;
}

export const ResultCardView: React.FC<ResultCardViewProps> = ({
  score,
  personality,
  isExportMode = false,
  playerName,
  profileImageUrl,
}) => {
  const logoSrc = getPublicAssetUrl('assets/aistudio/CHAKOSH_LOGO_LQ_56c97d99.png');
  const bengaliScore = toBengaliDigits(score);
  const scorePercent = Math.min(100, Math.max(0, score));
  const cleanName = (playerName || '').trim();

  // If rendering for 1080 x 1350 px export
  if (isExportMode) {
    return (
      <div
        id="export-card-content"
        className="w-[1080px] h-[1350px] bg-[#FAF7F2] p-[56px] flex flex-col justify-between items-center text-center box-border select-none"
        style={{ fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}
      >
        {/* Top Header & Logo */}
        <div className="flex flex-col items-center pt-2">
          <img
            src={logoSrc}
            alt="চা-খোর কল্যাণ সমিতি"
            className="h-24 w-auto max-w-[340px] object-contain mb-3 drop-shadow-xs"
            referrerPolicy="no-referrer"
          />
          <span className="inline-flex items-center gap-2 text-lg font-bold text-[#8B4513] tracking-wide uppercase">
            <Trophy className="w-5 h-5 text-[#D97706]" />
            কুইজের চূড়ান্ত ফলাফল
          </span>
          <h1 className="text-5xl font-extrabold text-[#381B0E] mt-1.5 tracking-tight">
            আপনি কত বড় চা-খোর?
          </h1>
        </div>

        {/* Main Result Card */}
        <div className="w-[960px] bg-[#FAF3EA] border-2 border-[#E7D6C3] rounded-[36px] p-10 shadow-md text-center relative overflow-hidden my-auto">
          {/* Subtle Decorative Background Glow */}
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#F59E0B]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#8B4513]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Large Personality Emoji / Profile Photo & Badge */}
          <div className="relative inline-block mb-4">
            <div
              className={`w-36 h-36 mx-auto rounded-[30px] bg-white border-2 border-[#E2CEBC] shadow-inner flex items-center justify-center text-7xl overflow-hidden select-none ${
                profileImageUrl ? 'p-0' : 'p-3'
              }`}
            >
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={cleanName || 'প্রোফাইল ছবি'}
                  className="w-full h-full object-cover"
                />
              ) : (
                personality.emoji
              )}
            </div>
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#5C2C16] text-[#FDE68A] text-base font-bold px-5 py-1 rounded-full whitespace-nowrap shadow-xs max-w-[360px] truncate">
              {cleanName || `লেভেল ${toBengaliDigits(personality.level)}`}
            </span>
          </div>

          {/* Personality Title */}
          <h2 className="text-4xl font-extrabold text-[#381B0E] mt-3 mb-4 tracking-tight">
            {personality.title}
          </h2>

          {/* Score Meter */}
          <div className="my-6 inline-flex flex-col items-center">
            <div className="flex items-baseline gap-2 text-[#5C2C16]">
              <span className="text-xl text-[#8C6D58] font-medium mr-1">মোট স্কোর:</span>
              <span className="text-7xl font-black text-[#8B4513] font-mono tabular-nums leading-none">
                {bengaliScore}
              </span>
              <span className="text-3xl font-bold text-[#A88C78] font-mono">
                / ১০০
              </span>
            </div>

            {/* Visual Score Level Bar */}
            <div className="w-80 h-4 bg-[#E8DAC9] rounded-full overflow-hidden mt-3 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#5C2C16] rounded-full"
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>

          {/* Personality Description Box */}
          <div className="bg-white/95 border-2 border-[#EADBCC] rounded-[24px] p-6 text-center mt-3 shadow-2xs">
            <p className="text-2xl text-[#3E2313] leading-relaxed font-medium">
              "{personality.description}"
            </p>
          </div>

          {/* Mini Tea Aesthetic Lockup */}
          <div className="mt-5 flex items-center justify-center gap-2 text-base text-[#8C6D58]">
            <img
              src={teaCupImg}
              alt="মাটির কাপ"
              className="w-6 h-6 rounded-full object-cover inline-block"
              referrerPolicy="no-referrer"
            />
            <span>স্কোর সীমা: {toBengaliDigits(personality.minScore)}–{toBengaliDigits(personality.maxScore)} পয়েন্ট</span>
          </div>
        </div>

        {/* Small Footer */}
        <div className="pb-3 text-center">
          <p className="text-xl font-bold text-[#6E4733] flex items-center justify-center gap-2">
            <span>☕</span>
            <span>আপনিও খেলুন, জেনে নিন আপনি কত বড় চা-খোর!</span>
            <span>☕</span>
          </p>
        </div>
      </div>
    );
  }

  // On-screen responsive display card (compact, fits mobile screens without duplicate header logo)
  return (
    <div className="w-full flex flex-col items-center">
      {/* Association Header (Logo is displayed in Header component above; omitted here to prevent duplicates) */}
      <div className="flex flex-col items-center mb-2 text-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#8B4513] tracking-wide uppercase">
          <Trophy className="w-3.5 h-3.5 text-[#D97706]" />
          কুইজের চূড়ান্ত ফলাফল
        </span>
        <h1 className="text-lg sm:text-2xl font-extrabold text-[#381B0E] mt-0.5 tracking-tight">
          আপনি কত বড় চা-খোর?
        </h1>
      </div>

      {/* Main Result Card */}
      <div className="w-full bg-[#FAF3EA] border border-[#E7D6C3] rounded-2xl p-3.5 sm:p-5 shadow-sm text-center relative overflow-hidden mb-3 sm:mb-4">
        {/* Subtle Decorative Background Glow */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-[#F59E0B]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-[#8B4513]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Personality Emoji / Profile Photo & Badge */}
        <div className="relative inline-block mb-1.5">
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-white border-2 border-[#E2CEBC] shadow-inner flex items-center justify-center text-3xl sm:text-5xl overflow-hidden select-none ${
              profileImageUrl ? 'p-0' : 'p-1.5'
            }`}
          >
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={cleanName || 'প্রোফাইল ছবি'}
                className="w-full h-full object-cover"
              />
            ) : (
              personality.emoji
            )}
          </div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#5C2C16] text-[#FDE68A] text-[10px] sm:text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap shadow-xs max-w-[200px] sm:max-w-[260px] truncate">
            {cleanName || `লেভেল ${toBengaliDigits(personality.level)}`}
          </span>
        </div>

        {/* Personality Title */}
        <h2 className="text-lg sm:text-2xl font-extrabold text-[#381B0E] mt-1.5 mb-1 tracking-tight">
          {personality.title}
        </h2>

        {/* Score Meter */}
        <div className="my-1.5 inline-flex flex-col items-center">
          <div className="flex items-baseline gap-1 text-[#5C2C16]">
            <span className="text-[11px] sm:text-xs text-[#8C6D58] font-medium mr-1">মোট স্কোর:</span>
            <span className="text-3xl sm:text-4xl font-black text-[#8B4513] font-mono tabular-nums leading-none">
              {bengaliScore}
            </span>
            <span className="text-sm sm:text-base font-bold text-[#A88C78] font-mono">
              / ১০০
            </span>
          </div>

          {/* Visual Score Level Bar */}
          <div className="w-36 sm:w-52 h-2 bg-[#E8DAC9] rounded-full overflow-hidden mt-1 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#5C2C16] rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>

        {/* Personality Description Box */}
        <div className="bg-white/95 border border-[#EADBCC] rounded-xl p-2.5 sm:p-3 text-center mt-1.5 shadow-2xs">
          <p className="text-xs sm:text-sm text-[#3E2313] leading-relaxed font-medium">
            "{personality.description}"
          </p>
        </div>

        {/* Mini Tea Aesthetic Lockup */}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#8C6D58]">
          <img
            src={teaCupImg}
            alt="মাটির কাপ"
            className="w-3.5 h-3.5 rounded-full object-cover inline-block"
            referrerPolicy="no-referrer"
          />
          <span>স্কোর সীমা: {toBengaliDigits(personality.minScore)}–{toBengaliDigits(personality.maxScore)} পয়েন্ট</span>
        </div>
      </div>
    </div>
  );
};
