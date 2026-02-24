"""Setup script for YAVIQ Python SDK"""
from setuptools import setup

setup(
    name="yaviq",
    version="1.0.0",
    description="YAVIQ Python SDK - Cut LLM token costs by up to 70% using TOON compression",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    py_modules=["yaviq"],
    python_requires=">=3.8",
    install_requires=[],
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    keywords=["llm", "token-optimization", "compression", "toon", "openai", "anthropic", "gemini"],
    author="YAVIQ",
    license="MIT",
)

