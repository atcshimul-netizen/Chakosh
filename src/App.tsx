import { useState, useMemo } from 'react';
import { QuizStage } from './types.ts';
import { QUESTIONS, getPersonality } from './data/quizData.ts';
import { Header } from './components/Header.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { QuestionScreen } from './components/QuestionScreen.tsx';
import { ResultScreen } from './components/ResultScreen.tsx';
import { soundEffects } from './utils/sound.ts';

export default function App() {
  const [stage, setStage] = useState<QuizStage>('welcome');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundEffects.enabled);

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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center">
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
