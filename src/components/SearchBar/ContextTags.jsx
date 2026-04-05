import React, { useState, useEffect } from 'react';

// 상황별 키워드 매핑
const CONTEXT_KEYWORDS = {
  after_party: {
    name: '뒷풀이',
    keywords: ['뒷풀이', '회식', '단체', '팀', '부서', '회사', '직장', '동료', '상사', '부장', '팀장', '과장', '대리', '사원'],
    icon: '🎉',
    color: 'bg-orange-500',
    description: '직장 동료들과 즐거운 뒷풀이 장소'
  },
  date: {
    name: '데이트',
    keywords: ['데이트', '연인', '여친', '남친', '커플', '소개팅', '첫만남', '기념일', '발렌타인', '화이트데이'],
    icon: '💕',
    color: 'bg-pink-500',
    description: '로맨틱한 분위기의 데이트 명소'
  },
  hangover: {
    name: '해장',
    keywords: ['해장', '숙취', '머리아파', '깨야', '해장술', '속쓰림', '술깨', '몽롱', '두통'],
    icon: '💊',
    color: 'bg-sky-500',
    description: '숙취 해소에 좋은 해장 맛집'
  },
  solo: {
    name: '혼술',
    keywords: ['혼술', '혼자', '싱글', '나혼자', '외로워', '혼밥', '혼술하기', '나만'],
    icon: '🍶',
    color: 'bg-purple-500',
    description: '혼자 즐기는 여유로운 술자리'
  },
  group: {
    name: '단체',
    keywords: ['단체', '모임', '친구', '동창', '선후배', '가족', '친척', '여럿', '다함께', '우리'],
    icon: '👥',
    color: 'bg-yellow-500',
    description: '여러 명이 함께 즐기는 공간'
  },
  must_go: {
    name: '필방',
    keywords: ['필방', '꼭가야', '인생', '최고', '강추', '재방문', '단골', '인기', '유명', '명소'],
    icon: '🏆',
    color: 'bg-green-500',
    description: '인생 맛집, 꼭 가봐야 할 곳'
  },
  terrace: {
    'name': '루프탑',
    keywords: ['루프탑', '옥상', '야외', '테라스', '바베큐', '야외', '노천', '하늘', '별', '전망'],
    icon: '🌃',
    color: 'bg-gray-800',
    description: '야외 테라스, 루프탑 바'
  }
};

const ContextTags = ({ query, onTagClick }) => {
  const [matchedContexts, setMatchedContexts] = useState([]);

  useEffect(() => {
    if (!query || query.length < 1) {
      setMatchedContexts([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = [];

    // 각 상황별 키워드 매칭
    Object.entries(CONTEXT_KEYWORDS).forEach(([key, context]) => {
      const hasMatch = context.keywords.some(keyword => 
        lowerQuery.includes(keyword.toLowerCase())
      );

      if (hasMatch) {
        matches.push({ key, ...context });
      }
    });

    setMatchedContexts(matches);
  }, [query]);

  if (matchedContexts.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="text-xs text-gray-500 mb-2 font-medium">💡 상황별 추천</div>
      <div className="flex flex-wrap gap-2">
        {matchedContexts.map((context) => (
          <button
            key={context.key}
            onClick={() => onTagClick && onTagClick(context.key, context.name)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              text-white transition-all duration-200 hover:scale-105 hover:shadow-md
              ${context.color} hover:${context.color.replace('bg-', 'bg-opacity-80 bg-')}
            `}
          >
            <span className="text-sm">{context.icon}</span>
            <span>{context.name}</span>
          </button>
        ))}
      </div>
      {matchedContexts.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          {matchedContexts[0].description}
        </div>
      )}
    </div>
  );
};

export default ContextTags;
