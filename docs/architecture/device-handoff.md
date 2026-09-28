# NexaVoice Device Handoff Architecture

## Overview
Cross-Device Handoff allows authenticated users with multiple active sessions (e.g., Desktop and Mobile) to seamlessly move an active call from one device to another without dropping or restarting the media session.

## State Machine (`CallDeviceTransfer`)
```
REQUESTED -> AUTHENTICATING -> CONNECTING -> CONNECTED -> COMPLETED
                                                       -> FAILED
                                                       -> CANCELLED
```

## Workflow
1. User clicks "Handoff Call" on their desktop web client.
2. A list of active authenticated user devices (`targetDevices`) is presented, filtered to exclude the current device.
3. User selects target device (e.g. mobile app) and initiates handoff (`initiateDeviceTransfer`).
4. Server creates `CallDeviceTransfer` record (`REQUESTED`) and sends a high-priority push notification / Socket.IO event `call.device_transfer.started` to the target device.
5. The target device authenticates and requests connection (`CONNECTING`).
6. An inbound `CallLeg` is established for the target device (`CONNECTED`).
7. Once media flow on the target device is confirmed, the server marks the transfer `COMPLETED`, tears down the source device's `CallLeg` (`ENDED`), and emits `call.device_transfer.completed`.
8. The call session remains uninterrupted throughout the transition.
