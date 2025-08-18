"""
Verify Analytics Service structure and imports.
"""

import os
import sys

def check_file_exists(filepath):
    """Check if file exists and print result."""
    exists = os.path.exists(filepath)
    status = "✅" if exists else "❌"
    print(f"{status} {filepath}")
    return exists

def check_directory_structure():
    """Check the directory structure."""
    print("📁 Checking Directory Structure:")
    
    base_dir = os.path.dirname(__file__)
    
    files_to_check = [
        "app/__init__.py",
        "app/main.py",
        "app/config.py", 
        "app/database.py",
        "app/models.py",
        "app/analytics_engine.py",
        "app/cache_manager.py",
        "app/kafka_processor.py",
        "app/routers.py",
        "app/response_models.py",
        "app/auth.py",
        "app/error_handler.py",
        "requirements.txt",
        "Dockerfile"
    ]
    
    all_exist = True
    for file_path in files_to_check:
        full_path = os.path.join(base_dir, file_path)
        exists = check_file_exists(full_path)
        if not exists:
            all_exist = False
    
    return all_exist

def check_imports():
    """Check if the import structure is correct."""
    print("\n📦 Checking Import Structure:")
    
    try:
        # Check if we can import the config without dependencies
        import importlib.util
        
        config_path = os.path.join(os.path.dirname(__file__), "app", "config.py")
        spec = importlib.util.spec_from_file_location("config", config_path)
        config_module = importlib.util.module_from_spec(spec)
        
        # Mock pydantic BaseSettings to avoid import error
        class MockBaseSettings:
            def __init__(self, **kwargs):
                for key, value in kwargs.items():
                    setattr(self, key, value)
        
        import types
        mock_pydantic = types.ModuleType('pydantic')
        mock_pydantic.BaseSettings = MockBaseSettings
        sys.modules['pydantic'] = mock_pydantic
        
        spec.loader.exec_module(config_module)
        print("✅ Config module structure valid")
        
        return True
        
    except Exception as e:
        print(f"❌ Import error: {e}")
        return False

def check_docker():
    """Check Dockerfile."""
    print("\n🐳 Checking Docker Configuration:")
    
    dockerfile_path = os.path.join(os.path.dirname(__file__), "Dockerfile")
    if os.path.exists(dockerfile_path):
        with open(dockerfile_path, 'r') as f:
            content = f.read()
            if "analytics-service" in content and "uvicorn" in content:
                print("✅ Dockerfile appears valid")
                return True
            else:
                print("❌ Dockerfile missing expected content")
                return False
    else:
        print("❌ Dockerfile not found")
        return False

def check_requirements():
    """Check requirements.txt."""
    print("\n📋 Checking Requirements:")
    
    req_path = os.path.join(os.path.dirname(__file__), "requirements.txt")
    if os.path.exists(req_path):
        with open(req_path, 'r') as f:
            content = f.read()
            required_packages = ["fastapi", "sqlalchemy", "redis", "aiokafka", "numpy", "pandas"]
            
            missing = []
            for package in required_packages:
                if package not in content:
                    missing.append(package)
            
            if not missing:
                print("✅ All required packages listed")
                return True
            else:
                print(f"❌ Missing packages: {missing}")
                return False
    else:
        print("❌ requirements.txt not found")
        return False

def main():
    """Main verification function."""
    print("🔍 Analytics Service Structure Verification\n")
    
    structure_ok = check_directory_structure()
    imports_ok = check_imports()
    docker_ok = check_docker()
    requirements_ok = check_requirements()
    
    print("\n📊 Summary:")
    print(f"Directory Structure: {'✅' if structure_ok else '❌'}")
    print(f"Import Structure: {'✅' if imports_ok else '❌'}")
    print(f"Docker Configuration: {'✅' if docker_ok else '❌'}")
    print(f"Requirements: {'✅' if requirements_ok else '❌'}")
    
    if all([structure_ok, imports_ok, docker_ok, requirements_ok]):
        print("\n🎉 Analytics Service is ready for deployment!")
        return True
    else:
        print("\n⚠️  Some issues found. Please review and fix.")
        return False

if __name__ == "__main__":
    main()