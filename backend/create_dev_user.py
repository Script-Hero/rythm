#!/usr/bin/env python3
"""
Create development user in the database.
This script ensures there's always a real dev user available for development authentication.
"""

import asyncio
import asyncpg
import os
from uuid import UUID
from datetime import datetime
from passlib.context import CryptContext

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://algotrade:algotrade@localhost:5432/algotrade")
DEV_USER_ID = "00000000-0000-0000-0000-000000000000"
DEV_USERNAME = "dev_user"
DEV_EMAIL = "dev@example.com"
DEV_PASSWORD = "dev_password"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_dev_user():
    """Create or update the development user in the database."""
    try:
        # Connect to database
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Hash the password
        hashed_password = pwd_context.hash(DEV_PASSWORD)
        now = datetime.utcnow()
        
        # Check if dev user already exists
        existing_user = await conn.fetchrow(
            "SELECT id FROM users WHERE id = $1 OR username = $2",
            UUID(DEV_USER_ID), DEV_USERNAME
        )
        
        if existing_user:
            # Update existing dev user
            await conn.execute(
                """
                UPDATE users 
                SET username = $2, email = $3, hashed_password = $4, 
                    is_active = true, updated_at = $5
                WHERE id = $1
                """,
                UUID(DEV_USER_ID), DEV_USERNAME, DEV_EMAIL, hashed_password, now
            )
            print(f"✅ Updated existing dev user: {DEV_USERNAME}")
        else:
            # Create new dev user
            await conn.execute(
                """
                INSERT INTO users (id, username, email, hashed_password, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                UUID(DEV_USER_ID), DEV_USERNAME, DEV_EMAIL, hashed_password, True, now, now
            )
            print(f"✅ Created new dev user: {DEV_USERNAME}")
        
        await conn.close()
        
        print("\n🔑 Development credentials:")
        print(f"   Username: {DEV_USERNAME}")
        print(f"   Password: {DEV_PASSWORD}")
        print(f"   Email: {DEV_EMAIL}")
        print(f"   ID: {DEV_USER_ID}")
        
    except Exception as e:
        print(f"❌ Failed to create dev user: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(create_dev_user())