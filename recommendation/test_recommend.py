from __future__ import annotations

import json
import os
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from recommendation.recommend import (
    _canonical_place_name_row,
    _category_try_order,
    _enrich_place_for_api,
    _mood_score_place,
    _name_tokens_overlap,
    _places_list,
    _reason_from_content_column,
    _reason_from_raw_data,
    recommend,
)


class TestCategoryTryOrder:
    def test_puts_requested_first_then_fallbacks_without_dup(self) -> None:
        parsed: dict[str, Any] = {"category": "이자카야", "location": "성수"}
        assert _category_try_order(parsed)[:3] == ["이자카야", "와인바", "노포"]

    def test_empty_category_defaults_to_wine_bar_first_slot(self) -> None:
        parsed: dict[str, Any] = {"category": "", "location": "합정"}
        assert _category_try_order(parsed)[0] == "와인바"

    def test_dedupes_when_first_equals_fallback(self) -> None:
        parsed: dict[str, Any] = {"category": "와인바", "location": "강남"}
        order = _category_try_order(parsed)
        assert order[0] == "와인바"
        assert order.count("와인바") == 1


class TestReasonFromContentColumn:
    def test_prefers_sentence_chunk_containing_name(self) -> None:
        content = "앞부분은 일반적이다. 성수바는 자연와인 위주로 골라 마시기 좋다."
        got = _reason_from_content_column("성수바", content)
        assert got is not None
        assert "성수바" in got
        assert "자연와인" in got

    def test_returns_none_when_name_or_content_missing(self) -> None:
        assert _reason_from_content_column("", "있는 본문") is None
        assert _reason_from_content_column("가게", "") is None


class TestNameTokensOverlap:
    def test_space_folded_equality_korean(self) -> None:
        assert _name_tokens_overlap("성수와인바", "성수 와인 바")

    def test_substring_after_space_fold(self) -> None:
        assert _name_tokens_overlap("연남치킨집", "연남 치킨")

    def test_whitespace_token_overlap_still_works(self) -> None:
        assert _name_tokens_overlap("성수 자연와인", "자연와인 성수")

    def test_unrelated_short_names(self) -> None:
        assert not _name_tokens_overlap("만선", "선릉")


class TestReasonFromRawData:
    def test_slash_block_title_desc_joined(self) -> None:
        raw = (
            "다른술집 / 무시 / 무시\n\n"
            "목표바 / 짧은 제목 / 여기는 시음 위주로 조용한 편이다."
        )
        got = _reason_from_raw_data("목표바", raw)
        assert got == "짧은 제목 — 여기는 시음 위주로 조용한 편이다."

    def test_slash_block_matches_when_only_space_differs(self) -> None:
        raw = "성수 와인 바 / 내용제목 / 설명 한 줄"
        got = _reason_from_raw_data("성수와인바", raw)
        assert got == "내용제목 — 설명 한 줄"

    def test_block_without_slash_substring_match(self) -> None:
        raw = "한 블록만 있고 슬래시는 없다. 목표바가 골목 끝에 있다."
        got = _reason_from_raw_data("목표바", raw)
        assert got is not None
        assert "목표바" in got

    def test_truncates_with_ellipsis_over_280_chars(self) -> None:
        title = "x" * 120
        desc = "y" * 200
        raw = f"장소 / {title} / {desc}"
        got = _reason_from_raw_data("장소", raw)
        assert got is not None
        assert got.endswith("…")
        assert len(got) <= 281


class TestEnrichPlaceForApi:
    def test_content_beats_raw_and_sets_canonical_names(self) -> None:
        p = {"title": "표시용", "place_name": "실제상호", "reason": "옛이유"}
        raw = "실제상호 / 제목줄 / 본문줄"
        content = "실제상호는 content에서 다른 말을 한다."
        out = _enrich_place_for_api(p, content, raw)
        assert out["name"] == "실제상호"
        assert out["place_name"] == "실제상호"
        assert "content에서" in out["reason"]

    def test_raw_when_content_has_no_match_for_place_name(self) -> None:
        p = {"place_name": "목표바"}
        raw = "목표바 / 제목줄 / 본문설명이다."
        content = "본문에는 전혀 다른 내용만 있다."
        out = _enrich_place_for_api(p, content, raw)
        assert out["reason"] == "제목줄 — 본문설명이다."

    def test_falls_back_to_content_then_reason_then_signals(self) -> None:
        base = {"name": "가게", "reason": "", "signals": ["a", "b", "c"]}
        out1 = _enrich_place_for_api(dict(base), "가게는 여기 한 문장이다.", "")
        assert out1["reason"] == "가게는 여기 한 문장이다."

        out2 = _enrich_place_for_api(
            {"name": "청계철판", "reason": "저장된 이유", "signals": ["a"]},
            "이 본문에는 상호가 전혀 등장하지 않는다.",
            "",
        )
        assert out2["reason"] == "저장된 이유"

        out3 = _enrich_place_for_api(
            {"name": "가게", "signals": ["시그1", "시그2"]},
            "",
            "",
        )
        assert out3["reason"] == "시그1 · 시그2"

    def test_non_dict_passthrough(self) -> None:
        assert _enrich_place_for_api("x", "c", "") == "x"


