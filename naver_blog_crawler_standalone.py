#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
네이버 블로그 크롤러 - 독립 실행 버전
맥북에서 바로 실행할 수 있는 버전
"""

import asyncio
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup


class NaverBlogCrawlerStandalone:
    """독립 실행형 네이버 블로그 크롤러"""
    
    def __init__(self):
        self.results = []
        self.base_url = "https://search.naver.com/search.naver?where=view&query="
        
    async def _extract_reviews_from_page(self, page, query):
        """페이지에서 블로그 링크 추출"""
        content = await page.content()
        soup = BeautifulSoup(content, 'html.parser')
        
        reviews = []
        
        # 블로그 링크 찾기 (다양한 선택자 시도)
        blog_links = []
        
        # 방법 1: 일반 블로그 링크
        links = soup.find_all('a', href=True)
        for link in links:
            href = link.get('href', '')
            if 'blog.naver.com' in href and '/post/' in href:
                # 클립/프로필 링크 필터링
                if any(skip in href for skip in ['/clip/', '/my/', '/PostView.nhn']):
                    continue
                blog_links.append(href)
        
        # 중복 제거 및 제한
        blog_links = list(set(blog_links))[:5]  # 최대 5개만
        
        print(f"🔗 찾은 블로그 링크 수: {len(blog_links)}")
        
        # 각 블로그 방문
        for i, blog_url in enumerate(blog_links[:5], 1):
            try:
                print(f"🔗 블로그 방문 ({i}/{len(blog_links)}): {blog_url}")
                
                # 새 브라우저 컨텍스트에서 블로그 방문
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    blog_page = await browser.new_page()
                    
                    await blog_page.set_extra_http_headers({
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    })
                    
                    await blog_page.goto(blog_url, wait_until='domcontentloaded')
                    await blog_page.wait_for_timeout(3000)
                    
                    blog_content = await blog_page.content()
                    blog_soup = BeautifulSoup(blog_content, 'html.parser')
                    
                    # 리뷰 정보 추출
                    review = await self._extract_review_info(blog_soup, blog_url)
                    if review:
                        reviews.append(review)
                        print(f"✅ 리뷰 수집 완료: {review['place_name']}")
                    
                    await browser.close()
                    
                # 요청 간격
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"❌ 블로그 방문 실패: {e}")
                continue
        
        return reviews
    
    async def _extract_review_info(self, soup, blog_url):
        """블로그에서 리뷰 정보 추출"""
        try:
            # 장소 이름 추출 (다양한 방법 시도)
            place_name = self._extract_place_name(soup, blog_url)
            
            # 내용 추출
            content = self._extract_content_text(soup)
            
            # 작성일 추출
            publish_date = self._extract_publish_date(soup)
            
            # 태그 추출
            tags = self._extract_tags(soup)
            
            return {
                'place_name': place_name,
                'content': content,
                'publish_date': publish_date,
                'blog_url': blog_url,
                'tags': tags,
                'collected_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ 리뷰 정보 추출 실패: {e}")
            return None
    
    def _extract_place_name(self, soup, blog_url):
        """장소 이름 추출"""
        try:
            # 방법 1: 제목에서 장소 이름 추출
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text()
                
                # 일반적인 패턴
                patterns = [
                    r'(.+?)후기',
                    r'(.+?)리뷰',
                    r'(.+?)맛집',
                    r'(.+?)추천',
                    r'(.+?)술집',
                    r'(.+?)바',
                    r'(.+?)호프',
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, title)
                    if match:
                        place_name = match.group(1).strip()
                        if len(place_name) > 1 and len(place_name) < 50:
                            return place_name
            
            # 방법 2: 블로그 본문에서 장소 이름 추출
            main_content = soup.find('div', class_='se-main-container')
            if main_content:
                text = main_content.get_text()[:500]  # 앞부분 500자만
                
                # 장소 이름 패턴
                place_patterns = [
                    r'([가-힣]+[가-힣]*[동|로|길|역|가]\s*[0-9]*[-]*[0-9]*\s*(?:술집|바|호프|맥주|소주|맛집))',
                    r'([가-힣]{2,20}\s*(?:술집|바|호프|맥주|소주|맛집))',
                ]
                
                for pattern in place_patterns:
                    match = re.search(pattern, text)
                    if match:
                        return match.group(1).strip()
            
            # 방법 3: 기본값 (URL에서 추출)
            if 'blog.naver.com/' in blog_url:
                blog_id = blog_url.split('blog.naver.com/')[-1].split('/')[0]
                return f"네이버블로그_{blog_id[:8]}"
            
            return "장소명 미확인"
            
        except Exception as e:
            print(f"장소 이름 추출 실패: {e}")
            return "장소명 미확인"
    
    def _extract_content_text(self, soup):
        """본문 내용 추출"""
        try:
            # 방법 1: 네이버 블로그 최신 구조
            main_container = soup.find('div', class_='se-main-container')
            if main_container:
                content_parts = []
                
                # 모든 텍스트 요소 추출
                for element in main_container.find_all(['p', 'div', 'span']):
                    text = element.get_text(strip=True)
                    if len(text) > 20:  # 의미 있는 텍스트만
                        content_parts.append(text)
                
                if content_parts:
                    content = ' '.join(content_parts[:3])  # 앞부분 3개만
                    return content[:300]  # 300자로 제한
            
            # 방법 2: 일본 구조
            content_div = soup.find('div', id='postViewArea')
            if content_div:
                content = content_div.get_text(strip=True)
                return content[:300]
            
            # 방법 3: 전체 텍스트에서 필터링
            all_text = soup.get_text()
            lines = [line.strip() for line in all_text.split('\n') if len(line.strip()) > 20]
            
            if lines:
                return ' '.join(lines[:2])[:300]
            
            return "내용 추출 실패"
            
        except Exception as e:
            print(f"내용 추출 실패: {e}")
            return "내용 추출 실패"
    
    def _extract_publish_date(self, soup):
        """작성일 추출"""
        try:
            # 다양한 날짜 선택자
            date_selectors = [
                '.se_publishDate',
                '.blog_date',
                '.date',
                'time',
                '[datetime]',
                '.yyyy'
            ]
            
            for selector in date_selectors:
                date_elem = soup.select_one(selector)
                if date_elem:
                    date_text = date_elem.get_text(strip=True)
                    if re.search(r'\d{4}', date_text):
                        return date_text
            
            return "작성일 없음"
            
        except Exception as e:
            print(f"작성일 추출 실패: {e}")
            return "작성일 없음"
    
    def _extract_tags(self, soup):
        """태그 추출"""
        try:
            tags = []
            
            # 해시태그 추출
            for element in soup.find_all(text=True):
                text = element.strip()
                if text.startswith('#') and len(text) > 1 and len(text) < 20:
                    tags.append(text)
            
            return tags[:5]  # 최대 5개 태그
            
        except Exception as e:
            print(f"태그 추출 실패: {e}")
            return []
    
    async def search_place_reviews(self, place_name, max_pages=2):
        """장소 리뷰 검색"""
        print(f"🕷️  네이버 블로그 리뷰 크롤러 - 독립 실행 버전")
        print("=" * 50)
        print(f"🚀 '{place_name} 후기' 검색 시작...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            await page.set_extra_http_headers({
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            })
            
            try:
                # 검색 페이지 접속
                search_query = f"{place_name} 후기"
                search_url = f"{self.base_url}{search_query}"
                
                print(f"🔍 검색 시작: {search_query}")
                await page.goto(search_url, wait_until='domcontentloaded')
                await page.wait_for_timeout(3000)
                
                # 첫 페이지 수집
                print(f"📄 1페이지 수집 중...")
                reviews = await self._extract_reviews_from_page(page, search_query)
                
                self.results.extend(reviews)
                
                # 추가 페이지 수집 (선택적)
                if max_pages > 1:
                    for page_num in range(2, min(max_pages + 1, 4)):  # 최대 3페이지
                        try:
                            print(f"📄 {page_num}페이지 수집 중...")
                            
                            # 다음 페이지로 이동
                            next_button = await page.query_selector(f'a[href*="&page={page_num}"]')
                            if next_button:
                                await next_button.click()
                                await page.wait_for_timeout(3000)
                                
                                page_reviews = await self._extract_reviews_from_page(page, search_query)
                                self.results.extend(page_reviews)
                                
                                await asyncio.sleep(2)
                            else:
                                print(f"📄 {page_num}페이지 링크 없음")
                                break
                                
                        except Exception as e:
                            print(f"❌ {page_num}페이지 수집 실패: {e}")
                            break
                
                print(f"✅ 총 {len(self.results)}개의 리뷰를 수집했습니다.")
                
                # 결과 저장
                await self.save_results(place_name)
                
                return self.results
                
            except Exception as e:
                print(f"❌ 검색 실패: {e}")
                return []
                
            finally:
                await browser.close()
    
    async def save_results(self, place_name):
        """결과 저장"""
        try:
            # results 폴더 생성
            results_dir = Path("results")
            results_dir.mkdir(exist_ok=True)
            
            # 파일 이름 생성
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"naver_blog_reviews_{timestamp}.json"
            filepath = results_dir / filename
            
            # 결과 저장
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, ensure_ascii=False, indent=2)
            
            print(f"📁 결과 저장 완료: {filepath}")
            
            # 간단한 요약 출력
            print(f"\n📊 수집 결과 요약:")
            print("=" * 30)
            for i, review in enumerate(self.results, 1):
                print(f"{i}. {review['place_name']}")
                print(f"   📅 {review['publish_date']}")
                print(f"   📝 {review['content'][:50]}...")
                print()
            
        except Exception as e:
            print(f"❌ 결과 저장 실패: {e}")


async def main():
    """메인 함수"""
    import sys
    
    crawler = NaverBlogCrawlerStandalone()
    
    # 명령줄 인수 처리
    if len(sys.argv) > 1:
        place_name = sys.argv[1].strip()
        max_pages = 2
        if len(sys.argv) > 2:
            try:
                max_pages = int(sys.argv[2])
            except ValueError:
                max_pages = 2
    else:
        # 대화형 입력
        place_name = input("🔍 검색할 장소 이름을 입력하세요: ").strip()
        
        if not place_name:
            print("❌ 장소 이름을 입력해주세요.")
            return
        
        try:
            max_pages = int(input("📄 최대 검색 페이지 수 (기본값: 2): ") or "2")
        except ValueError:
            max_pages = 2
    
    # 크롤링 실행
    results = await crawler.search_place_reviews(place_name, max_pages)
    
    if results:
        print(f"\n🎉 크롤링 완료! {len(results)}개의 리뷰를 수집했습니다.")
    else:
        print("\n❌ 리뷰를 수집하지 못했습니다.")


if __name__ == "__main__":
    asyncio.run(main())
