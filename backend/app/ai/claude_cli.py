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
    MEFARSHIM_RESEARCH_PROMPT,
    MEFARSHIM_SUMMARIZE_NEW_PROMPT,
    PUNCHLINE_PROMPT,
    BEATS_PROMPT,
    FLOW_GENERATE_PROMPT,
    FLOW_REFINE_SECTION_PROMPT,
    FLOW_REFINE_GLOBAL_PROMPT,
)


CLAUDE_BIN = "/home/oshrin/.local/bin/claude"


class ClaudeCLI:
    def _build_cmd(self, prompt: str, session_id: str | None = None, model: str | None = None) -> list[str]:
        cmd = [CLAUDE_BIN, "--print", "-p", prompt]
        if session_id:
            cmd = [CLAUDE_BIN, "--print", "--session-id", session_id, "-p", prompt]
        if model:
            cmd.extend(["--model", model])
        return cmd

    async def _run_claude(self, prompt: str, session_id: str | None = None, model: str | None = None) -> str:
        cmd = self._build_cmd(prompt, session_id, model=model)
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
        rhetoric_sequence: list[dict] | None = None,
        punchline: str = "",
        beats: list[dict] | None = None,
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
        result = FOCUSED_SUGGESTION_PROMPT_TEMPLATE.format(
            parasha_name=parasha_name,
            parasha_text=parasha_text[:2000],
            news_section=news_section,
            themes_section=themes_section,
            connections_section=connections_section,
            mefarshim_section=mefarshim_section,
            style_section=style_section,
        )
        # Append rhetoric context if provided (after formatting the template)
        if rhetoric_sequence or punchline:
            rhetoric_parts = []
            if punchline:
                rhetoric_parts.append(f"## פאנצ'ליין (המסר המרכזי)\n{punchline}")
            if rhetoric_sequence:
                seq = "\n".join(
                    f"{i+1}. **{s.get('name', '')}**: {s.get('structure_template', '')}"
                    for i, s in enumerate(rhetoric_sequence)
                )
                rhetoric_parts.append(f"## רצף רטורי\n{seq}")
            if beats:
                beats_text = "\n".join(
                    f"- {b.get('strategy_name', '')}: {b.get('beat', '')}" for b in beats
                )
                rhetoric_parts.append(f"## ביטים\n{beats_text}")
            rhetoric_parts.append("## הנחיה נוספת\nהתאם את ההצעות לפאנצ'ליין ולרצף הרטורי שלמעלה. כל הצעה צריכה לבנות את הדרשה לכיוון הפאנצ'ליין.")
            result += "\n\n" + "\n\n".join(rhetoric_parts)
        return result

    async def generate_suggestions_focused(
        self,
        parasha_name: str,
        parasha_text: str,
        news_items: list[dict],
        themes: list[dict],
        connections: list[dict],
        mefarshim_texts: dict[str, list[dict]],
        style: dict | None = None,
        rhetoric_sequence: list[dict] | None = None,
        punchline: str = "",
        beats: list[dict] | None = None,
    ) -> list[dict]:
        prompt = self._build_focused_prompt(
            parasha_name, parasha_text, news_items, themes, connections, mefarshim_texts, style,
            rhetoric_sequence, punchline, beats,
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
        rhetoric_sequence: list[dict] | None = None,
        punchline: str = "",
        beats: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        prompt = self._build_focused_prompt(
            parasha_name, parasha_text, news_items, themes, connections, mefarshim_texts, style,
            rhetoric_sequence, punchline, beats,
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

    async def stream_mefarshim_research(
        self,
        parasha_name: str,
        news_items: list[dict],
        themes: list[dict],
        mefarshim_texts: dict[str, list[dict]],
    ) -> AsyncGenerator[dict, None]:
        """Two-phase mefarshim research: summarize DB texts, then fetch+summarize new ones."""
        from app.collectors.parasha_collector import ParashaCollector

        # Build prompt sections
        news_section = "\n".join(
            f"- {item.get('title', '')}: {item.get('summary', '')}" for item in news_items
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"- {t.get('title', '')}: {t.get('description', '')}" for t in themes
        ) or "לא נבחרו נושאי פרשה"
        mefarshim_section = ""
        indexed_texts = []  # list of {mefaresh, ref, text} indexed by position
        for mefaresh, texts in mefarshim_texts.items():
            mefarshim_section += f"\n### {mefaresh}\n"
            for t in texts[:5]:
                ref = t.get("ref", "")
                full_text = t.get("text", "")
                idx = len(indexed_texts)
                mefarshim_section += f"- [{idx}] {ref}: {full_text[:200]}\n"
                indexed_texts.append({"mefaresh": mefaresh, "ref": ref, "text": full_text})

        # Phase 1: Summarize existing mefarshim
        prompt = MEFARSHIM_RESEARCH_PROMPT.format(
            parasha_name=parasha_name,
            news_section=news_section,
            themes_section=themes_section,
            mefarshim_section=mefarshim_section or "אין מפרשים במאגר לקטגוריות שנבחרו",
        )
        raw = await self._run_claude(prompt, model="haiku")
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
        except (ValueError, json.JSONDecodeError):
            data = {"summaries": [], "additional_refs": []}

        # Yield phase 1 results
        for s in data.get("summaries", []):
            idx = s.get("index")
            if idx is not None and 0 <= idx < len(indexed_texts):
                orig_entry = indexed_texts[idx]
                orig_text = orig_entry["text"]
                mefaresh_name = orig_entry["mefaresh"]
                ref = orig_entry["ref"]
            else:
                orig_text = ""
                mefaresh_name = s.get("mefaresh", "")
                ref = s.get("ref", "")
            yield {
                "type": "mefaresh",
                "mefaresh": mefaresh_name,
                "ref": ref,
                "summary": s.get("summary", ""),
                "original_text": orig_text,
                "source": "db",
            }

        # Phase 2: Fetch additional references
        additional_refs = data.get("additional_refs", [])[:5]
        if additional_refs:
            yield {"type": "phase", "phase": "fetching_additional", "count": len(additional_refs)}

            collector = ParashaCollector()
            try:
                import asyncio

                async def fetch_ref(ref_info: dict) -> list[dict]:
                    """Fetch a single commentary ref from Sefaria."""
                    mefaresh = ref_info["mefaresh"]
                    ref = ref_info["ref"]
                    return await collector.get_commentary(ref, mefaresh)

                tasks = [fetch_ref(ref) for ref in additional_refs]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                new_texts = []
                for ref_info, result in zip(additional_refs, results):
                    if isinstance(result, Exception) or not result:
                        continue
                    for t in result[:3]:
                        new_texts.append(t)

                if new_texts:
                    # Summarize new texts
                    new_texts_section = ""
                    for t in new_texts:
                        new_texts_section += f"- {t.get('mefaresh', '')} ({t.get('ref', '')}): {t.get('text', '')[:200]}\n"

                    prompt2 = MEFARSHIM_SUMMARIZE_NEW_PROMPT.format(
                        news_section=news_section,
                        themes_section=themes_section,
                        new_texts_section=new_texts_section,
                    )
                    raw2 = await self._run_claude(prompt2, model="haiku")
                    try:
                        start2 = raw2.index("{")
                        end2 = raw2.rindex("}") + 1
                        data2 = json.loads(raw2[start2:end2])
                    except (ValueError, json.JSONDecodeError):
                        data2 = {"summaries": []}

                    # Build lookup for original texts
                    new_originals = {}
                    for t in new_texts:
                        key = f"{t.get('mefaresh', '')}||{t.get('ref', '')}"
                        new_originals[key] = t.get("text", "")

                    for s in data2.get("summaries", []):
                        key = f"{s.get('mefaresh', '')}||{s.get('ref', '')}"
                        yield {
                            "type": "mefaresh",
                            "mefaresh": s.get("mefaresh", ""),
                            "ref": s.get("ref", ""),
                            "summary": s.get("summary", ""),
                            "original_text": new_originals.get(key, ""),
                            "source": "new",
                        }
            finally:
                await collector.close()

        yield {"type": "done"}

    def _parse_json(self, raw: str) -> dict:
        """Extract and parse JSON from Claude's response, handling markdown fences."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        return json.loads(cleaned[start:end])

    async def generate_punchlines(
        self,
        news_items: list[dict],
        themes: list[dict],
        rhetoric_sequence: list[dict],
    ) -> list[str]:
        """Generate 3-5 punchline suggestions using Sonnet."""
        news_section = "\n".join(
            f"- {item.get('title', '')}: {item.get('summary', '')}" for item in news_items
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"- {t.get('title', '')}: {t.get('description', '')}" for t in themes
        ) or "לא נבחרו נושאי פרשה"
        rhetoric_section = "\n".join(
            f"{i+1}. **{s.get('name', '')}**: {s.get('description', '')} — מבנה: {s.get('structure_template', '')}"
            for i, s in enumerate(rhetoric_sequence)
        ) or "לא נבחרו אסטרטגיות"

        prompt = PUNCHLINE_PROMPT.format(
            news_section=news_section,
            themes_section=themes_section,
            rhetoric_section=rhetoric_section,
        )
        raw = await self._run_claude(prompt)  # Sonnet (default)
        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            # Remove first line (```json) and last line (```)
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        try:
            start = cleaned.index("{")
            end = cleaned.rindex("}") + 1
            data = json.loads(cleaned[start:end])
            return data.get("punchlines", [])
        except (ValueError, json.JSONDecodeError):
            # Try to extract punchlines from raw text as fallback
            return [raw.strip()[:300]]

    async def generate_beats(
        self,
        punchline: str,
        news_items: list[dict],
        themes: list[dict],
        rhetoric_sequence: list[dict],
    ) -> list[dict]:
        """Generate a beat per strategy step using Sonnet."""
        news_section = "\n".join(
            f"- {item.get('title', '')}: {item.get('summary', '')}" for item in news_items
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"- {t.get('title', '')}: {t.get('description', '')}" for t in themes
        ) or "לא נבחרו נושאי פרשה"
        rhetoric_section = "\n".join(
            f"{i+1}. **{s.get('name', '')}**: {s.get('description', '')} — מבנה: {s.get('structure_template', '')}"
            for i, s in enumerate(rhetoric_sequence)
        ) or "לא נבחרו אסטרטגיות"

        prompt = BEATS_PROMPT.format(
            punchline=punchline,
            news_section=news_section,
            themes_section=themes_section,
            rhetoric_section=rhetoric_section,
        )
        raw = await self._run_claude(prompt)  # Sonnet (default)
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
            return data.get("beats", [])
        except (ValueError, json.JSONDecodeError):
            return []

    async def generate_flow(
        self,
        punchline: str,
        news_items: list[dict],
        themes: list[dict],
        connections: list[dict],
        rhetoric_sequence: list[dict],
    ) -> dict:
        """Generate a 4-6 section drasha flow."""
        news_section = "\n".join(
            f"{i}. {item.get('title', '')}: {item.get('summary', '')}" for i, item in enumerate(news_items)
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"{i}. {t.get('title', '')}: {t.get('description', '')}" for i, t in enumerate(themes)
        ) or "לא נבחרו נושאי פרשה"
        connections_section = "\n".join(
            f"- חדשה {c.get('news_index', '')} ↔ נושא {c.get('theme_index', '')}: {c.get('reason', '')}"
            for c in connections
        ) or "לא זוהו קשרים"
        rhetoric_section = "\n".join(
            f"{i+1}. **{s.get('name', '')}**: {s.get('description', '')} — מבנה: {s.get('structure_template', '')}"
            for i, s in enumerate(rhetoric_sequence)
        ) or "לא נבחרו אסטרטגיות"

        prompt = FLOW_GENERATE_PROMPT.format(
            punchline=punchline,
            news_section=news_section,
            themes_section=themes_section,
            connections_section=connections_section,
            rhetoric_section=rhetoric_section,
        )
        raw = await self._run_claude(prompt)
        try:
            data = self._parse_json(raw)
            return data
        except (ValueError, json.JSONDecodeError):
            return {"sections": []}

    async def refine_section(
        self,
        punchline: str,
        flow_sections: list[dict],
        section_index: int,
        instruction: str,
    ) -> dict:
        """Refine a single section of the flow."""
        flow_summary = "\n".join(
            f"{i+1}. [{s.get('rhetoricalMove', '')}] {s.get('title', '')}"
            for i, s in enumerate(flow_sections)
        )
        section_json = json.dumps(flow_sections[section_index], ensure_ascii=False, indent=2)
        prev_section = json.dumps(flow_sections[section_index - 1], ensure_ascii=False, indent=2) if section_index > 0 else "אין — זה השלב הראשון"
        next_section = json.dumps(flow_sections[section_index + 1], ensure_ascii=False, indent=2) if section_index < len(flow_sections) - 1 else "אין — זה השלב האחרון"

        prompt = FLOW_REFINE_SECTION_PROMPT.format(
            punchline=punchline,
            flow_summary=flow_summary,
            section_json=section_json,
            prev_section=prev_section,
            next_section=next_section,
            instruction=instruction,
        )
        raw = await self._run_claude(prompt)
        try:
            return self._parse_json(raw)
        except (ValueError, json.JSONDecodeError):
            return flow_sections[section_index]

    async def refine_flow(
        self,
        punchline: str,
        news_items: list[dict],
        themes: list[dict],
        flow_sections: list[dict],
        instruction: str = "",
    ) -> dict:
        """Refine the entire flow for coherence."""
        news_section = "\n".join(
            f"{i}. {item.get('title', '')}: {item.get('summary', '')}" for i, item in enumerate(news_items)
        ) or "לא נבחרו חדשות"
        themes_section = "\n".join(
            f"{i}. {t.get('title', '')}: {t.get('description', '')}" for i, t in enumerate(themes)
        ) or "לא נבחרו נושאי פרשה"
        flow_json = json.dumps(flow_sections, ensure_ascii=False, indent=2)

        prompt = FLOW_REFINE_GLOBAL_PROMPT.format(
            punchline=punchline,
            news_section=news_section,
            themes_section=themes_section,
            flow_json=flow_json,
            instruction=instruction or "שפר את המהלך הכללי",
        )
        raw = await self._run_claude(prompt)
        try:
            return self._parse_json(raw)
        except (ValueError, json.JSONDecodeError):
            return {"sections": flow_sections, "changes": ""}
