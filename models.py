from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    name = db.Column(db.String(255))
    credits = db.Column(db.Integer, default=3)  # ✅ Changed from 10 to 3
    last_credit_reset = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))  # ✅ ADD THIS LINE
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    projects = db.relationship('Project', backref='user', lazy=True, cascade='all, delete-orphan')
    chat_history = db.relationship('ChatHistory', backref='user', lazy=True, cascade='all, delete-orphan')

class Project(db.Model):
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), default='Untitled Project')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    files = db.relationship('ProjectFile', backref='project', lazy=True, cascade='all, delete-orphan')
    chat_messages = db.relationship('ChatHistory', backref='project', lazy=True, cascade='all, delete-orphan')

class ProjectFile(db.Model):
    __tablename__ = 'project_files'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text)  # For text files (HTML, CSS, JS)
    content_binary = db.Column(db.LargeBinary)  # For binary files (images)
    file_type = db.Column(db.String(50))  # html, css, js, png, jpg, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatHistory(db.Model):
    __tablename__ = 'chat_history'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    prompt = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text)
    generated_code = db.Column(db.Text)
    was_modification = db.Column(db.Boolean, default=False)
    created_files = db.Column(db.JSON)  # List of filenames created
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class SessionRecord(db.Model):
    __tablename__ = 'session_records'
    
    id = db.Column(db.Integer, primary_key=True)
    prompt = db.Column(db.Text, nullable=False)
    generated_code = db.Column(db.Text)
    description = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    remaining_credits = db.Column(db.Integer)
    filename = db.Column(db.String(255))
    created_files = db.Column(db.JSON)
    was_modification = db.Column(db.Boolean, default=False)
