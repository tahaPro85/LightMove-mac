# backend/file_organizer_backend.py
import os
import shutil
from pathlib import Path
import json
import sys
import codecs
import time

# Ensure stdout uses UTF-8
if hasattr(sys.stdout, "buffer"):
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer)
if hasattr(sys.stderr, "buffer"):
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer)

# Fallback for humanize if not installed
try:
    import humanize

    def format_size(size):
        return humanize.naturalsize(size)

except ImportError:

    def format_size(size):
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"


# --- Core Logic with New Folder Structure ---
def orgenize_file(source, destination):
    """
    Organizes files from source to destination, copying them instead of moving.
    Sends progress and completion messages as JSON to stdout.
    """
    try:
        source_path = Path(source)
        dest_path = Path(destination)

        # Create main destination directories if they don't exist
        archive_path = dest_path / "1.Archive"
        select_path = dest_path / "2.Select"
        final_path = dest_path / "3.Final"
        others_path = dest_path / "4.Others" # Added a folder for unrecognized files

        # Create the main top-level folders
        if not dest_path.exists():
            dest_path.mkdir(parents=True)
        archive_path.mkdir(exist_ok=True)
        select_path.mkdir(exist_ok=True)
        final_path.mkdir(exist_ok=True)
        others_path.mkdir(exist_ok=True)

        # Create subfolders inside 'archive'
        (archive_path / "Raw").mkdir(exist_ok=True)
        (archive_path / "Video").mkdir(exist_ok=True)
        (archive_path / "JPG").mkdir(exist_ok=True)
        
        # Create subfolders inside 'final'
        (final_path / "top ten").mkdir(exist_ok=True)
        (final_path / "cart postal").mkdir(exist_ok=True)

        # File extension mappings for the new structure
        raw_formats = {".cr2", ".cr3", ".nef", ".arw", ".dng", ".raf", ".pef", ".orf", ".sr2", ".srf", ".rw2", ".3fr", ".erf", ".kdc", ".mef", ".mos", ".mrw"}
        jpg_formats = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".psd", ".ai"}
        video_formats = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".3gp"}

        # Get all files to be processed
        all_files = [f for f in source_path.iterdir() if f.is_file()]
        total_files = len(all_files)
        total_size = sum(f.stat().st_size for f in all_files)
        processed_size = 0
        processed_files_info = []

        send_status_message(f"Found {total_files} files to process. Total size: {format_size(total_size)}.")
        
        for i, file_path in enumerate(all_files):
            try:
                file_ext = file_path.suffix.lower()
                destination_folder = others_path # Default destination for unrecognized files

                if file_ext in raw_formats:
                    destination_folder = archive_path / "Raw"
                elif file_ext in jpg_formats:
                    destination_folder = archive_path / "JPG"
                elif file_ext in video_formats:
                    destination_folder = archive_path / "Video"
                
                # Copy the file instead of moving it
                destination_file_path = destination_folder / file_path.name
                shutil.copy2(str(file_path), str(destination_file_path))
                
                # Update progress
                file_size = file_path.stat().st_size
                processed_size += file_size
                
                # Store original and new paths, plus file size for the delete check
                processed_files_info.append(
                    {
                        "original_path": str(file_path),
                        "new_path": str(destination_file_path),
                        "size": file_size
                    }
                )

                # Send progress update to Electron
                progress = {
                    "type": "progress",
                    "total_size": total_size,
                    "processed_size": processed_size,
                    "current_file": file_path.name,
                    "progress_percent": (processed_size / total_size) * 100 if total_size > 0 else 0,
                    "human_total_size": format_size(total_size),
                    "human_processed_size": format_size(processed_size)
                }
                sys.stdout.write(json.dumps(progress) + "\n")
                sys.stdout.flush()

            except Exception as e:
                send_error_message(f"Failed to copy file {file_path.name}: {e}")
                
        # Send a final completion message
        send_complete_message(processed_files_info)
        
    except Exception as e:
        send_error_message(f"An unexpected error occurred during organization: {e}")
        sys.exit(1)


