import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const OnboardingQuestions = ({ onComplete, user }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});

  const questions = [
    {
      id: 'favorite_alcohol',
      question: '가장 좋아하는 술은 무엇인가요?',
      type: 'single',
      options: [
        { value: '소주', label: '🍶 소주', icon: '🍶' },
        { value: '맥주', label: '🍺 맥주', icon: '🍺' },
        { value: '와인', label: '🍷 와인', icon: '🍷' },
        { value: '하이볼', label: '🥃 하이볼', icon: '🥃' },
        { value: '전통주', label: '🍾 전통주', icon: '🍾' },
        { value: '칵테일', label: '🍹 칵테일', icon: '🍹' }
      ]
    },
    {
      id: 'preferred_vibe',
      question: '어떤 분위기를 선호하시나요?',
      type: 'multiple',
      options: [
        { value: '조용한', label: '🤫 조용한', icon: '🤫' },
        { value: '활기찬', label: '🎉 활기찬', icon: '🎉' },
        { value: '로맨틱', label: '💕 로맨틱', icon: '💕' },
        { value: '데이트', label: '💑 데이트', icon: '💑' },
        { value: '회식', label: '👥 회식', icon: '👥' },
        { value: '혼술', label: '🧘 혼술', icon: '🧘' },
        { value: '2차', label: '🌙 2차', icon: '🌙' },
        { value: '뷰맛집', label: '🏞️ 뷰맛집', icon: '🏞️' }
      ]
    },
    {
      id: 'preferred_regions',
      question: '주로 활동하는 지역은 어디인가요?',
      type: 'multiple',
      options: [
        { value: '홍대', label: '🎭 홍대', icon: '🎭' },
        { value: '강남', label: '💼 강남', icon: '💼' },
        { value: '성수', label: '🎨 성수', icon: '🎨' },
        { value: '을지로', label: '🏢 을지로', icon: '🏢' },
        { value: '종로', label: '🏰 종로', icon: '🏰' },
        { value: '해운대', label: '🌊 해운대', icon: '🌊' },
        { value: '명동', label: '🛍️ 명동', icon: '🛍️' },
        { value: '기타', label: '📍 기타', icon: '📍' }
      ]
    }
  ];

  const handleAnswer = (questionId, value, isMultiple = false) => {
    setAnswers(prev => {
      if (isMultiple) {
        const currentValues = prev[questionId] || [];
        const newValues = currentValues.includes(value)
          ? currentValues.filter(v => v !== value)
          : [...currentValues, value];
        return { ...prev, [questionId]: newValues };
      } else {
        return { ...prev, [questionId]: value };
      }
    });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // 모든 질문 완료
      onComplete(answers);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const canProceed = () => {
    const question = questions[currentQuestion];
    const answer = answers[question.id];
    
    if (question.type === 'single') {
      return answer && answer !== '';
    } else {
      return answer && Array.isArray(answer) && answer.length > 0;
    }
  };

  const currentQ = questions[currentQuestion];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <motion.div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        {/* 진행 상태 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <h3 style={{
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '500',
            margin: 0
          }}>
            맞춤 추천을 위한 정보 수집
          </h3>
          <span style={{
            color: '#ffffff',
            fontSize: '12px',
            opacity: 0.7
          }}>
            {currentQuestion + 1} / {questions.length}
          </span>
        </div>

        {/* 진행 바 */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '40px'
        }}>
          {questions.map((_, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: '4px',
                backgroundColor: index <= currentQuestion ? '#3498db' : 'rgba(255,255,255,0.1)',
                borderRadius: '2px'
              }}
            />
          ))}
        </div>

        {/* 질문 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <h2 style={{
              color: '#ffffff',
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '30px',
              textAlign: 'center'
            }}>
              {currentQ.question}
            </h2>

            {/* 옵션 */}
            <div style={{
              display: 'grid',
              gap: '12px',
              marginBottom: '40px'
            }}>
              {currentQ.options.map((option) => {
                const isSelected = currentQ.type === 'single' 
                  ? answers[currentQ.id] === option.value
                  : (answers[currentQ.id] || []).includes(option.value);

                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    onClick={() => handleAnswer(currentQ.id, option.value, currentQ.type === 'multiple')}
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #3498db' : '1px solid rgba(255,255,255,0.2)',
                      backgroundColor: isSelected ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: '#ffffff',
                      fontSize: '16px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    whileHover={{ 
                      backgroundColor: isSelected ? 'rgba(52, 152, 219, 0.3)' : 'rgba(255,255,255,0.1)',
                      y: -2
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span style={{ fontSize: '20px' }}>{option.icon}</span>
                    <span>{option.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* 버튼 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between'
        }}>
          {currentQuestion > 0 && (
            <motion.button
              type="button"
              onClick={handlePrevious}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: 'transparent',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.95 }}
            >
              이전
            </motion.button>
          )}

          <motion.button
            type="button"
            onClick={handleNext}
            disabled={!canProceed()}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: canProceed() ? '#3498db' : 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canProceed() ? 'pointer' : 'not-allowed',
              marginLeft: currentQuestion > 0 ? 'auto' : '0'
            }}
            whileHover={canProceed() ? { backgroundColor: '#2980b9' } : {}}
            whileTap={canProceed() ? { scale: 0.95 } : {}}
          >
            {currentQuestion === questions.length - 1 ? '완료' : '다음'}
          </motion.button>
        </div>

        {/* 건너뛰기 */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px'
        }}>
          <button
            type="button"
            onClick={() => onComplete({})}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            나중에 하기
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingQuestions;
