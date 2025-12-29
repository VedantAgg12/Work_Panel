import os
import importlib
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pathlib import Path
import json
from pydantic import BaseModel

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/modules", StaticFiles(directory="modules"), name="modules")

# Setup templates
templates = Jinja2Templates(directory="templates")


# Module loading logic
MODULES_DIR = Path("modules")
MODULES_DB = Path("database/modules.json")
modules = []

def load_modules():
    # Basic Icon Map
    ICON_MAP = {
        "dashboard": "fa-tachometer-alt",
        "settings": "fa-cog",
        "tasks": "fa-check-square",
        "notes": "fa-sticky-note",
        "manager": "fa-th-large",
        "story_studio": "fa-book-open",
        "notes": "fa-sticky-note",
        "study_tracker": "fa-graduation-cap",
        "idea_vault": "fa-lightbulb",
        "event_manager": "fa-calendar-alt",
        "default": "fa-puzzle-piece"
    }

    # Load enabled state
    enabled_states = {}
    if MODULES_DB.exists():
        try:
            with open(MODULES_DB, "r") as f:
                enabled_states = json.load(f)
        except:
            pass

    found_modules = []
    if os.path.exists("modules"):
        for item in os.scandir("modules"):
            if item.is_dir():
                mod_id = item.name.lower()
                
                is_enabled = enabled_states.get(mod_id, True) # Default to true if not in DB
                
                icon = ICON_MAP.get(mod_id, ICON_MAP["default"])
                
                mod_data = {
                    "id": mod_id,
                    "name": item.name.replace('_', ' ').title(),
                    "path": f"/modules/{item.name}",
                    "icon": icon,
                    "enabled": is_enabled
                }
                found_modules.append(mod_data)
                
    # Sort
    found_modules.sort(key=lambda x: x['name'])
    return found_modules


# Generic Storage API
class StorageItem(BaseModel):
    data: list | dict

DATABASE_DIR = Path("database")
DATABASE_DIR.mkdir(exist_ok=True)

@app.get("/api/storage/{filename}")
async def get_storage(filename: str):
    # Security check: prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename or not filename.endswith(".json"):
         return {"error": "Invalid filename"}
    
    file_path = DATABASE_DIR / filename
    if not file_path.exists():
        return [] # Return empty list by default
    
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/storage/{filename}")
async def save_storage(filename: str, item: StorageItem):
    # Security check
    if ".." in filename or "/" in filename or "\\" in filename or not filename.endswith(".json"):
         return {"error": "Invalid filename"}
    
    file_path = DATABASE_DIR / filename
    try:
        with open(file_path, "w") as f:
            json.dump(item.data, f, indent=4)
        return {"status": "success"}
    except Exception as e:
        return {"error": str(e)}

# Module Management API
class ModuleToggle(BaseModel):
    enabled: bool

@app.get("/api/modules")
async def get_modules():
    return load_modules()

@app.post("/api/modules/{module_id}/toggle")
async def toggle_module(module_id: str, toggle: ModuleToggle):
    # Load current states
    states = {}
    if MODULES_DB.exists():
        with open(MODULES_DB, "r") as f:
            states = json.load(f)
    
    states[module_id] = toggle.enabled
    
    with open(MODULES_DB, "w") as f:
        json.dump(states, f, indent=4)
        
    return {"status": "success", "enabled": toggle.enabled}


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    modules = load_modules() 
    # Pass ALL modules to sidebar, but exclude dashboard from the loop if needed (it's often hardcoded or handled specially)
    # The template will use 'enabled' property to set initial display style.
    # Exclude 'dashboard' from the dynamic list as it is hardcoded in base.html
    visible_modules = [m for m in modules if m['id'] != 'dashboard']
    return templates.TemplateResponse("base.html", {"request": request, "modules": visible_modules})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
