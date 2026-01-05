#!/usr/bin/env python
"""Quick test of API endpoints"""
import asyncio
import aiohttp
import json

async def test_api():
    async with aiohttp.ClientSession() as session:
        endpoints = [
            ('GET', 'http://localhost:8000/api/call-reports'),
            ('GET', 'http://localhost:8000/api/call-reports/stats/overview'),
        ]
        
        for method, url in endpoints:
            try:
                async with session.get(url) as resp:
                    print(f'{method} {url.split("/")[-1] or "call-reports"}: {resp.status}')
                    if resp.status == 200:
                        data = await resp.json()
                        if 'total' in data:
                            print(f'  ✅ Success! Loaded {data.get("total", 0)} reports')
                        elif 'stats' in data:
                            print(f'  ✅ Success! Stats loaded')
                    else:
                        text = await resp.text()
                        print(f'  ❌ Error: {text[:200]}')
            except Exception as e:
                print(f'  ⚠️  {url.split("/")[-1]}: {type(e).__name__}: {str(e)[:100]}')

if __name__ == '__main__':
    asyncio.run(test_api())
