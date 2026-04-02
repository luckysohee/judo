#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
네이버 블로그 리뷰 크롤러
장소 이름 + 후기 검색으로 블로그 리뷰와 태그 수집
"""

import asyncio
import re
from datetime import datetime
from typing import List, Dict, Optional
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import json
import time


class NaverBlogCrawler:
    def __init__(self):
        self.results = []
        self.base_url = "https://search.naver.com/search.naver"
        
    async def search_place_reviews(self, place_name: str, max_pages: int = 3) -> List[Dict]:
        """
        장소 이름으로 네이버 블로그 리뷰 검색
        
        Args:
            place_name: 장소 이름
            max_pages: 최대 검색 페이지 수
            
        Returns:
            리뷰 정보 리스트
        """
        search_query = f"{place_name} 후기"
        print(f"🔍 검색 시작: {search_query}")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # User-Agent 설정
            await page.set_extra_http_headers({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            })
            
            try:
                # 검색 결과 페이지 접속
                search_url = f"{self.base_url}?where=view&query={search_query}"
                await page.goto(search_url, wait_until='domcontentloaded')
                await page.wait_for_timeout(2000)
                
                # 각 페이지에서 리뷰 수집
                for page_num in range(1, max_pages + 1):
                    print(f"📄 {page_num}페이지 수집 중...")
                    
                    # 현재 페이지의 리뷰 수집
                    page_results = await self._extract_reviews_from_page(page, place_name)
                    self.results.extend(page_results)
                    
                    # 다음 페이지로 이동
                    if page_num < max_pages:
                        next_page_exists = await self._go_to_next_page(page)
                        if not next_page_exists:
                            break
                        await page.wait_for_timeout(2000)
                
                print(f"✅ 총 {len(self.results)}개의 리뷰를 수집했습니다.")
                return self.results
                
            except Exception as e:
                print(f"❌ 오류 발생: {e}")
                return []
            finally:
                await browser.close()
    
    async def _extract_reviews_from_page(self, page, place_name: str) -> List[Dict]:
        """페이지에서 리뷰 정보 추출"""
        reviews = []
        
        try:
            # 페이지가 완전히 로드될 때까지 대기
            await page.wait_for_timeout(5000)
            
            # 네이버 블로그 링크 가져오기 - 최신 구조에 맞춰서
            blog_links = await page.query_selector_all('a[href*="blog.naver.com/"][href*="/"]')
            
            print(f"🔗 찾은 네이버 블로그 링크 수: {len(blog_links)}")
            
            # 중복 링크 제거
            seen_urls = set()
            unique_links = []
            
            for link in blog_links:
                href = await link.get_attribute('href')
                if href and href not in seen_urls and 'blog.naver.com/' in href and '/' in href.split('blog.naver.com/')[-1]:
                    seen_urls.add(href)
                    unique_links.append(link)
            
            print(f"🔗 중복 제거 후 블로그 링크 수: {len(unique_links)}")
            
            for i, link in enumerate(unique_links):
                try:
                    # 블로그 포스트 URL 가져오기
                    href = await link.get_attribute('href')
                    if not href:
                        continue
                    
                    # 네이버 블로그 링크만 처리
                    if 'blog.naver.com' not in href:
                        continue
                    
                    # 프로필 링크 제외
                    if href.count('/') < 5:  # blog.naver.com/username 형식은 제외
                        continue
                    
                    print(f"🔗 블로그 방문 ({i+1}/{len(unique_links)}): {href}")
                    
                    # 새 탭에서 블로그 포스트 열기
                    blog_page = await page.context.new_page()
                    await blog_page.goto(href, wait_until='domcontentloaded')
                    await blog_page.wait_for_timeout(3000)
                    
                    # 리뷰 정보 추출
                    review_info = await self._extract_blog_review(blog_page, place_name, href)
                    
                    if review_info:
                        reviews.append(review_info)
                        print(f"✅ 리뷰 수집 완료: {review_info['title'][:30]}...")
                    else:
                        print(f"⚠️ 리뷰 정보 추출 실패")
                    
                    await blog_page.close()
                    
                    # 요청 간격 조절
                    await asyncio.sleep(2)
                    
                    # 너무 많은 요청 방지
                    if i >= 5:  # 페이지당 최대 5개만 처리
                        break
                    
                except Exception as e:
                    print(f"⚠️ 블로그 처리 중 오류: {e}")
                    continue
            
        except Exception as e:
            print(f"⚠️ 페이지 분석 중 오류: {e}")
        
        return reviews
    
    async def _extract_blog_review(self, page, place_name: str, blog_url: str) -> Optional[Dict]:
        """개별 블로그 포스트에서 리뷰 정보 추출"""
        try:
            # 페이지 소스 가져오기
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            # 제목 추출
            title_elem = soup.find('title')
            title = title_elem.text.strip() if title_elem else "제목 없음"
            
            # 작성일 추출
            publish_date = self._extract_publish_date(soup)
            
            # 본문 내용 추출
            content_text = self._extract_content_text(soup)
            
            # 장소 관련 내용 필터링
            filtered_content = self._filter_place_related_content(content_text, place_name)
            
            # 태그 추출
            tags = self._extract_tags(soup)
            
            # 리뷰 정보 구성
            review_info = {
                'place_name': place_name,
                'title': title,
                'content': filtered_content,
                'publish_date': publish_date,
                'blog_url': blog_url,
                'tags': tags,
                'collected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            return review_info
            
        except Exception as e:
            print(f"⚠️ 블로그 리뷰 추출 중 오류: {e}")
            return None
    
    def _extract_publish_date(self, soup: BeautifulSoup) -> str:
        """작성일 추출"""
        date_patterns = [
            r'(\d{4}\.\s*\d{1,2}\.\s*\d{1,2})',
            r'(\d{4}-\d{1,2}-\d{1,2})',
            r'(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)',
            r'(\d{4}/\d{1,2}/\d{1,2})'
        ]
        
        # 다양한 위치에서 날짜 정보 찾기
        date_selectors = [
            '.date',
            '.publish_date',
            '.post-date',
            '.entry-date',
            '.se_publishDate',
            '.blog_date'
        ]
        
        for selector in date_selectors:
            date_elem = soup.select_one(selector)
            if date_elem:
                date_text = date_elem.text.strip()
                for pattern in date_patterns:
                    match = re.search(pattern, date_text)
                    if match:
                        return match.group(1)
        
        # 전체 텍스트에서 날짜 찾기
        full_text = soup.get_text()
        for pattern in date_patterns:
            match = re.search(pattern, full_text)
            if match:
                return match.group(1)
        
        return "작성일 없음"
    
    def _extract_content_text(self, soup: BeautifulSoup) -> str:
        """본문 내용 추출"""
        # 네이버 블로그 본문 선택자들
        content_selectors = [
            '.se-main-container .se-component-content',
            '.se-main-container .se-text',
            '.post-view .post-content',
            '.blog_content .post-body',
            '#post-view .post-body',
            '.se-module-text',
            '.se-section-text',
            '.blog-view .post-body',
            '.contents .post-body',
            '.article .post-body'
        ]
        
        for selector in content_selectors:
            content_elem = soup.select_one(selector)
            if content_elem:
                # 불필요한 태그 제거
                for tag in content_elem.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
                    tag.decompose()
                
                content_text = content_elem.get_text(separator=' ', strip=True)
                if len(content_text) > 50:  # 의미 있는 내용인지 확인
                    return content_text
        
        # 네이버 블로그 특정 구조 시도
        main_content = soup.find('div', class_='se-main-container')
        if main_content:
            # 모든 텍스트 요소 추출
            text_elements = main_content.find_all(['p', 'div', 'span'])
            content_parts = []
            
            for elem in text_elements:
                text = elem.get_text(strip=True)
                if len(text) > 10:  # 의미 있는 텍스트만
                    content_parts.append(text)
            
            if content_parts:
                return ' '.join(content_parts)
        
        # fallback: 전체 텍스트에서 본문 같은 부분 추출
        all_text = soup.get_text(separator=' ', strip=True)
        
        # 너무 짧으면 제목 제외하고 다시 시도
        title_elem = soup.find('title')
        if title_elem:
            title_text = title_elem.get_text(strip=True)
            all_text = all_text.replace(title_text, '')
        
        # 너무 길면 자르기
        if len(all_text) > 3000:
            all_text = all_text[:3000] + "..."
        
        return all_text.strip() if all_text.strip() else "내용 추출 실패"
    
    def _filter_place_related_content(self, content: str, place_name: str) -> str:
        """장소 관련 내용 필터링"""
        # 장소 이름과 관련된 문장만 추출
        sentences = content.split('.')
        
        filtered_sentences = []
        for sentence in sentences:
            sentence = sentence.strip()
            if (place_name in sentence or 
                '후기' in sentence or 
                '리뷰' in sentence or 
                '방문' in sentence or
                '가게' in sentence or
                '매장' in sentence or
                len(sentence) > 20):  # 의미 있는 문장
                filtered_sentences.append(sentence)
        
        return '. '.join(filtered_sentences) if filtered_sentences else content
    
    def _extract_tags(self, soup: BeautifulSoup) -> List[str]:
        """태그 추출"""
        tags = []
        
        # 태그 관련 클래스에서 추출
        tag_selectors = [
            '.tag',
            '.tags',
            '.hashtag',
            '.blog-tag',
            '.post-tag'
        ]
        
        for selector in tag_selectors:
            tag_elements = soup.select(selector)
            for elem in tag_elements:
                tag_text = elem.text.strip()
                if tag_text and tag_text.startswith('#'):
                    tags.append(tag_text)
        
        # 해시태그 패턴으로 추출
        hashtag_pattern = r'#([a-zA-Z0-9가-힣_]+)'
        full_text = soup.get_text()
        hashtags = re.findall(hashtag_pattern, full_text)
        tags.extend([f"#{tag}" for tag in hashtags])
        
        # 중복 제거
        return list(set(tags))
    
    async def _go_to_next_page(self, page) -> bool:
        """다음 페이지로 이동"""
        try:
            # 다음 페이지 버튼 찾기
            next_button = await page.query_selector('.pg_next:not(.disabled)')
            if next_button:
                await next_button.click()
                await page.wait_for_timeout(2000)
                return True
            return False
        except Exception as e:
            print(f"⚠️ 다음 페이지 이동 중 오류: {e}")
            return False
    
    def save_results(self, filename: str = None):
        """결과 저장"""
        if filename is None:
            filename = f"naver_blog_reviews_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        
        print(f"📁 결과 저장 완료: {filename}")


async def main():
    """메인 함수"""
    crawler = NaverBlogCrawler()
    
    # 검색할 장소 이름 입력
    place_name = input("🔍 검색할 장소 이름을 입력하세요: ").strip()
    
    if not place_name:
        print("❌ 장소 이름을 입력해주세요.")
        return
    
    # 최대 페이지 수 입력
    try:
        max_pages = int(input("📄 최대 검색 페이지 수 (기본값: 3): ") or "3")
    except ValueError:
        max_pages = 3
    
    print(f"🚀 '{place_name} 후기' 검색 시작...")
    
    # 크롤링 실행
    results = await crawler.search_place_reviews(place_name, max_pages)
    
    if results:
        # 결과 출력
        print(f"\n📊 수집 결과 (총 {len(results)}개)")
        print("=" * 50)
        
        for i, review in enumerate(results, 1):
            print(f"\n{i}. {review['title']}")
            print(f"   📅 작성일: {review['publish_date']}")
            print(f"   🏷️ 태그: {', '.join(review['tags'][:5]) if review['tags'] else '없음'}")
            print(f"   📝 내용: {review['content'][:100]}...")
            print(f"   🔗 링크: {review['blog_url']}")
        
        # 결과 저장
        save_choice = input("\n💾 결과를 저장하시겠습니까? (y/n): ").strip().lower()
        if save_choice == 'y':
            crawler.save_results()
    else:
        print("❌ 수집된 리뷰가 없습니다.")


if __name__ == "__main__":
    print("🕷️  네이버 블로그 리뷰 크롤러")
    print("=" * 40)
    asyncio.run(main())
