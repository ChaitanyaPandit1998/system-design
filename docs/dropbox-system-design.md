# DropBox System Design

This document outlines the architecture of a Dropbox-like file storage and sync system: a client with a local folder/DB, a gateway, a file service, a sync service, an event bus, and S3/DynamoDB for storage and metadata.

## Requirements Gathering

### Functional Requirements

- **Upload a file** — a user can upload a file from any device
- **Download / sync files** — a user's files stay in sync across all of their devices
- **Detect and propagate changes** — a change made on one device (or by another collaborator) is detected and pushed to the user's other devices
- **Support large files** — large files upload/download efficiently without routing their bytes through the application servers

### Non-Functional Requirements

- **High availability** — sync should keep making progress even if one device/peer is temporarily offline
- **Eventual consistency** — devices converge to the same state without silent data loss, even if they don't see changes at the exact same instant
- **Low latency for metadata/sync calls** — checking "what changed" should be fast, independent of file size
- **Scalability** — support a large number of users, each with a large number of files and devices

## Architecture Diagram

```
Client ──(direct, via presigned URL)──► S3
  │
  ▼
Gateway (auth, rate limiting, load balancing)
  │
  ├──► File Service ──► S3 (presigned URL) / DynamoDB (file metadata)
  │
  └──► Sync Service ⇄ Event Bus ⇄ File Service
```

### Key Components

| Component | Responsibility |
|-----------|-----------------|
| **Client** | End-user device; keeps a local DB + local folder, talks to the gateway, and uploads/downloads file bytes directly to/from S3 |
| **Gateway** | Entry point for API calls — authentication, rate limiting, load balancing, routing to File/Sync services |
| **File Service** | Handles `uploadFile()` / `getFile(fileId)`, issues presigned URLs for direct S3 access, writes file metadata |
| **Sync Service** | Handles `getChanges()` for clients polling/pulling updates; publishes/consumes change events on the event bus |
| **Event Bus** | Propagates file-change events so the File Service (and other consumers) learn about changes made elsewhere |
| **S3** | Object storage for the actual file bytes |
| **DynamoDB** | Stores file metadata (owner, version, S3 location, etc.) |

## Key Data Flows

### Upload Flow

1. Client calls the Gateway, which routes to the File Service
2. File Service requests a presigned URL from S3 and returns it to the client
3. Client uploads the file bytes **directly to S3**, bypassing the gateway and application servers
4. File Service writes the resulting file metadata to DynamoDB

### Sync Flow

1. A device's change (upload, edit, delete) is written to DynamoDB and published on the Event Bus
2. The event bus notifies the File Service / Sync Service of the change
3. Other clients call `getChanges()` on the Sync Service (via the Gateway) to learn what changed
4. Clients that are behind fetch the updated files directly from S3 using a fresh presigned URL

## Key Design Decisions

1. **Presigned URLs** — clients upload/download directly to/from S3, keeping large file transfers off the application tier
2. **Separate File vs. Sync services** — read/write of a single file and "what changed" queries scale differently and are split into their own services
3. **Event-driven change propagation** — the event bus decouples "a file changed" from "who needs to know," so consumers can be added without changing the writer
4. **Metadata in DynamoDB, bytes in S3** — metadata lookups stay fast (KB-sized reads) and independent of file size (GB-sized objects)
