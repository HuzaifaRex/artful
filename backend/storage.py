"""Cloudinary-backed object storage helper for ARTFUL."""
import io
import os
from pathlib import PurePosixPath

import cloudinary
import cloudinary.uploader
from cloudinary import CloudinaryImage
import httpx

APP_NAME = "artful"


def _require_config():
    cloud_name = (os.environ.get("CLOUDINARY_CLOUD_NAME") or "").strip()
    api_key = (os.environ.get("CLOUDINARY_API_KEY") or "").strip()
    api_secret = (os.environ.get("CLOUDINARY_API_SECRET") or "").strip()

    missing = [
        name
        for name, value in (
            ("CLOUDINARY_CLOUD_NAME", cloud_name),
            ("CLOUDINARY_API_KEY", api_key),
            ("CLOUDINARY_API_SECRET", api_secret),
        )
        if not value
    ]

    if missing:
        raise RuntimeError(
            "Missing Cloudinary environment variables: "
            + ", ".join(missing)
        )

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )


def init_storage(force: bool = False):
    """Validate Cloudinary configuration.

    Kept with the old function name so existing startup code
    does not need to change.
    """
    _require_config()
    return True


def _public_id(path: str) -> str:
    clean = path.replace("\\", "/").lstrip("/")

    # Cloudinary image public IDs should not contain file extensions.
    suffix = PurePosixPath(clean).suffix

    if suffix:
        return clean[:-len(suffix)]

    return clean


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload an image to Cloudinary while preserving the old storage interface."""
    _require_config()

    public_id = _public_id(path)

    stream = io.BytesIO(data)
    stream.name = os.path.basename(path) or "upload"

    result = cloudinary.uploader.upload(
        stream,
        public_id=public_id,
        resource_type="image",
        overwrite=False,
        unique_filename=False,
        use_filename=False,
    )

    return {
        "path": public_id,
        "url": result.get("secure_url"),
        "size": int(result.get("bytes") or len(data)),
        "content_type": content_type,
        "public_id": result.get("public_id", public_id),
    }


def get_object(path: str):
    """Fetch an uploaded image from Cloudinary.

    This keeps the existing /api/uploads/... endpoint working.
    """
    _require_config()

    public_id = _public_id(path)
    url = CloudinaryImage(public_id).build_url(secure=True)

    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        resp = client.get(url)

    if resp.status_code != 200:
        raise RuntimeError(
            f"Cloudinary returned HTTP {resp.status_code}"
        )

    return (
        resp.content,
        resp.headers.get("Content-Type", "application/octet-stream"),
    )