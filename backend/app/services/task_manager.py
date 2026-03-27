import asyncio
import time
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    INTERRUPTED = "interrupted"


@dataclass
class TaskInfo:
    task_id: str
    task_type: str
    symbol: str
    interval: str
    status: TaskStatus
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    message_zh: str = ""
    message_en: str = ""
    collected_count: int = 0
    error_message: Optional[str] = None

    @property
    def message(self) -> str:
        return self.message_zh

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "symbol": self.symbol,
            "interval": self.interval,
            "status": self.status.value,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "message_zh": self.message_zh,
            "message_en": self.message_en,
            "collected_count": self.collected_count,
            "error_message": self.error_message,
        }


def create_task_message(zh: str, en: str) -> Tuple[str, str]:
    return zh, en


class TaskManager:
    def __init__(self, max_tasks: int = 1000):
        self._tasks: Dict[str, TaskInfo] = {}
        self._running_task_types: Dict[str, bool] = {}
        self._task_counter = 0
        self._max_tasks = max_tasks

    def _generate_task_id(self) -> str:
        self._task_counter += 1
        return f"task_{int(time.time() * 1000)}_{self._task_counter}"

    def _get_task_type(self, symbol: str, interval: str) -> str:
        return f"collect_{symbol.upper()}_{interval}"

    def _cleanup_old_tasks(self):
        if len(self._tasks) > self._max_tasks:
            completed_tasks = [
                (tid, t) for tid, t in self._tasks.items()
                if t.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.INTERRUPTED)
            ]
            completed_tasks.sort(key=lambda x: x[1].created_at)
            tasks_to_remove = len(self._tasks) - self._max_tasks
            for i in range(min(tasks_to_remove, len(completed_tasks))):
                task_id, _ = completed_tasks[i]
                del self._tasks[task_id]

    def is_task_running(self, symbol: str, interval: str) -> bool:
        task_type = self._get_task_type(symbol, interval)
        return self._running_task_types.get(task_type, False)

    def create_task(self, symbol: str, interval: str) -> Optional[TaskInfo]:
        task_type = self._get_task_type(symbol, interval)

        if self._running_task_types.get(task_type, False):
            return None

        self._cleanup_old_tasks()

        task_id = self._generate_task_id()
        task_info = TaskInfo(
            task_id=task_id,
            task_type=task_type,
            symbol=symbol.upper(),
            interval=interval,
            status=TaskStatus.PENDING,
            created_at=time.time(),
            message_zh="等待执行",
            message_en="Pending",
        )
        self._tasks[task_id] = task_info
        return task_info

    def start_task(self, task_id: str):
        task_info = self._tasks.get(task_id)
        if task_info and task_info.status == TaskStatus.PENDING:
            task_info.status = TaskStatus.RUNNING
            task_info.started_at = time.time()
            task_info.message_zh = "执行中"
            task_info.message_en = "Running"
            self._running_task_types[task_info.task_type] = True

    def complete_task(self, task_id: str, collected_count: int, message_zh: str = "", message_en: str = ""):
        task_info = self._tasks.get(task_id)
        if task_info and task_info.status == TaskStatus.RUNNING:
            task_info.status = TaskStatus.COMPLETED
            task_info.completed_at = time.time()
            task_info.collected_count = collected_count
            task_info.message_zh = message_zh or "已完成"
            task_info.message_en = message_en or "Completed"
            if task_info.task_type in self._running_task_types:
                del self._running_task_types[task_info.task_type]

    def fail_task(self, task_id: str, error_message: str):
        task_info = self._tasks.get(task_id)
        if task_info and task_info.status == TaskStatus.RUNNING:
            task_info.status = TaskStatus.FAILED
            task_info.completed_at = time.time()
            task_info.error_message = error_message
            task_info.message_zh = f"失败: {error_message}"
            task_info.message_en = f"Failed: {error_message}"
            if task_info.task_type in self._running_task_types:
                del self._running_task_types[task_info.task_type]

    def interrupt_task(self, task_id: str):
        task_info = self._tasks.get(task_id)
        if task_info and task_info.status == TaskStatus.RUNNING:
            task_info.status = TaskStatus.INTERRUPTED
            task_info.completed_at = time.time()
            task_info.message_zh = "任务被中断"
            task_info.message_en = "Task interrupted"
            if task_info.task_type in self._running_task_types:
                del self._running_task_types[task_info.task_type]

    def interrupt_all_tasks(self):
        for task_id, task_info in self._tasks.items():
            if task_info.status == TaskStatus.RUNNING:
                task_info.status = TaskStatus.INTERRUPTED
                task_info.completed_at = time.time()
                task_info.message_zh = "程序中断"
                task_info.message_en = "Application stopped"
        self._running_task_types.clear()

    def get_task(self, task_id: str) -> Optional[TaskInfo]:
        return self._tasks.get(task_id)

    def update_task_progress(self, task_id: str, collected_count: int, message_zh: str, message_en: str):
        task_info = self._tasks.get(task_id)
        if task_info and task_info.status == TaskStatus.RUNNING:
            task_info.collected_count = collected_count
            task_info.message_zh = message_zh
            task_info.message_en = message_en

    def is_task_running_by_id(self, task_id: str) -> bool:
        task_info = self._tasks.get(task_id)
        if task_info:
            return task_info.status == TaskStatus.RUNNING
        return False

    def get_all_tasks(self, symbol: Optional[str] = None, interval: Optional[str] = None) -> List[TaskInfo]:
        tasks = list(self._tasks.values())
        tasks.sort(key=lambda x: x.created_at, reverse=True)

        if symbol:
            tasks = [t for t in tasks if t.symbol == symbol.upper()]
        if interval:
            tasks = [t for t in tasks if t.interval == interval]

        return tasks[:100]

    def get_running_task_by_type(self, symbol: str, interval: str) -> Optional[TaskInfo]:
        task_type = self._get_task_type(symbol, interval)
        if self._running_task_types.get(task_type, False):
            for task_info in self._tasks.values():
                if task_info.task_type == task_type and task_info.status == TaskStatus.RUNNING:
                    return task_info
        return None


task_manager = TaskManager()
