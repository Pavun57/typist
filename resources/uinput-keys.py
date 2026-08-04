#!/usr/bin/env python3
"""Minimal uinput key injector for Typist — no external dependencies.

Creates a short-lived virtual keyboard on /dev/uinput and emits key events,
ydotool-style: each argument is "<evdev_code>:<pressed>" where pressed is
1 (down), 0 (up), or 2 (repeat). Example for Enter:  uinput-keys.py 28:1 28:0

Why this exists: distro ydotoold packages (0.1.x) create a virtual device
that some compositors mis-map (an injected Enter lands as stray digits),
and wtype's temporary-keymap injection has the same problem on KWin. This
script's device is created fresh with exactly the key bits we need.
"""

import fcntl
import os
import struct
import sys
import time

UI_SET_EVBIT = 0x40045564
UI_SET_KEYBIT = 0x40045565
UI_DEV_SETUP = 0x405C5503
UI_DEV_CREATE = 0x5501
UI_DEV_DESTROY = 0x5502

EV_SYN = 0x00
EV_KEY = 0x01
SYN_REPORT = 0

BUS_USB = 0x03


def emit(f, ev_type, code, value):
    # struct input_event { time(16) ; u16 type ; u16 code ; s32 value }
    f.write(struct.pack("llHHI", 0, 0, ev_type, code, value))
    f.flush()


def main():
    seq = []
    for arg in sys.argv[1:]:
        code, _, state = arg.partition(":")
        seq.append((int(code), int(state or "1")))
    if not seq:
        return

    fd = os.open("/dev/uinput", os.O_WRONLY | os.O_NONBLOCK)
    f = os.fdopen(fd, "wb")
    try:
        fcntl.ioctl(fd, UI_SET_EVBIT, EV_KEY)
        for code, _ in seq:
            fcntl.ioctl(fd, UI_SET_KEYBIT, code)

        # struct uinput_setup { input_id(HHHH) ; name[80] ; ff_effects_max(I) }
        setup = bytearray(
            struct.pack("HHHH80sI", BUS_USB, 0x1D6B, 0x0001, 1, b"typist-keys".ljust(80, b"\0"), 0)
        )
        fcntl.ioctl(fd, UI_DEV_SETUP, setup, True)
        fcntl.ioctl(fd, UI_DEV_CREATE)

        # The compositor ignores events from a device it hasn't registered yet.
        time.sleep(0.35)

        def syn():
            emit(f, EV_SYN, SYN_REPORT, 0)

        for code, state in seq:
            emit(f, EV_KEY, code, state)
            syn()
            time.sleep(0.012)

        time.sleep(0.05)
        fcntl.ioctl(fd, UI_DEV_DESTROY)
    finally:
        f.close()


if __name__ == "__main__":
    main()
