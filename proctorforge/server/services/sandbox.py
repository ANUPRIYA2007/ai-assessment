"""
ProctorForge AI - Secure Code Execution Sandbox
Executes student code in isolated Docker containers with resource limits.
Falls back to subprocess execution (with restrictions) if Docker is unavailable.
"""
import asyncio
import subprocess
import sys
import tempfile
import os
import json
import uuid
from typing import Optional
from config import settings


class SandboxResult:
    """Result of code execution."""

    def __init__(self, stdout: str = "", stderr: str = "", exit_code: int = 0,
                 timed_out: bool = False, execution_time: float = 0.0):
        self.stdout = stdout
        self.stderr = stderr
        self.exit_code = exit_code
        self.timed_out = timed_out
        self.execution_time = execution_time

    def to_dict(self):
        return {
            "stdout": self.stdout[:5000],  # Cap output size
            "stderr": self.stderr[:2000],
            "exit_code": self.exit_code,
            "timed_out": self.timed_out,
            "execution_time": round(self.execution_time, 3),
        }


async def _check_docker_available() -> bool:
    """Check if Docker is available."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "info",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=5)
        return proc.returncode == 0
    except Exception:
        return False


async def execute_code_docker(code: str, language: str = "python",
                               stdin_data: str = "", timeout: int = None) -> SandboxResult:
    """Execute code inside a Docker container."""
    timeout = timeout or settings.SANDBOX_TIMEOUT
    container_name = f"pf-sandbox-{uuid.uuid4().hex[:12]}"

    # Language-specific commands
    lang_config = {
        "python": {"image": settings.SANDBOX_IMAGE, "cmd": ["python3", "-c", code]},
        "javascript": {"image": "node:20-slim", "cmd": ["node", "-e", code]},
    }

    config = lang_config.get(language, lang_config["python"])

    docker_cmd = [
        "docker", "run", "--rm",
        "--name", container_name,
        "--network", "none",  # No network
        "--memory", settings.SANDBOX_MEMORY_LIMIT,
        "--cpus", str(settings.SANDBOX_CPU_LIMIT),
        "--pids-limit", "50",
        "--read-only",
        "--tmpfs", "/tmp:size=10m",
        "--security-opt", "no-new-privileges",
        config["image"],
    ] + config["cmd"]

    import time
    start_time = time.time()

    try:
        proc = await asyncio.create_subprocess_exec(
            *docker_cmd,
            stdin=asyncio.subprocess.PIPE if stdin_data else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=stdin_data.encode() if stdin_data else None),
            timeout=timeout,
        )

        execution_time = time.time() - start_time

        return SandboxResult(
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace"),
            exit_code=proc.returncode or 0,
            execution_time=execution_time,
        )

    except asyncio.TimeoutError:
        # Kill the container
        kill_proc = await asyncio.create_subprocess_exec(
            "docker", "kill", container_name,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await kill_proc.wait()

        return SandboxResult(
            stderr="Execution timed out",
            exit_code=124,
            timed_out=True,
            execution_time=timeout,
        )

    except Exception as e:
        return SandboxResult(stderr=str(e), exit_code=1, execution_time=time.time() - start_time)


async def execute_code_subprocess(code: str, language: str = "python",
                                    stdin_data: str = "", timeout: int = None) -> SandboxResult:
    """Fallback: Execute code in a subprocess with basic restrictions."""
    timeout = timeout or settings.SANDBOX_TIMEOUT

    # Blocked modules/patterns for safety
    dangerous_patterns = [
        "import os", "import subprocess", "import sys", "import shutil",
        "__import__", "eval(", "exec(", "open(", "import socket",
        "import http", "import urllib", "import requests",
    ]

    for pattern in dangerous_patterns:
        if pattern in code:
            return SandboxResult(
                stderr=f"Blocked: '{pattern}' is not allowed in sandbox mode",
                exit_code=1,
            )

    import time
    start_time = time.time()

    lang_cmd = {
        "python": [sys.executable, "-c", code],
        "javascript": ["node", "-e", code],
    }

    cmd = lang_cmd.get(language, lang_cmd["python"])

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE if stdin_data else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=tempfile.gettempdir(),
        )

        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=stdin_data.encode() if stdin_data else None),
            timeout=timeout,
        )

        execution_time = time.time() - start_time

        return SandboxResult(
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace"),
            exit_code=proc.returncode or 0,
            execution_time=execution_time,
        )

    except asyncio.TimeoutError:
        proc.kill()
        return SandboxResult(stderr="Execution timed out", exit_code=124, timed_out=True, execution_time=timeout)

    except Exception as e:
        return SandboxResult(stderr=str(e), exit_code=1, execution_time=time.time() - start_time)


async def execute_code(code: str, language: str = "python",
                       stdin_data: str = "", timeout: int = None) -> SandboxResult:
    """Execute code using Docker if available, otherwise subprocess fallback."""
    if await _check_docker_available():
        return await execute_code_docker(code, language, stdin_data, timeout)
    else:
        return await execute_code_subprocess(code, language, stdin_data, timeout)


async def run_test_cases(code: str, test_cases: list, language: str = "python") -> dict:
    """Run code against a list of test cases and return results."""
    results = []
    passed = 0
    total = len(test_cases)

    for i, tc in enumerate(test_cases):
        stdin_data = tc.get("input", "")
        expected = tc.get("expected_output", "").strip()

        result = await execute_code(code, language, stdin_data=stdin_data, timeout=10)
        actual = result.stdout.strip()

        test_passed = actual == expected and result.exit_code == 0 and not result.timed_out

        if test_passed:
            passed += 1

        results.append({
            "test_case": i + 1,
            "passed": test_passed,
            "expected": expected,
            "actual": actual,
            "stderr": result.stderr[:200] if result.stderr else None,
            "timed_out": result.timed_out,
            "execution_time": result.execution_time,
        })

    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "score": round((passed / total) * 100, 1) if total > 0 else 0,
        "results": results,
    }
