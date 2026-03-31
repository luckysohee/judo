#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
네이버 검색 결과 디버깅 스크립트
"""

import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import re

async def debug_naver_search():
    """네이버 검색 결과 구조 디버깅"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # 보이는 모드로
        page = await browser.new_page()
        
        # User-Agent 설정
        await page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        try:
            # 검색 결과 페이지 접속
            search_query = "을지로 술집 후기"
            search_url = f"https://search.naver.com/search.naver?where=view&query={search_query}"
            
            print(f"🔍 검색 URL: {search_url}")
            await page.goto(search_url, wait_until='domcontentloaded')
            await page.wait_for_timeout(5000)  # 5초 대기
            
            # 페이지 소스 가져오기
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            print("🔍 페이지 제목:", soup.find('title').text if soup.find('title') else "제목 없음")
            
            # 모든 링크 찾기
            all_links = soup.find_all('a', href=True)
            blog_links = []
            
            for link in all_links:
                href = link.get('href', '')
                if 'blog.naver.com' in href:
                    blog_links.append({
                        'text': link.get_text(strip=True),
                        'href': href,
                        'class': link.get('class', []),
                        'parent_class': link.parent.get('class', []) if link.parent else []
                    })
            
            print(f"🔗 찾은 네이버 블로그 링크 수: {len(blog_links)}")
            
            # 블로그 링크 출력
            for i, link in enumerate(blog_links[:10]):  # 처음 10개만
                print(f"\n{i+1}. 텍스트: {link['text'][:50]}...")
                print(f"   링크: {link['href']}")
                print(f"   클래스: {link['class']}")
                print(f"   부모 클래스: {link['parent_class']}")
            
            # 일반적인 선택자들 테스트
            test_selectors = [
                '.api_txt_lines .total_tit',
                '.title_area .title',
                '.blog .title a',
                '.total_search .blog .title',
                '.lst_view .blog .title',
                '.section_blog .title',
                '.blog_section .title',
                '.search_result .blog .title'
            ]
            
            print(f"\n🔍 선택자 테스트:")
            for selector in test_selectors:
                elements = await page.query_selector_all(selector)
                if elements:
                    print(f"✅ {selector}: {len(elements)}개 찾음")
                    for elem in elements[:2]:
                        text = await elem.text_content()
                        href = await elem.get_attribute('href')
                        print(f"   - {text[:30]}... ({href})")
                else:
                    print(f"❌ {selector}: 0개")
            
            # 전체 HTML 저장
            with open('debug_naver_search.html', 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"\n📁 전체 HTML 저장: debug_naver_search.html")
            
            # 스크린샷 저장
            await page.screenshot(path='debug_naver_search.png')
            print(f"📸 스크린샷 저장: debug_naver_search.png")
            
        except Exception as e:
            print(f"❌ 오류 발생: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_naver_search())
