import asyncio
import json
from app.ai.prompts import (
    SYSTEM_PROMPT,
    SUGGESTION_PROMPT_TEMPLATE,
    EXPAND_PROMPT_TEMPLATE,
    CHAT_PROMPT_TEMPLATE,
    THEMES_PROMPT_TEMPLATE,
)


class ClaudeCLI:
    async def _run_claude(self, prompt: str, session_id: str | None = None) -> str:
        cmd = ["claude", "--print", "-p", prompt]
        if session_id:
            cmd = ["claude", "--print", "--session-id", session_id, "-p", prompt]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"Claude CLI failed: {stderr.decode()}")
        return stdout.decode()

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
        prompt = THEMES_PROMPT_TEMPLATE.format(
            parasha_name=parasha_name,
            parasha_text=parasha_text[:2000],
            news_section=news_section,
            mefarshim_section=mefarshim_section,
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