class TestCanonicalPlaceName:
    def test_skips_theme_fragment_uses_clipped_blog_title(self) -> None:
        p = {
            "place_name": "기념일에 가기",
            "name": "기념일에 가기",
            "title": "을지로 언오디너리 방문 후기",
        }
        assert _canonical_place_name_row(p) == "을지로 언오디너리"


class TestPlacesList:
    def test_json_string_parsed_to_list(self) -> None:
        row = {"places": json.dumps([{"name": "n"}])}
        assert _places_list(row) == [{"name": "n"}]

    def test_invalid_json_returns_empty(self) -> None:
        assert _places_list({"places": "not json"}) == []


class TestMoodScorePlace:
    def test_counts_signal_hits_per_mood(self) -> None:
        p = {
            "title": "바",
            "reason": "조용한 편이라 대화하기 좋다",
            "signals": ["데이트"],
        }
        # reason 채널: 조용 +4, 대화 +4
        assert _mood_score_place(p, ["조용한"]) >= 8
        # signals 채널: 데이트 +5
        assert _mood_score_place(p, ["데이트"]) >= 5

    def test_unknown_mood_falls_back_to_literal_substring(self) -> None:
        p = {"title": "", "reason": "야외 테라스가 인상적"}
        assert _mood_score_place(p, ["야외"]) == 4

    def test_raw_blob_adds_blog_text_when_reason_sparse(self) -> None:
        raw = (
            "조용한바 / 블로그제목 / 아늑하고 조용한 분위기의 와인바 후기\n\n"
            "다른곳 / x / 시끄러운 술집"
        )
        p = {"place_name": "조용한바", "title": "조용한바", "reason": ""}
        with_raw = _mood_score_place(p, ["조용한"], raw)
        without = _mood_score_place(p, ["조용한"], "")
        assert with_raw > without
        assert with_raw >= 3


