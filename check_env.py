import os
from dotenv import load_dotenv

load_dotenv()

REQUIRED_VARS = [
    'SECRET_KEY',
    'SQLALCHEMY_DATABASE_URI',
    'GEMINI_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_DISCOVERY_URL'
]

OPTIONAL_VARS = [
    'ANTHROPIC_API_KEY',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'REDIS_URL'
]

print("🔍 Checking environment variables...\n")

all_good = True

for var in REQUIRED_VARS:
    value = os.getenv(var)
    if not value:
        print(f"❌ MISSING: {var}")
        all_good = False
    else:
        # Show length without exposing value
        print(f"✅ {var}: set (length: {len(value)})")

print("\n📋 Optional variables:")
for var in OPTIONAL_VARS:
    value = os.getenv(var)
    if value:
        print(f"✅ {var}: set (length: {len(value)})")
    else:
        print(f"⚠️  {var}: not set")

if all_good:
    print("\n✅ All required environment variables are set!")
else:
    print("\n❌ Some required variables are missing. Check your .env file!")
    exit(1)
