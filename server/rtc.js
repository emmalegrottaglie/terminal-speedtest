// WebRTC side of the packet-loss test.
//
// The client opens two data channels:
//   "loss" — unordered, maxRetransmits 0 (UDP-like). Every packet is echoed back untouched.
//   "ctrl" — reliable, ordered. Carries JSON control messages ({ type: "stats" }).
//
// Packet layout (little-endian): [u8 flags][u32 seq][f64 client send time][padding...]
// flags bit 0 marks warm-up packets, which are echoed but not counted.
// Counting the packets that reach the server is what lets the client split
// loss into upload (client -> server) and download (server -> client).

import nodeDataChannel from 'node-datachannel';

const env = process.env;
const MAX_SESSIONS = Number(env.RTC_MAX_SESSIONS) || 32;
const SESSION_MS = 180_000;     // hard cap on a session's lifetime
const GATHER_MS = 5_000;        // ICE gathering deadline before answering
const MAX_TRACKED = 250_000;    // distinct sequence numbers counted per session
const FLAG_WARMUP = 1;

function rtcConfig() {
  const config = { iceServers: [] };
  // Lets a server behind NAT learn and advertise its public address, e.g. stun:stun.l.google.com:19302
  if (env.STUN_URL) config.iceServers.push(env.STUN_URL);
  // A single UDP port (muxed) is the easiest thing to forward through a NAT/firewall.
  if (env.RTC_PORT) {
    config.portRangeBegin = config.portRangeEnd = Number(env.RTC_PORT);
    config.enableIceUdpMux = true;
  } else if (env.RTC_PORT_MIN && env.RTC_PORT_MAX) {
    config.portRangeBegin = Number(env.RTC_PORT_MIN);
    config.portRangeEnd = Number(env.RTC_PORT_MAX);
  }
  if (env.RTC_BIND_ADDRESS) config.bindAddress = env.RTC_BIND_ADDRESS;
  return config;
}

const sessions = new Set();
let nextId = 1;

export function sessionCount() {
  return sessions.size;
}

export function createLossSession(offerSdp) {
  if (sessions.size >= MAX_SESSIONS) return Promise.reject(new Error('server busy, try again shortly'));

  const pc = new nodeDataChannel.PeerConnection(`loss-${nextId++}`, rtcConfig());
  const session = { pc, received: new Set(), closed: false };
  sessions.add(session);

  const close = () => {
    if (session.closed) return;
    session.closed = true;
    sessions.delete(session);
    clearTimeout(session.timer);
    try { pc.close(); } catch { /* already closed */ }
  };
  session.timer = setTimeout(close, SESSION_MS);

  pc.onStateChange((state) => {
    if (state === 'closed' || state === 'failed' || state === 'disconnected') close();
  });

  pc.onDataChannel((dc) => {
    const label = dc.getLabel();
    if (label === 'loss') {
      dc.onMessage((msg) => {
        if (typeof msg === 'string' || msg.length < 13) return;
        if (!(msg[0] & FLAG_WARMUP) && session.received.size < MAX_TRACKED) {
          session.received.add(msg.readUInt32LE(1));
        }
        dc.sendMessageBinary(msg);
      });
    } else if (label === 'ctrl') {
      dc.onMessage((msg) => {
        let req;
        try { req = JSON.parse(String(msg)); } catch { return; }
        if (req?.type === 'stats') {
          dc.sendMessage(JSON.stringify({ type: 'stats', received: session.received.size }));
        } else if (req?.type === 'bye') {
          close();
        }
      });
    } else {
      dc.close();
    }
  });

  return new Promise((resolve, reject) => {
    let done = false;
    const answer = () => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      const desc = pc.localDescription();
      if (!desc) { close(); reject(new Error('could not create answer')); return; }
      resolve({ type: desc.type, sdp: desc.sdp });
    };
    // Non-trickle signalling: answer once gathering completes (or the deadline passes),
    // so the SDP already carries every candidate.
    const deadline = setTimeout(answer, GATHER_MS);
    pc.onGatheringStateChange((state) => { if (state === 'complete') answer(); });
    try {
      pc.setRemoteDescription(offerSdp, 'offer');
    } catch (err) {
      done = true;
      clearTimeout(deadline);
      close();
      reject(new Error('invalid offer: ' + err.message));
    }
  });
}
