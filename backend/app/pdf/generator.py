from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

TEMPLATE_DIR = Path(__file__).parent / "templates"

env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))

def generate_daf_mekorot(
    title: str,
    parasha_name: str,
    hebrew_date: str,
    gregorian_date: str,
    content: str,
    sources: list[dict],
    layout: str = "expanded",
) -> bytes:
    template = env.get_template("daf_mekorot.html")
    html_str = template.render(
        title=title,
        parasha_name=parasha_name,
        hebrew_date=hebrew_date,
        gregorian_date=gregorian_date,
        content=content,
        sources=sources,
        layout=layout,
    )
    return HTML(string=html_str).write_pdf()