class TestRecommend:
    def test_no_location_skips_supabase(self) -> None:
        with patch("recommendation.recommend.create_client") as cc:
            out = recommend("   ")
        cc.assert_not_called()
        assert out == {"ok": False, "message": "지역을 더 구체적으로 입력해줘"}

    def test_missing_supabase_env_returns_friendly_message(self) -> None:
        env = dict(os.environ)
        env.pop("SUPABASE_URL", None)
        env.pop("SUPABASE_KEY", None)
        with patch.dict(os.environ, env, clear=True):
            out = recommend("성수 와인바")
        assert out["ok"] is False
        assert out["message"] == "Supabase 연결 정보가 설정되지 않았어"

    def test_no_row_returns_message(self) -> None:
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "http://test", "SUPABASE_KEY": "k"},
            clear=False,
        ):
            with patch("recommendation.recommend.create_client", return_value=MagicMock()):
                with patch(
                    "recommendation.recommend.fetch_latest_recommendation",
                    return_value=None,
                ):
                    out = recommend("성수 와인바")
        assert out["ok"] is False
        assert "없어" in out["message"]

    def test_happy_path_enriches_places_without_openai(self) -> None:
        row: dict[str, Any] = {
            "content": "성수바는 첫 문장이다. 다음 문장은 다른 내용.",
            "raw_data": "",
            "places": [{"title": "성수바", "reason": ""}],
        }
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "http://test", "SUPABASE_KEY": "k"},
            clear=False,
        ):
            with patch("recommendation.recommend.create_client", return_value=MagicMock()):
                with patch(
                    "recommendation.recommend.fetch_latest_recommendation",
                    return_value=row,
                ):
                    out = recommend("성수 와인바")
        assert out["ok"] is True
        assert out["location"] == "성수"
        assert out["category"] == "와인바"
        assert out["moods"] == []
        assert out["mood_refinement_applied"] is False
        assert out["mood_refinement_skipped_reason"] is None
        assert out["summary"] == row["content"].strip()
        assert len(out["places"]) == 1
        assert out["places"][0].get("reason")
        assert "성수바" in (out["places"][0].get("reason") or "")

    def test_moods_reorder_places_without_openai(self) -> None:
        row: dict[str, Any] = {
            "content": "두 곳 모두 언급.",
            "raw_data": "",
            "places": [
                {
                    "place_name": "북적바",
                    "title": "북적바",
                    "reason": "북적이고 음악이 큰 편",
                },
                {
                    "place_name": "한산바",
                    "title": "한산바",
                    "reason": "조용한 분위기에 대화하기 좋다",
                },
            ],
        }
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "http://test",
                "SUPABASE_KEY": "k",
                "OPENAI_API_KEY": "",
            },
            clear=False,
        ):
            with patch("recommendation.recommend.create_client", return_value=MagicMock()):
                with patch(
                    "recommendation.recommend.fetch_latest_recommendation",
                    return_value=row,
                ):
                    out = recommend("을지로 조용한 와인바")
        assert out["ok"] is True
        assert out["moods"] == ["조용한"]
        names = [p.get("place_name") for p in out["places"]]
        assert names[0] == "한산바"
        assert names[1] == "북적바"
        assert out["places"][0].get("mood_score", 0) >= out["places"][1].get(
            "mood_score", 0
        )

    def test_moods_raw_data_can_reorder_when_reason_tied(self) -> None:
        raw = (
            "한잔바 / 제목 / 조용하고 대화하기 좋은 후기 본문\n\n"
            "시끌바 / 제목2 / 북적이고 음악 큰 편"
        )
        row: dict[str, Any] = {
            "content": "요약",
            "raw_data": raw,
            "places": [
                {"place_name": "시끌바", "title": "시끌바", "reason": "일반 설명"},
                {"place_name": "한잔바", "title": "한잔바", "reason": "일반 설명"},
            ],
        }
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "http://test",
                "SUPABASE_KEY": "k",
                "OPENAI_API_KEY": "",
            },
            clear=False,
        ):
            with patch("recommendation.recommend.create_client", return_value=MagicMock()):
                with patch(
                    "recommendation.recommend.fetch_latest_recommendation",
                    return_value=row,
                ):
                    out = recommend("을지로 조용한 와인바")
        assert out["ok"] is True
        names = [p.get("place_name") for p in out["places"]]
        assert names[0] == "한잔바"
        assert all("mood_score" in p for p in out["places"])

    def test_moods_without_openai_key_skips_refinement_with_reason(self) -> None:
        row: dict[str, Any] = {
            "content": "원문 요약 그대로",
            "raw_data": "",
            "places": [],
        }
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "http://test",
                "SUPABASE_KEY": "k",
                "OPENAI_API_KEY": "",
            },
            clear=False,
        ):
            with patch("recommendation.recommend.create_client", return_value=MagicMock()):
                with patch(
                    "recommendation.recommend.fetch_latest_recommendation",
                    return_value=row,
                ):
                    out = recommend("성수 조용한 와인바")
        assert out["ok"] is True
        assert out["moods"] == ["조용한"]
        assert out["mood_refinement_applied"] is False
        assert out["mood_refinement_skipped_reason"] == "openai_key_missing"
        assert out["summary"] == "원문 요약 그대로"

    def test_refine_failure_falls_back_to_stored_content(self) -> None:
        row: dict[str, Any] = {
            "content": "원문 요약 그대로",
            "raw_data": "",
            "places": [],
        }
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "http://test",
                "SUPABASE_KEY": "k",
                "OPENAI_API_KEY": "sk-test",
            },
            clear=False,
        ):
            with patch("recommendation.recommend.create_client", return_value=MagicMock()):
                with patch(
                    "recommendation.recommend.fetch_latest_recommendation",
                    return_value=row,
                ):
                    with patch(
                        "recommendation.recommend.refine_with_user_query",
                        side_effect=RuntimeError("upstream"),
                    ):
                        out = recommend("성수 조용한 와인바")
        assert out["ok"] is True
        assert out["moods"] == ["조용한"]
        assert out["mood_refinement_applied"] is False
        assert out["mood_refinement_skipped_reason"] == "refine_failed"
        assert out["summary"] == "원문 요약 그대로"
