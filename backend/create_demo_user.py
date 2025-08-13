#!/usr/bin/env python3
"""
Create a demo user for development purposes.
This script creates the 'demo' user with password 'demo123' for frontend development.
"""

import asyncio
import asyncpg
from passlib.context import CryptContext
import os

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_demo_user():
    """Create demo user in database."""
    
    # Database connection parameters
    db_config = {
        'host': os.getenv('POSTGRES_HOST', 'localhost'),
        'port': os.getenv('POSTGRES_PORT', '5432'),
        'user': os.getenv('POSTGRES_USER', 'algotrade'),
        'password': os.getenv('POSTGRES_PASSWORD', 'algotrade'),
        'database': os.getenv('POSTGRES_DB', 'algotrade')
    }
    
    try:
        # Connect to database
        conn = await asyncpg.connect(**db_config)
        
        # Hash the demo password
        hashed_password = pwd_context.hash('demo123')
        
        # Check if demo user already exists
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE username = $1",
            'demo'
        )
        
        if existing:
            print("✅ Demo user already exists")
            print(f"   Username: demo")
            print(f"   Password: demo123")
            print(f"   User ID: {existing['id']}")
            return
        
        # Create demo user
        result = await conn.fetchrow(
            """
            INSERT INTO users (email, username, hashed_password, is_active, is_verified)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, username, is_active, is_verified, created_at
            """,
            'demo@algotrade.dev', 'demo', hashed_password, True, True
        )
        
        print("🎉 Demo user created successfully!")
        print(f"   Username: demo")
        print(f"   Password: demo123")
        print(f"   Email: demo@algotrade.dev")
        print(f"   User ID: {result['id']}")
        print(f"   Created: {result['created_at']}")
        print()
        print("🔧 You can now use these credentials in the frontend for development")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ Failed to create demo user: {e}")
        print()
        print("📝 Make sure PostgreSQL is running and accessible:")
        print(f"   Host: {db_config['host']}")
        print(f"   Port: {db_config['port']}")
        print(f"   Database: {db_config['database']}")
        print(f"   User: {db_config['user']}")

if __name__ == "__main__":
    asyncio.run(create_demo_user())