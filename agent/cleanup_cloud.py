import asyncio
import os
from dotenv import load_dotenv
from livekit import api

load_dotenv()

async def cleanup():
    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    
    print(f"Connecting to LiveKit Cloud: {url}")
    
    # Use LiveKitAPI to manage rooms
    # Converting wss:// to https:// for the API client if needed
    http_url = url.replace("wss://", "https://")
    
    async with api.LiveKitAPI(http_url, api_key, api_secret) as lk_api:
        # 1. List all rooms
        print("Fetching rooms...")
        rooms_res = await lk_api.room.list_rooms(api.ListRoomsRequest())
        
        if not rooms_res.rooms:
            print("No active rooms found. Cloud is already clean!")
            return

        print(f"Found {len(rooms_res.rooms)} rooms. Starting cleanup...")
        
        # 2. Delete each room
        for room in rooms_res.rooms:
            try:
                print(f"Deleting room: {room.name}...")
                await lk_api.room.delete_room(api.DeleteRoomRequest(room=room.name))
                print(f"Successfully deleted {room.name}")
            except Exception as e:
                print(f"Failed to delete {room.name}: {e}")

    print("Cleanup complete! All 'ghost' participants should now be gone.")

if __name__ == "__main__":
    asyncio.run(cleanup())
