from app.db.session import engine
from app.models.all_models import Base, LivestockZone
import sqlalchemy

print("Checking if livestock_zones exists...")
insp = sqlalchemy.inspect(engine)
if "livestock_zones" in insp.get_table_names():
    print("✅ Table livestock_zones exists.")
else:
    print("❌ Table livestock_zones is missing! Creating it now...")
    Base.metadata.create_all(bind=engine)
    print("✅ Created missing tables.")
