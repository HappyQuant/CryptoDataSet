import asyncio
import time
from typing import Dict, Optional, List
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
    message: str = ""
    collected_count: int = 0
    error_message: Optional[str] = None
    
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
            "message": self.message,
            "collected_count": self.collected_count,
            "error_message": self.error_message,
        }


class TaskManager:
    def __init__(self):
        self._tasks: Dict[str, TaskInfo] = {}
        self._running_task_types: Dict[str, bool] = {}
        self._task_counter = 0
    
    def _generate_task_id(self) -> str:
        self._task_counter += 1
        return f"task_{int(time.time() * 1000)}_{self._task_counter}"
    
    def _get_task_type(self, symbol: str, interval: str) -> str:
        return f"collect_{symbol.upper()}_{interval}"
    
    def is_task_running(self, symbol: str, interval: str) -> bool:
        task_type = self._get_task_type(symbol, interval)
        return self._running_task_types.get(task_type, False)
    
    def create_task(self, symbol: str, interval: str) -> Optional[TaskInfo]:
        task_type = self._get_task_type(symbol, interval)
        
        if self._running_task_types.get(task_type, False):
            return None
        
        task_id = self._generate_task_id()
        task_info = TaskInfo(
            task_id=task_id,
            task_type=task_type,
            symbol=symbol.upper(),
            interval=interval,
            status=TaskStatus.PENDING,
            created_at=time.time(),
            message="等待执行",
        )
        self._tasks[task_id] = task_info
        return task_info
    
    def start_task(self, task_id: str):
        task_info = self._tasks.get(task_id)
        if task_info:
            task_info.status = TaskStatus.RUNNING
            task_info.started_at = time.time()
            task_info.message = "执行中"
            self._running_task_types[task_info.task_type] = True
    
    def complete_task(self, task_id: str, collected_count: int, message: str = ""):
        task_info = self._tasks.get(task_id)
        if task_info:
            task_info.status = TaskStatus.COMPLETED
            task_info.completed_at = time.time()
            task_info.collected_count = collected_count
            task_info.message = message or "已完成"
            if task_info.task_type in self._running_task_types:
                del self._running_task_types[task_info.task_type]
    
    def fail_task(self, task_id: str, error_message: str):
        task_info = self._tasks.get(task_id)
        if task_info:
            task_info.status = TaskStatus.FAILED
            task_info.completed_at = time.time()
            task_info.error_message = error_message
            task_info.message = f"失败: {error_message}"
            if task_info.task_type in self._running_task_types:
                del self._running_task_types[task_info.task_type]
    
    def interrupt_all_tasks(self):
        for task_id, task_info in self._tasks.items():
            if task_info.status == TaskStatus.RUNNING:
                task_info.status = TaskStatus.INTERRUPTED
                task_info.completed_at = time.time()
                task_info.message = "程序中断"
        self._running_task_types.clear()
    
    def get_task(self, task_id: str) -> Optional[TaskInfo]:
        return self._tasks.get(task_id)
    
    def update_task_progress(self, task_id: str, collected_count: int, message: str):
        task_info = self._tasks.get(task_id)
        if task_info:
            task_info.collected_count = collected_count
            task_info.message = message
    
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
        
        return tasks
    
    def get_running_task_by_type(self, symbol: str, interval: str) -> Optional[TaskInfo]:
        task_type = self._get_task_type(symbol, interval)
        if self._running_task_types.get(task_type, False):
            for task_info in self._tasks.values():
                if task_info.task_type == task_type and task_info.status == TaskStatus.RUNNING:
                    return task_info
        return None


task_manager = TaskManager()
