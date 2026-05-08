# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec — Control Tower IA backend."""

a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[],
    datas=[('app', 'app')],
    hiddenimports=[
        # uvicorn
        'uvicorn.logging',
        'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.loops.asyncio',
        'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl', 'uvicorn.protocols.http.httptools_impl',
        'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.lifespan.off',
        # fastapi / starlette
        'fastapi', 'fastapi.responses', 'fastapi.middleware.cors',
        'starlette.routing', 'starlette.middleware', 'starlette.responses',
        'starlette.staticfiles', 'starlette.templating',
        # sqlalchemy
        'sqlalchemy', 'sqlalchemy.dialects.sqlite',
        'sqlalchemy.orm', 'sqlalchemy.ext.declarative',
        # pydantic
        'pydantic', 'pydantic.v1',
        # pywin32
        'win32com', 'win32com.client', 'win32api', 'win32con',
        'pythoncom', 'pywintypes',
        # email / multipart
        'email', 'multipart',
        # async
        'asyncio', 'anyio', 'anyio.abc',
        # http
        'h11', 'httpx',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'PIL', 'PyQt5', 'wx'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='run',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='run',
)