def delete_source_files(processed_files_json):
    """
    Deletes the source files after verifying the copy based on filename and size.
    """
    try:
        processed_files_info = json.loads(processed_files_json)
        total_files_to_delete = len(processed_files_info)
        deleted_count = 0
        
        send_delete_status_message(f"Found {total_files_to_delete} files to check and delete.")

        for i, file_info in enumerate(processed_files_info):
            original_path = Path(file_info["original_path"])
            new_path = Path(file_info["new_path"])
            original_size = file_info["size"]

            # Check if the file was successfully copied to the new location
            if new_path.exists():
                try:
                    new_size = new_path.stat().st_size
                    if new_size == original_size:
                        os.remove(original_path)
                        deleted_count += 1
                        send_delete_progress_message(f"Deleted successfully: {original_path.name}")
                    else:
                        send_delete_status_message(f"Skipped deletion for {original_path.name}: size mismatch.")
                except Exception as e:
                    send_delete_status_message(f"Skipped deletion for {original_path.name}: could not get new file size. Error: {e}")
            else:
                send_delete_status_message(f"Skipped deletion for {original_path.name}: destination file not found.")

        send_delete_complete_message(deleted_count)

    except Exception as e:
        send_error_message(f"An unexpected error occurred during deletion: {e}")
        sys.exit(1)


# Helper functions for sending JSON messages and main entry point (unchanged)
def send_status_message(message):
    sys.stdout.write(json.dumps({"type": "status", "message": message}) + "\n")
    sys.stdout.flush()

def send_progress_message(total, processed, current_file):
    sys.stdout.write(json.dumps({"type": "progress", "total_size": total, "processed_size": processed, "current_file": current_file}) + "\n")
    sys.stdout.flush()

def send_complete_message(processed_files_info):
    sys.stdout.write(json.dumps({"type": "complete", "message": "File organization complete!", "processedFilesInfo": processed_files_info}) + "\n")
    sys.stdout.flush()

def send_delete_status_message(message):
    sys.stdout.write(json.dumps({"type": "delete_status", "message": message}) + "\n")
    sys.stdout.flush()
    
def send_delete_progress_message(message):
    sys.stdout.write(json.dumps({"type": "delete_progress", "message": message}) + "\n")
    sys.stdout.flush()


def send_delete_complete_message(deleted_count):
    sys.stdout.write(json.dumps({"type": "delete_complete", "message": f"Successfully deleted {deleted_count} source files."}) + "\n")
    sys.stdout.flush()
    
def send_error_message(message):
    sys.stderr.write(json.dumps({"type": "error", "message": message}) + "\n")
    sys.stderr.flush()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write(
            json.dumps(
                {"type": "error", "message": "Usage: python script.py <organize|delete> [args]"}
            )
            + "\n"
        )
        sys.stderr.flush()
        sys.exit(1)

    action = sys.argv[1]

    if action == "organize":
        if len(sys.argv) != 4:
            sys.stderr.write(
                json.dumps(
                    {
                        "type": "error",
                        "message": "Usage for organize: python script.py organize <source_dir> <destination_dir>",
                    }
                )
                + "\n"
            )
            sys.stderr.flush()
            sys.exit(1)
        source_dir = sys.argv[2]
        destination_dir = sys.argv[3]
        orgenize_file(source_dir, destination_dir)
    elif action == "delete":
        if len(sys.argv) != 3:
            sys.stderr.write(
                json.dumps(
                    {
                        "type": "error",
                        "message": "Usage for delete: python script.py delete <processed_files_json>",
                    }
                )
                + "\n"
            )
            sys.stderr.flush()
            sys.exit(1)
        processed_files_json = sys.argv[2]
        delete_source_files(processed_files_json)
    else:
        sys.stderr.write(
            json.dumps(
                {
                    "type": "error",
                    "message": f"Unknown action: {action}. Please use 'organize' or 'delete'.",
                }
            )
            + "\n"
        )
        sys.stderr.flush()
        sys.exit(1)