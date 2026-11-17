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
}

export const ResultCardView: React.FC<ResultCardViewProps> = ({
  score,
  personality,
  isExportMode = false,
}) => {
  const logoSrc = getPublicAssetUrl('assets/aistudio/CHAKOSH_LOGO_LQ_56c97d99.png');
  const bengaliScore = toBengaliDigits(score);
  const scorePercent = Math.min(100, Math.max(0, score));

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

          {/* Large Personality Emoji & Badge */}
          <div className="relative inline-block mb-4">
            <div className="w-36 h-36 mx-auto rounded-[30px] bg-white border-2 border-[#E2CEBC] shadow-inner flex items-center justify-center text-7xl p-3">
              {personality.emoji}
            </div>
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#5C2C16] text-[#FDE68A] text-base font-bold px-5 py-1 rounded-full whitespace-nowrap shadow-xs">
              লেভেল {toBengaliDigits(personality.level)}
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

  // On-screen responsive display card
  return (
    <div className="w-full flex flex-col items-center">
      {/* Uploaded Logo & Association Header */}
      <div className="flex flex-col items-center mb-4 text-center">
        <img
          src={logoSrc}
          alt="চাকস - চা-খোর কল্যাণ সমিতি"
          className="h-14 sm:h-16 w-auto max-w-[260px] object-contain mb-2 drop-shadow-xs"
          referrerPolicy="no-referrer"
        />
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B4513] tracking-wide uppercase">
          <Trophy className="w-4 h-4 text-[#D97706]" />
          কুইজের চূড়ান্ত ফলাফল
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#381B0E] mt-0.5">
          আপনি কত বড় চা-খোর?
        </h1>
      </div>

      {/* Main Result Card */}
      <div className="w-full bg-[#FAF3EA] border border-[#E7D6C3] rounded-3xl p-6 sm:p-8 shadow-md text-center relative overflow-hidden mb-6">
        {/* Subtle Decorative Background Glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#F59E0B]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-[#8B4513]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Large Personality Emoji & Badge */}
        <div className="relative inline-block mb-3">
          <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-3xl bg-white border-2 border-[#E2CEBC] shadow-inner flex items-center justify-center text-5xl sm:text-6xl p-2 select-none">
            {personality.emoji}
          </div>
          <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#5C2C16] text-[#FDE68A] text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap shadow-xs">
            লেভেল {toBengaliDigits(personality.level)}
          </span>
        </div>

        {/* Personality Title */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#381B0E] mt-3 mb-2 tracking-tight">
          {personality.title}
        </h2>

        {/* Score Meter */}
        <div className="my-5 inline-flex flex-col items-center">
          <div className="flex items-baseline gap-1 text-[#5C2C16]">
            <span className="text-xs text-[#8C6D58] font-medium mr-1">মোট স্কোর:</span>
            <span className="text-4xl sm:text-5xl font-black text-[#8B4513] font-mono tabular-nums">
              {bengaliScore}
            </span>
            <span className="text-lg sm:text-xl font-bold text-[#A88C78] font-mono">
              / ১০০
            </span>
          </div>

          {/* Visual Score Level Bar */}
          <div className="w-48 sm:w-64 h-3 bg-[#E8DAC9] rounded-full overflow-hidden mt-2 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#5C2C16] rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>

        {/* Personality Description Box */}
        <div className="bg-white/90 border border-[#EADBCC] rounded-2xl p-4 sm:p-5 text-center mt-3 shadow-2xs">
          <p className="text-base sm:text-lg text-[#3E2313] leading-relaxed font-medium">
            "{personality.description}"
          </p>
        </div>

        {/* Mini Tea Aesthetic Lockup */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#8C6D58]">
          <img
            src={teaCupImg}
            alt="মাটির কাপ"
            className="w-5 h-5 rounded-full object-cover inline-block"
            referrerPolicy="no-referrer"
          />
          <span>স্কোর সীমা: {toBengaliDigits(personality.minScore)}–{toBengaliDigits(personality.maxScore)} পয়েন্ট</span>
        </div>
      </div>
    </div>
  );
};
