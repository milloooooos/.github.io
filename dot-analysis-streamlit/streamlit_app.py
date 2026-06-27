"""Streamlit Cloud 入口包装器。
实际的 Streamlit 应用在 streamlit_app/streamlit_app.py
"""
import sys
import os

repo_root = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(repo_root, 'streamlit_app'))

app_path = os.path.join(repo_root, 'streamlit_app', 'streamlit_app.py')
with open(app_path, 'r', encoding='utf-8') as f:
    code = f.read()

exec(compile(code, app_path, 'exec'))
