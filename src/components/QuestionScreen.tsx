import React from 'react';
import { Question } from '../types.ts';
import { toBengaliDigits } from '../data/quizData.ts';
import { ChevronLeft, ChevronRight, Check, Award } from 'lucide-react';
import { soundEffects } from '../utils/sound.ts';

interface QuestionScreenProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selectedOptionId?: string;
  onSelectOption: (optionId: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({
  question,
  questionIndex,
  totalQuestions,
  selectedOptionId,
  onSelectOption,
  onNext,
  onPrev,
  onSubmit,
}) => {
  const isFirst = questionIndex === 0;
  const isLast = questionIndex === totalQuestions - 1;
  const hasSelected = Boolean(selectedOptionId);
  const progressPercent = ((questionIndex + 1) / totalQuestions) * 100;

  const handleOptionClick = (optionId: string) => {
    soundEffects.playSelect();
    onSelectOption(optionId);
  };

  const handleNextClick = () => {
    if (!hasSelected) return;
    soundEffects.playTap();
    if (isLast) {
      onSubmit();
    } else {
      onNext();
    }
  };

  const handlePrevClick = () => {
    soundEffects.playTap();
    onPrev();
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-5 flex flex-col justify-between min-h-[calc(100vh-4rem)]">
      {/* Top Header & Progress */}
      <div className="space-y-4">
        {/* Step Indicator Row */}
        <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-[#7C5A43]">
          <span className="flex items-center gap-1.5 font-semibold text-[#5C2C16]">
            <span>প্রশ্ন</span>
            <span className="text-base font-bold text-[#8B4513] font-mono tabular-nums">
              {toBengaliDigits(questionIndex + 1)}
            </span>
            <span className="text-[#A88C78]">/</span>
            <span className="text-[#8C6D58] font-mono tabular-nums">
              {toBengaliDigits(totalQuestions)}
            </span>
          </span>

          <span className="text-[#8C6D58] font-mono tabular-nums font-medium">
            {toBengaliDigits(Math.round(progressPercent))}% সম্পন্ন
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-[#EFE6D8] rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-[#8B4513] via-[#B45309] to-[#D97706] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Question Title Card */}
        <div className="bg-[#FAF3EA] border border-[#E8DCCB] rounded-2xl p-5 sm:p-6 shadow-xs mt-3">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-[#34180A] leading-snug">
            {question.prompt}
          </h2>
        </div>

        {/* Answer Options List */}
        <div className="space-y-2.5 sm:space-y-3 pt-2">
          {question.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleOptionClick(option.id)}
                className={`w-full text-left p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer min-h-[58px] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B4513] ${
                  isSelected
                    ? 'bg-[#F2E5D4] border-[#8B4513] shadow-xs'
                    : 'bg-white border-[#E7DCD0] hover:bg-[#FDFBF7] hover:border-[#D6C2AF]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Option Tag Badge */}
                  <span
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#5C2C16] text-[#FFF7ED]'
                        : 'bg-[#F0E6D8] text-[#6E4933]'
                    }`}
                  >
                    {option.id}
                  </span>

                  {/* Option Text */}
                  <span
                    className={`text-sm sm:text-base leading-relaxed ${
                      isSelected
                        ? 'font-bold text-[#34180A]'
                        : 'font-normal text-[#4A3022]'
                    }`}
                  >
                    {option.text}
                  </span>
                </div>

                {/* Selection indicator checkmark */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                    isSelected
                      ? 'bg-[#8B4513] border-[#8B4513] text-white'
                      : 'border-[#D1C3B2] bg-white'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons Row */}
      <div className="pt-6 pb-2">
        <div className="flex items-center gap-3">
          {/* Previous Button */}
          {!isFirst ? (
            <button
              type="button"
              onClick={handlePrevClick}
              className="h-13 px-4 sm:px-5 rounded-xl border border-[#D8C7B5] bg-[#F7F1E8] hover:bg-[#EFE5D7] active:scale-95 text-[#5C2C16] font-semibold text-sm sm:text-base flex items-center gap-1.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B4513] shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>আগের প্রশ্ন</span>
            </button>
          ) : (
            <div className="shrink-0" />
          )}

          {/* Next or View Results Button */}
          {isLast ? (
            <button
              type="button"
              disabled={!hasSelected}
              onClick={handleNextClick}
              className={`flex-1 h-13 px-5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                hasSelected
                  ? 'bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#8B4513] hover:from-[#B45309] hover:to-[#78350F] text-[#FFFBF5] active:scale-[0.98]'
                  : 'bg-[#E5DACB] text-[#9D8877] cursor-not-allowed shadow-none'
              }`}
            >
              <Award className="w-5 h-5" />
              <span>ফলাফল দেখুন</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!hasSelected}
              onClick={handleNextClick}
              className={`flex-1 h-13 px-5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                hasSelected
                  ? 'bg-[#5C2C16] hover:bg-[#451A03] text-[#FFF9F2] active:scale-[0.98]'
                  : 'bg-[#E5DACB] text-[#9D8877] cursor-not-allowed shadow-none'
              }`}
            >
              <span>পরের প্রশ্ন</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
