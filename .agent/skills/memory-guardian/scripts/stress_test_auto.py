#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Memory Stress Test (Auto) - 自动内存压力测试
无需交互，自动分配内存并保持运行
"""

import sys
import time
import gc

def main():
    target_gb = 7.0  # 分配 7GB 内存
    if len(sys.argv) > 1:
        try:
            target_gb = float(sys.argv[1])
        except ValueError:
            pass
    
    print(f"[Stress Test] 开始分配 {target_gb} GB 内存...")
    print(f"[Stress Test] Allocating {target_gb} GB memory...")
    
    chunks = []
    chunk_size = 100 * 1024 * 1024  # 100 MB
    num_chunks = int(target_gb * 10.24)
    
    for i in range(num_chunks):
        try:
            chunks.append(bytearray(chunk_size))
            print(f"  已分配 / Allocated: {(i+1) * 100} MB ({(i+1)*100/1024:.1f} GB)", end="\r")
            time.sleep(0.1)  # 慢慢分配，方便观察
        except MemoryError:
            print(f"\n  内存不足 / Out of memory")
            break
    
    actual_mb = len(chunks) * 100
    print(f"\n✅ 已分配 {actual_mb} MB ({actual_mb/1024:.1f} GB)")
    print("进程保持运行中... PID:", os.getpid() if 'os' in dir() else "N/A")
    print("Ctrl+C 或使用 cleanup.py 终止")
    
    import os
    print(f"PID: {os.getpid()}")
    
    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        print("\n释放内存...")
        del chunks
        gc.collect()

if __name__ == "__main__":
    import os
    main()
