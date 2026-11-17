import React from 'react';
import { ArrowRight, Sparkles, Flame, Coffee } from 'lucide-react';
import heroImg from '../assets/images/bengali_tea_stall_hero_1792709017687.jpg';

interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center">
      {/* Decorative Tea Hero Card */}
      <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-[#E3D4C1] bg-[#F4EDE2] aspect-[16/9] mb-6">
        <img
          src={heroImg}
          alt="টংয়ের গরম চা এবং আড্ডা"
          className="w-full h-full object-cover object-center transform hover:scale-102 transition-transform duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2C1408]/85 via-[#2C1408]/30 to-transparent flex items-end p-4 sm:p-6">
          <div className="text-white">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#F9E2AF] uppercase mb-1">
              <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
              খাঁটি টংয়ের ধোঁয়া ওঠা আড্ডা
            </span>
            <p className="text-xs sm:text-sm text-stone-200 line-clamp-2">
              মাটির ভাঁড় আর গরম চায়ের উষ্ণতায় এক চিলতে নির্ভেজাল বিনোদন
            </p>
          </div>
        </div>
      </div>

      {/* Main Title and Intro */}
      <div className="text-center space-y-3 mb-6 w-full">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#381B0E] tracking-tight leading-tight">
          আপনি কত বড় চা-খোর?
        </h1>
        <p className="text-sm sm:text-base text-[#6E4733] max-w-md mx-auto leading-relaxed">
          চায়ের কাপে ঝড় তুলতে আমরা ওস্তাদ! টংয়ের ধোঁয়া ওঠা গরম দুধ চা হোক বা কড়া লিকার—জানুন আপনার ভেতরের আসল চা-প্রেমী সত্তা আসলে কেমন!
        </p>
      </div>

      {/* 3 Value Pillars */}
      <div className="w-full grid grid-cols-3 gap-2 sm:gap-3 py-3 mb-8">
        <div className="bg-[#FAF3EA] border border-[#EADCCB] rounded-xl p-3 text-center">
          <span className="block text-xl sm:text-2xl font-bold text-[#5C2C16] font-mono tabular-nums">
            ১০টি
          </span>
          <span className="text-xs text-[#8C6D58] font-medium">মজার প্রশ্ন</span>
        </div>
        <div className="bg-[#FAF3EA] border border-[#EADCCB] rounded-xl p-3 text-center">
          <span className="block text-xl sm:text-2xl font-bold text-[#5C2C16] font-mono tabular-nums">
            ১০০
          </span>
          <span className="text-xs text-[#8C6D58] font-medium">পূর্ণমান</span>
        </div>
        <div className="bg-[#FAF3EA] border border-[#EADCCB] rounded-xl p-3 text-center">
          <span className="block text-xl sm:text-2xl font-bold text-[#5C2C16] font-mono tabular-nums">
            ৬টি
          </span>
          <span className="text-xs text-[#8C6D58] font-medium">বিশেষ খেতাব</span>
        </div>
      </div>

      {/* Start Button */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={onStart}
          className="w-full h-14 sm:h-15 px-6 rounded-2xl bg-gradient-to-r from-[#5C2C16] via-[#78350F] to-[#5C2C16] hover:from-[#451A03] hover:via-[#5C2C16] hover:to-[#451A03] text-[#FFF9F2] font-bold text-lg sm:text-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer group"
        >
          <span>খেলা শুরু করুন</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-center text-xs text-[#9B7B66] flex items-center justify-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
          কোনো লগইন বা রেজিস্ট্রেশন প্রয়োজন নেই
        </p>
      </div>
    </div>
  );
};
