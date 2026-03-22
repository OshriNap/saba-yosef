from pathlib import Path
from sqlmodel import SQLModel, Session, create_engine, select
from app.models import RhetoricStrategy

DB_PATH = Path(__file__).parent.parent / "data" / "dvar_tora.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

def seed_rhetoric_strategies():
    """Insert pre-seeded strategies if not already present. Idempotent by key."""
    presets = [
        RhetoricStrategy(
            key="news_to_torah",
            name="מהחדשות לתורה",
            description="מה שמעסיק את כולם השבוע מקבל פרספקטיבה תורנית",
            structure_template="פתח עם האירוע, חבר לפרשה, תן תובנה",
            display_order=0,
        ),
        RhetoricStrategy(
            key="bigger_picture",
            name="התמונה הגדולה",
            description="עזור לאנשים לראות את ההקשר הרחב שהם לא רואים",
            structure_template="הצג את הפרט, הרחב לכלל, חשוף את התבנית",
            display_order=1,
        ),
        RhetoricStrategy(
            key="counter_consensus",
            name="נגד הזרם",
            description="אמור משהו שאנשים לא מצפים לשמוע, תגר על הקונצנזוס",
            structure_template="הצג את הדעה המקובלת, ערער, הצע חלופה",
            display_order=2,
        ),
        RhetoricStrategy(
            key="provocative_reframe",
            name="מסגור מחדש פרובוקטיבי",
            description="פתח עם טענה מפתיעה שנראית שגויה, ובסוף כולם מסכימים",
            structure_template="פתח פרובוקטיבית, בנה דרך מקורות, חשוף שהטענה נכונה מזווית אחרת",
            display_order=3,
        ),
    ]
    with Session(engine) as session:
        for preset in presets:
            existing = session.exec(
                select(RhetoricStrategy).where(RhetoricStrategy.key == preset.key)
            ).first()
            if not existing:
                session.add(preset)
        session.commit()
