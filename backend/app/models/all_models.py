from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, Enum, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from ..db.session import Base

class UserRole(str, enum.Enum):
    FARMER = "FARMER"
    COOPERATIVE_ADMIN = "COOPERATIVE_ADMIN"

class Cooperative(Base):
    __tablename__ = "cooperatives"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True)
    location = Column(String)
    users = relationship("User", back_populates="cooperative")
    farms = relationship("Farm", back_populates="cooperative")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(Enum(UserRole), default=UserRole.FARMER)
    cooperative_id = Column(UUID(as_uuid=True), ForeignKey("cooperatives.id"), nullable=True)
    farm_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cooperative = relationship("Cooperative", back_populates="users")

class Farm(Base):
    __tablename__ = "farms"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cooperative_id = Column(UUID(as_uuid=True), ForeignKey("cooperatives.id"))
    name = Column(String)
    location = Column(String)
    owner_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cooperative = relationship("Cooperative", back_populates="farms")
    fields = relationship("Field", back_populates="farm")
    animals = relationship("Animal", back_populates="farm")
    alerts = relationship("Alert", back_populates="farm")

class Field(Base):
    __tablename__ = "fields"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    farm_id = Column(UUID(as_uuid=True), ForeignKey("farms.id"))
    name = Column(String)
    crop_type = Column(String)
    area_ha = Column(Float)
    polygon_geojson = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    farm = relationship("Farm", back_populates="fields")
    sensor_readings = relationship("SensorReading", back_populates="field")
    irrigation_logs = relationship("IrrigationLog", back_populates="field")
    disease_scans = relationship("DiseaseScan", back_populates="field")
    ndvi_records = relationship("NDVIRecord", back_populates="field")

class SensorReading(Base):
    __tablename__ = "sensor_readings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"))
    soil_moisture = Column(Float)
    temperature_c = Column(Float)
    humidity_pct = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    field = relationship("Field", back_populates="sensor_readings")

class IrrigationLog(Base):
    __tablename__ = "irrigation_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"))
    recommended_minutes = Column(Integer)
    executed_minutes = Column(Integer, nullable=True)
    water_estimate_m3 = Column(Float)
    status = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    field = relationship("Field", back_populates="irrigation_logs")

class DiseaseScan(Base):
    __tablename__ = "disease_scans"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"))
    image_url = Column(String)
    crop_type = Column(String)
    predicted_disease = Column(String)
    confidence = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    field = relationship("Field", back_populates="disease_scans")

class NDVIRecord(Base):
    __tablename__ = "ndvi_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"))
    ndvi_value = Column(Float)
    status = Column(String)
    captured_at = Column(DateTime(timezone=True))
    field = relationship("Field", back_populates="ndvi_records")

class Animal(Base):
    __tablename__ = "animals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    farm_id = Column(UUID(as_uuid=True), ForeignKey("farms.id"))
    tag_id = Column(String, unique=True)
    species = Column(String)
    breed = Column(String)
    birth_date = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    farm = relationship("Farm", back_populates="animals")
    vaccinations = relationship("VaccinationLog", back_populates="animal")
    treatments = relationship("TreatmentLog", back_populates="animal")

class VaccinationLog(Base):
    __tablename__ = "vaccination_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    animal_id = Column(UUID(as_uuid=True), ForeignKey("animals.id"))
    vaccine_name = Column(String)
    dose = Column(String)
    vet_name = Column(String)
    date = Column(DateTime)
    next_due_date = Column(DateTime)
    animal = relationship("Animal", back_populates="vaccinations")

class TreatmentLog(Base):
    __tablename__ = "treatment_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    animal_id = Column(UUID(as_uuid=True), ForeignKey("animals.id"))
    diagnosis = Column(String)
    medicine = Column(String)
    dosage = Column(String)
    vet_note = Column(Text)
    date = Column(DateTime)
    animal = relationship("Animal", back_populates="treatments")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    farm_id = Column(UUID(as_uuid=True), ForeignKey("farms.id"))
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"), nullable=True)
    type = Column(String)
    severity = Column(String)
    status = Column(String, default="open")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    farm = relationship("Farm", back_populates="alerts")
