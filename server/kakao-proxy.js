// Express 서버 카카오 API 프록시
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 4000;

// CORS 설정
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://your-domain.com'],
  credentials: true
}));

app.use(express.json());

// 카카오 REST API 키
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

// 카카오 장소 상세 정보 프록시
app.post('/api/kakao/place-details', async (req, res) => {
  try {
    const { placeId } = req.body;
    
    if (!placeId) {
      return res.status(400).json({ error: 'placeId가 필요합니다.' });
    }

    console.log('🔍 카카오 API 프록시 요청:', placeId);

    const response = await axios.get(`https://dapi.kakao.com/v2/local/search/detail.json`, {
      params: { id: placeId },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    console.log('✅ 카카오 API 응답:', response.status);

    res.json(response.data);
  } catch (error) {
    console.error('❌ 카카오 API 프록시 에러:', error.message);
    res.status(500).json({ error: '카카오 API 호출 실패' });
  }
});

// 카카오 키워드 검색 프록시
app.post('/api/kakao/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query가 필요합니다.' });
    }

    const response = await axios.get(`https://dapi.kakao.com/v2/local/search/keyword.json`, {
      params: { query },
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('❌ 카카오 검색 API 에러:', error.message);
    res.status(500).json({ error: '카카오 검색 API 호출 실패' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 카카오 API 프록시 서버 실행 중: http://localhost:${PORT}`);
});
