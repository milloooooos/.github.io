"""Root-level entry point for Streamlit Cloud deployment.
Delegates to streamlit_app/streamlit_app.py
"""
import sys
import os

# Add the streamlit_app subdirectory to the path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'streamlit_app'))

# Load and execute the actual Streamlit app
app_path = os.path.join(os.path.dirname(__file__), 'streamlit_app', 'streamlit_app.py')
with open(app_path, 'r', encoding='utf-8') as f:
    code = f.read()

exec(compile(code, app_path, 'exec'))
