; NSIS expands __FILEDIR__ in this file at include time. Capture it here so
; payload paths remain stable when the Tauri-generated script is compiled.
!define VIBEHUB_PAYLOAD_DIR "${__FILEDIR__}\payload"
