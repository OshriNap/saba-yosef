from app.pdf.generator import generate_daf_mekorot

def test_generate_pdf_returns_bytes():
    result = generate_daf_mekorot(
        title="בין חדשות לבשורות",
        parasha_name="פרשת בשלח",
        hebrew_date="כ״ב שבט תשפ״ו",
        gregorian_date="2026-02-14",
        content="<p>גוף דבר התורה כאן</p>",
        sources=[
            {"mefaresh": "רש״י", "ref": "שמות י״ד:ט״ו", "text": "טקסט הפירוש"},
            {"mefaresh": "רמב״ן", "ref": "שמות י״ד:ט״ז", "text": "טקסט הפירוש"},
        ],
        layout="expanded",
    )
    assert isinstance(result, bytes)
    assert result[:5] == b"%PDF-"

def test_generate_pdf_compact_layout():
    result = generate_daf_mekorot(
        title="כותרת",
        parasha_name="פרשת בראשית",
        hebrew_date="א׳ תשרי",
        gregorian_date="2026-10-01",
        content="<p>תוכן</p>",
        sources=[],
        layout="compact",
    )
    assert isinstance(result, bytes)
    assert result[:5] == b"%PDF-"
