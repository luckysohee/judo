import { STUDIO_LIQUOR_TYPE_OPTIONS } from "./placeTaxonomy.js";

/**
 * 코스 생성 엔진용 스텝 룰. 체류 시간·매칭 축은 제품에서 고정(평균값)으로 두고
 * AI는 요청 파싱·카피 보조만 담당하는 구조에 맞춤.
 * 2차 주종은 `placeTaxonomy`의 잔 올리기 표준 목록과 동일.
 */
export const COURSE_PATTERNS = {
  casual_2step: [
    {
      step: 1,
      label: "1차",
      stayMinutes: 110,
      categories: ["한식", "고깃집", "식사", "육류", "고기", "포차", "술집"],
      vibes: ["시끌벅적", "편안한"],
      liquorTypes: ["소주", "맥주"],
      tags: ["1차", "식사가능", "안주맛집"],
    },
    {
      step: 2,
      label: "2차",
      stayMinutes: 80,
      categories: ["포차", "술집", "해산물", "이자카야", "와인바", "바"],
      vibes: ["가볍게", "분위기좋은", "편안한", "조용한"],
      liquorTypes: [...STUDIO_LIQUOR_TYPE_OPTIONS],
      tags: ["2차", "가볍게", "한잔", "늦게까지"],
    },
  ],

  date_2step: [
    {
      step: 1,
      label: "1차",
      stayMinutes: 100,
      categories: ["양식", "와인바", "이자카야", "한식", "다이닝"],
      vibes: ["분위기좋은", "조용한", "편안한"],
      liquorTypes: ["와인", "하이볼", "맥주", "소주"],
      tags: ["데이트", "분위기", "식사가능"],
    },
    {
      step: 2,
      label: "2차",
      stayMinutes: 70,
      categories: ["바", "와인바", "카페", "술집", "칵테일"],
      vibes: ["조용한", "분위기좋은", "가볍게"],
      liquorTypes: [...STUDIO_LIQUOR_TYPE_OPTIONS],
      tags: ["데이트", "2차", "가볍게"],
    },
  ],
};
