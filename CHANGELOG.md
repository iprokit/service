# Changelog

## [1.5.0]

### Added

- SCP now supports buffers and strings, allowing correct encoding during transmission.
- SDP now detects service crashes through SCP heartbeats and updates pods accordingly.

## [1.4.1]

### Fixed

- Resolved URI decoding for path and query parameters.
- Now throws `INVALID_CONNECTION` when `RemoteService` is not connected and sub-functions are invoked.

## [1.4.0]

### Changed

- Renamed `Orchestrator` to `Coordinator`.
- Introduced a queue mechanism for the outgoing stream in the SCP server.

## [1.3.1]

### Improved

- Enhanced error handling for SCP client and server.

## [1.3.0]

### Added

- Connection pool to `RemoteService`.
- Migrated SCP & SDP repositories to native modules.

## [1.2.1]

### Improved

- General readability and minor code optimizations.

## [1.2.0]

### Removed

- HTTP proxy handler.

## [1.1.1]

### Changed

- Standardized formatting of HTTP headers.

## [1.1.0]

### Added

- Introduced `Router` and `Executor` as modular classes.
- Added `Remote` for enhanced service linking.
- Added `Orchestrator` and `Conductor` for coordinating signals across multiple services.

## [1.0.0]

### Initial

- First release of `Service`.
