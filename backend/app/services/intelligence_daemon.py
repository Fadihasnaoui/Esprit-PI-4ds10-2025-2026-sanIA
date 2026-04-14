import threading
import time
import random
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session
from ..db.session import SessionLocal
from ..models.all_models import Animal, AnimalTelemetry
from .weather_intelligence import weather_service
from ..routers.livestock_ws import manager

logger = logging.getLogger(__name__)

class IntelligenceDaemon:
    """
    Démon de monitoring universel ultra-robuste.
    Gère la persistence et la diffusion temps réel sans échec.
    """
    
    def __init__(self, interval=30):
        self.interval = interval
        self.running = False
        self._thread = None

    def start(self):
        if self.running: return
        self.running = True
        self._thread = threading.Thread(target=self._run_wrapper, daemon=True)
        self._thread.start()
        logger.info("Universal Intelligence Engine started.")

    def stop(self):
        self.running = False

    def _run_wrapper(self):
        try:
            asyncio.run(self._main_loop())
        except Exception as e:
            logger.error(f"Main loop crashed: {e}")

    async def _main_loop(self):
        while self.running:
            start_batch = time.time()
            try:
                db = SessionLocal()
                animals = db.query(Animal).all()
                animal_count = len(animals) if animals else 0
                
                # Heartbeat pour débug avec count
                with open("daemon_heartbeat.txt", "w") as f:
                    f.write(f"Last Run: {datetime.now().isoformat()}\n")
                    f.write(f"Animals Found: {animal_count}\n")
                    f.write(f"DB URI: {db.get_bind().url}\n")

                if not animals:
                    logger.warning("No animals found in database.")
                    db.close()
                    await asyncio.sleep(self.interval)
                    continue

                # Batch weather results
                locations = [(a.latitude or 36.60, a.longitude or 10.49) for a in animals]
                all_weather = []
                for i in range(0, len(locations), 50):
                    batch = locations[i:i+50]
                    res = await weather_service.get_batch_weather(batch)
                    all_weather.extend(res)

                # Process each animal with individual commits for safety
                for idx, animal in enumerate(animals):
                    try:
                        # Update position
                        animal.latitude = (animal.latitude or 36.60) + random.uniform(-0.00002, 0.00002)
                        animal.longitude = (animal.longitude or 10.49) + random.uniform(-0.00002, 0.00002)
                        
                        w = all_weather[idx] if idx < len(all_weather) else {"temperature": 22.0}
                        temp_ext = w.get("temperature", 20.0)
                        
                        # Bio-Modeling
                        activity = random.choice(["EATING", "RESTING", "WALKING"])
                        body_temp = 38.2 + (temp_ext * 0.01) + random.uniform(-0.05, 0.05)
                        hr = {"RESTING": 45, "EATING": 60, "WALKING": 75}[activity] + random.randint(-3, 3)

                        telemetry = AnimalTelemetry(
                            animal_id=animal.id,
                            time=datetime.now(),
                            heart_rate=hr,
                            temperature_c=round(body_temp, 2),
                            activity_level=activity,
                            latitude=animal.latitude,
                            longitude=animal.longitude,
                            weight_kg=animal.weight_kg
                        )
                        db.add(telemetry)
                        db.commit() # Individual commit to avoid bulk failure
                        
                        # WebSocket Broadcast
                        try:
                            await manager.broadcast({
                                "type": "TELEMETRY_UPDATE",
                                "data": {
                                    "animal_id": str(animal.id),
                                    "tag_id": animal.tag_id,
                                    "heart_rate": telemetry.heart_rate,
                                    "temperature_c": telemetry.temperature_c,
                                    "activity_level": telemetry.activity_level,
                                    "latitude": telemetry.latitude,
                                    "longitude": telemetry.longitude,
                                    "source": "SVI_ENGINE"
                                }
                            })
                        except Exception: pass # WebSocket errors shouldn't stop DB writes
                        
                    except Exception as inner_e:
                        db.rollback()
                        logger.error(f"Error processing animal {animal.id}: {inner_e}")
                
                elapsed = time.time() - start_batch
                logger.info(f"Processed {len(animals)} animals in {elapsed:.1f}s")

            except Exception as e:
                logger.error(f"Global loop error: {e}")
            finally:
                if db: db.close()
            
            # Use max to ensure we don't sleep negative time
            sleep_time = max(1, self.interval - (time.time() - start_batch))
            await asyncio.sleep(sleep_time)

intelligence_daemon = IntelligenceDaemon()
