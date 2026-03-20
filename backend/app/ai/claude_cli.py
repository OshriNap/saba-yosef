import asyncio
import json
from typing import AsyncGenerator
from app.ai.prompts import (
    SYSTEM_PROMPT,
    NEWS_FILTER_PROMPT,
    SUGGESTION_PROMPT_TEMPLATE,
    FOCUSED_SUGGESTION_PROMPT_TEMPLATE,
    EXPAND_PROMPT_TEMPLATE,
    CHAT_PROMPT_TEMPLATE,
    THEMES_PROMPT_TEMPLATE,
)


class ClaudeCLI:
    def _build_cmd(self, prompt: str, session_id: str | None = None) -> list[str]:
        cmd = ["claude", "--print", "-p", prompt]
        if session_id:
            cmd = ["claude", "--print", "--session-id", session_id, "-p", prompt]
        return cmd

    async def _run_claude(self, prompt: str, session_id: str | None = None) -> str:
        cmd = self._build_cmd(prompt, session_id)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"Claude CLI failed: {stderr.decode()}")
        return stdout.decode()

    async def _stream_claude(self, prompt: str, session_id: str | None = None) -> AsyncGenerator[str, None]:
        """Run Claude CLI and yield heartbeats while waiting, then typewriter the result."""
        cmd = self._build_cmd(prompt, session_id)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        # Send heartbeats while waiting
        while True:
            try:
                await asyncio.wait_for(proc.wait(), timeout=3)
                break  # Process finished
            except asyncio.TimeoutError:
                yield ""  # Empty heartbeat to keep SSE alive
        stdout = await proc.stdout.read()
        text = stdout.decode()
        if proc.returncode != 0:
            stderr = await proc.stderr.read()
            raise RuntimeError(f"Claude CLI failed: {stderr.decode()}")
        # Typewriter effect
        words = text.split(' ')
        for i, word in enumerate(words):
            yield word + (' ' if i < len(words) - 1 else '')
            await asyncio.sleep(0.02)

    async def filter_news(self, news_items: list[dict]) -> list[dict]:
        """Filter news items, keeping only those relevant for dvar tora."""
        news_list = "\n".join(
            f"{i}. {item['title']}: {item.get('summary', '')}"
            for i, item in enumerate(news_items)
        )
        prompt = NEWS_FILTER_PROMPT.format(news_list=news_list)
        raw = await self._run_claude(prompt)
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            keep_indices = data.get("keep", [])
            return [news_items[i] for i in keep_indices if i < len(news_items)]
        except (ValueError, json.JSONDecodeError):
            return news_items  # On error, keep all

    def _build_suggestion_prompt(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        mefarshim_texts: dict[str, list[dict]],
    ) -> str:
        news_section = "\n".join(
            f"- {item['title']}: {item.get('summary', '')}" for item in news_items
        )
        mefarshim_section = ""
        for mefaresh, texts in mefarshim_texts.items():
            mefarshim_section += f"\n### {mefaresh}\n"
            for t in texts[:10]:
                mefarshim_section += f"- {t.get('ref', '')}: {t.get('text', '')[:200]}\n"
        return SUGGESTION_PROMPT_TEMPLATE.format(
            parasha_name=parasha_name,
            parasha_text=parasha_text[:2000],
            news_section=news_section,
            mefarshim_section=mefarshim_section,
        )

    async def generate_suggestions(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        mefarshim_texts: dict[str, list[dict]],
    ) -> list[dict]:
        prompt = self._build_suggestion_prompt(
            parasha_name, parasha_text, news_items, mefarshim_texts
        )
        raw = await self._run_claude(prompt)
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            return data.get("suggestions", [])
        except (ValueError, json.JSONDecodeError):
            return [{"title": "שגיאה בפענוח", "thesis": raw[:200], "outline": "", "sources": [], "linked_news": []}]

    def _build_focused_prompt(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        themes: list[dict],
        connections: list[dict],
        mefarshim_texts: dict[str, list[dict]],
        style: dict | None = None,
    ) -> str:
        news_section = "\n".join(
            f"- {item.get('title', '')}: {item.get('summary', '')}" for item in news_items
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"- {t.get('title', '')}: {t.get('description', '')}" for t in themes
        ) or "לא נבחרו נושאי פרשה"
        connections_section = "\n".join(
            f"- {c.get('reason', '')}" for c in connections
        ) or "אין קשרים מזוהים"
        mefarshim_section = ""
        for mefaresh, texts in mefarshim_texts.items():
            mefarshim_section += f"\n### {mefaresh}\n"
            for t in texts[:5]:
                mefarshim_section += f"- {t.get('ref', '')}: {t.get('text', '')[:150]}\n"
        style_section = "לא צוינו העדפות סגנון."
        if style:
            parts = []
            if style.get("tone"): parts.append(f"טון: {style['tone']}")
            if style.get("audience"): parts.append(f"קהל יעד: {style['audience']}")
            if style.get("length"): parts.append(f"אורך: {style['length']}")
            if style.get("approach"): parts.append(f"גישה: {style['approach']}")
            if parts:
                style_section = "\n".join(parts)
        return FOCUSED_SUGGESTION_PROMPT_TEMPLATE.format(
            parasha_name=parasha_name,
            parasha_text=parasha_text[:2000],
            news_section=news_section,
            themes_section=themes_section,
            connections_section=connections_section,
            mefarshim_section=mefarshim_section,
            style_section=style_section,
        )

    async def generate_suggestions_focused(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        themes: list[dict],
        connections: list[dict],
        mefarshim_texts: dict[str, list[dict]],
        style: dict | None = None,
    ) -> list[dict]:
        prompt = self._build_focused_prompt(
            parasha_name, parasha_text, news_items, themes, connections, mefarshim_texts, style,
        )
        raw = await self._run_claude(prompt)
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            return data.get("suggestions", [])
        except (ValueError, json.JSONDecodeError):
            return [{"title": "שגיאה בפענוח", "thesis": raw[:200], "outline": "", "sources": [], "linked_news": []}]

    async def stream_suggestions_focused(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        themes: list[dict],
        connections: list[dict],
        mefarshim_texts: dict[str, list[dict]],
        style: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        prompt = self._build_focused_prompt(
            parasha_name, parasha_text, news_items, themes, connections, mefarshim_texts, style,
        )
        async for chunk in self._stream_claude(prompt):
            yield chunk

    async def stream_suggestions(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        mefarshim_texts: dict[str, list[dict]],
    ) -> AsyncGenerator[str, None]:
        prompt = self._build_suggestion_prompt(
            parasha_name, parasha_text, news_items, mefarshim_texts
        )
        async for chunk in self._stream_claude(prompt):
            yield chunk

    async def stream_expand(
        self,
        title: str,
        thesis: str,
        outline: str,
        sources: list[dict],
        parasha_text: str,
    ) -> AsyncGenerator[str, None]:
        sources_section = "\n".join(
            f"- {s.get('mefaresh', '')}: {s.get('ref', '')}" for s in sources
        )
        prompt = EXPAND_PROMPT_TEMPLATE.format(
            title=title,
            thesis=thesis,
            outline=outline,
            sources_section=sources_section,
            parasha_text=parasha_text[:2000],
        )
        async for chunk in self._stream_claude(prompt):
            yield chunk

    async def expand_suggestion(
        self,
        title: str,
        thesis: str,
        outline: str,
        sources: list[dict],
        parasha_text: str,
        session_id: str,
    ) -> str:
        sources_section = "\n".join(
            f"- {s.get('mefaresh', '')}: {s.get('ref', '')}" for s in sources
        )
        prompt = EXPAND_PROMPT_TEMPLATE.format(
            title=title,
            thesis=thesis,
            outline=outline,
            sources_section=sources_section,
            parasha_text=parasha_text[:2000],
        )
        return await self._run_claude(prompt, session_id=session_id)

    async def generate_themes_and_connections(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        mefarshim_texts: dict[str, list[dict]],
        jewish_events: list[dict] | None = None,
    ) -> dict:
        news_section = "\n".join(
            f"{i}. {item['title']}: {item.get('summary', '')}"
            for i, item in enumerate(news_items)
        )
        mefarshim_section = ""
        for mefaresh, texts in mefarshim_texts.items():
            mefarshim_section += f"\n### {mefaresh}\n"
            for t in texts[:5]:
                mefarshim_section += f"- {t.get('ref', '')}: {t.get('text', '')[:150]}\n"
        events_section = "אין מועדים מיוחדים קרובים."
        if jewish_events:
            events_section = "\n".join(
                f"- {e['title']} ({e.get('date', '')})"
                for e in jewish_events
            )
        prompt = THEMES_PROMPT_TEMPLATE.format(
            parasha_name=parasha_name,
            parasha_text=parasha_text[:2000],
            news_section=news_section,
            mefarshim_section=mefarshim_section,
            events_section=events_section,
        )
        raw = await self._run_claude(prompt)
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            return {
                "themes": data.get("themes", []),
                "connections": data.get("connections", []),
            }
        except (ValueError, json.JSONDecodeError):
            return {"themes": [], "connections": []}

    async def chat_edit(
        self,
        current_text: str,
        user_request: str,
        session_id: str,
    ) -> str:
        prompt = CHAT_PROMPT_TEMPLATE.format(
            current_text=current_text,
            user_request=user_request,
        )
        return await self._run_claude(prompt, session_id=session_id)
