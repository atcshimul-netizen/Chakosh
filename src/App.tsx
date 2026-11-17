import { useState, useMemo, useEffect } from 'react';
import { QuizStage } from './types.ts';
import { QUESTIONS, getPersonality } from './data/quizData.ts';
import { Header } from './components/Header.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { QuestionScreen } from './components/QuestionScreen.tsx';
import { ResultScreen } from './components/ResultScreen.tsx';
import { soundEffects } from './utils/sound.ts';
import {
  isFacebookInAppBrowser,
  isIOSDevice,
  attemptAutoOpenExternalBrowserFromFacebook,
  attemptOpenInExternalBrowser,
} from './utils/browser.ts';
import { ExternalLink, X } from 'lucide-react';

export default function App() {
  const [stage, setStage] = useState<QuizStage>('welcome');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundEffects.enabled);
  const [showFbBrowserBanner, setShowFbBrowserBanner] = useState<boolean>(() =>
    isFacebookInAppBrowser()
  );
  const [fbBannerHint, setFbBannerHint] = useState<string | null>(null);

  const isIOS = isIOSDevice();

  useEffect(() => {
    attemptAutoOpenExternalBrowserFromFacebook();
  }, []);

  const handleToggleSound = () => {
    const nextState = soundEffects.toggleSound();
    setSoundEnabled(nextState);
  };

  const handleStart = () => {
    soundEffects.playTap();
    setStage('quiz');
    setCurrentQuestionIndex(0);
  };

  const handleSelectOption = (optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionId,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Calculate final score by summing the exact scores of the selected answers
  const finalScore = useMemo(() => {
    let total = 0;
    QUESTIONS.forEach((question, idx) => {
      const selectedId = answers[idx];
      if (selectedId) {
        const option = question.options.find((o) => o.id === selectedId);
        if (option) {
          total += option.score;
        }
      }
    });
    return total;
  }, [answers]);

  const personality = useMemo(() => {
    return getPersonality(finalScore);
  }, [finalScore]);

  const handleSubmit = () => {
    setStage('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRestart = () => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setStage('welcome');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const selectedOptionForCurrent = answers[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C1810] flex flex-col justify-between selection:bg-[#EBDDCF] selection:text-[#381B0E]">
      {/* Persistent Navigation Header */}
      <Header
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onResetToHome={() => {
          if (stage !== 'welcome') {
            if (window.confirm('আপনি কি প্রথম পাতা বা হোম স্ক্রিনে ফিরে যেতে চান?')) {
              handleRestart();
            }
          }
        }}
      />

      {/* Facebook In-App Browser External Browser Banner */}
      {showFbBrowserBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2.5 text-xs text-[#5C2C16]">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2.5">
            <div className="flex-1 space-y-1">
              <p className="font-semibold leading-snug">
                {isIOS
                  ? 'ভালো অভিজ্ঞতা ও ফটোকার্ড ডাউনলোডের জন্য উপরের বা নিচের (•••) মেনু থেকে "Open in Safari" নির্বাচন করুন।'
                  : 'ফটোকার্ড সহজে ডাউনলোড করতে পেজটি বাইরের ব্রাউজারে (Chrome) খুলুন।'}
              </p>
              {fbBannerHint && (
                <p className="text-[11px] text-[#6E4733] leading-snug">{fbBannerHint}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!isIOS && (
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playTap();
                    const res = attemptOpenInExternalBrowser();
                    if (res === 'android-intent') {
                      setFbBannerHint('Chrome বা বাইরের ব্রাউজারে খোলা হচ্ছে—না খুললে ডানদিকের ⋮ মেনু থেকে Open in External Browser চাপুন।');
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#5C2C16] text-[#FFF9F2] font-bold text-[11px] whitespace-nowrap cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open in Browser</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFbBrowserBanner(false)}
                className="p-1 rounded-md text-[#7C5A43] hover:bg-amber-100 cursor-pointer"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main
        className={`flex-1 flex flex-col items-center ${
          stage === 'quiz' ? 'justify-start pt-1' : 'justify-center'
        }`}
      >
        {stage === 'welcome' && <WelcomeScreen onStart={handleStart} />}

        {stage === 'quiz' && currentQuestion && (
          <QuestionScreen
            question={currentQuestion}
            questionIndex={currentQuestionIndex}
            totalQuestions={QUESTIONS.length}
            selectedOptionId={selectedOptionForCurrent}
            onSelectOption={handleSelectOption}
            onNext={handleNext}
            onPrev={handlePrev}
            onSubmit={handleSubmit}
          />
        )}

        {stage === 'result' && (
          <ResultScreen
            score={finalScore}
            personality={personality}
            onRestart={handleRestart}
          />
        )}
      </main>

      {/* Clean Unobtrusive Footer */}
      <footer className="w-full border-t border-[#EAE0D2] py-4 px-4 text-center text-xs text-[#8F7463]">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>আপনি কত বড় চা-খোর? · খাঁটি বাঙালি চা কুইজ</span>
          <span className="text-[#AFA193]">চায়ের কাপে ঝড় উঠুক প্রতিদিন ☕</span>
        </div>
      </footer>
    </div>
  );
}
