# Screenshots

Reference captures of every screen, taken on 2026-09-28 from the Android app (v0.2.1 plus the fixes in this folder's pull request). Device: Motorola Edge 50 Pro, 1220 × 2712, Android 16, system font scale about 115%. App settings: Broadcast 8s palette, broadcast accents, JetBrains Mono, CRT scanlines on, text size 110%.

Pages taller than the screen are stitched from several captures. During capture, the sticky header and bottom nav were unpinned and the CRT vignette was switched off so the joins stay clean; the scanlines stay on. Captures marked *screen* show exactly one phone screen.

All numbers are real measurements against a local server (`local-01`) on the same Wi-Fi network.

| File | What it shows |
|---|---|
| `01-test-idle.png` | Test screen before a run: last-run summary, phase toggles, run button |
| `02-test-running.png` | *Screen.* Full test in the download phase: live scope, per-second chart, progress bar and log tail |
| `03-test-result.png` | Full test result: hero speed, verdict, tiles, download and upload charts, stability band |
| `04-loss-idle.png` | Packet-loss screen before a run: run button, profiles and parameters |
| `05-loss-running.png` | *Screen.* Packet-loss test running (STRESS profile): live counters, packet map and latency chart |
| `06-loss-result.png` | Packet-loss result: loss split, latency statistics, packet map, latency chart, parameters used |
| `07-history.png` | History at 110% text: date over time, all seven columns fit the screen |
| `08-history-large-text.png` | History at 140% text: rows switch to the stacked two-line layout instead of scrolling sideways |
| `09-settings.png` | Settings: server list, speed-test parameters, palette, accents, typeface, screen and privacy |
| `10-clear-history-armed.png` | *Screen.* "Clear history" after the first tap: armed and waiting for the confirming second tap |
